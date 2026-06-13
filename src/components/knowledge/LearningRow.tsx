/**
 * Sprint 12 / S12.2.4 — single-learning row for the Knowledge list.
 *
 * Layout follows the `ActivityRow` pattern (title bodyStrong on
 * top; meta line below with repo/state/scope; effectiveness +
 * recency on the right; chevron at the end).
 */

"use client";

import { ChevronRightIcon } from "@heroicons/react/20/solid";

import { Badge } from "@/components/ui/elements/Badge";
import type { LearningListItemV1 } from "@/lib/api/knowledge";
import { cn } from "@/lib/cn";
import { colors, motion, type as t } from "@/lib/design-tokens";
import { formatRelativeTime } from "@/lib/format/relative-time";

export function LearningRow({
  row,
  onOpen,
}: {
  row: LearningListItemV1;
  onOpen: (id: string) => void;
}) {
  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen(row.learning_id);
    }
  };
  const acceptPct = Math.round(row.accept_rate * 100);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(row.learning_id)}
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
        <p className={cn("truncate", t.bodyStrong, colors.text.primary)}>
          {row.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Badge kind={row.state === "active" ? "healthy" : "dim"} pill size="sm">
            {row.state}
          </Badge>
          {row.repo === null ? (
            <Badge kind="info" size="sm" pill showDot={false}>
              tenant-wide
            </Badge>
          ) : (
            <span className={cn(t.meta, colors.text.muted, "font-medium")}>
              {row.repo}
            </span>
          )}
          <span className={cn(t.meta, colors.text.faint)}>
            <span className="tabular-nums">{row.fired_count}</span>{" "}
            {row.fired_count === 1 ? "fire" : "fires"} ·{" "}
            <span className="tabular-nums">{acceptPct}%</span> accept rate
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-x-2">
        <span className={cn(t.meta, colors.text.faint, "tabular-nums")}>
          {row.last_fired_at === null
            ? "never fired"
            : formatRelativeTime(row.last_fired_at)}
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
