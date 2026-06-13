/**
 * Sprint 13 / S13.1.4 — Status page (initial mock-backed scaffolding).
 * Sprint 16 / S16.D.3 — wired to `GET /api/admin/status/{pipeline,pilot-progress}`.
 *
 * Two cards:
 *   - Pipeline status: in-flight reviews + last-24h activity rollup
 *     + per-system health states (bedrock, postgres, temporal).
 *     Visible to reader+.
 *   - Pilot Stage 2 progress: orgs onboarded / target + reviews
 *     this week + sprint-day indicator. Operator-only (super_admin
 *     + platform_owner) — the named-org count is sensitive.
 *
 * Both endpoints surface 503 on persistence failure; ErrorState
 * renders + on-call sees the corresponding alert. Pilot zero-state
 * (no installations onboarded yet) renders normally with zeros.
 */

"use client";

import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { useQuery } from "@tanstack/react-query";

import { Card } from "@/components/ui/elements/Card";
import { Empty } from "@/components/ui/states/Empty";
import {
  fetchPilotProgress,
  fetchPipelineStatus,
  STATUS_QUERY_KEYS,
  type HealthState,
  type PilotProgressV1,
  type PipelineStatusV1,
} from "@/lib/api/status";
import { useAdminQueryGuards } from "@/lib/api/use-admin-query-guards";
import { cn } from "@/lib/cn";
import { colors, type as t } from "@/lib/design-tokens";

const HEALTH_LABEL: Record<HealthState, string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  down: "Down",
};

function HealthIcon({ state }: { state: HealthState }) {
  const Icon =
    state === "healthy"
      ? CheckCircleIcon
      : state === "degraded"
        ? ExclamationTriangleIcon
        : XCircleIcon;
  return (
    <span className={cn("inline-flex shrink-0", colors.status[state])}>
      <Icon aria-hidden="true" className="size-5" />
    </span>
  );
}

export default function StatusPage() {
  const pipelineQuery = useQuery({
    queryKey: STATUS_QUERY_KEYS.pipeline(),
    queryFn: fetchPipelineStatus,
    refetchInterval: 30_000, // 30s — auto-refresh per spec.
  });
  const pilotQuery = useQuery({
    queryKey: STATUS_QUERY_KEYS.pilotProgress(),
    queryFn: fetchPilotProgress,
    refetchInterval: 60_000,
    // Pilot endpoint is operator-only (403 for reader). React-query's
    // 403 surfaces via `isError` + the AdminApiError; the guard hook
    // renders the right empty state.
    retry: false,
  });
  const pipelineGuard = useAdminQueryGuards(pipelineQuery, "status-pipeline");

  if (pipelineGuard.guardElement) {
    return <>{pipelineGuard.guardElement}</>;
  }
  if (!pipelineQuery.data) {
    return <></>;
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className={cn(t.display, colors.text.primary)}>Status</h1>
        <p className={cn("mt-2 max-w-2xl", t.bodyLarge, colors.text.muted)}>
          A glance at whether codemaster is healthy and where pilot
          Stage 2 sits. For deeper drill-downs, the platform dashboard
          carries the full metric breakdowns.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PipelineCard data={pipelineQuery.data} />
        <PilotCard query={pilotQuery} />
      </div>
    </div>
  );
}

function PipelineCard({ data }: { data: PipelineStatusV1 }) {
  return (
    <Card padding="lg">
      <h2 className={cn(t.h2, colors.text.primary)}>Pipeline</h2>
      <p className={cn("mt-1", t.body, colors.text.muted)}>
        Trailing 24-hour rollup + per-system health.
      </p>
      <dl className="mt-5 grid grid-cols-3 gap-x-4">
        <Stat
          label="In flight"
          value={String(data.in_flight_review_count)}
          tone="neutral"
        />
        <Stat
          label="Done · 24h"
          value={String(data.last_24h_review_count)}
          tone="neutral"
        />
        <Stat
          label="Findings · 24h"
          value={String(data.last_24h_findings_count)}
          tone="neutral"
        />
      </dl>
      <ul className="mt-5 space-y-2" data-testid="health-list">
        <HealthRow label="Bedrock" state={data.bedrock_health} />
        <HealthRow label="Postgres" state={data.postgres_health} />
        <HealthRow label="Temporal" state={data.temporal_health} />
      </ul>
    </Card>
  );
}

function HealthRow({ label, state }: { label: string; state: HealthState }) {
  return (
    <li
      className="flex items-center gap-x-3"
      data-testid={`health-row-${label.toLowerCase()}`}
    >
      <HealthIcon state={state} />
      <span className={cn(t.body, colors.text.primary)}>{label}</span>
      <span className={cn("ml-auto", t.meta, colors.status[state])}>
        {HEALTH_LABEL[state]}
      </span>
    </li>
  );
}

function PilotCard({
  query,
}: {
  query: {
    data: PilotProgressV1 | undefined;
    isError: boolean;
    error?: unknown;
  };
}) {
  if (query.isError) {
    // 403 (reader/operator) or 503: render a small empty state
    // rather than the whole-page guard; reader users still see
    // pipeline data above.
    return (
      <Card padding="lg">
        <Empty
          title="Pilot progress unavailable"
          body="Operator-level access required, or the persistence layer is unreachable."
        />
      </Card>
    );
  }
  if (!query.data) {
    return <Card padding="lg">{null}</Card>;
  }
  const data = query.data;
  const onTrack = data.total_orgs_onboarded >= data.target_orgs;
  const orgsPct = Math.round(
    (data.total_orgs_onboarded / Math.max(data.target_orgs, 1)) * 100,
  );
  return (
    <Card padding="lg">
      <h2 className={cn(t.h2, colors.text.primary)}>Pilot Stage 2</h2>
      <p className={cn("mt-1", t.body, colors.text.muted)}>
        {onTrack
          ? "On track: minimum onboarding target reached."
          : "Behind target: still under the minimum org count."}
      </p>
      <div className="mt-5">
        <div className="flex items-baseline justify-between">
          <span
            className={cn(t.caption, colors.text.faint, "uppercase tracking-wider")}
          >
            Orgs onboarded
          </span>
          <span
            className={cn(t.meta, colors.text.muted, "tabular-nums")}
            data-testid="orgs-onboarded-label"
          >
            <span className={cn(t.numericLarge, colors.text.primary)}>
              {data.total_orgs_onboarded}
            </span>{" "}
            / {data.target_orgs}
          </span>
        </div>
        <div
          className={cn(
            "mt-2 h-2 overflow-hidden",
            colors.bg.muted,
            "rounded-full",
          )}
          role="progressbar"
          aria-valuenow={data.total_orgs_onboarded}
          aria-valuemin={0}
          aria-valuemax={data.target_orgs}
        >
          <div
            className={cn(
              "h-full",
              onTrack
                ? "bg-[oklch(48%_0.13_165)] dark:bg-[oklch(76%_0.13_165)]"
                : "bg-[oklch(50%_0.14_80)] dark:bg-[oklch(82%_0.16_80)]",
            )}
            style={{ width: `${Math.min(orgsPct, 100)}%` }}
          />
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-x-4">
        <Stat
          label="Reviews this week"
          value={data.total_prs_reviewed_this_week.toLocaleString()}
          tone="neutral"
        />
        <Stat
          label="Sprint day"
          value={`${data.sprint_day} / 14`}
          tone="neutral"
        />
      </dl>
    </Card>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "neutral" | "down";
}) {
  return (
    <div>
      <dt
        className={cn(
          t.caption,
          colors.text.faint,
          "uppercase tracking-wider",
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1",
          t.numericLarge,
          tone === "down" ? colors.status.down : colors.text.primary,
        )}
      >
        {value}
      </dd>
    </div>
  );
}
