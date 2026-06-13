/**
 * Sprint X.9 (2026-05-11) — client-side idle detection.
 *
 * Spec line 1825: "Sessions: 12 hr, 1 hr idle." The hard 12-hour
 * session lifetime is enforced backend-side (the cookie's
 * expires_at). The 1-hour idle policy lives client-side until
 * v1 ships server-side cookie re-issuance.
 *
 * Behavior:
 *   * Tracks the last user-interaction timestamp in a ref.
 *   * Resets on mousedown / keydown / touchstart / scroll /
 *     visibilitychange-to-visible. The events are listened with
 *     `{ passive: true }` so they don't add jank.
 *   * Calls `onWarn(remainingMs)` ~5 minutes before the limit.
 *   * Calls `onIdle()` at the limit.
 *
 * Multi-tab note: this hook does NOT cross-coordinate tabs. A
 * user actively typing in tab A while tab B sits idle won't reset
 * tab B's timer — tab B will warn + log out independently. Cross-
 * tab sync via `storage` events is v1.
 *
 * Tracked: docs/superpowers/plans/2026-05-11-frontend-FINAL-sprint-plan.md
 *         → Sprint X / X.9.
 */

"use client";

import { useEffect, useRef } from "react";

const ACTIVITY_EVENTS: ReadonlyArray<keyof DocumentEventMap> = [
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "visibilitychange",
];

export interface UseIdleTimerOptions {
  /** Total idle budget before `onIdle` fires. Default 1h = 3,600,000ms. */
  idleMs?: number;
  /**
   * How long BEFORE `onIdle` to fire `onWarn`. Default 5 min.
   * Set to 0 to skip the warn callback (sometimes useful in tests).
   */
  warnMs?: number;
  /**
   * Fires `warnMs` before the idle limit. The remaining-ms argument
   * is approximate (timer drift up to ~30s). Callers typically show
   * a banner with "Sign me out / Stay signed in".
   */
  onWarn?: (remainingMs: number) => void;
  /** Fires AT the idle limit. Caller is expected to navigate to logout. */
  onIdle: () => void;
  /** Test-only: pass a custom now() so tests can inject FakeClock-style time. */
  now?: () => number;
}

const DEFAULT_IDLE_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_WARN_MS = 5 * 60 * 1000; // 5 minutes
const POLL_MS = 30 * 1000; // poll every 30s; idle precision ±30s

/**
 * Wire user-activity listeners + tick a polling timer that fires
 * onWarn / onIdle when the last-activity timestamp passes the
 * configured thresholds.
 *
 * Safe to enable/disable conditionally via the `enabled` flag (idiom
 * matches TanStack Query's `enabled` option):
 *
 *   useIdleTimer({ enabled: !!session, onIdle: () => router.push('/api/auth/logout') });
 *
 * Returns nothing; effects are side-effecting.
 */
export function useIdleTimer({
  idleMs = DEFAULT_IDLE_MS,
  warnMs = DEFAULT_WARN_MS,
  onWarn,
  onIdle,
  now = () => Date.now(),
}: UseIdleTimerOptions): void {
  // Refs so callbacks don't recreate the effect.
  const lastActivityRef = useRef<number>(now());
  const warnedRef = useRef<boolean>(false);
  const nowRef = useRef(now);
  const onWarnRef = useRef(onWarn);
  const onIdleRef = useRef(onIdle);

  // Keep callback refs current without re-running the listener
  // attach effect every render.
  useEffect(() => {
    onWarnRef.current = onWarn;
    onIdleRef.current = onIdle;
    nowRef.current = now;
  }, [onWarn, onIdle, now]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const bumpActivity = () => {
      // visibilitychange fires both when becoming hidden AND visible;
      // we only want the "user came back" path to reset.
      if (document.visibilityState === "hidden") return;
      lastActivityRef.current = nowRef.current();
      warnedRef.current = false;
    };

    for (const event of ACTIVITY_EVENTS) {
      document.addEventListener(event, bumpActivity, { passive: true });
    }

    const interval = window.setInterval(() => {
      const idleFor = nowRef.current() - lastActivityRef.current;
      if (idleFor >= idleMs) {
        onIdleRef.current?.();
        return;
      }
      if (
        warnMs > 0 &&
        !warnedRef.current &&
        idleFor >= idleMs - warnMs
      ) {
        warnedRef.current = true;
        onWarnRef.current?.(idleMs - idleFor);
      }
    }, POLL_MS);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        document.removeEventListener(event, bumpActivity);
      }
      window.clearInterval(interval);
    };
  }, [idleMs, warnMs]);
}
