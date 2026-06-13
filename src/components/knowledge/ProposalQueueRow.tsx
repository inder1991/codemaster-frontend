/**
 * Sprint 12 / S12.2.4 — single-proposal row for the approvals queue.
 *
 * Heavier than `LearningRow` because the queue is the
 * platform-owner's primary write surface: each row carries the
 * proposal's title + body excerpt + meta + the two CTA buttons
 * inline (Approve / Reject). Modals fire from those CTAs in
 * Batch 2; for now they're stubs.
 */

"use client";

import { Badge } from "@/components/ui/elements/Badge";
import { Button } from "@/components/ui/elements/Button";
import type { ProposalV1 } from "@/lib/api/knowledge";
import { cn } from "@/lib/cn";
import { colors, type as t } from "@/lib/design-tokens";

export interface ProposalQueueRowProps {
  proposal: ProposalV1;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  busy?: boolean;
}

const EXCERPT_CHARS = 280;

export function ProposalQueueRow({
  proposal,
  onApprove,
  onReject,
  busy = false,
}: ProposalQueueRowProps) {
  const excerpt =
    proposal.body_markdown.length > EXCERPT_CHARS
      ? proposal.body_markdown.slice(0, EXCERPT_CHARS) + "…"
      : proposal.body_markdown;
  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
        <h3 className={cn(t.h3, colors.text.primary)}>{proposal.title}</h3>
        {proposal.repo === null ? (
          <Badge kind="info" pill showDot={false}>
            tenant-wide
          </Badge>
        ) : (
          <span className={cn(t.meta, colors.text.muted, "font-medium")}>
            {proposal.repo}
          </span>
        )}
      </div>
      <p className={cn("mt-2", t.body, colors.text.muted, "leading-6 whitespace-pre-wrap")}>
        {excerpt}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className={cn(t.meta, colors.text.faint)}>
          Nominated by{" "}
          <span
            className={cn(colors.text.muted, "font-medium font-mono text-xs")}
          >
            {proposal.proposed_by_user_id.slice(0, 8)}
          </span>
          {" "}· {new Date(proposal.created_at).toLocaleString()}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={() => onApprove(proposal.proposal_id)}
          disabled={busy}
          data-testid={`approve-btn-${proposal.proposal_id}`}
        >
          {busy ? "Submitting…" : "Approve"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onReject(proposal.proposal_id)}
          disabled={busy}
          data-testid={`reject-btn-${proposal.proposal_id}`}
        >
          Reject
        </Button>
      </div>
    </div>
  );
}
