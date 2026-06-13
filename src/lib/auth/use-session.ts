/**
 * Sprint 14 / S14.A — TanStack Query session hook.
 *
 * Replaces the Sprint-12 `MOCK_SESSION` import. Reads the user identity
 * from `GET /api/auth/me` (proxied through the Next.js Route Handler at
 * `/api/auth/me` — see `frontend/src/app/api/auth/login/route.ts` for the
 * paired login proxy).
 *
 * On 401 the hook returns `data: null`, which authed pages should treat
 * as "not signed in" → redirect to `/login`. The hook itself does NOT
 * issue the redirect; page-level effects handle that so server-rendered
 * shells render correctly without flashing.
 */

"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import type { Role } from "@/lib/auth/roles";

export interface MeResponse {
  schema_version: 1;
  user_id: string;
  role: Role;
  email: string;
  installation_id: string | null;
}

export const SESSION_QUERY_KEY = ["auth", "me"] as const;

/**
 * Fetch the current session identity.
 *
 * Returns `data: null` on 401 (so the caller can branch on
 * "unauthenticated" without inspecting the error). All other errors
 * surface via `query.error`.
 */
export function useSession(): UseQueryResult<MeResponse | null, Error> {
  return useQuery<MeResponse | null, Error>({
    queryKey: SESSION_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/auth/me", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (res.status === 401) {
        return null;
      }
      if (!res.ok) {
        throw new Error(`/api/auth/me returned ${res.status}`);
      }
      const body = (await res.json()) as MeResponse;
      return body;
    },
    // Refetch on focus + 1-minute stale-time matches the SPA usage
    // pattern: the user's role doesn't change mid-session, but the
    // expiry boundary should re-check periodically.
    staleTime: 60_000,
    retry: false,
  });
}
