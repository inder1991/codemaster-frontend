/**
 * Sprint 14 / S14.A — Next.js Route Handler proxying to the FastAPI
 * backend's POST /api/auth/login.
 *
 * Sprint X.2 (2026-05-11) — simplified to a thin forwarder now that
 * the login page is a Client Component (frontend/src/app/login/page.tsx)
 * posting JSON with X-CSRF-Token directly. The form-encoded reshape
 * + 303 redirect dance that lived here is gone — the Client
 * Component handles redirects via router.push.
 *
 * What this handler still does:
 *   * Forwards the JSON body verbatim to the upstream admin-api.
 *   * Forwards X-CSRF-Token + Cookie headers.
 *   * Forwards the upstream Set-Cookie back to the browser at the
 *     Next.js origin so the session cookie attaches same-origin.
 *
 * Same shape as /api/auth/me and /api/auth/logout — a minimal
 * pass-through.
 */

import { NextRequest, NextResponse } from "next/server";

import {
  authForwardHeaders,
  backendUnavailable,
  fetchAuthUpstream,
  proxyAuthTextResponse,
} from "../_upstream";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const upstream = await fetchAuthUpstream({
      path: "/api/auth/login",
      method: "POST",
      headers: authForwardHeaders(request, {
        "Content-Type":
          request.headers.get("Content-Type") ?? "application/json",
        Accept: "application/json",
        // Forward CSRF + session cookies so the backend middleware can
        // verify the double-submit token.
        "X-CSRF-Token": request.headers.get("X-CSRF-Token") ?? "",
      }),
      body: await request.text(),
    });
    return proxyAuthTextResponse(upstream);
  } catch {
    return backendUnavailable();
  }
}
