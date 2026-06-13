/**
 * Review-detail header — PR identity panel.
 *
 * A labeled definition-grid card that gives the PR's identity facts
 * (repo, number, author, branches, review state, publication) their own
 * structure, instead of the loose inline stack that read as one blob.
 * Sits page-level under the title, above the two-column working area, so
 * it stays visible regardless of whether a finding is open in the
 * inspector. Status facts pair icon + text + dot per WCAG.
 */

import { ArrowLongRightIcon, ChevronRightIcon } from "@heroicons/react/20/solid";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";

import { Badge, type BadgeKind } from "@/components/ui/elements/Badge";
import type { ReviewDetailV1, ReviewState } from "@/lib/api/admin";
import { cn } from "@/lib/cn";
import { colors, radius, type as t } from "@/lib/design-tokens";
import { LOCKED_SANITIZE_SCHEMA } from "@/lib/markdown";

const STATE_KIND: Record<ReviewState, BadgeKind> = {
  queued: "dim",
  in_progress: "info",
  complete: "healthy",
  failed: "down",
};

const STATE_LABEL: Record<ReviewState, string> = {
  queued: "Queued",
  in_progress: "In progress",
  complete: "Complete",
  failed: "Failed",
};

type PublicationOutcome = NonNullable<ReviewDetailV1["publication_outcome"]>;

const OUTCOME_KIND: Record<PublicationOutcome, BadgeKind> = {
  inline_posted: "healthy",
  body_only_posted: "degraded",
  degraded_unposted: "down",
};

const OUTCOME_LABEL: Record<PublicationOutcome, string> = {
  inline_posted: "Posted inline",
  body_only_posted: "Posted (summary only)",
  degraded_unposted: "Not posted",
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className={cn(t.caption, colors.text.faint, "uppercase tracking-wide")}>
        {label}
      </dt>
      <dd className={cn(t.body, colors.text.primary, "mt-0.5")}>{children}</dd>
    </div>
  );
}

export function PrIdentityPanel({ detail }: { detail: ReviewDetailV1 }) {
  const outcome = detail.publication_outcome;
  return (
    <dl
      className={cn(
        "grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3",
        colors.bg.muted,
        "border",
        colors.border.default,
        radius.md,
        "p-4 sm:p-5",
      )}
    >
      <Field label="Repository">
        <span className="block truncate" title={detail.repo}>
          {detail.repo}
        </span>
      </Field>

      <Field label="Pull request">
        <span className="tabular-nums">#{detail.pr_number}</span>
      </Field>

      <Field label="Author">@{detail.pr_author ?? "unknown"}</Field>

      <Field label="Branches">
        {detail.head_ref && detail.base_ref ? (
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className="font-mono break-all">{detail.head_ref}</span>
            <ArrowLongRightIcon
              aria-hidden="true"
              className={cn("size-4 shrink-0", colors.text.faint)}
            />
            <span className="font-mono">{detail.base_ref}</span>
          </span>
        ) : (
          <span className={colors.text.faint}>n/a</span>
        )}
      </Field>

      <Field label="Review state">
        <span className="flex flex-wrap items-center gap-2">
          <Badge kind={STATE_KIND[detail.state]} pill>
            {STATE_LABEL[detail.state]}
          </Badge>
          {detail.draft ? (
            <Badge kind="dim" pill>
              Draft
            </Badge>
          ) : null}
        </span>
      </Field>

      <Field label="Publication">
        {outcome ? (
          <Badge kind={OUTCOME_KIND[outcome]} pill>
            {OUTCOME_LABEL[outcome]}
          </Badge>
        ) : (
          <span className={colors.text.faint}>Pending</span>
        )}
      </Field>

      {detail.pr_description ? (
        <div className="col-span-full">
          <details className={cn("group border-t pt-4", colors.border.default)}>
            <summary
              className={cn(
                "flex cursor-pointer items-center gap-x-1 list-none select-none",
                t.caption,
                colors.text.faint,
                colors.hover.text.primary,
                "uppercase tracking-wide",
              )}
            >
              <ChevronRightIcon
                aria-hidden="true"
                className="size-3.5 shrink-0 transition-transform group-open:rotate-90"
              />
              Description
            </summary>
            <div
              className={cn(
                "prose-codemaster mt-2",
                t.body,
                colors.text.primary,
              )}
            >
              <ReactMarkdown
                rehypePlugins={[[rehypeSanitize, LOCKED_SANITIZE_SCHEMA]]}
              >
                {detail.pr_description}
              </ReactMarkdown>
            </div>
          </details>
        </div>
      ) : null}
    </dl>
  );
}
