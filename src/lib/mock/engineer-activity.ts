/**
 * Sprint 12 / DEMO ONLY — engineer-home stubbed activity.
 *
 * Replaced at S12.2.x wiring with TanStack Query reads against
 * `/api/v1/me/reviews` and `/api/v1/me/proposals`. The shape below
 * is the contract those endpoints will return; the page is built
 * against this contract today so the swap is mechanical.
 *
 * Locked invariant (PRODUCT.md): the engineer-home is a CURATED
 * activity surface, not a search tool. Lists are pre-scoped (by me /
 * by reviewer-me) and pre-filtered to a small recency window.
 */

// Sprint 14 / S14.B — aligned with the canonical ReviewState in
// `frontend/src/lib/api/admin.ts` (which mirrors
// `contracts/admin/v1.py`). The pre-S14 "errored" literal was a
// frontend-only invention and never matched the backend.
export type ReviewState =
  | "queued"
  | "in_progress"
  | "complete"
  | "failed";

export type ProposalState = "pending" | "approved" | "rejected";

export type ActivityScope = "authored" | "reviewing";

/**
 * One row in either of the two primary activity lists. The two
 * lists share shape; only the scope differs.
 */
export interface MyReviewActivity {
  id: string;
  repo: string;
  pr_number: number;
  title: string;
  state: ReviewState;
  severity: {
    blocker: number;
    issue: number;
    suggestion: number;
    nit: number;
  };
  /** Pre-formatted, locale-aware label so SSR doesn't reflow. */
  updated_at_label: string;
  /** Internal review-detail link. */
  href: string;
}

export interface PendingProposal {
  id: string;
  title: string;
  repo: string;
  state: ProposalState;
  submitted_at_label: string;
  href: string;
}

const ACTIVITY_AUTHORED: ReadonlyArray<MyReviewActivity> = [
  {
    id: "rev-9821",
    repo: "acme/web",
    pr_number: 142,
    title: "Add formatCurrency helper for the cart subtotal row",
    state: "complete",
    severity: { blocker: 0, issue: 3, suggestion: 1, nit: 0 },
    updated_at_label: "3h ago",
    href: "/reviews/rev-9821",
  },
  {
    id: "rev-9817",
    repo: "acme/widget",
    pr_number: 87,
    title: "Migrate cart state machine to xstate v5",
    state: "in_progress",
    severity: { blocker: 0, issue: 0, suggestion: 0, nit: 0 },
    updated_at_label: "12m ago",
    href: "/reviews/rev-9817",
  },
  {
    id: "rev-9803",
    repo: "acme/api",
    pr_number: 311,
    title: "Bump pgvector to 0.7 and reindex the audit table",
    state: "complete",
    severity: { blocker: 1, issue: 2, suggestion: 4, nit: 1 },
    updated_at_label: "yesterday",
    href: "/reviews/rev-9803",
  },
  {
    id: "rev-9788",
    repo: "acme/web",
    pr_number: 138,
    title: "Reduce Storybook bundle by 40 percent",
    state: "complete",
    severity: { blocker: 0, issue: 0, suggestion: 2, nit: 1 },
    updated_at_label: "2d ago",
    href: "/reviews/rev-9788",
  },
];

const ACTIVITY_REVIEWING: ReadonlyArray<MyReviewActivity> = [
  {
    id: "rev-9824",
    repo: "acme/web",
    pr_number: 145,
    title: "Adam: add dark-mode toggle to user-menu",
    state: "complete",
    severity: { blocker: 0, issue: 1, suggestion: 2, nit: 0 },
    updated_at_label: "1h ago",
    href: "/reviews/rev-9824",
  },
  {
    id: "rev-9810",
    repo: "acme/api",
    pr_number: 312,
    title: "Beth: Postgres 16 prep, replication settings",
    state: "complete",
    severity: { blocker: 0, issue: 0, suggestion: 1, nit: 0 },
    updated_at_label: "yesterday",
    href: "/reviews/rev-9810",
  },
];

const PROPOSALS: ReadonlyArray<PendingProposal> = [
  {
    id: "prop-501",
    title: "Always pass installation_id when constructing QueryBuilder",
    repo: "acme/api",
    state: "pending",
    submitted_at_label: "5h ago",
    href: "/knowledge/proposals/prop-501",
  },
  {
    id: "prop-498",
    title: "Use infra.clock.now() instead of datetime.utcnow()",
    repo: "acme/web",
    state: "pending",
    submitted_at_label: "yesterday",
    href: "/knowledge/proposals/prop-498",
  },
];

export function getMyActivity(
  scope: ActivityScope,
  // windowDays accepted so the swap-in real fetch keeps the same
  // signature; the stub ignores it.
  _windowDays: 7 | 30 | 90,
): ReadonlyArray<MyReviewActivity> {
  return scope === "authored" ? ACTIVITY_AUTHORED : ACTIVITY_REVIEWING;
}

export function getMyPendingProposals(): ReadonlyArray<PendingProposal> {
  return PROPOSALS;
}
