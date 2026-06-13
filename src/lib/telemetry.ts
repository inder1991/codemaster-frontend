/**
 * Sprint 16 / S16.F.5 — frontend telemetry binding.
 *
 * Optional frontend telemetry binding. Disabled by default because
 * not every compatible backend exposes a frontend-event collector.
 * Set NEXT_PUBLIC_FRONTEND_TELEMETRY_ENABLED=true to enable it.
 *
 * Two signals can be piped to the backend's OTel collector:
 *
 *   1. Page-load timing — Web Vitals (LCP / FCP / CLS / FID /
 *      TTFB) reported via `web-vitals` library OR a minimal
 *      Performance API fallback when the package isn't bundled.
 *      Currently uses the Performance API directly so we don't
 *      add a new FE dependency for this one PR.
 *
 *   2. Mutation timing — `timedFetch(label, fn)` wraps any
 *      async fetch with a high-resolution timer, reports the
 *      duration tagged by `label`. Used by admin-page mutations
 *      (PUT flag, POST integration, approve/reject proposal).
 *
 * Backend route when enabled: `POST /api/telemetry/fe-events`.
 *
 * Failure mode: telemetry collector down → measurements dropped
 * silently. NEVER block the user-facing path on telemetry. Per
 * the spec's failure-mode AC ("fail-open").
 *
 * Initialization: call `initTelemetry()` once at app mount (the
 * `(authed)/layout.tsx` is the canonical site). It's safe to
 * call multiple times — the Performance Observer registers
 * idempotently.
 */

const TELEMETRY_ENDPOINT = "/api/telemetry/fe-events";
const TELEMETRY_ENABLED =
  process.env.NEXT_PUBLIC_FRONTEND_TELEMETRY_ENABLED === "true";

type TelemetryEvent =
  | {
      kind: "page_load";
      url: string;
      lcp_ms: number | null;
      fcp_ms: number | null;
      ttfb_ms: number | null;
      occurred_at: string;
    }
  | {
      kind: "mutation_latency";
      label: string;
      duration_ms: number;
      ok: boolean;
      occurred_at: string;
    };

let _initialized = false;

/**
 * Wire up page-load metrics. Idempotent — calling twice is a
 * no-op. Safe to call from any component's mount effect; the
 * canonical site is `(authed)/layout.tsx`.
 */
export function initTelemetry(): void {
  if (_initialized) return;
  if (!TELEMETRY_ENABLED) return;
  _initialized = true;
  if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") {
    // SSR or unsupported browser — bail.
    return;
  }

  // Page-load metrics: harvest after the page has fully loaded.
  // Using a `load` event listener rather than a `requestIdleCallback`
  // so we capture LCP before the user interacts.
  const harvest = () => {
    try {
      const nav = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;
      const paint = performance.getEntriesByType("paint");
      const fcpEntry = paint.find((p) => p.name === "first-contentful-paint");

      // LCP requires PerformanceObserver — capture the latest.
      let lcp_ms: number | null = null;
      try {
        const po = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1];
          if (last !== undefined) {
            lcp_ms = last.startTime;
          }
        });
        po.observe({ type: "largest-contentful-paint", buffered: true });
      } catch {
        // Browser doesn't support LCP observer; leave null.
      }

      // Defer the actual report until the next tick so LCP has
      // a chance to populate from the buffered entries.
      setTimeout(() => {
        emit({
          kind: "page_load",
          url: window.location.pathname,
          lcp_ms,
          fcp_ms: fcpEntry ? fcpEntry.startTime : null,
          ttfb_ms: nav ? nav.responseStart - nav.requestStart : null,
          occurred_at: new Date().toISOString(),
        });
      }, 0);
    } catch {
      // Anything throws → silently drop (fail-open).
    }
  };

  if (document.readyState === "complete") {
    harvest();
  } else {
    window.addEventListener("load", harvest, { once: true });
  }
}

/**
 * Wrap an async fetch (or any Promise-returning operation) with
 * a high-resolution timer. Reports the duration to the backend
 * tagged by `label`. The wrapped function's return value AND
 * thrown errors propagate normally — telemetry never changes
 * the caller's contract.
 *
 *   const learning = await timedFetch(
 *     "PUT /api/admin/knowledge/{id}",
 *     () => updateLearningBody(args),
 *   );
 *
 * Use a low-cardinality `label` (the URL pattern, NOT the
 * substituted URL) — high-cardinality labels explode Grafana.
 */
export async function timedFetch<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = performance.now();
  let ok = true;
  try {
    const result = await fn();
    return result;
  } catch (err) {
    ok = false;
    throw err;
  } finally {
    const duration_ms = performance.now() - start;
    emit({
      kind: "mutation_latency",
      label,
      duration_ms,
      ok,
      occurred_at: new Date().toISOString(),
    });
  }
}

/**
 * Send a telemetry event to the backend. Fail-open: if the
 * fetch fails (collector down, network blip), drop silently.
 *
 * Internal function; tests can spy on `globalThis.fetch` to assert
 * the default disabled behavior and fail-open contract.
 */
function emit(event: TelemetryEvent): void {
  if (!TELEMETRY_ENABLED) return;
  if (typeof window === "undefined") return;
  try {
    // `keepalive: true` lets the request survive a page
    // navigation (useful for `page_load` events emitted just
    // before the user clicks a link).
    void fetch(TELEMETRY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      credentials: "include",
      keepalive: true,
    }).catch(() => {
      // Swallow — fail-open per the spec.
    });
  } catch {
    // Synchronous throw (e.g., URL malformed) → also swallow.
  }
}

/**
 * Test-only: reset the initialization flag. Vitest doesn't
 * tear down module state between tests, so a global init flag
 * needs an explicit reset hook.
 */
export function _resetForTesting(): void {
  _initialized = false;
}
