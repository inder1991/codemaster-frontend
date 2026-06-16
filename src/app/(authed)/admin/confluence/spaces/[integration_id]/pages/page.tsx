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
  // The live page list is unavailable when the upstream Confluence call
  // degraded (auth/rate-limit/outage); the endpoint then returns only
  // already-ingested pages. Treat a missing flag as available so the note
  // doesn't flash before the field lands in older cached payloads.
  const liveListAvailable = query.data?.live_list_available !== false;

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

      {!liveListAvailable ? (
        <p
          role="note"
          className={cn("flex items-center gap-x-2", t.meta, colors.text.muted)}
        >
          <span
            aria-hidden="true"
            className={cn("size-1.5 rounded-full", "bg-[oklch(72%_0.16_65)]")}
          />
          Live page list unavailable — showing ingested pages only.
        </p>
      ) : null}

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
                    <LifecycleChip
                      ingestStatus={row.ingest_status}
                      approvalStatus={row.approval_status}
                    />
                  </td>
                  <td className={cn("px-3 py-2", t.meta, colors.text.muted)}>
                    {row.approval_status === "approved"
                      ? row.approver_email
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <RowAction
                      row={row}
                      onApprove={() => setApproveTarget(row)}
                      onRevoke={() => setRevokeTarget(row)}
                    />
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

type ChipTone = "success" | "info" | "pending" | "neutral";

interface LifecycleChipSpec {
  label: string;
  tone: ChipTone;
}

/**
 * Derive the page lifecycle chip from the (ingest_status, approval_status)
 * pair. `revoked` dominates regardless of ingest state. We deliberately do
 * NOT fetch live Confluence labels here, so a `not_ingested + none` page is
 * just an ordinary tracked page that may never need approval — its chip is
 * neutral ("Not ingested"), not a call to action.
 *
 * Exported for unit testing of the full pair matrix.
 */
export function lifecycleChip(
  ingestStatus: PageWithApprovalV1["ingest_status"],
  approvalStatus: PageWithApprovalV1["approval_status"],
): LifecycleChipSpec {
  if (approvalStatus === "revoked") {
    return { label: "Revoked", tone: "neutral" };
  }
  if (approvalStatus === "approved") {
    return ingestStatus === "ingested"
      ? { label: "In default corpus", tone: "success" }
      : { label: "Approved · ingesting…", tone: "pending" };
  }
  // approval_status === "none"
  return ingestStatus === "ingested"
    ? { label: "Ingested", tone: "info" }
    : { label: "Not ingested", tone: "neutral" };
}

const CHIP_PALETTE: Record<ChipTone, string> = {
  success:
    "bg-[oklch(94%_0.05_165)] text-[oklch(45%_0.13_165)] dark:bg-[oklch(26%_0.08_165)] dark:text-[oklch(80%_0.13_165)]",
  info: "bg-[oklch(94%_0.05_235)] text-[oklch(48%_0.13_235)] dark:bg-[oklch(26%_0.08_235)] dark:text-[oklch(80%_0.13_235)]",
  pending:
    "bg-[oklch(95%_0.06_75)] text-[oklch(48%_0.12_60)] dark:bg-[oklch(28%_0.07_60)] dark:text-[oklch(82%_0.12_75)]",
  neutral:
    "bg-[oklch(94%_0.01_80)] text-[oklch(50%_0.01_80)] dark:bg-[oklch(26%_0.01_80)] dark:text-[oklch(75%_0.01_80)]",
};

function LifecycleChip({
  ingestStatus,
  approvalStatus,
}: {
  ingestStatus: PageWithApprovalV1["ingest_status"];
  approvalStatus: PageWithApprovalV1["approval_status"];
}) {
  const { label, tone } = lifecycleChip(ingestStatus, approvalStatus);
  return (
    <span
      className={cn(
        "inline-block px-2 py-0.5",
        radius.sm,
        t.caption,
        CHIP_PALETTE[tone],
      )}
    >
      {label}
    </span>
  );
}

/**
 * Per-row action. Approved rows offer Revoke. Unapproved rows offer an
 * Approve action wired to the page_id-based `postPageApproval` (so it works
 * for not-ingested rows too). For `not_ingested + none` the label is
 * "Approve for default corpus" and the variant is a quiet `secondary` — we
 * can't tell from here whether the page is default-labeled, so we don't
 * push it as a primary CTA.
 */
function RowAction({
  row,
  onApprove,
  onRevoke,
}: {
  row: PageWithApprovalV1;
  onApprove: () => void;
  onRevoke: () => void;
}) {
  if (row.approval_status === "approved") {
    return (
      <Button variant="secondary" size="sm" onClick={onRevoke}>
        Revoke
      </Button>
    );
  }
  // approval_status is "none" or "revoked" — both offer an Approve action.
  // For a not-ingested page we can't tell whether it's default-labeled, so
  // we offer a quiet `secondary` "Approve for default corpus" rather than a
  // loud primary CTA. Everything else keeps the original primary "Approve".
  if (row.approval_status === "none" && row.ingest_status === "not_ingested") {
    return (
      <Button variant="secondary" size="sm" onClick={onApprove}>
        Approve for default corpus
      </Button>
    );
  }
  return (
    <Button variant="primary" size="sm" onClick={onApprove}>
      Approve
    </Button>
  );
}
