/**
 * Sprint 12 / S12.2.1 — platform Dashboard.
 * Sprint 14 / S14.B — wired to GET /api/admin/dashboard.
 *
 * Tenant-wide review-pipeline activity surfaced from the typed
 * `DashboardSummaryV1` envelope: stat band (this-hour count, p95
 * latency, in-flight count) and per-service health rows. Operational
 * concerns (cost cap, alerts, kill switches) live in Grafana / Slack /
 * Vault, not here.
 */

"use client";

import Link from "next/link";

import { useQuery } from "@tanstack/react-query";

import { Badge, type BadgeKind } from "@/components/ui/elements/Badge";
import { Card } from "@/components/ui/elements/Card";
import { Empty } from "@/components/ui/states/Empty";
import { EmptyIllustration } from "@/components/ui/states/EmptyIllustration";
import {
  fetchDashboard,
  QUERY_KEYS,
  type ServiceHealthV1,
} from "@/lib/api/admin";
import { useAdminQueryGuards } from "@/lib/api/use-admin-query-guards";
import { cn } from "@/lib/cn";
import { colors, type as t } from "@/lib/design-tokens";

const SERVICE_KIND: Record<ServiceHealthV1["state"], BadgeKind> = {
  healthy: "healthy",
  degraded: "degraded",
  down: "down",
};

const SERVICE_LABEL: Record<ServiceHealthV1["state"], string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  down: "Down",
};

export default function DashboardPage() {
  const query = useQuery({
    queryKey: QUERY_KEYS.dashboard(),
    queryFn: fetchDashboard,
  });

  const { guardElement } = useAdminQueryGuards(query, "dashboard");
  if (guardElement !== null) return guardElement;

  const data = query.data;
  if (!data) return null;

  return (
    <div className="space-y-8">
      <header>
        <h1 className={cn(t.display, colors.text.primary)}>Dashboard</h1>
        <p className={cn("mt-2 max-w-2xl", t.bodyLarge, colors.text.muted)}>
          Tenant-wide review-pipeline activity — what&apos;s running now and
          how the platform is performing.
        </p>
      </header>

      {/* Stat band */}
      <Section heading="Pipeline · last hour">
        <Card padding="lg">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <Stat
              testId="stat-reviews-this-hour"
              label="Reviews this hour"
              value={data.reviews_this_hour}
            />
            <Stat
              testId="stat-latency-p95"
              label="Latency p95 (ms)"
              value={data.latency_p95_ms}
            />
            <Stat
              testId="stat-in-flight"
              label="In flight"
              value={data.in_flight_reviews}
            />
          </div>
          <p
            className={cn(
              "mt-4 pt-4 border-t",
              colors.border.default,
              t.meta,
              colors.text.faint,
            )}
          >
            Updated{" "}
            <time dateTime={data.last_updated_at}>{data.last_updated_at}</time>
          </p>
        </Card>
      </Section>

      {/* In-flight section — placeholder when 0 (per S14.B AC) */}
      <Section heading={`Reviews in flight (${data.in_flight_reviews})`}>
        {data.in_flight_reviews === 0 ? (
          <Empty
            illustration={<EmptyIllustration />}
            title="No reviews running right now"
            body="When codemaster picks up a PR, it'll appear here while it works through the pipeline."
          />
        ) : (
          <Card padding="md">
            <p className={cn(t.body, colors.text.muted)}>
              {data.in_flight_reviews} review
              {data.in_flight_reviews === 1 ? "" : "s"} currently running.
              Open the{" "}
              <Link
                href="/reviews"
                className={cn(
                  colors.text.accent,
                  "hover:underline underline-offset-4",
                )}
              >
                reviews list
              </Link>{" "}
              to drill in.
            </p>
          </Card>
        )}
      </Section>

      {/* Service health */}
      <Section heading="Services">
        <Card>
          <ul className={cn("divide-y", colors.divider)}>
            {data.services.map((s) => (
              <ServiceRow key={s.name} service={s} />
            ))}
          </ul>
        </Card>
      </Section>
    </div>
  );
}

function Stat({
  testId,
  label,
  value,
}: {
  testId: string;
  label: string;
  value: number;
}) {
  return (
    <div>
      <p className={cn(t.meta, colors.text.muted)}>{label}</p>
      <p
        data-testid={testId}
        className={cn("mt-1 tabular-nums", t.h2, colors.text.primary)}
      >
        {value}
      </p>
    </div>
  );
}

function ServiceRow({ service }: { service: ServiceHealthV1 }) {
  return (
    <li className="flex items-center gap-x-4 px-4 py-3">
      <span className={cn(t.bodyStrong, colors.text.primary, "min-w-24")}>
        {service.name}
      </span>
      <Badge kind={SERVICE_KIND[service.state]} pill>
        {SERVICE_LABEL[service.state]}
      </Badge>
      {service.detail ? (
        <span className={cn(t.meta, colors.text.muted, "truncate")}>
          {service.detail}
        </span>
      ) : null}
    </li>
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
