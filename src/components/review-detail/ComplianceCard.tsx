/**
 * Review-detail rail — compliance scorecard (compact).
 *
 * Rail-compact variant of GovernancePanel. Shows titles (not rule_id)
 * for violated rules; satisfied rules behind a native <details> disclosure;
 * citation source groups with locators behind per-group <details>.
 */

import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/20/solid";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";

import { groupCitationsBySource } from "@/components/review-detail/governance-sources";
import { RailSectionHeading } from "@/components/review-detail/RailSectionHeading";
import type {
  GovernancePanelV1,
  GovernanceRuleV1,
  ReviewFindingCitationV1,
  ReviewFindingItemV1,
} from "@/lib/api/admin";
import { cn } from "@/lib/cn";
import { colors, type as t } from "@/lib/design-tokens";

function ViolatedRule({ rule }: { rule: GovernanceRuleV1 }) {
  return (
    <li className="flex flex-col gap-y-0.5">
      <div className={cn("flex items-center gap-x-1.5", t.meta)}>
        <XCircleIcon
          aria-label="violated"
          className={cn("size-3.5 shrink-0", colors.status.down)}
        />
        <span className={colors.text.primary}>{rule.title}</span>
      </div>
      <span className={cn("ml-5", t.caption, colors.text.muted)}>
        {rule.source_file}
      </span>
    </li>
  );
}

function SatisfiedRule({ rule }: { rule: GovernanceRuleV1 }) {
  return (
    <li className="flex flex-col gap-y-0.5">
      <div className={cn("flex items-center gap-x-1.5", t.meta)}>
        <CheckCircleIcon
          aria-label="satisfied"
          className={cn("size-3.5 shrink-0", colors.status.healthy)}
        />
        <span className={colors.text.primary}>{rule.title}</span>
      </div>
      <span className={cn("ml-5", t.caption, colors.text.muted)}>
        {rule.source_file}
      </span>
    </li>
  );
}

function CitationGroup({
  label,
  citations,
}: {
  label: string;
  citations: ReviewFindingCitationV1[];
}) {
  if (citations.length === 0) return null;
  return (
    <div className="space-y-1">
      <details>
        <summary
          className={cn(
            "cursor-pointer list-none",
            t.meta,
            colors.text.muted,
          )}
        >
          {label} ({citations.length})
        </summary>
        <ul className="mt-1 space-y-0.5 pl-3">
          {citations.map((c, i) => (
            <li
              key={`${c.locator}-${i}`}
              className={cn("font-mono truncate", t.caption, colors.text.muted)}
              title={c.locator}
            >
              {c.locator}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export function ComplianceCard({
  governance,
  findings,
}: {
  governance: GovernancePanelV1 | null;
  findings: ReviewFindingItemV1[];
}) {
  const sources = groupCitationsBySource(findings);
  const hasSources =
    sources.confluence.length > 0 ||
    sources.linter.length > 0 ||
    sources.repoKnowledge.length > 0;

  if (!governance && !hasSources) return null;

  const violated = governance
    ? governance.policy_rules.filter((r) => r.status === "violated")
    : [];
  const satisfied = governance
    ? governance.policy_rules.filter((r) => r.status === "satisfied")
    : [];

  return (
    <section className="space-y-2">
      <RailSectionHeading icon={ShieldCheckIcon}>Compliance</RailSectionHeading>

      {governance ? (
        <div className={cn("flex flex-wrap gap-x-3 tabular-nums", t.meta)}>
          <span className={cn("inline-flex items-center gap-x-1", colors.text.muted)}>
            {governance.applied_count} applied
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-x-1",
              governance.violated_count > 0
                ? colors.status.down
                : colors.text.muted,
            )}
          >
            {governance.violated_count} violated
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-x-1",
              governance.satisfied_count > 0
                ? colors.status.healthy
                : colors.text.muted,
            )}
          >
            {governance.satisfied_count} passed
          </span>
        </div>
      ) : null}

      {violated.length > 0 ? (
        <ul className="space-y-1.5">
          {violated.map((r) => (
            <ViolatedRule key={r.rule_id} rule={r} />
          ))}
        </ul>
      ) : governance ? (
        <p className={cn(t.meta, colors.text.faint)}>No policy violations.</p>
      ) : null}

      {satisfied.length > 0 ? (
        <details>
          <summary
            className={cn(
              "cursor-pointer list-none",
              t.meta,
              colors.text.muted,
              "hover:underline underline-offset-4",
            )}
          >
            Show {satisfied.length} satisfied
          </summary>
          <ul className="mt-1.5 space-y-1.5">
            {satisfied.map((r) => (
              <SatisfiedRule key={r.rule_id} rule={r} />
            ))}
          </ul>
        </details>
      ) : null}

      {hasSources ? (
        <div className="space-y-1 pt-1">
          <CitationGroup label="Confluence" citations={sources.confluence} />
          <CitationGroup label="Repo knowledge" citations={sources.repoKnowledge} />
          <CitationGroup label="Linter" citations={sources.linter} />
        </div>
      ) : null}
    </section>
  );
}
