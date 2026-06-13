/**
 * FindingRow -- compact, selectable row for the findings ledger.
 *
 * Lives inside a role="grid" container. Renders severity badge, title,
 * and file location. Body/evidence/feedback are NOT here -- those
 * render in a separate inspector pane when this row is selected.
 *
 * Selected state uses a full inset ring (not a side-stripe border).
 */

"use client";

import type { KeyboardEvent } from "react";

import { cn } from "@/lib/cn";
import { colors, type as t, motion } from "@/lib/design-tokens";
import type { FindingSeverity, ReviewFindingItemV1 } from "@/lib/api/admin";
import { FileLocationChip } from "@/components/ui/FileLocationChip";

const SEVERITY_COLOR: Record<FindingSeverity, string> = {
  blocker: colors.status.down,
  issue: colors.status.degraded,
  suggestion: colors.status.info,
  nit: colors.status.dim,
  none: colors.text.muted,
};

const SEVERITY_LABEL: Record<FindingSeverity, string> = {
  blocker: "Blocker",
  issue: "Issue",
  suggestion: "Suggestion",
  nit: "Nit",
  none: "None",
};

export interface FindingRowProps {
  finding: ReviewFindingItemV1;
  selected: boolean;
  onSelect: (id: string) => void;
  tabIndex?: number;
}

export function FindingRow({
  finding,
  selected,
  onSelect,
  tabIndex = 0,
}: FindingRowProps) {
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(finding.finding_id);
    }
  }

  return (
    <div
      role="row"
      aria-selected={selected}
      tabIndex={tabIndex}
      className={cn(
        "flex items-center gap-4 px-4 py-2.5 cursor-pointer select-none",
        motion.fast,
        selected
          ? cn(colors.bg.elevated, "ring-1 ring-inset", colors.border.strong)
          : cn(colors.bg.surface, colors.hover.bg),
      )}
      onClick={() => onSelect(finding.finding_id)}
      onKeyDown={handleKeyDown}
    >
      {/* Severity: dot + label (lighter than a filled badge; avoids a wall of red) */}
      <div role="gridcell" className="w-24 shrink-0">
        <span
          className={cn(
            "inline-flex items-center gap-x-1.5",
            SEVERITY_COLOR[finding.severity],
          )}
        >
          <span
            aria-hidden="true"
            className="size-1.5 shrink-0 rounded-full bg-current"
          />
          <span className={cn(t.meta, "font-medium")}>
            {SEVERITY_LABEL[finding.severity]}
          </span>
        </span>
      </div>

      {/* Title */}
      <div role="gridcell" className="flex-1 min-w-0">
        <span
          className={cn(
            t.bodyStrong,
            "truncate block",
            selected ? colors.text.accent : colors.text.primary,
          )}
        >
          {finding.title}
        </span>
      </div>

      {/* Location */}
      <div role="gridcell" className="shrink-0">
        <FileLocationChip
          path={finding.file_path}
          startLine={finding.start_line}
          endLine={finding.end_line}
        />
      </div>
    </div>
  );
}
