/**
 * SeveritySummaryStrip -- clickable severity count chips row.
 *
 * Renders one chip per severity that has at least one finding
 * (in order: blocker, issue, suggestion, nit). "none" severity
 * is intentionally excluded from the strip.
 *
 * Clicking a chip toggles it: if already active it calls
 * onSelect(null); otherwise onSelect(severity).
 */

import { cn } from "@/lib/cn";
import { colors, type as t, radius } from "@/lib/design-tokens";
import type { ReviewFindingItemV1 } from "@/lib/api/admin";
import type { StatusKind } from "@/lib/design-tokens";

type Severity = ReviewFindingItemV1["severity"];

// Severities shown in strip (excludes "none")
const SEVERITY_ORDER: Exclude<Severity, "none">[] = [
  "blocker",
  "issue",
  "suggestion",
  "nit",
];

const SEVERITY_KIND: Record<Exclude<Severity, "none">, StatusKind> = {
  blocker: "down",
  issue: "degraded",
  suggestion: "info",
  nit: "dim",
};

const SEVERITY_LABEL_PLURAL: Record<Exclude<Severity, "none">, string> = {
  blocker: "Blockers",
  issue: "Issues",
  suggestion: "Suggestions",
  nit: "Nits",
};

const SEVERITY_LABEL_SINGULAR: Record<Exclude<Severity, "none">, string> = {
  blocker: "Blocker",
  issue: "Issue",
  suggestion: "Suggestion",
  nit: "Nit",
};

export interface SeveritySummaryStripProps {
  findings: ReviewFindingItemV1[];
  active: Severity | null;
  onSelect: (s: Severity | null) => void;
}

export function SeveritySummaryStrip({
  findings,
  active,
  onSelect,
}: SeveritySummaryStripProps) {
  // Count findings per severity
  const counts = new Map<Severity, number>();
  for (const f of findings) {
    counts.set(f.severity, (counts.get(f.severity) ?? 0) + 1);
  }

  const chips = SEVERITY_ORDER.filter((sev) => (counts.get(sev) ?? 0) > 0);

  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((sev) => {
        const count = counts.get(sev) ?? 0;
        const kind = SEVERITY_KIND[sev];
        const label =
          count === 1 ? SEVERITY_LABEL_SINGULAR[sev] : SEVERITY_LABEL_PLURAL[sev];
        const isActive = active === sev;

        return (
          <button
            key={sev}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(isActive ? null : sev)}
            className={cn(
              "inline-flex items-center gap-x-1.5 px-2 py-0.5 transition",
              "cursor-pointer hover:opacity-80",
              radius.sm,
              t.meta,
              colors.statusBg[kind],
              colors.status[kind],
              isActive && `ring-1 ring-inset ${colors.border.strong}`,
            )}
          >
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-current"
            />
            {count} {label}
          </button>
        );
      })}
    </div>
  );
}
