/**
 * Sprint 12 / S12.2.2 — Reviews list page.
 * Sprint 14 / S14.B — wired to GET /api/admin/reviews.
 * Sprint N / Task 9 — URL-synced filters, pagination, Started column,
 *   header count. Mirrors the audit-log URL-filter pattern.
 *
 * Closes audit B4 contract-drift: the prior code declared
 * `ReviewState = "queued" | "in_progress" | "complete" | "errored"`
 * while no backend ever produced "errored" — the canonical state in
 * `contracts/admin/v1.py` is `"failed"`. The frontend now mirrors
 * the backend type via `frontend/src/lib/api/admin.ts`.
 *
 * Visible to platform_operator+. Engineer-tier users see only
 * `/your-reviews` (their own + reviews where they're the reviewer).
 */

"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge, type BadgeKind } from "@/components/ui/elements/Badge";
import { Card } from "@/components/ui/elements/Card";
import { ReviewsTable } from "@/components/ui/lists/ReviewsTable";
import type { Column } from "@/components/ui/lists/ReviewsTable";
import { Empty } from "@/components/ui/states/Empty";
import { EmptyIllustration } from "@/components/ui/states/EmptyIllustration";
import { ErrorState } from "@/components/ui/states/Error";
import { Loading } from "@/components/ui/states/Loading";
import { Pagination } from "@/components/review-list/Pagination";
import {
  ReviewsFilters,
  type ReviewFilterValues,
} from "@/components/review-list/ReviewsFilters";
import {
  fetchReviewsList,
  fetchReviewOrgs,
  QUERY_KEYS,
  type ReviewListItemV1,
  type ReviewState,
} from "@/lib/api/admin";
import { cn } from "@/lib/cn";
import { colors, type as t } from "@/lib/design-tokens";
import { formatRelativeTime } from "@/lib/format/relative-time";
import { stripRunPrefix } from "@/lib/review-title";

type Severity = "blocker" | "issue" | "suggestion" | "nit" | "none";

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

const SEVERITY_KIND: Record<Severity, BadgeKind> = {
  blocker: "down",
  issue: "degraded",
  suggestion: "info",
  nit: "dim",
  none: "neutral",
};

function severityOf(row: ReviewListItemV1): Severity {
  return row.severity_max ?? "none";
}

// ── URL helpers ────────────────────────────────────────────────────

function readFilters(p: URLSearchParams): ReviewFilterValues {
  return {
    q: p.get("q") ?? "",
    org: p.get("org") ?? "",
    repo: p.get("repo") ?? "",
    state: p.get("state") ?? "",
  };
}
function readPage(p: URLSearchParams): number {
  const n = Number(p.get("page") ?? "1");
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}
function toParams(f: ReviewFilterValues, page: number): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.org) p.set("org", f.org);
  if (f.repo.trim()) p.set("repo", f.repo.trim());
  if (f.state) p.set("state", f.state);
  if (page > 1) p.set("page", String(page));
  return p;
}

// Static (no render-time deps): hoisted to a module constant so it is not
// rebuilt on every render.
const COLUMNS: ReadonlyArray<Column<ReviewListItemV1>> = [
  { header: "Repo", cell: (r) => r.repo },
  {
    header: "PR",
    cell: (r) => <span className="tabular-nums">#{r.pr_number}</span>,
  },
  {
    header: "Title",
    cell: (r) => (
      <span className="block max-w-[28rem] truncate" title={r.pr_title}>
        {stripRunPrefix(r.pr_title)}
      </span>
    ),
  },
  {
    header: "Started",
    cell: (r) => (
      <span title={new Date(r.started_at).toLocaleString()}>
        {formatRelativeTime(r.started_at)}
      </span>
    ),
  },
  {
    header: "State",
    cell: (r) => (
      <Badge kind={STATE_KIND[r.state]} size="xs" pill>
        {STATE_LABEL[r.state]}
      </Badge>
    ),
    hiddenOnMobile: true,
  },
  {
    header: "Severity",
    cell: (r) => {
      const sev = severityOf(r);
      return sev === "none" ? (
        <span className={cn(t.meta, colors.text.muted)}>none</span>
      ) : (
        <Badge kind={SEVERITY_KIND[sev]} size="xs" pill>
          {sev}
        </Badge>
      );
    },
    hiddenOnMobile: true,
  },
  {
    header: "Findings",
    cell: (r) => <span className="tabular-nums">{r.finding_count}</span>,
    hiddenOnMobile: true,
  },
];

export default function ReviewsListPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);
  const SIZE = 50;

  // The debounce timer below reads this at fire time (not a captured snapshot)
  // so a filter changed mid-debounce is not clobbered by the pending q write.
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const [qDraft, setQDraft] = useState(filters.q);
  useEffect(() => setQDraft(filters.q), [filters.q]);

  function writeUrl(next: ReviewFilterValues, nextPage: number) {
    const qs = toParams(next, nextPage).toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }
  function onFilterChange(partial: Partial<ReviewFilterValues>) {
    const next = { ...filters, ...partial };
    const keys = Object.keys(partial) as (keyof ReviewFilterValues)[];
    // Search box: only `q` changed → debounce through qDraft (the URL write
    // happens in the timeout effect below).
    if (keys.length === 1 && keys[0] === "q") {
      setQDraft(partial.q ?? "");
      return;
    }
    // Any other change — a non-`q` filter, or a multi-key "Clear filters"
    // payload — writes the URL immediately and resets to page 1.
    if ("q" in partial) setQDraft(partial.q ?? "");
    writeUrl(next, 1);
  }
  useEffect(() => {
    const id = window.setTimeout(() => {
      const current = filtersRef.current;
      if (qDraft !== current.q) writeUrl({ ...current, q: qDraft }, 1);
    }, 300);
    return () => window.clearTimeout(id);
  }, [qDraft]); // eslint-disable-line react-hooks/exhaustive-deps

  const orgsQuery = useQuery({
    queryKey: QUERY_KEYS.reviewOrgs(),
    queryFn: fetchReviewOrgs,
    staleTime: 5 * 60_000,
  });

  const query = useQuery({
    queryKey: QUERY_KEYS.reviewsList({ ...filters, page, size: SIZE }),
    queryFn: () => fetchReviewsList({ ...filters, page, size: SIZE }),
    placeholderData: keepPreviousData,
  });

  // Clamp out-of-range page after data loads.
  useEffect(() => {
    const data = query.data;
    if (!data) return;
    // An out-of-range page returns an empty slice, and the backend reports
    // total=0 for it (COUNT(*) OVER () has no row to read). Recover to page 1
    // rather than dead-ending on the "no reviews" empty state.
    if (data.items.length === 0 && page > 1) {
      writeUrl(filters, 1);
      return;
    }
    if (data.total > 0) {
      const lastPage = Math.max(1, Math.ceil(data.total / data.size));
      if (page > lastPage) writeUrl(filters, lastPage);
    }
  }, [query.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = query.data?.total;
  const items = query.data?.items ?? [];
  const hasActiveFilter = Boolean(
    filters.q || filters.org || filters.repo || filters.state,
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className={cn(t.display, colors.text.primary)}>
          Reviews{typeof total === "number" && total > 0 ? ` (${total})` : ""}
        </h1>
        <p className={cn("mt-2 max-w-2xl", t.bodyLarge, colors.text.muted)}>
          Reviews across your tenant. Open one for its activity timeline and findings.
        </p>
      </header>

      <ReviewsFilters
        values={{ ...filters, q: qDraft }}
        orgs={orgsQuery.data?.orgs ?? []}
        orgsLoading={orgsQuery.isLoading}
        orgsError={orgsQuery.isError}
        onChange={onFilterChange}
      />

      {query.isLoading ? (
        <div data-testid="reviews-loading">
          <Loading label="Loading reviews…" />
        </div>
      ) : query.isError ? (
        <div data-testid="reviews-error">
          <ErrorState
            title="Couldn't load reviews"
            body="Something went wrong fetching the reviews list. Please retry."
            onRetry={() => query.refetch()}
          />
        </div>
      ) : query.data && items.length === 0 ? (
        hasActiveFilter ? (
          <div className="space-y-3">
            <p className={cn(t.body, colors.text.muted)}>
              No reviews match these filters.
            </p>
            <button
              type="button"
              className={cn(t.meta, colors.text.primary, "underline")}
              onClick={() =>
                onFilterChange({ q: "", org: "", repo: "", state: "" })
              }
            >
              Clear filters
            </button>
          </div>
        ) : (
          <Empty
            illustration={<EmptyIllustration />}
            title="No reviews yet"
            body="Reviews appear here as codemaster processes PRs across your tenant."
          />
        )
      ) : query.data ? (
        <>
          <Card padding="md">
            <ReviewsTable
              rows={query.data.items}
              columns={COLUMNS}
              rowKey={(r) => r.review_id}
              caption="Reviews"
              rowHref={(r) => `/reviews/${r.review_id}`}
              rowLabel={(r) => `Open review for ${r.repo} #${r.pr_number}`}
            />
          </Card>
          <Pagination
            total={query.data.total}
            page={query.data.page}
            size={query.data.size}
            onPageChange={(p) => writeUrl(filters, p)}
          />
        </>
      ) : null}
    </div>
  );
}
