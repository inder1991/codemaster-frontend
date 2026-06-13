/**
 * Sub-spec C T13 (2026-05-28) — rollup banner at the top of
 * /integrations summarizing visibility-violation counts across
 * Confluence integrations.
 *
 * Renders nothing when integrationsWithViolations = 0 — the banner
 * is only useful when there is something to triage.
 *
 * "Visibility violation" is operationally defined here as: the
 * quarantined-chunks endpoint returned at least one row for that
 * integration. A sharper predicate (e.g. specific quarantine-reason
 * strings) is tracked as deferred hardening in the T13 plan-doc.
 */

import Link from "next/link";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

import { cn } from "@/lib/cn";
import { colors, radius, type as t } from "@/lib/design-tokens";

export interface VisibilityViolationBannerProps {
  integrationsWithViolations: number;
  totalIntegrations: number;
}

export function VisibilityViolationBanner({
  integrationsWithViolations,
  totalIntegrations,
}: VisibilityViolationBannerProps) {
  if (integrationsWithViolations <= 0) {
    return null;
  }
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-x-3 px-4 py-3",
        radius.md,
        "bg-[oklch(94%_0.06_85)] dark:bg-[oklch(26%_0.10_85)]",
        "text-[oklch(45%_0.14_85)] dark:text-[oklch(80%_0.12_85)]",
      )}
    >
      <ExclamationTriangleIcon className="size-5 shrink-0 mt-0.5" />
      <div className="flex-1 space-y-1">
        <p className={cn(t.bodyStrong)}>
          {integrationsWithViolations} of {totalIntegrations} integrations
          have quarantined chunks.
        </p>
        <p className={cn(t.meta)}>
          Pages whose labels or visibility metadata conflict with this
          space&apos;s policy were skipped at retrieval time. Triage by
          editing the source pages in Confluence; the next sync recomputes
          the quarantine state.
        </p>
        <Link
          href="/admin/confluence/quarantined-chunks"
          className={cn(t.meta, "underline", colors.text.primary)}
        >
          View details →
        </Link>
      </div>
    </div>
  );
}
