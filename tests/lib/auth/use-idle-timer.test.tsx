/**
 * Sprint X.9 (2026-05-11) — useIdleTimer hook tests.
 *
 * Mocks the activity events + tick polling via Vitest's fake timers.
 * Verifies:
 *   - onIdle fires after the idle budget elapses
 *   - User activity resets the timer
 *   - onWarn fires at warnMs before onIdle
 *   - onWarn fires AT MOST ONCE per warn window (no spam)
 */

import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { useIdleTimer } from "@/lib/auth/use-idle-timer";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useIdleTimer (X.9)", () => {
  test("fires onIdle after the idle budget elapses", () => {
    const onIdle = vi.fn();
    renderHook(() =>
      useIdleTimer({
        idleMs: 60_000,    // 1 minute
        warnMs: 0,         // disable warn for this case
        onIdle,
      }),
    );

    // Advance just under the limit — nothing fires.
    act(() => {
      vi.advanceTimersByTime(45_000);
    });
    expect(onIdle).not.toHaveBeenCalled();

    // Cross the threshold — onIdle fires.
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(onIdle).toHaveBeenCalled();
  });

  test("user activity resets the timer", () => {
    const onIdle = vi.fn();
    renderHook(() =>
      useIdleTimer({
        idleMs: 60_000,
        warnMs: 0,
        onIdle,
      }),
    );

    // Halfway through, simulate a keydown — resets the counter.
    act(() => {
      vi.advanceTimersByTime(40_000);
    });
    act(() => {
      document.dispatchEvent(new Event("keydown"));
    });

    // Advance ANOTHER 40s. Without the reset we'd be at 80s > 60s.
    // With the reset we're at 40s < 60s — no idle yet.
    act(() => {
      vi.advanceTimersByTime(40_000);
    });
    expect(onIdle).not.toHaveBeenCalled();

    // Push past the 60s-from-reset point. The polling interval is
    // 30s, so the next poll after t=80 fires at t=120; that's when
    // idleFor crosses 60s (120 - 40 = 80 ≥ 60). Advance 50s to
    // ensure the poll fires.
    act(() => {
      vi.advanceTimersByTime(50_000);
    });
    expect(onIdle).toHaveBeenCalled();
  });

  test("fires onWarn at warnMs before onIdle", () => {
    const onWarn = vi.fn();
    const onIdle = vi.fn();
    renderHook(() =>
      useIdleTimer({
        idleMs: 120_000,    // 2 min total
        warnMs: 30_000,     // warn at 1:30 into idle
        onWarn,
        onIdle,
      }),
    );

    // 60s in — neither fired.
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(onWarn).not.toHaveBeenCalled();
    expect(onIdle).not.toHaveBeenCalled();

    // 90s in — past warn threshold (120-30=90); onWarn fires.
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(onWarn).toHaveBeenCalled();
    expect(onIdle).not.toHaveBeenCalled();

    // 120s+ — onIdle fires.
    act(() => {
      vi.advanceTimersByTime(31_000);
    });
    expect(onIdle).toHaveBeenCalled();
  });

  test("onWarn fires only once per warn window", () => {
    const onWarn = vi.fn();
    const onIdle = vi.fn();
    renderHook(() =>
      useIdleTimer({
        idleMs: 120_000,
        warnMs: 30_000,
        onWarn,
        onIdle,
      }),
    );

    // Cross into the warn window
    act(() => {
      vi.advanceTimersByTime(95_000);
    });
    expect(onWarn).toHaveBeenCalledTimes(1);

    // Advance more (still in warn window, not yet idle) — no spam.
    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(onWarn).toHaveBeenCalledTimes(1);
  });

  test("visibilitychange while hidden does NOT reset", () => {
    const onIdle = vi.fn();
    renderHook(() =>
      useIdleTimer({
        idleMs: 60_000,
        warnMs: 0,
        onIdle,
      }),
    );

    // Simulate the user tabbing away. document.visibilityState is
    // jsdom's "visible" by default; force "hidden" so the bumpActivity
    // path short-circuits.
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });

    act(() => {
      vi.advanceTimersByTime(40_000);
      document.dispatchEvent(new Event("visibilitychange"));
      vi.advanceTimersByTime(30_000); // past 60s total
    });

    expect(onIdle).toHaveBeenCalled();
  });
});
