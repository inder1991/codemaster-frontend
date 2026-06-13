/**
 * Sprint 16 / S16.F.1 — Review-timeline debug page.
 *
 * Operator-only page that surfaces every link of the review chain
 * for a given GitHub delivery_id: webhook arrival, outbox write,
 * workflow status (Temporal SDK), Bedrock costs (Langfuse), and
 * GitHub postings (check-run + review).
 *
 * Failure semantics:
 *   - delivery query absent → guidance card.
 *   - 404 → "no chain links found" empty state.
 *   - 403 → page-level error guard via useAdminQueryGuards.
 *   - sub-source warnings (Temporal SDK down, etc.) render inline
 *     above the chain rows.
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";

import { Card } from "@/components/ui/elements/Card";
import { Empty } from "@/components/ui/states/Empty";
import {
  fetchReviewTimeline,
  REVIEW_TIMELINE_QUERY_KEYS,
  type ReviewTimelineV1,
} from "@/lib/api/review-timeline";
import { useAdminQueryGuards } from "@/lib/api/use-admin-query-guards";
import { cn } from "@/lib/cn";
import { colors, type as t } from "@/lib/design-tokens";

export default function ReviewTimelinePage() {
  const params = useSearchParams();
  const delivery = params.get("delivery") ?? "";
  const query = useQuery({
    queryKey: REVIEW_TIMELINE_QUERY_KEYS.byDelivery(delivery),
    queryFn: () => fetchReviewTimeline(delivery),
    enabled: delivery.length > 0,
    retry: false,
  });
  const guard = useAdminQueryGuards(query, "review-timeline");

  return (
    <div className="space-y-8">
      <header>
        <h1 className={cn(t.display, colors.text.primary)}>Review timeline</h1>
        <p className={cn("mt-2 max-w-2xl", t.bodyLarge, colors.text.muted)}>
          Single-pane debug surface joining webhook arrival, outbox write,
          workflow status, Bedrock costs, and GitHub postings for one
          delivery_id.
        </p>
      </header>

      {!delivery && (
        <Card padding="lg">
          <Empty
            title="Provide a delivery_id"
            body="Append `?delivery=<id>` to the URL to load the timeline. The delivery_id is the X-GitHub-Delivery header from the originating webhook."
          />
        </Card>
      )}

      {delivery && guard.guardElement}
      {delivery && !guard.guardElement && query.data && (
        <TimelineRender data={query.data} />
      )}
    </div>
  );
}

function TimelineRender({ data }: { data: ReviewTimelineV1 }) {
  return (
    <div className="space-y-6" data-testid="timeline-render">
      {data.warnings.length > 0 && (
        <Card padding="lg">
          <h2 className={cn(t.h2, colors.text.primary)}>Warnings</h2>
          <ul className={cn("mt-3 list-disc space-y-1 pl-6", t.body, colors.status.degraded)}>
            {data.warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </Card>
      )}

      <ChainLink
        label="Webhook"
        present={data.webhook !== null}
        details={
          data.webhook
            ? `${data.webhook.event_type} · received ${data.webhook.received_at}`
            : "no audit row found"
        }
      />
      <ChainLink
        label="Outbox"
        present={data.outbox !== null}
        details={
          data.outbox
            ? `state=${data.outbox.state} · workflow_id=${data.outbox.workflow_id ?? "none"}`
            : "no outbox row found"
        }
      />
      <ChainLink
        label="Workflow"
        present={data.workflow !== null}
        details={
          data.workflow
            ? `status=${data.workflow.status} · started=${data.workflow.started_at ?? "—"}`
            : "no workflow record"
        }
      />
      <ChainLink
        label={`Bedrock calls (${data.bedrock_calls.length})`}
        present={data.bedrock_calls.length > 0}
        details={
          data.bedrock_calls.length > 0
            ? `total cost ${data.bedrock_calls.reduce((s, c) => s + c.cost_usd_cents, 0)} cents`
            : "no Bedrock calls recorded"
        }
      />
      <ChainLink
        label={`GitHub postings (${data.github_postings.length})`}
        present={data.github_postings.length > 0}
        details={
          data.github_postings.length > 0
            ? data.github_postings.map((p) => `${p.kind} · ${p.status}`).join(" / ")
            : "no postings recorded"
        }
      />
    </div>
  );
}

function ChainLink({
  label,
  present,
  details,
}: {
  label: string;
  present: boolean;
  details: string;
}) {
  return (
    <Card padding="md">
      <div className="flex items-baseline justify-between gap-x-3">
        <span
          className={cn(
            t.bodyStrong,
            present ? colors.text.primary : colors.text.faint,
          )}
        >
          {label}
        </span>
        <span
          className={cn(t.meta, present ? colors.status.healthy : colors.text.faint)}
        >
          {present ? "Present" : "Missing"}
        </span>
      </div>
      <p className={cn("mt-1", t.meta, colors.text.muted)}>{details}</p>
    </Card>
  );
}
