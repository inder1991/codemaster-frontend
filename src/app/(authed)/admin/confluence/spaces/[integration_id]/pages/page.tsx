/**
 * Sub-spec C T14 (2026-05-28) — per-integration pages list with
 * approval CRUD. Lists every Confluence page tracked for an integration
 * with current approval state; allows IDP-team operators to approve
 * (creates an active approval) or revoke (DELETE + workflow trigger
 * for resync).
 *
 * Route is parameterized by integration_id (UUID) not space_key —
 * matches the backend's path-param shape natively, avoids the
 * list-then-find lookup space_key would require.
 */

"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { ApprovePageModal } from "@/components/confluence/ApprovePageModal";
import { Button } from "@/components/ui/elements/Button";
import { Modal } from "@/components/ui/overlays/Modal";
import {
  AdminApiError,
  deletePageApproval,
  fetchPages,
  postPageApproval,
  QUERY_KEYS,
  type CreatePageApprovalRequestV1,
  type PageWithApprovalV1,
} from "@/lib/api/admin";
import { useAdminQueryGuards } from "@/lib/api/use-admin-query-guards";
import { cn } from "@/lib/cn";
import { colors, radius, type as t } from "@/lib/design-tokens";

export default function SpacePagesAdminPage() {
  const params = useParams();
  const integrationId = String(params?.integration_id ?? "");

  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: QUERY_KEYS.confluencePages(integrationId),
    queryFn: () => fetchPages({ integration_id: integrationId }),
    enabled: integrationId !== "",
  });
  const { guardElement } = useAdminQueryGuards(query, "confluence-pages");

  const [approveTarget, setApproveTarget] =
    useState<PageWithApprovalV1 | null>(null);
  const [revokeTarget, setRevokeTarget] =
    useState<PageWithApprovalV1 | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const approveMutation = useMutation({
    mutationFn: (body: CreatePageApprovalRequestV1) =>
      postPageApproval({
        integration_id: integrationId,
        page_id: body.page_id,
        body,
      }),
    onSuccess: async () => {
      setApproveTarget(null);
      setErrorMessage(undefined);
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.confluencePages(integrationId),
      });
    },
    onError: (err) => {
      if (err instanceof AdminApiError && err.status === 409) {
        setErrorMessage(
          "This page already has an active approval (concurrent edit?).",
        );
      } else if (err instanceof AdminApiError && err.status === 400) {
        setErrorMessage(
          "Couldn't submit — the body and URL didn't agree. Try again.",
        );
      } else {
        setErrorMessage("Couldn't submit the approval. Please try again.");
      }
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (pageId: string) =>
      deletePageApproval({ integration_id: integrationId, page_id: pageId }),
    onSuccess: async () => {
      setRevokeTarget(null);
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.confluencePages(integrationId),
      });
    },
  });

  if (guardElement !== null) return guardElement;

  const rows: PageWithApprovalV1[] =
    (query.data?.rows ?? []) as PageWithApprovalV1[];

  return (
    <div className="space-y-6">
      <header>
        <h1 className={cn(t.display, colors.text.primary)}>Pages</h1>
        <p className={cn(t.body, colors.text.muted)}>
          Every Confluence page tracked for this integration. Approve a page
          to include it in the default corpus; revoke to remove. Revoking
          dispatches a resync so cached chunks are flushed within minutes.
        </p>
      </header>

      {rows.length === 0 ? (
        <p className={cn(t.body, colors.text.muted)}>No pages tracked yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className={cn(t.meta, colors.text.muted, "text-left")}>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Page ID</th>
                <th className="px-3 py-2">Labels</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Approver</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.page_id}
                  className={cn("border-t", colors.border.default)}
                >
                  <td
                    className={cn(
                      "px-3 py-2",
                      t.bodyStrong,
                      colors.text.primary,
                    )}
                  >
                    {row.page_title}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 font-mono",
                      t.meta,
                      colors.text.muted,
                    )}
                  >
                    {row.page_id}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {row.labels.map((l) => (
                        <span
                          key={l}
                          className={cn(
                            "inline-block px-2 py-0.5",
                            radius.sm,
                            t.caption,
                            colors.bg.muted,
                            colors.text.muted,
                          )}
                        >
                          {l}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={row.approval_status} />
                  </td>
                  <td className={cn("px-3 py-2", t.meta, colors.text.muted)}>
                    {row.approval_status === "approved"
                      ? row.approver_email
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {row.approval_status === "approved" ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setRevokeTarget(row)}
                      >
                        Revoke
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setApproveTarget(row)}
                      >
                        Approve
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {approveTarget ? (
        <ApprovePageModal
          open
          spaceKey={approveTarget.space_key}
          pageId={approveTarget.page_id}
          pageTitle={approveTarget.page_title}
          onConfirm={(body) => approveMutation.mutate(body)}
          onCancel={() => {
            setApproveTarget(null);
            setErrorMessage(undefined);
          }}
          submitting={approveMutation.isPending}
          {...(errorMessage ? { errorMessage } : {})}
        />
      ) : null}

      {revokeTarget ? (
        <Modal
          open
          onClose={(next) => {
            if (!next) setRevokeTarget(null);
          }}
          title={`Revoke approval for "${revokeTarget.page_title}"?`}
          description="The page's default-corpus chunks will be flushed within minutes. The integration can re-approve later if needed."
          iconTone="danger"
          primaryAction={{
            label: revokeMutation.isPending ? "Revoking…" : "Revoke approval",
            onClick: () => revokeMutation.mutate(revokeTarget.page_id),
            disabled: revokeMutation.isPending,
            variant: "danger",
          }}
          secondaryAction={{
            label: "Cancel",
            onClick: () => setRevokeTarget(null),
          }}
        />
      ) : null}
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: PageWithApprovalV1["approval_status"];
}) {
  const palette =
    status === "approved"
      ? "bg-[oklch(94%_0.05_165)] text-[oklch(45%_0.13_165)] dark:bg-[oklch(26%_0.08_165)] dark:text-[oklch(80%_0.13_165)]"
      : status === "revoked"
        ? "bg-[oklch(94%_0.01_80)] text-[oklch(50%_0.01_80)] dark:bg-[oklch(26%_0.01_80)] dark:text-[oklch(75%_0.01_80)]"
        : "bg-[oklch(94%_0.05_235)] text-[oklch(48%_0.13_235)] dark:bg-[oklch(26%_0.08_235)] dark:text-[oklch(80%_0.13_235)]";
  return (
    <span
      className={cn(
        "inline-block px-2 py-0.5",
        radius.sm,
        t.caption,
        palette,
      )}
    >
      {status}
    </span>
  );
}
