/**
 * Review-detail rail -- pipeline and debug links.
 *
 * Shows the activities pipeline strip (behind a disclosure) and
 * deep-links to Temporal, Langfuse, and the retrieval trace. Renders
 * nothing when all of activities/temporal_url/langfuse_url/retrieval_trace_id
 * are absent. Role-gating is applied by the parent.
 */

import { ArrowTopRightOnSquareIcon } from "@heroicons/react/20/solid";
import { WrenchScrewdriverIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

import { RailSectionHeading } from "@/components/review-detail/RailSectionHeading";
import { StageStrip } from "@/components/review-detail/StageStrip";
import type { ReviewDetailV1 } from "@/lib/api/admin";
import { cn } from "@/lib/cn";
import { colors, type as t } from "@/lib/design-tokens";

const LINK_CLS = cn(
  t.meta,
  colors.text.accent,
  "inline-flex items-center gap-1",
);

export function DebugLinks({ detail }: { detail: ReviewDetailV1 }) {
  const hasActivities = detail.activities.length > 0;
  const hasLinks =
    Boolean(detail.temporal_url) ||
    Boolean(detail.langfuse_url) ||
    Boolean(detail.retrieval_trace_id);

  if (!hasActivities && !hasLinks) return null;

  return (
    <section className="space-y-2">
      <RailSectionHeading icon={WrenchScrewdriverIcon}>
        Pipeline &amp; debug
      </RailSectionHeading>

      {hasActivities ? (
        <details>
          <summary
            className={cn(
              "cursor-pointer list-none",
              t.meta,
              colors.text.muted,
            )}
          >
            Pipeline ({detail.activities.length} stages)
          </summary>
          <div className="mt-1.5">
            <StageStrip activities={detail.activities} />
          </div>
        </details>
      ) : null}

      <div className="flex flex-col gap-y-1">
        {detail.temporal_url ? (
          <a
            href={detail.temporal_url}
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_CLS}
          >
            Temporal workflow
            <ArrowTopRightOnSquareIcon className="size-3 shrink-0" aria-hidden="true" />
          </a>
        ) : null}

        {detail.langfuse_url ? (
          <a
            href={detail.langfuse_url}
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_CLS}
          >
            Langfuse trace
            <ArrowTopRightOnSquareIcon className="size-3 shrink-0" aria-hidden="true" />
          </a>
        ) : null}

        {detail.retrieval_trace_id ? (
          <Link
            href={`/admin/retrieval-traces/${detail.retrieval_trace_id}`}
            className={LINK_CLS}
          >
            Retrieval trace
            <ArrowTopRightOnSquareIcon className="size-3 shrink-0" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </section>
  );
}
