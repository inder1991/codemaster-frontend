/**
 * Sprint 15 / S15.H — Cost-caps admin page.
 *
 * super_admin + platform_owner only. Shows today's spend +
 * projection, the global + per-org-default cap settings, the
 * per-org overrides table, and the pending-changes queue.
 *
 * Architectural note: the 2026-05-04 layout-rescope comment named
 * cost-cap as something that "lives in Grafana / Slack / Vault."
 * That language conflated *Dashboard widget* scope with *portal
 * page* scope; the kill-switches page (also named) shipped
 * regardless because it's a CUSTOMER-facing safety lever.
 * Cost-cap follows the same archetype: customers' platform_owners
 * own the daily spend cap and need a self-service surface that's
 * not behind codemaster-internal Grafana / Vault. The S15.H DoR's
 * head-of-product framing: "S14.D ships the atomic enforcement
 * primitive but reads the cap from env/Vault at startup; changing
 * it requires a deploy. S15.H adds the operability layer."
 *
 * Mutation contract:
 *   • POST /api/admin/cost-caps/changes (target=global|per_org_default|
 *     per_org_override) → 202 + pending row. Settings unchanged
 *     until a SECOND user approves.
 *   • POST /api/admin/cost-caps/changes/{id}/approve →
 *     200 (different user) | 403 (self-approval) | 409 (already applied).
 *   • POST /api/admin/cost-caps/changes/{id}/reject → same shape.
 */

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { EditCostCapModal } from "@/components/cost-caps/EditCostCapModal";
import { EditCostCapOverrideModal } from "@/components/cost-caps/EditCostCapOverrideModal";
import { PendingChangesTable } from "@/components/cost-caps/PendingChangesTable";
import { Card } from "@/components/ui/elements/Card";
import { AdminApiError } from "@/lib/api/admin";
import {
  approveCostCapChange,
  COST_CAPS_QUERY_KEYS,
  fetchCostCaps,
  formatCents,
  rejectCostCapChange,
  requestCostCapChange,
  type CostCapOverrideV1,
  type CostCapPageV1,
} from "@/lib/api/cost-caps";
import { useAdminQueryGuards } from "@/lib/api/use-admin-query-guards";
import { useSession } from "@/lib/auth/use-session";

type ModalState =
  | { kind: "closed" }
  | { kind: "edit-global"; current_cap_cents: number }
  | { kind: "edit-per-org-default"; current_cap_cents: number }
  | {
      kind: "edit-override";
      override: CostCapOverrideV1 | null; // null = "+ Add"
    };

export default function CostCapsPage() {
  const queryClient = useQueryClient();
  const session = useSession();
  const currentUserId = session.data?.user_id ?? "";

  const query = useQuery<CostCapPageV1, Error>({
    queryKey: COST_CAPS_QUERY_KEYS.page(),
    queryFn: fetchCostCaps,
    refetchInterval: 30_000, // spend card stays fresh-ish
  });
  const guard = useAdminQueryGuards(query, "cost-caps");

  const [modal, setModal] = useState<ModalState>({ kind: "closed" });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [approvalsInFlight, setApprovalsInFlight] = useState<Set<string>>(
    new Set(),
  );

  const requestMutation = useMutation({
    mutationFn: requestCostCapChange,
    onSuccess: () => {
      setModal({ kind: "closed" });
      setSubmitError(null);
      queryClient.invalidateQueries({ queryKey: COST_CAPS_QUERY_KEYS.page() });
    },
    onError: (err: Error) => {
      setSubmitError(_describeMutationError(err));
    },
  });

  const approveMutation = useMutation({
    mutationFn: approveCostCapChange,
    onMutate: (id) => {
      setApprovalsInFlight((prev) => new Set(prev).add(id));
    },
    onSettled: (_data, _err, id) => {
      setApprovalsInFlight((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: COST_CAPS_QUERY_KEYS.page() });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: rejectCostCapChange,
    onMutate: (id) => {
      setApprovalsInFlight((prev) => new Set(prev).add(id));
    },
    onSettled: (_data, _err, id) => {
      setApprovalsInFlight((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: COST_CAPS_QUERY_KEYS.page() });
    },
  });

  if (guard.guardElement) {
    return <>{guard.guardElement}</>;
  }
  if (!query.data) {
    return <></>;
  }

  const data = query.data;
  const installationOptions = data.overrides.map((o) => ({
    installation_id: o.installation_id,
    installation_name: o.installation_name,
  }));

  return (
    <div className="space-y-6 p-6" data-testid="cost-caps-page">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Cost caps
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Daily Bedrock spend ceiling. Changes require approval from a
          second admin (super_admin or platform_owner).
        </p>
      </header>

      {/* Spend card */}
      <Card>
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Today&apos;s spend (global)
            </p>
            <p
              className="text-3xl font-semibold text-gray-900 dark:text-gray-100"
              data-testid="todays-spend"
            >
              {formatCents(data.todays_spend_global_cents)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Projected end-of-day
            </p>
            <p
              className={`text-2xl font-semibold ${_severityClass(
                data.todays_projected_global_cents,
                data.settings.global_cap_cents,
              )}`}
              data-testid="projected-spend"
            >
              {formatCents(data.todays_projected_global_cents)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Global cap
            </p>
            <p
              className="text-2xl text-gray-900 dark:text-gray-100"
              data-testid="global-cap"
            >
              {formatCents(data.settings.global_cap_cents)}
            </p>
          </div>
        </div>
      </Card>

      {/* Settings */}
      <section>
        <h2 className="mb-3 text-lg font-medium text-gray-900 dark:text-gray-100">
          Defaults
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <SettingRow
            label="Global cap"
            value={formatCents(data.settings.global_cap_cents)}
            onEdit={() =>
              setModal({
                kind: "edit-global",
                current_cap_cents: data.settings.global_cap_cents,
              })
            }
            testId="edit-global-cap"
          />
          <SettingRow
            label="Per-org default"
            value={formatCents(data.settings.per_org_default_cap_cents)}
            onEdit={() =>
              setModal({
                kind: "edit-per-org-default",
                current_cap_cents: data.settings.per_org_default_cap_cents,
              })
            }
            testId="edit-per-org-default-cap"
          />
        </div>
      </section>

      {/* Overrides */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Per-tenant overrides
          </h2>
          <button
            type="button"
            onClick={() => setModal({ kind: "edit-override", override: null })}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            data-testid="add-override-btn"
          >
            + Add override
          </button>
        </div>
        {data.overrides.length === 0 ? (
          <Card>
            <p
              className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400"
              data-testid="overrides-empty"
            >
              No per-tenant overrides. Tenants use the per-org default cap.
            </p>
          </Card>
        ) : (
          <Card>
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <Th>Installation</Th>
                  <Th>Cap</Th>
                  <Th>Expires</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {data.overrides.map((o) => (
                  <tr key={o.installation_id} data-testid={`override-row-${o.installation_id}`}>
                    <Td>{o.installation_name}</Td>
                    <Td>{formatCents(o.cap_cents)}</Td>
                    <Td>
                      {o.expires_at
                        ? new Date(o.expires_at).toLocaleString()
                        : "Permanent"}
                    </Td>
                    <Td className="text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setModal({ kind: "edit-override", override: o })
                        }
                        className="text-sm text-indigo-600 hover:text-indigo-500"
                      >
                        Edit
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      {/* Pending changes */}
      <section>
        <h2 className="mb-3 text-lg font-medium text-gray-900 dark:text-gray-100">
          Pending approvals
        </h2>
        <PendingChangesTable
          pendingChanges={data.pending_changes}
          currentUserId={currentUserId}
          inFlight={approvalsInFlight}
          onApprove={(id) => approveMutation.mutate(id)}
          onReject={(id) => rejectMutation.mutate(id)}
        />
      </section>

      {modal.kind === "edit-global" && (
        <EditCostCapModal
          open
          onClose={() => setModal({ kind: "closed" })}
          targetKind="global"
          currentCapCents={modal.current_cap_cents}
          submitting={requestMutation.isPending}
          errorMessage={submitError}
          onSubmit={(newCapCents) =>
            requestMutation.mutate({
              schema_version: 1,
              target_kind: "global",
              target_id: null,
              new_cap_cents: newCapCents,
              expires_at: null,
            })
          }
        />
      )}
      {modal.kind === "edit-per-org-default" && (
        <EditCostCapModal
          open
          onClose={() => setModal({ kind: "closed" })}
          targetKind="per_org_default"
          currentCapCents={modal.current_cap_cents}
          submitting={requestMutation.isPending}
          errorMessage={submitError}
          onSubmit={(newCapCents) =>
            requestMutation.mutate({
              schema_version: 1,
              target_kind: "per_org_default",
              target_id: null,
              new_cap_cents: newCapCents,
              expires_at: null,
            })
          }
        />
      )}
      {modal.kind === "edit-override" && (
        <EditCostCapOverrideModal
          open
          onClose={() => setModal({ kind: "closed" })}
          initial={
            modal.override
              ? {
                  installation_id: modal.override.installation_id,
                  installation_name: modal.override.installation_name,
                  cap_cents: modal.override.cap_cents,
                  expires_at: modal.override.expires_at,
                }
              : null
          }
          installationOptions={installationOptions}
          submitting={requestMutation.isPending}
          errorMessage={submitError}
          onSubmit={(args) =>
            requestMutation.mutate({
              schema_version: 1,
              target_kind: "per_org_override",
              target_id: args.installationId,
              new_cap_cents: args.newCapCents,
              expires_at: args.expiresAt,
            })
          }
        />
      )}
    </div>
  );
}

// ── small helpers ─────────────────────────────────────────────────


function SettingRow({
  label,
  value,
  onEdit,
  testId,
}: {
  label: string;
  value: string;
  onEdit: () => void;
  testId: string;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {label}
          </p>
          <p className="mt-1 text-xl font-medium text-gray-900 dark:text-gray-100">
            {value}
          </p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          data-testid={testId}
        >
          Edit
        </button>
      </div>
    </Card>
  );
}

function _severityClass(projected: number, cap: number): string {
  if (cap === 0) return "text-gray-900 dark:text-gray-100";
  const ratio = projected / cap;
  if (ratio >= 0.9) return "text-red-600 dark:text-red-400";
  if (ratio >= 0.75) return "text-orange-600 dark:text-orange-400";
  if (ratio >= 0.5) return "text-amber-600 dark:text-amber-400";
  return "text-gray-900 dark:text-gray-100";
}

function _describeMutationError(err: Error): string {
  if (err instanceof AdminApiError) {
    if (err.status === 403) {
      return "You can't approve or modify your own pending change.";
    }
    if (err.status === 422) {
      return "Cap value rejected by the server (out of range).";
    }
    if (err.status === 409) {
      return "This change was already approved or rejected by someone else.";
    }
  }
  return err.message;
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

