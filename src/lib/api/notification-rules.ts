/**
 * Sprint S21 (2026-05-12) — typed API helpers for the platform-scope
 * notification rules admin page.
 *
 * Backend: `codemaster/api/admin/notification_rules.py`.
 * Contracts: `contracts/notification_rules/v1.py`.
 * Generated TS shape:
 * `frontend/src/lib/api/generated/contracts.ts::NotificationRulesPageV1`.
 *
 * IMPORTANT: the GET route is platform-scoped — no `installation_id`
 * query parameter is sent. The backend's hard-error gate (Task 2)
 * returns 422 if `installation_id` is supplied, so this client must
 * not include it.
 *
 * Mutation flows (create / update / delete / dry-run) defer to a
 * follow-up PR. Adding them here later requires only
 * `apiClient.POST(...)` / `apiClient.PATCH(...)` callsites; the same
 * typed client + CSRF middleware applies.
 */

import { apiClient } from "@/lib/api/client";
import type { components } from "@/lib/api/generated/contracts";

export type NotificationRulesPageV1 =
  components["schemas"]["NotificationRulesPageV1"];
export type NotificationRuleV1 = components["schemas"]["NotificationRuleV1"];

export const NOTIFICATION_RULES_QUERY_KEYS = {
  page: () => ["notification-rules"] as const,
};

export async function fetchNotificationRulesPage(): Promise<NotificationRulesPageV1> {
  // No installation_id param — this is a platform-scope route.
  const { data, error } = await apiClient.GET(
    "/api/admin/notification-rules",
    {},
  );
  if (error || !data) {
    throw new Error(
      error && typeof error === "object" && "detail" in error
        ? String((error as { detail: unknown }).detail)
        : "notification rules fetch failed",
    );
  }
  return data;
}
