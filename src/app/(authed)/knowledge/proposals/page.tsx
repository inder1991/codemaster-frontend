/**
 * Sprint 12 / S12.2.4 — Pending learning proposals queue.
 * Sprint 15 / S15.C — wired to real
 * `/api/admin/knowledge/proposals` (list) +
 * `/api/admin/knowledge/proposals/{id}/approve` +
 * `/api/admin/knowledge/proposals/{id}/reject` (mutations).
 *
 * Mutation contract:
 *   • Approve fires `POST .../approve`. On 200 the row disappears
 *     from the queue (cache invalidated; the page re-fetches).
 *   • Reject fires `POST .../reject` with `{reason: string}`
 *     (min 10 chars, server-validated).
 *   • 403 on a self-approval attempt → inline error.
 *   • 5xx → optimistic update rolled back; row reappears.
 *
 * `window.alert` is intentionally absent — production builds must
 * not flash native browser dialogs at the user.
 */

"use client";

import { ChevronLeftIcon } from "@heroicons/react/20/solid";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { ApproveConfirmationModal } from "@/components/knowledge/ApproveConfirmationModal";
import { ProposalQueueRow } from "@/components/knowledge/ProposalQueueRow";
import { RejectModal } from "@/components/knowledge/RejectModal";
import { Card } from "@/components/ui/elements/Card";
import { Empty } from "@/components/ui/states/Empty";
import { EmptyIllustration } from "@/components/ui/states/EmptyIllustration";
import { AdminApiError } from "@/lib/api/admin";
import {
  approveProposal,
  fetchProposals,
  KNOWLEDGE_QUERY_KEYS,
  type ProposalV1,
  rejectProposal,
} from "@/lib/api/knowledge";
import { useAdminQueryGuards } from "@/lib/api/use-admin-query-guards";
import { cn } from "@/lib/cn";
import { colors, motion, type as t } from "@/lib/design-tokens";

type DialogState =
  | { kind: "closed" }
  | { kind: "approve"; proposal: ProposalV1 }
  | { kind: "reject"; proposal: ProposalV1 };

export default function ProposalsQueuePage() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: KNOWLEDGE_QUERY_KEYS.proposals(),
    queryFn: fetchProposals,
  });
  const guard = useAdminQueryGuards(query, "knowledge-proposals");

  const [dialog, setDialog] = useState<DialogState>({ kind: "closed" });
  const [submitError, setSubmitError] = useState<string | null>(null);

  const close = () => {
    setDialog({ kind: "closed" });
    setSubmitError(null);
  };

  const approveMutation = useMutation({
    mutationFn: approveProposal,
    onSuccess: () => {
      close();
      queryClient.invalidateQueries({
        queryKey: KNOWLEDGE_QUERY_KEYS.proposals(),
      });
    },
    onError: (err: Error) => {
      setSubmitError(_describeMutationError(err));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rejectProposal(id, reason),
    onSuccess: () => {
      close();
      queryClient.invalidateQueries({
        queryKey: KNOWLEDGE_QUERY_KEYS.proposals(),
      });
    },
    onError: (err: Error) => {
      setSubmitError(_describeMutationError(err));
    },
  });

  if (guard.guardElement) {
    return <>{guard.guardElement}</>;
  }
  const proposals = query.data ?? [];

  const findProposal = (id: string) => proposals.find((p) => p.proposal_id === id);

  const handleApprove = (id: string) => {
    const proposal = findProposal(id);
    if (proposal) {
      setSubmitError(null);
      setDialog({ kind: "approve", proposal });
    }
  };
  const handleReject = (id: string) => {
    const proposal = findProposal(id);
    if (proposal) {
      setSubmitError(null);
      setDialog({ kind: "reject", proposal });
    }
  };

  const submitApprove = () => {
    if (dialog.kind === "approve") {
      approveMutation.mutate(dialog.proposal.proposal_id);
    }
  };
  const submitReject = (reason: string) => {
    if (dialog.kind === "reject") {
      rejectMutation.mutate({ id: dialog.proposal.proposal_id, reason });
    }
  };

  return (
    <div className="space-y-8" data-testid="proposals-page">
      <Link
        href="/knowledge"
        className={cn(
          "inline-flex items-center gap-x-1",
          t.meta,
          colors.text.muted,
          colors.hover.text.primary,
          motion.fast,
        )}
      >
        <ChevronLeftIcon
          aria-hidden="true"
          className={cn("size-4", colors.text.faint)}
        />
        Back to knowledge
      </Link>

      <header>
        <h1 className={cn(t.display, colors.text.primary)}>
          Pending learning proposals
        </h1>
        <p className={cn("mt-2 max-w-2xl", t.bodyLarge, colors.text.muted)}>
          Reviewer-promoted findings awaiting your approval. Approving signals
          the knowledge-approval workflow; the learning becomes active and
          fires on subsequent reviews against the same scope.
        </p>
      </header>

      {proposals.length === 0 ? (
        <Empty
          illustration={<EmptyIllustration />}
          title="No proposals waiting"
          body="When reviewers add a bookmark reaction on a finding, it lands here for your approval."
        />
      ) : (
        <Card>
          <ul className={cn("divide-y", colors.divider)}>
            {proposals.map((p) => (
              <li key={p.proposal_id}>
                <ProposalQueueRow
                  proposal={p}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  busy={
                    (approveMutation.isPending &&
                      dialog.kind === "approve" &&
                      dialog.proposal.proposal_id === p.proposal_id) ||
                    (rejectMutation.isPending &&
                      dialog.kind === "reject" &&
                      dialog.proposal.proposal_id === p.proposal_id)
                  }
                />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {dialog.kind === "approve" ? (
        <ApproveConfirmationModal
          open
          proposal={dialog.proposal}
          onConfirm={submitApprove}
          onCancel={close}
          submitting={approveMutation.isPending}
          {...(submitError ? { errorMessage: submitError } : {})}
        />
      ) : null}
      {dialog.kind === "reject" ? (
        <RejectModal
          open
          proposal={dialog.proposal}
          onConfirm={submitReject}
          onCancel={close}
          submitting={rejectMutation.isPending}
          {...(submitError ? { errorMessage: submitError } : {})}
        />
      ) : null}
    </div>
  );
}

function _describeMutationError(err: Error): string {
  if (err instanceof AdminApiError) {
    if (err.status === 403) {
      return "You can't approve or reject your own proposal (two-person rule).";
    }
    if (err.status === 404) {
      return "Proposal no longer exists; it may have been resolved by another admin.";
    }
    if (err.status === 409) {
      return "A newer version was saved concurrently; please review and reapprove.";
    }
  }
  return err.message;
}
