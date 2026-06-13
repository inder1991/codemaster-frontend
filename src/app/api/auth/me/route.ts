/**
 * Sprint 14 / S14.A — Next.js Route Handler proxying to the FastAPI
 * backend's GET /api/auth/me.
 *
 * The frontend's `useSession()` hook calls this same-origin endpoint;
 * this handler forwards the session cookie to the backend and relays
 * the JSON body + status back. On 401 the upstream Set-Cookie clearing
 * header is forwarded so a stale session cookie is cleaned up.
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
      path: "/api/auth/me",
      method: "GET",
      headers: authForwardHeaders(request, {
        // The session cookie is the only credential needed; CSRF
        // protection only applies to unsafe methods and GET is safe.
        Accept: "application/json",
      }),
    });
    return proxyAuthTextResponse(upstream);
  } catch {
    return backendUnavailable();
  }
}
