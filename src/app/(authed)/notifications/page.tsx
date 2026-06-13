/**
 * Sprint S21 (2026-05-12) — Notifications admin page (read-only v0).
 *
 * Reads `NotificationRulesPageV1` from
 * `GET /api/admin/notification-rules` and renders the platform-scope
 * rule listing.
 *
 * This is a platform-scope route: the rules shown here fire across ALL
 * installations, not just a single org. Operators who need per-org or
 * per-tenant scoping must encode that inside the `filters` JSONB on
 * each rule (e.g. `{"installation_owner_logins": ["acme", "globex"]}`).
 * Without filters, every recipient receives every matching trigger
 * across the platform.
 *
 * Mutation flows (create / edit / delete / dry-run) defer to a
 * follow-up PR per the sprint plan.
 *
 * Visibility: platform_owner + super_admin (set in NAV_SPEC). The
 * backend's `_require_role` also enforces.
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, type JSX } from "react";

import { useSession } from "@/lib/auth/use-session";
import {
  fetchNotificationRulesPage,
  NOTIFICATION_RULES_QUERY_KEYS,
  type NotificationRulesPageV1,
  type NotificationRuleV1,
} from "@/lib/api/notification-rules";

const _STATE_TONE: Record<string, string> = {
  active:
    "bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-200",
  paused:
    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

function _stateBadge(state: NotificationRuleV1["state"]): JSX.Element {
  const tone = _STATE_TONE[state] ?? _STATE_TONE.paused;
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${tone}`}
    >
      {state}
    </span>
  );
}

export default function NotificationRulesPage(): JSX.Element {
  const session = useSession();

  // Platform-scope route — no installation_id gate needed. Query fires
  // as soon as session resolves (we still wait for session so we don't
  // fire before auth cookies are set).
  const enabled = !session.isLoading;

  const query = useQuery<NotificationRulesPageV1, Error>({
    queryKey: NOTIFICATION_RULES_QUERY_KEYS.page(),
    queryFn: fetchNotificationRulesPage,
    enabled,
  });

  useEffect(() => {
    if (query.error && typeof window !== "undefined") {
      console.error("notification-rules-page fetch error:", query.error);
    }
  }, [query.error]);

  if (query.isLoading || session.isLoading) {
    return (
      <main className="p-6">
        <header>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Notification rules
          </h1>
        </header>
      </main>
    );
  }

  if (query.error) {
    return (
      <main className="p-6">
        <header>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Notification rules
          </h1>
        </header>
        <div
          role="alert"
          className="mt-6 rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-4"
        >
          <p className="text-sm text-red-900 dark:text-red-200">
            Couldn&apos;t load notification rules. Try again; if the problem
            persists, share this with{" "}
            <a href="mailto:platform-owners@acme.io" className="underline">
              platform-owners@acme.io
            </a>
            .
          </p>
        </div>
      </main>
    );
  }

  const rules = query.data?.rules ?? [];

  return (
    <main className="space-y-8 p-6" data-testid="notification-rules-page">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Notification rules
        </h1>
        <p
          className="mt-1 text-sm text-gray-600 dark:text-gray-400"
          data-testid="platform-scope-descriptor"
        >
          Platform-shared across all installations. Rules fire for every
          matching trigger across every installation unless the rule&apos;s{" "}
          <code className="rounded bg-gray-100 px-1 text-xs dark:bg-gray-800">
            filters
          </code>{" "}
          field encodes per-org or per-tenant scoping (e.g.{" "}
          <code className="rounded bg-gray-100 px-1 text-xs dark:bg-gray-800">
            {`{"installation_owner_logins": ["acme"]}`}
          </code>
          ).
        </p>
      </header>

      {rules.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          No notification rules configured yet.
        </p>
      ) : (
        <section aria-labelledby="notification-rules-table-heading">
          <h2
            id="notification-rules-table-heading"
            className="sr-only"
          >
            Notification rules list
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase opacity-70">
                <tr>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Trigger event</th>
                  <th className="py-2 pr-4">State</th>
                  <th className="py-2 pr-4">Recipients</th>
                  <th className="py-2">Schedule</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr
                    key={rule.rule_id}
                    className="border-t border-gray-200 dark:border-gray-800"
                  >
                    <td className="py-2 pr-4 font-medium">{rule.name}</td>
                    <td className="py-2 pr-4 font-mono text-xs">
                      {rule.trigger_event}
                    </td>
                    <td className="py-2 pr-4">{_stateBadge(rule.state)}</td>
                    <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">
                      {rule.recipients?.length ?? 0}
                    </td>
                    <td className="py-2 font-mono text-xs text-gray-600 dark:text-gray-400">
                      {rule.schedule_cron ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
