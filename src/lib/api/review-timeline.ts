/**
 * Sprint 16 / S16.F.1 — typed fetch wrapper for /api/admin/review-timeline.
 *
 * The Pydantic source is `contracts/admin/review_timeline/v1.py`;
 * the S16.A.4 codegen will pick these up on the next `make codegen`.
 * Until then types are hand-authored mirrors documented under the
 * S17.X-ts-mirror-lint follow-up.
 */

import { AdminApiError } from "@/lib/api/admin";

// ── Wire types (mirror contracts/admin/review_timeline/v1.py) ────

export interface WebhookEventV1 {
  schema_version: 1;
  webhook_event_id: string;
  installation_id: string | null;
  event_type: string;
  received_at: string;
}

export interface OutboxRowV1 {
  schema_version: 1;
  outbox_id: string;
  sink: string;
  state: "pending" | "leased" | "delivered" | "failed";
  created_at: string;
  leased_until: string | null;
  workflow_id: string | null;
}

export type WorkflowStatusKind =
  | "running"
  | "completed"
  | "failed"
  | "canceled"
  | "terminated"
  | "continued_as_new"
  | "timed_out"
  | "unknown";

export interface WorkflowStatusV1 {
  schema_version: 1;
  workflow_id: string;
  run_id: string | null;
  status: WorkflowStatusKind;
  started_at: string | null;
  closed_at: string | null;
}

export interface LlmCallV1 {
  schema_version: 1;
  llm_call_id: string;
  model: string;
  cost_usd_cents: number;
  latency_ms: number;
  status: "ok" | "error";
  created_at: string;
}

export interface GitHubPostingV1 {
  schema_version: 1;
  kind: "check_run" | "review_comment" | "review";
  posted_at: string;
  external_id: string | null;
  status: "posted" | "failed";
  error_message?: string | null;
}

export interface ReviewTimelineV1 {
  schema_version: 1;
  delivery_id: string;
  webhook: WebhookEventV1 | null;
  outbox: OutboxRowV1 | null;
  workflow: WorkflowStatusV1 | null;
  bedrock_calls: ReadonlyArray<LlmCallV1>;
  github_postings: ReadonlyArray<GitHubPostingV1>;
  warnings: ReadonlyArray<string>;
  sampled_at: string;
}

// ── Fetcher ───────────────────────────────────────────────────────

const TIMELINE_BASE = "/api/admin/review-timeline";
const DEFAULT_TIMEOUT_MS = 15_000;

export const REVIEW_TIMELINE_QUERY_KEYS = {
  all: ["review-timeline"] as const,
  byDelivery: (delivery: string) =>
    [...REVIEW_TIMELINE_QUERY_KEYS.all, delivery] as const,
};

export async function fetchReviewTimeline(
  delivery: string,
): Promise<ReviewTimelineV1> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const url = `${TIMELINE_BASE}?delivery=${encodeURIComponent(delivery)}`;
    const res = await fetch(url, {
      credentials: "include",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (res.status === 401) throw new AdminApiError("unauthenticated", 401, url, null);
    if (res.status === 403) throw new AdminApiError("forbidden", 403, url, null);
    if (res.status === 404) {
      throw new AdminApiError(
        `delivery_id ${delivery} not found`,
        404,
        url,
        null,
      );
    }
    if (!res.ok) {
      throw new AdminApiError(
        `review-timeline fetch failed (${res.status})`,
        res.status,
        url,
        null,
      );
    }
    return (await res.json()) as ReviewTimelineV1;
  } finally {
    clearTimeout(timer);
  }
}
