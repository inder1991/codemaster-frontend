/**
 * Sprint 14 / S14.A — Next.js Route Handler proxying to the FastAPI
 * backend's POST /api/auth/logout.
 *
 * Forwards the Cookie + CSRF header to the backend, then forwards the
 * cookie-clearing Set-Cookie header back to the browser.
 */

import { NextRequest, NextResponse } from "next/server";

import {
  authForwardHeaders,
  backendUnavailable,
  copyUpstreamSetCookies,
  fetchAuthUpstream,
} from "../_upstream";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const upstream = await fetchAuthUpstream({
      path: "/api/auth/logout",
      method: "POST",
      headers: authForwardHeaders(request, {
        "X-CSRF-Token": request.headers.get("X-CSRF-Token") ?? "",
      }),
    });
    const response = new NextResponse(null, { status: upstream.status });
    copyUpstreamSetCookies(upstream, response);
    return response;
  } catch {
    return backendUnavailable();
  }
}

// Convenience GET handler so the existing `<a href="/api/auth/logout">`
// link (in the SidebarShell userNavigation) still works without a
// click-to-form-submit refactor. The GET path performs the same
// upstream POST and then redirects to /login.
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const upstream = await fetchAuthUpstream({
      path: "/api/auth/logout",
      method: "POST",
      headers: authForwardHeaders(request, {
        "X-CSRF-Token": request.headers.get("X-CSRF-Token") ?? "",
      }),
    });
    if (!upstream.ok) {
      return new NextResponse(null, { status: upstream.status });
    }
    const url = new URL("/login", request.url);
    const response = NextResponse.redirect(url, { status: 303 });
    copyUpstreamSetCookies(upstream, response);
    return response;
  } catch {
    return backendUnavailable();
  }
}
