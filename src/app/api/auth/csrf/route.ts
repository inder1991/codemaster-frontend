/**
 * Sprint X.5b (2026-05-11) — Next.js proxy for GET /api/auth/csrf.
 *
 * Forwards to the backend's CSRF preflight endpoint. The backend's
 * response carries both:
 *   * `Set-Cookie: csrf_token=...; SameSite=Lax` (the cookie the
 *     middleware sets on every non-exempt response — the double-
 *     submit pattern's first half)
 *   * `{ "token": "<hex>" }` in the body (so the Client Component
 *     can read the value without parsing document.cookie)
 *
 * This route is NOT bundled with the `/api/admin/*` rewrite in
 * `next.config.ts` because, like the other `/api/auth/*` handlers,
 * it forwards the upstream Set-Cookie headers explicitly so the
 * cookie attaches to the browser at the Next.js origin (not the
 * upstream backend origin).
 *
 * Tracked: docs/superpowers/plans/2026-05-11-frontend-FINAL-sprint-plan.md
 *         → Sprint X / X.5.
 */

import { NextRequest, NextResponse } from "next/server";

import {
  authForwardHeaders,
  backendUnavailable,
  fetchAuthUpstream,
  proxyAuthTextResponse,
} from "../_upstream";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const upstream = await fetchAuthUpstream({
      path: "/api/auth/csrf",
      method: "GET",
      headers: authForwardHeaders(request, {
        Accept: "application/json",
      }),
    });
    return proxyAuthTextResponse(upstream);
  } catch {
    return backendUnavailable();
  }
}
