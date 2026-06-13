/**
 * Review-detail rail -- rail-compact walkthrough summary.
 *
 * Rail-compact variant of WalkthroughBlock. TL;DR + degradation note +
 * file rows behind a disclosure + linked issues + suggested reviewers.
 * Renders nothing when walkthrough is null.
 */

import { DocumentTextIcon } from "@heroicons/react/24/outline";

import { RailSectionHeading } from "@/components/review-detail/RailSectionHeading";
import { Badge, type BadgeKind } from "@/components/ui/elements/Badge";
import type {
  WalkthroughFileRowV1,
  WalkthroughSummaryV1,
} from "@/lib/api/admin";
import { cn } from "@/lib/cn";
import { colors, radius, type as t } from "@/lib/design-tokens";

const SEVERITY_KIND: Record<WalkthroughFileRowV1["severity_max"], BadgeKind> = {
  blocker: "down",
  issue: "degraded",
  suggestion: "info",
  nit: "dim",
};

export function WalkthroughRail({
  walkthrough,
}: {
  walkthrough: WalkthroughSummaryV1 | null;
}) {
  if (!walkthrough) return null;

  return (
    <section className="space-y-2">
      <RailSectionHeading icon={DocumentTextIcon}>Walkthrough</RailSectionHeading>

      <p className={cn(t.body, colors.text.primary)}>{walkthrough.tldr}</p>

      {walkthrough.degradation_note ? (
        <p className={cn(t.caption, colors.status.degraded)}>
          {walkthrough.degradation_note}
        </p>
      ) : null}

      {walkthrough.file_rows.length > 0 ? (
        <details>
          <summary
            className={cn(
              "cursor-pointer list-none",
              t.meta,
              colors.text.muted,
            )}
          >
            {walkthrough.file_rows.length} files changed
          </summary>
          <ul className="mt-1.5 space-y-1">
            {walkthrough.file_rows.map((row) => (
              <li
                key={row.path}
                className={cn("flex flex-wrap items-baseline gap-x-2", t.meta)}
              >
                <Badge kind={SEVERITY_KIND[row.severity_max]} size="xs" pill>
                  {row.severity_max}
                </Badge>
                <span
                  className={cn(
                    "font-mono truncate max-w-[16rem]",
                    colors.text.primary,
                  )}
                  title={row.path}
                >
                  {row.path}
                </span>
                <span
                  className={cn("tabular-nums", colors.text.muted)}
                >
                  ({row.finding_count})
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {walkthrough.linked_issues.length > 0 ? (
        <div className={cn("flex flex-wrap gap-1", t.caption)}>
          {walkthrough.linked_issues.map((li) => (
            <span
              key={li.issue_number}
              className={cn(
                colors.bg.muted,
                colors.text.muted,
                radius.full,
                "px-2 py-0.5",
              )}
              title={li.title ?? undefined}
            >
              #{li.issue_number} {li.linkage_kind}
            </span>
          ))}
        </div>
      ) : null}

      {walkthrough.suggested_reviewers.length > 0 ? (
        <div className={cn("flex flex-wrap gap-1", t.caption)}>
          {walkthrough.suggested_reviewers.map((login) => (
            <span
              key={login}
              className={cn(
                colors.bg.muted,
                colors.text.muted,
                radius.full,
                "px-2 py-0.5",
              )}
            >
              @{login}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
