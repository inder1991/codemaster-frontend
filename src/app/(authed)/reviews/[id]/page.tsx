/**
 * Sprint 12 / S12.2.5 — review-detail page.
 * Sprint 14 / S14.B — wired to GET /api/admin/reviews/{id}.
 * Review-detail P1-B (2026-05-30) — engineer-value redesign: PR meta-row
 * + publication verdict, author PR description, findings grouped by
 * category (Security → Logic → …) with confidence + evidence restored,
 * and the workflow stage strip (data the old page fetched but never
 * showed).
 *
 * Trust-traceability invariant: PR description AND finding body/suggestion are rendered via rehype-sanitize (no raw HTML, no dangerouslySetInnerHTML); finding title + citations remain text nodes.
 */

"use client";

import { ChevronLeftIcon } from "@heroicons/react/20/solid";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";

import { ContextRail } from "@/components/review-detail/ContextRail";
import { FindingInspector } from "@/components/review-detail/FindingInspector";
import { FindingsLedger } from "@/components/review-detail/FindingsLedger";
import { FixPromptHero } from "@/components/review-detail/FixPromptHero";
import { PrIdentityPanel } from "@/components/review-detail/PrIdentityPanel";
import { ReviewIdChip } from "@/components/review-detail/ReviewIdChip";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import {
  fetchReviewDetail,
  QUERY_KEYS,
  type ReviewDetailV1,
} from "@/lib/api/admin";
import { useAdminQueryGuards } from "@/lib/api/use-admin-query-guards";
import { cn } from "@/lib/cn";
import { colors, motion, type as t } from "@/lib/design-tokens";
import { stripRunPrefix } from "@/lib/review-title";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ReviewDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const query = useQuery({
    queryKey: QUERY_KEYS.reviewDetail(id),
    queryFn: () => fetchReviewDetail(id),
    enabled: id.length > 0,
  });

  const { guardElement } = useAdminQueryGuards(query, "review-detail");
  if (guardElement !== null) return guardElement;

  const review = query.data;
  if (!review) return null;

  return <ReviewDetailBody review={review} />;
}

function ReviewDetailBody({ review }: { review: ReviewDetailV1 }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    review.findings.find((f) => f.finding_id === selectedId) ?? null;

  // A review opens from several lists (Reviews, Your activity, …), so "Back"
  // returns to wherever the user actually came from. Fall back to the canonical
  // Reviews list when there is no in-app history (direct / deep link).
  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/reviews");
    }
  }

  // Smoke/automation PRs prefix the title with a `[run:<uuid>]` tag. That run
  // id is machine noise in the page heading (it stays visible in the Branches
  // field below), so surface the human-meaningful title in the H1.
  const displayTitle = stripRunPrefix(review.pr_title);

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={handleBack}
        className={cn(
          "inline-flex items-center gap-x-1",
          t.meta,
          colors.text.muted,
          colors.hover.text.primary,
          motion.fast,
        )}
      >
        <ChevronLeftIcon
          aria-hidden="true"
          className={cn("size-4", colors.text.faint)}
        />
        Back
      </button>

      <header className="space-y-4">
        <div className="flex items-start justify-between gap-x-4">
          <div className="min-w-0 space-y-1.5">
            <p
              className={cn(
                t.caption,
                colors.text.muted,
                "uppercase tracking-wide",
              )}
            >
              Code review
            </p>
            <h1 className={cn(t.display, colors.text.primary, "line-clamp-2")}>
              {displayTitle}
            </h1>
          </div>
          <ReviewIdChip reviewId={review.review_id} />
        </div>
        <PrIdentityPanel detail={review} />
      </header>

      <FixPromptHero fixPrompt={review.fix_prompt} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <main className="min-w-0 space-y-4">
          <div className="flex items-baseline justify-between gap-x-3">
            <h2 className={cn(t.h2, colors.text.primary)}>
              Findings ({review.findings.length})
            </h2>
          </div>
          <FindingsLedger
            findings={review.findings}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId((cur) => (cur === id ? null : id))}
          />
          <p className={cn(t.meta, colors.text.muted)}>
            <Link
              href="/knowledge/proposals"
              className={cn(
                colors.text.accent,
                "hover:underline underline-offset-4",
                motion.fast,
              )}
            >
              Promote a learning &rarr;
            </Link>
          </p>
        </main>
        <aside className="lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
          <ErrorBoundary
            fallback={
              <div className={cn(t.caption, colors.status.down, "p-4")}>
                Could not render this panel.
              </div>
            }
          >
            {selected ? (
              <FindingInspector
                finding={selected}
                reviewId={review.review_id}
                onClose={() => setSelectedId(null)}
              />
            ) : (
              <ContextRail detail={review} />
            )}
          </ErrorBoundary>
        </aside>
      </div>
    </div>
  );
}
