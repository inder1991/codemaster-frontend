/**
 * Sprint 12 / S12.2.6 — tenant-wide severity-counts strip.
 *
 * Locked structure (DESIGN.md): NOT a 4-up tile grid. A single
 * row of pill badges, ordered most-severe first, with tabular-
 * numerals so the counts don't dance during refresh. Dot+label
 * pairing per a11y rule.
 */

"use client";

import { Badge } from "@/components/ui/elements/Badge";
import { cn } from "@/lib/cn";
import { colors, type as t } from "@/lib/design-tokens";

export interface SeverityCounts {
  blocker: number;
  issue: number;
  suggestion: number;
  nit: number;
}

export function SeverityBreakdown({ counts }: { counts: SeverityCounts }) {
  const total = counts.blocker + counts.issue + counts.suggestion + counts.nit;
  if (total === 0) {
    return (
      <p className={cn(t.body, colors.text.muted)}>
        No findings in the last 24 hours.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
      <Badge kind="down" pill>
        <span className="tabular-nums font-semibold">{counts.blocker}</span>{" "}
        {counts.blocker === 1 ? "blocker" : "blockers"}
      </Badge>
      <Badge kind="degraded" pill>
        <span className="tabular-nums font-semibold">{counts.issue}</span>{" "}
        {counts.issue === 1 ? "issue" : "issues"}
      </Badge>
      <Badge kind="info" pill>
        <span className="tabular-nums font-semibold">{counts.suggestion}</span>{" "}
        {counts.suggestion === 1 ? "suggestion" : "suggestions"}
      </Badge>
      <Badge kind="dim" pill>
        <span className="tabular-nums font-semibold">{counts.nit}</span>{" "}
        {counts.nit === 1 ? "nit" : "nits"}
      </Badge>
    </div>
  );
}
