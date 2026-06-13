/**
 * Sprint 12 / S12.2.x — engineer-home ("Your reviews").
 * Sprint 14 / S14.B — wired to GET /api/admin/your-reviews.
 *
 * Two sections — reviews on PRs you authored, and reviews on PRs you
 * are reviewing — driven directly off the locked YourReviewsPageV1
 * envelope. Each section renders independently: when authored is
 * empty AND assigned is populated, the "Nothing on your PRs" empty
 * state coexists with the populated "Reviews on PRs you're reviewing"
 * card.
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { Card } from "@/components/ui/elements/Card";
import { Empty } from "@/components/ui/states/Empty";
import { EmptyIllustration } from "@/components/ui/states/EmptyIllustration";
import {
  fetchYourReviews,
  QUERY_KEYS,
  type ReviewListItemV1,
} from "@/lib/api/admin";
import { useAdminQueryGuards } from "@/lib/api/use-admin-query-guards";
import { cn } from "@/lib/cn";
import { colors, type as t } from "@/lib/design-tokens";

export default function YourReviewsPage() {
  const router = useRouter();
  const query = useQuery({
    queryKey: QUERY_KEYS.yourReviews(),
    queryFn: fetchYourReviews,
  });

  const { guardElement } = useAdminQueryGuards(query, "your-reviews");
  if (guardElement !== null) return guardElement;

  const data = query.data;
  if (!data) return null;

  const open = (id: string) => router.push(`/reviews/${id}`);

  return (
    <div className="space-y-8">
      <header>
        <h1 className={cn(t.display, colors.text.primary)}>Your activity</h1>
        <p className={cn("mt-2 max-w-2xl", t.bodyLarge, colors.text.muted)}>
          Reviews codemaster has produced on your PRs, and on PRs where
          you&apos;re the reviewer.
        </p>
      </header>

      <Section heading={`Reviews on your PRs (${data.authored.length})`}>
        {data.authored.length === 0 ? (
          <Empty
            illustration={<EmptyIllustration />}
            title="No reviews on your PRs yet"
            body="Push a PR and codemaster will weigh in. Recent activity will appear here."
          />
        ) : (
          <Card>
            <RowGroup>
              {data.authored.map((row) => (
                <ReviewRow key={row.review_id} row={row} onOpen={open} />
              ))}
            </RowGroup>
          </Card>
        )}
      </Section>

      <Section
        heading={`Reviews on PRs you're reviewing (${data.assigned.length})`}
      >
        {data.assigned.length === 0 ? (
          <Empty
            illustration={<EmptyIllustration />}
            title="Nothing waiting on your review"
            body="When you're a reviewer on a PR codemaster has commented on, it'll show up here."
          />
        ) : (
          <Card>
            <RowGroup>
              {data.assigned.map((row) => (
                <ReviewRow key={row.review_id} row={row} onOpen={open} />
              ))}
            </RowGroup>
          </Card>
        )}
      </Section>
    </div>
  );
}

function ReviewRow({
  row,
  onOpen,
}: {
  row: ReviewListItemV1;
  onOpen: (id: string) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(row.review_id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(row.review_id);
        }
      }}
      className={cn(
        "flex items-center gap-x-4 px-4 py-3 cursor-pointer",
        colors.hover.bgElevated,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className={cn("truncate", t.bodyStrong, colors.text.primary)}>
          {row.pr_title}
        </p>
        <p className={cn("mt-1", t.meta, colors.text.muted)}>
          <span className="font-medium">{row.repo}</span>
          <span aria-hidden="true" className={colors.text.faint}>
            {" "}
            ·{" "}
          </span>
          <span className="tabular-nums">#{row.pr_number}</span>
          <span aria-hidden="true" className={colors.text.faint}>
            {" "}
            ·{" "}
          </span>
          <span>{row.finding_count} findings</span>
        </p>
      </div>
    </div>
  );
}

function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className={cn(t.h2, colors.text.primary)}>{heading}</h2>
      {children}
    </section>
  );
}

function RowGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn("divide-y", colors.divider)}>{children}</div>
  );
}
