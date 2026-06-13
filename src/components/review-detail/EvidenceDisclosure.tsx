/**
 * Review-detail P1-B — per-finding evidence disclosure.
 *
 * The trust-traceability footnote the wired page dropped: a collapsed
 * "Evidence (N)" control that expands to the finding's citations (kind +
 * locator + optional excerpt), each walking back to its governing source.
 * Citations render as text nodes only (no dangerouslySetInnerHTML).
 */

"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/elements/Badge";
import type { ReviewFindingCitationV1 } from "@/lib/api/admin";
import { cn } from "@/lib/cn";
import { colors, motion, type as t } from "@/lib/design-tokens";

export function EvidenceDisclosure({
  citations,
}: {
  citations: ReviewFindingCitationV1[];
}) {
  const [expanded, setExpanded] = useState(false);
  if (citations.length === 0) return null;
  return (
    <div className="mt-3">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "inline-flex items-center gap-x-1",
          t.meta,
          colors.text.accent,
          "hover:underline underline-offset-4",
          motion.fast,
        )}
      >
        {expanded ? "▾" : "▸"} Evidence ({citations.length})
      </button>
      {expanded ? (
        <ul className={cn("mt-2 space-y-1.5", "border-t pt-2", colors.border.default)}>
          {citations.map((c, i) => (
            <li
              key={`${c.kind}-${c.locator}-${i}`}
              className={cn("flex flex-wrap items-baseline gap-x-2", t.meta)}
            >
              <Badge kind="neutral" size="xs" showDot={false}>
                {c.kind}
              </Badge>
              <span className={cn("font-mono", colors.text.primary)}>
                {c.locator}
              </span>
              {c.excerpt ? (
                <span className={cn("italic", colors.text.muted)}>
                  {c.excerpt}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
