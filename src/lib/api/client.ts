/**
 * Typed admin-API client — Sprint X.1 (2026-05-11).
 *
 * Single source of truth for every fetch the admin console makes
 * against the backend. Built on `openapi-fetch`, which consumes the
 * generated `paths` interface from `./generated/contracts.ts` and
 * gives us:
 *
 *   * String-literal-union typed paths. `client.GET("/api/admin/dashbord")`
 *     (typo) fails TypeScript at compile time — the path is not in
 *     the union of OpenAPI paths.
 *   * Typed path params. `client.GET("/api/admin/reviews/{review_id}",
 *     { params: { path: { review_id } } })` — both keys are typed
 *     against the OpenAPI spec.
 *   * Typed response bodies. `result.data` is the success-schema
 *     model; `result.error` is the union of declared error schemas.
 *
 * Sprint X.1 closes finding-classes 9-12 (path drift), 31 (no
 * path-correctness gate), 38 (hand-rolled types that mask missing
 * backend routes), 39 (~700 LoC of hand-written URL strings), and
 * 55 (CSRF-header inclusion not test-asserted) by making them
 * impossible-by-construction: there are no hand-rolled URL strings
 * to drift, and the CSRF header is included by one shared helper.
 *
 * Migration plan: each `frontend/src/lib/api/*.ts` file is rewritten
 * one at a time to use this client. The first one done in X.1 is
 * `status.ts` (canonical example). The other five (admin, knowledge,
 * cost-caps, bedrock-config, review-timeline) follow in subsequent
 * commits; each rewrite is mechanical and behavior-preserving.
 *
 * Endpoints not yet in backend (audit findings 9-12: /dashboard,
 * /reviews, /reviews/{id}, /telemetry/fe-events) stay in
 * `src/lib/api/pending.ts` with hand-rolled types until Sprint X.3
 * ships the backend routes. Once they land, `make codegen`
 * picks them up and the imports flip from `pending.ts` to the
 * generated client.
 *
 * Tracked: docs/superpowers/plans/2026-05-11-frontend-FINAL-sprint-plan.md
 *         → Sprint X / X.1.
 */

import createClient, { type Middleware } from "openapi-fetch";

import type { paths } from "./generated/contracts";

// ── CSRF helper ────────────────────────────────────────────────────

/**
 * Read the `csrf_token` cookie value the CSRF middleware sets on
 * every safe-method response. The cookie is JS-readable
 * (HttpOnly=false) so SPA fetches mirror it back via the
 * `X-CSRF-Token` header on unsafe methods.
 *
 * Returns `null` when the cookie is absent (e.g., first-load
 * mutation before any GET has primed the cookie). Sprint X.5's
 * preflight ensures the cookie exists before any mutation runs.
 */
export function readCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(/;\s*/)
    .map((p) => p.split("=", 2))
    .find(([k]) => k === "csrf_token");
  return match ? decodeURIComponent(match[1] ?? "") : null;
}

// ── Middleware: attach CSRF + Accept header to every request ──────

const csrfMiddleware: Middleware = {
  async onRequest({ request }) {
    // Attach the CSRF token on unsafe methods. The middleware on
    // the backend enforces the double-submit comparison only on
    // POST/PUT/PATCH/DELETE; harmless to attach on safe methods.
    const csrf = readCsrfToken();
    if (csrf !== null) {
      request.headers.set("X-CSRF-Token", csrf);
    }
    if (!request.headers.has("Accept")) {
      request.headers.set("Accept", "application/json");
    }
    return request;
  },
};

// ── Client instance ───────────────────────────────────────────────

/**
 * The shared typed client. Same-origin baseURL — Next.js route
 * handlers proxy `/api/admin/*` + `/api/telemetry/*` to the backend;
 * `/api/auth/*` paths are served by explicit Next.js route handlers.
 * So an empty baseURL routes every call through the user's browser
 * origin (cookies attach automatically).
 */
/**
 * openapi-fetch builds requests via `new URL(path, baseUrl)`. An
 * empty baseUrl throws on a relative path because the URL spec
 * requires an absolute base when the input is relative.
 *
 * We use a placeholder host that's syntactically valid but
 * recognizable, then strip it back to a relative path inside the
 * custom fetch wrapper. The result is:
 *
 *   `client.GET("/api/admin/...")` → fetch is called with the path
 *   alone, "/api/admin/...", which routes same-origin in the
 *   browser and matches every existing `vi.spyOn` test mock that
 *   does `url.endsWith("/api/admin/...")`.
 */
const PLACEHOLDER_BASE = "http://_codemaster_admin_placeholder";

export const apiClient = createClient<paths>({
  baseUrl: PLACEHOLDER_BASE,
  credentials: "include",
  // Custom fetch wrapper. Three jobs:
  //
  // 1. Strip the placeholder host so the actual fetch is
  //    same-origin in the browser AND matches existing test
  //    mock URL-suffix checks.
  //
  // 2. Resolve `globalThis.fetch` at CALL time, not module-load
  //    time. openapi-fetch's default captures `globalThis.fetch`
  //    when createClient runs, which breaks vitest's
  //    `vi.spyOn(globalThis, "fetch")` pattern.
  //
  // 3. Call `globalThis.fetch(url-string, init)` — pass the URL
  //    as a string, NOT the Request object. Existing test mocks
  //    do `String(input)` and would see "[object Request]".
  fetch: (request) => {
    const url = new URL(request.url);
    const sameOriginPath = url.pathname + url.search;
    const hasBody =
      request.method !== "GET" &&
      request.method !== "HEAD" &&
      request.body !== null;
    // Build the RequestInit conditionally so `body` is OMITTED on
    // safe methods rather than set to `undefined`. The tsconfig has
    // `exactOptionalPropertyTypes: true`, which rejects an explicit
    // `body: undefined`.
    const init: RequestInit = {
      method: request.method,
      headers: request.headers,
      credentials: request.credentials,
      signal: request.signal,
    };
    if (hasBody && request.body !== null) {
      init.body = request.body;
    }
    return globalThis.fetch(sameOriginPath, init);
  },
});

apiClient.use(csrfMiddleware);

// ── Error class — shared across all callsites ─────────────────────

/**
 * Typed error thrown by the typed-fetch wrappers when a request
 * resolves with a non-2xx status. Preserves the existing
 * `AdminApiError` shape so page code that catches it (every page's
 * `useAdminQueryGuards` consumer) keeps working.
 */
export class AdminApiError extends Error {
  readonly status: number;
  readonly endpoint: string;
  readonly body: unknown;

  constructor(
    message: string,
    status: number,
    endpoint: string,
    body: unknown = null,
  ) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.endpoint = endpoint;
    this.body = body;
  }
}

// ── Lifetime-of-page request timeout ──────────────────────────────

/** Default per-call timeout. TanStack Query layers its own 15s. */
export const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Tag a fetch result with a structured `AdminApiError` when the
 * response status is non-2xx. Used by every typed-fetch wrapper in
 * `lib/api/*.ts`.
 *
 * The status-code → error-name mapping matches the existing
 * `AdminApiError` strings so page-level branching (`error.status
 * === 401`) keeps working.
 */
export function asAdminApiError(
  status: number,
  endpoint: string,
  body: unknown,
): AdminApiError {
  if (status === 401) {
    return new AdminApiError("unauthenticated", 401, endpoint, body);
  }
  if (status === 403) {
    return new AdminApiError("forbidden", 403, endpoint, body);
  }
  return new AdminApiError(
    `admin api ${endpoint} returned ${status}`,
    status,
    endpoint,
    body,
  );
}
