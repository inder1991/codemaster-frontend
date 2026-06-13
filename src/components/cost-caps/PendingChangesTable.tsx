/**
 * Sprint 15 / S15.H — PendingChangesTable.
 *
 * Renders queued cost-cap changes (state="pending") with Approve
 * and Reject CTAs. The Approve button is DISABLED when the
 * current user is also the requester — that's the two-person rule
 * enforced at the UI layer (the backend ALSO enforces it via
 * `CostCapSelfApprovalError → 403`, so a stolen session that
 * bypasses the UI still fails server-side).
 */

"use client";

import { Card } from "@/components/ui/elements/Card";
import {
  formatCents,
  type CostCapPendingChangeV1,
} from "@/lib/api/cost-caps";

export interface PendingChangesTableProps {
  pendingChanges: CostCapPendingChangeV1[];
  /** Current viewer's user_id — used to disable Approve on
   *  rows requested by the same user. */
  currentUserId: string;
  onApprove: (pendingChangeId: string) => void;
  onReject: (pendingChangeId: string) => void;
  /** Set of pending_change_ids currently in-flight. Buttons on
   *  those rows render as "Approving…" / "Rejecting…" + disabled. */
  inFlight: Set<string>;
}

export function PendingChangesTable({
  pendingChanges,
  currentUserId,
  onApprove,
  onReject,
  inFlight,
}: PendingChangesTableProps) {
  if (pendingChanges.length === 0) {
    return (
      <Card>
        <p
          className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
          data-testid="pending-changes-empty"
        >
          No changes awaiting approval.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <table
        className="min-w-full divide-y divide-gray-200 dark:divide-gray-700"
        data-testid="pending-changes-table"
      >
        <thead>
          <tr>
            <Th>Target</Th>
            <Th>New cap</Th>
            <Th>Expires</Th>
            <Th>Requested by</Th>
            <Th>Requested at</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {pendingChanges.map((row) => {
            const isSelfRequest = row.requested_by_user_id === currentUserId;
            const busy = inFlight.has(row.pending_change_id);
            return (
              <tr
                key={row.pending_change_id}
                data-testid={`pending-row-${row.pending_change_id}`}
              >
                <Td>{describeTarget(row)}</Td>
                <Td>{formatCents(row.new_cap_cents)}</Td>
                <Td>{row.expires_at ? formatTimestamp(row.expires_at) : "—"}</Td>
                <Td className="font-mono text-xs">
                  {abbreviateUserId(row.requested_by_user_id)}
                </Td>
                <Td>{formatTimestamp(row.requested_at)}</Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onApprove(row.pending_change_id)}
                      disabled={isSelfRequest || busy}
                      title={
                        isSelfRequest
                          ? "Two-person rule: you cannot approve your own change."
                          : undefined
                      }
                      className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-700"
                      data-testid={`approve-btn-${row.pending_change_id}`}
                    >
                      {busy ? "Approving…" : "Approve"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onReject(row.pending_change_id)}
                      disabled={isSelfRequest || busy}
                      title={
                        isSelfRequest
                          ? "Two-person rule: you cannot reject your own change."
                          : undefined
                      }
                      className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                      data-testid={`reject-btn-${row.pending_change_id}`}
                    >
                      {busy ? "Rejecting…" : "Reject"}
                    </button>
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function describeTarget(row: CostCapPendingChangeV1): string {
  switch (row.target_kind) {
    case "global":
      return "Global cap";
    case "per_org_default":
      return "Per-org default";
    case "per_org_override":
      return `Override: ${row.target_id ?? "—"}`;
  }
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString();
}

function abbreviateUserId(uid: string): string {
  return uid.length > 8 ? `${uid.slice(0, 8)}…` : uid;
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-4 py-3 text-sm text-gray-900 dark:text-gray-100 ${className}`}>
      {children}
    </td>
  );
}
