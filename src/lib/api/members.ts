/**
 * Sprint Z.1 (2026-05-11) — typed API helpers for the members page.
 *
 * Backend: `codemaster/api/admin/members.py`.
 * Contracts: `contracts/admin/members/v1.py`.
 * Generated TS shape:
 * `frontend/src/lib/api/generated/contracts.ts::MembersPageV1`.
 *
 * v0 is read-only — request-change / approve / reject flows ship
 * with Z.1b. Adding the mutations here later requires only
 * `apiClient.POST(...)` callsites; the same typed client + CSRF
 * middleware applies.
 */

import { apiClient } from "@/lib/api/client";
import type { components } from "@/lib/api/generated/contracts";

export type MembersPageV1 = components["schemas"]["MembersPageV1"];
export type MemberV1 = components["schemas"]["MemberV1"];
export type RoleChangePendingV1 = components["schemas"]["RoleChangePendingV1"];

export const MEMBERS_QUERY_KEYS = {
  page: (installationId: string) => ["members", installationId] as const,
};

export async function fetchMembersPage(
  installationId: string,
): Promise<MembersPageV1> {
  const { data, error } = await apiClient.GET("/api/admin/members", {
    params: { query: { installation_id: installationId } },
  });
  if (error || !data) {
    // The typed client surfaces non-2xx as `error`; coerce to a
    // plain Error so TanStack Query renders it predictably.
    throw new Error(
      error && typeof error === "object" && "detail" in error
        ? String((error as { detail: unknown }).detail)
        : "members fetch failed",
    );
  }
  return data;
}
