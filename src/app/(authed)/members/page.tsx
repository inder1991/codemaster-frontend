/**
 * Sprint Z.1 (2026-05-11) — Members admin page (read-only v0).
 *
 * Reads `MembersPageV1` from `GET /api/admin/members` and renders
 * the active grants + the in-flight pending-change queue.
 *
 * Mutation flows (request a role change, approve, reject) defer to
 * Z.1b. Per the two-person-approval contract enforced in
 * `codemaster/api/admin/members.py`, the mutations require the
 * second-approver UX which warrants its own focused implementation.
 *
 * Visibility: platform_owner + super_admin (set in NAV_SPEC). The
 * backend's `_require_role` also enforces.
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, type JSX } from "react";

import { useSession } from "@/lib/auth/use-session";
import {
  fetchMembersPage,
  MEMBERS_QUERY_KEYS,
  type MembersPageV1,
} from "@/lib/api/members";

const _ROLE_TONE: Record<string, string> = {
  platform_owner:
    "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  platform_operator:
    "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200",
  reader:
    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

function _roleBadge(role: string): JSX.Element {
  const tone = _ROLE_TONE[role] ?? _ROLE_TONE.reader;
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${tone}`}
    >
      {role}
    </span>
  );
}

function _formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

export default function MembersPage(): JSX.Element {
  const session = useSession();
  const installationId = session.data?.installation_id ?? "";

  // The `enabled` gate prevents firing the query before the session
  // resolves; without it we'd race a fetch with an empty
  // installation_id which the backend rejects with 422.
  const query = useQuery<MembersPageV1, Error>({
    queryKey: MEMBERS_QUERY_KEYS.page(installationId),
    queryFn: () => fetchMembersPage(installationId),
    enabled: installationId.length > 0,
  });

  // Sprint Y.5 toast hookup would surface fetch errors; for v0 we
  // render an inline error banner so the page reads honestly without
  // depending on the global toast for primary signal.
  useEffect(() => {
    if (query.error && typeof window !== "undefined") {
      console.error("members-page fetch error:", query.error);
    }
  }, [query.error]);

  if (query.isLoading || !session.data) {
    return (
      <main className="p-6">
        <header>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Members
          </h1>
        </header>
      </main>
    );
  }

  if (installationId.length === 0) {
    return (
      <main className="p-6">
        <header>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Members
          </h1>
        </header>
        <div
          role="status"
          className="mt-6 rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30"
        >
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Members are scoped to an installation. Select an
            installation-scoped session to view this page.
          </p>
        </div>
      </main>
    );
  }

  if (query.error) {
    return (
      <main className="p-6">
        <header>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Members
          </h1>
        </header>
        <div
          role="alert"
          className="mt-6 rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-4"
        >
          <p className="text-sm text-red-900 dark:text-red-200">
            Couldn&apos;t load members. Try again; if the problem
            persists, share this with{" "}
            <a
              href="mailto:platform-owners@acme.io"
              className="underline"
            >
              platform-owners@acme.io
            </a>
            .
          </p>
        </div>
      </main>
    );
  }

  const data = query.data!;
  // Partition grants by scope. Rows without an explicit scope default to
  // "installation" so legacy/pre-PR2a responses still render correctly.
  const platformMembers = data.members.filter((m) => m.scope === "platform");
  const installationMembers = data.members.filter(
    (m) => m.scope !== "platform",
  );
  const hasPending = data.pending_changes.length > 0;

  return (
    <main className="space-y-8 p-6" data-testid="members-page">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Members
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Role grants for this installation, partitioned by scope. Platform
          grants are separate from the super_admin account in
          core.local_users. Z.1b will add the request / approve / reject
          controls.
        </p>
      </header>

      {platformMembers.length > 0 && (
        <section aria-labelledby="platform-grants-heading">
          <h2
            id="platform-grants-heading"
            className="text-lg font-medium text-gray-900 dark:text-gray-100"
          >
            Platform grants
          </h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
            Separate from super_admin (core.local_users). These grants
            apply across all installations.
          </p>
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-xs uppercase opacity-70">
              <tr>
                <th className="py-2">Email</th>
                <th className="py-2">Name</th>
                <th className="py-2">Role</th>
                <th className="py-2">Granted</th>
              </tr>
            </thead>
            <tbody>
              {platformMembers.map((m) => (
                <tr
                  key={m.user_id}
                  className="border-t border-gray-200 dark:border-gray-800"
                >
                  <td className="py-2 font-mono">{m.email}</td>
                  <td className="py-2">{m.display_name}</td>
                  <td className="py-2">{_roleBadge(m.role)}</td>
                  <td className="py-2 text-gray-600 dark:text-gray-400">
                    {_formatDate(m.granted_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section aria-labelledby="installation-grants-heading">
        <h2
          id="installation-grants-heading"
          className="text-lg font-medium text-gray-900 dark:text-gray-100"
        >
          Installation grants
        </h2>
        {installationMembers.length > 0 ? (
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-xs uppercase opacity-70">
              <tr>
                <th className="py-2">Email</th>
                <th className="py-2">Name</th>
                <th className="py-2">Role</th>
                <th className="py-2">Granted</th>
              </tr>
            </thead>
            <tbody>
              {installationMembers.map((m) => (
                <tr
                  key={m.user_id}
                  className="border-t border-gray-200 dark:border-gray-800"
                >
                  <td className="py-2 font-mono">{m.email}</td>
                  <td className="py-2">{m.display_name}</td>
                  <td className="py-2">{_roleBadge(m.role)}</td>
                  <td className="py-2 text-gray-600 dark:text-gray-400">
                    {_formatDate(m.granted_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            No members in this installation yet.
          </p>
        )}
      </section>

      <section aria-labelledby="pending-changes-heading">
        <h2
          id="pending-changes-heading"
          className="text-lg font-medium text-gray-900 dark:text-gray-100"
        >
          Pending changes
        </h2>
        {hasPending ? (
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-xs uppercase opacity-70">
              <tr>
                <th className="py-2">Subject</th>
                <th className="py-2">Action</th>
                <th className="py-2">Role</th>
                <th className="py-2">Requested</th>
                <th className="py-2">Expires</th>
                <th className="py-2">State</th>
              </tr>
            </thead>
            <tbody>
              {data.pending_changes.map((p) => (
                <tr
                  key={p.pending_id}
                  className="border-t border-gray-200 dark:border-gray-800"
                >
                  <td className="py-2 font-mono text-xs">
                    {p.subject_kind}/{p.subject_id.slice(0, 8)}…
                  </td>
                  <td className="py-2 capitalize">{p.action}</td>
                  <td className="py-2">{_roleBadge(p.role)}</td>
                  <td className="py-2 text-gray-600 dark:text-gray-400">
                    {_formatDate(p.requested_at)}
                  </td>
                  <td className="py-2 text-gray-600 dark:text-gray-400">
                    {_formatDate(p.expires_at)}
                  </td>
                  <td className="py-2">
                    <span className="inline-flex items-center rounded bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs">
                      {p.state}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            No pending role changes.
          </p>
        )}
      </section>

    </main>
  );
}
