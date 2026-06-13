/**
 * Sprint 12 / DEMO ONLY — tenant-wide review-pipeline activity.
 *
 * Replaced at S12.2.6 wiring with TanStack Query reads against
 * `/api/v1/platform/activity` (in-flight + recently completed) and
 * `/api/v1/platform/findings/last-24h` (severity breakdown).
 *
 * Locked invariant (PRODUCT.md, head-of-product 2026-05-04): the
 * dashboard surface is strictly review-pipeline activity. NO
 * service health, NO cost cap, NO alerts, NO kill switches.
 * Operational concerns live in Grafana / Slack / Vault.
 */

import type { MyReviewActivity } from "@/lib/mock/engineer-activity";

const IN_FLIGHT: ReadonlyArray<MyReviewActivity> = [
  {
    id: "rev-9831",
    repo: "acme/widget",
    pr_number: 88,
    title: "Refactor cart state machine to xstate v5",
    state: "in_progress",
    severity: { blocker: 0, issue: 0, suggestion: 0, nit: 0 },
    updated_at_label: "8m ago · chunking",
    href: "/reviews/rev-9831",
  },
  {
    id: "rev-9830",
    repo: "acme/api",
    pr_number: 314,
    title: "Add rate-limit middleware to /v1/feedback",
    state: "in_progress",
    severity: { blocker: 0, issue: 0, suggestion: 0, nit: 0 },
    updated_at_label: "3m ago · reviewing",
    href: "/reviews/rev-9830",
  },
  {
    id: "rev-9829",
    repo: "acme/web",
    pr_number: 148,
    title: "Wire dark-mode toggle to user-menu",
    state: "in_progress",
    severity: { blocker: 0, issue: 0, suggestion: 0, nit: 0 },
    updated_at_label: "just now · classifying",
    href: "/reviews/rev-9829",
  },
];

const RECENTLY_COMPLETED: ReadonlyArray<MyReviewActivity> = [
  {
    id: "rev-9828",
    repo: "acme/web",
    pr_number: 147,
    title: "Reduce initial JS bundle by removing momentjs",
    state: "complete",
    severity: { blocker: 0, issue: 1, suggestion: 4, nit: 1 },
    updated_at_label: "12m ago",
    href: "/reviews/rev-9828",
  },
  {
    id: "rev-9827",
    repo: "acme/widget",
    pr_number: 87,
    title: "Bump tailwindcss to v4.1",
    state: "complete",
    severity: { blocker: 0, issue: 0, suggestion: 2, nit: 0 },
    updated_at_label: "26m ago",
    href: "/reviews/rev-9827",
  },
  {
    id: "rev-9826",
    repo: "acme/api",
    pr_number: 313,
    title: "Migrate audit_events.before/after to encrypted columns",
    state: "complete",
    severity: { blocker: 1, issue: 3, suggestion: 5, nit: 0 },
    updated_at_label: "41m ago",
    href: "/reviews/rev-9826",
  },
  {
    id: "rev-9825",
    repo: "acme/web",
    pr_number: 146,
    title: "Add Storybook 8 a11y addon to CI",
    state: "complete",
    severity: { blocker: 0, issue: 0, suggestion: 1, nit: 2 },
    updated_at_label: "1h ago",
    href: "/reviews/rev-9825",
  },
  {
    id: "rev-9823",
    repo: "acme/api",
    pr_number: 312,
    title: "Postgres 16 prep: replication + pg_stat_statements",
    state: "complete",
    severity: { blocker: 0, issue: 2, suggestion: 1, nit: 0 },
    updated_at_label: "2h ago",
    href: "/reviews/rev-9823",
  },
  {
    id: "rev-9822",
    repo: "acme/web",
    pr_number: 145,
    title: "Add a /healthz endpoint that returns 200 only when worker pool is ready",
    state: "failed",
    severity: { blocker: 0, issue: 0, suggestion: 0, nit: 0 },
    updated_at_label: "2h ago · context redaction timed out",
    href: "/reviews/rev-9822",
  },
];

const FINDINGS_LAST_24H = {
  blocker: 1,
  issue: 12,
  suggestion: 31,
  nit: 8,
} as const;

const ROLLUP_LAST_24H = {
  reviews_complete: 47,
  reviews_errored: 2,
  reviews_in_flight: IN_FLIGHT.length,
} as const;

export function getInFlightReviews(): ReadonlyArray<MyReviewActivity> {
  return IN_FLIGHT;
}

export function getRecentlyCompletedReviews(): ReadonlyArray<MyReviewActivity> {
  return RECENTLY_COMPLETED;
}

export function getFindingsLast24h() {
  return FINDINGS_LAST_24H;
}

export function getRollupLast24h() {
  return ROLLUP_LAST_24H;
}
