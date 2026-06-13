/**
 * Sprint 12 / S12.2.x — engineer-home pending-proposal row.
 *
 * A simpler twin of ActivityRow used for the "Your pending learning
 * proposals" strip. State is the dominant visual cue (pending = info,
 * approved = healthy, rejected = dim).
 */

"use client";

import { ChevronRightIcon } from "@heroicons/react/20/solid";

import { Badge } from "@/components/ui/elements/Badge";
import { cn } from "@/lib/cn";
import { colors, motion, type as t } from "@/lib/design-tokens";
import type {
  PendingProposal,
  ProposalState,
} from "@/lib/mock/engineer-activity";

const STATE_KIND = (s: ProposalState) =>
  s === "approved"
    ? "healthy"
    : s === "rejected"
      ? "dim"
      : "info";

const STATE_LABEL: Record<ProposalState, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
};

export function ProposalRow({
  proposal,
  onOpen,
}: {
  proposal: PendingProposal;
  onOpen: (id: string) => void;
}) {
  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen(proposal.id);
    }
  };
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(proposal.id)}
      onKeyDown={handleKey}
      className={cn(
        "group flex items-center gap-x-4 px-4 py-3 cursor-pointer",
        colors.hover.bg,
        motion.fast,
        "focus-visible:outline focus-visible:outline-2",
        "focus-visible:outline-[oklch(72%_0.16_65)] focus-visible:-outline-offset-2",
      )}
    >
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate",
            t.bodyStrong,
            colors.text.primary,
          )}
        >
          {proposal.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className={cn(t.meta, colors.text.muted, "font-medium")}>
            {proposal.repo}
          </span>
          <Badge kind={STATE_KIND(proposal.state)} size="sm" pill>
            {STATE_LABEL[proposal.state]}
          </Badge>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-x-2">
        <span className={cn(t.meta, colors.text.faint, "tabular-nums")}>
          {proposal.submitted_at_label}
        </span>
        <ChevronRightIcon
          aria-hidden="true"
          className={cn(
            "size-5",
            colors.text.faint,
            "group-hover:text-[oklch(45%_0.008_80)] dark:group-hover:text-[oklch(80%_0.008_80)]",
            motion.fast,
          )}
        />
      </div>
    </div>
  );
}
