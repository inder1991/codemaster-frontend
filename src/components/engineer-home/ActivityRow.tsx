/**
 * Sprint 12 / S12.2.x — engineer-home activity row.
 *
 * Layout (sibling-of-coderabbit-app pattern, retokenized to OKLCH +
 * amber identity):
 *
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ <title bodyStrong>                          updated_at_label │
 *   │ <repo · #pr · state>   [severity badges]            >  │
 *   └─────────────────────────────────────────────────────────┘
 *
 * Locked invariants (DESIGN.md):
 *   - Borderless rows; 1px hairline (`border.default`) between
 *     adjacent rows. NEVER nested cards.
 *   - Whole row is the click target. Keyboard: Enter / Space.
 *   - Hover: `bg.muted` only.
 *   - Severity chips use `Badge kind="..."` so dot + label are
 *     paired (a11y: status NEVER carries color as the sole signal).
 *   - Numeric severity counts use tabular-nums via `Badge` (the
 *     badge component sets `meta` which inherits font-feature-settings
 *     from globals.css through tabular-nums where applied).
 */

"use client";

import { ChevronRightIcon } from "@heroicons/react/20/solid";

import { Badge } from "@/components/ui/elements/Badge";
import { cn } from "@/lib/cn";
import { colors, motion, type as t } from "@/lib/design-tokens";
import type { ReviewState } from "@/lib/api/admin";
import type { MyReviewActivity } from "@/lib/mock/engineer-activity";

const STATE_LABEL: Record<ReviewState, string> = {
  queued: "Queued",
  in_progress: "In progress",
  complete: "Complete",
  failed: "Failed",
};

const STATE_KIND = (s: ReviewState) =>
  s === "complete"
    ? "healthy"
    : s === "in_progress"
      ? "info"
      : s === "failed"
        ? "down"
        : "dim";

export function ActivityRow({
  row,
  onOpen,
}: {
  row: MyReviewActivity;
  onOpen: (id: string) => void;
}) {
  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen(row.id);
    }
  };
  const sev = row.severity;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(row.id)}
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
          {row.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-x-1.5",
              t.meta,
              colors.text.muted,
            )}
          >
            <span className="font-medium">{row.repo}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">#{row.pr_number}</span>
          </span>
          <Badge kind={STATE_KIND(row.state)} size="sm" pill>
            {STATE_LABEL[row.state]}
          </Badge>
          <SeverityCounts severity={sev} />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-x-2">
        <span className={cn(t.meta, colors.text.faint, "tabular-nums")}>
          {row.updated_at_label}
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

function SeverityCounts({
  severity,
}: {
  severity: MyReviewActivity["severity"];
}) {
  const items: Array<{ kind: "down" | "degraded" | "info" | "dim"; n: number; label: string }> = [
    { kind: "down", n: severity.blocker, label: "blocker" },
    { kind: "degraded", n: severity.issue, label: "issue" },
    { kind: "info", n: severity.suggestion, label: "suggestion" },
    { kind: "dim", n: severity.nit, label: "nit" },
  ];
  const visible = items.filter((i) => i.n > 0);
  if (visible.length === 0) {
    return (
      <Badge kind="neutral" size="sm" showDot={false}>
        No findings
      </Badge>
    );
  }
  return (
    <div className="flex items-center gap-x-1.5">
      {visible.map((i) => (
        <Badge key={i.label} kind={i.kind} size="sm" pill>
          <span className="tabular-nums">{i.n}</span>{" "}
          {i.n === 1 ? i.label : `${i.label}s`}
        </Badge>
      ))}
    </div>
  );
}
