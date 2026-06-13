/**
 * Sprint 13 / S13.1.4 — StatusPage initial scaffolding.
 * Sprint 16 / S16.D.3 — re-tested against real `/api/admin/status`
 * endpoints (mocked at the fetch layer per the existing admin
 * page-test convention).
 *
 * Six cases covering happy-path + failure modes:
 *
 *   1. Pipeline data renders with all 3 health rows.
 *   2. Degraded bedrock surfaces the right label.
 *   3. Down bedrock surfaces the down label.
 *   4. Pilot 403 (reader role) → empty state in the right card.
 *   5. Pilot zero-state renders normally with zeros.
 *   6. Pipeline 503 → error guard (no pipeline data shown).
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import StatusPage from "@/app/(authed)/status/page";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

let fetchSpy: ReturnType<typeof vi.spyOn> | null = null;

function _renderWith(): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <StatusPage />
    </QueryClientProvider>,
  );
}

function _mockFetch(
  callback: (url: string) => Response | Promise<Response>,
): void {
  fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
    async (input: RequestInfo | URL) => {
      const url = String(input);
      // Telemetry endpoint (S16.F.5) — silently 204.
      if (url.includes("/api/telemetry")) {
        return new Response(null, { status: 204 });
      }
      return callback(url);
    },
  );
}

beforeEach(() => {
  fetchSpy = null;
});

afterEach(() => {
  fetchSpy?.mockRestore();
  fetchSpy = null;
});

describe("StatusPage", () => {
  test("renders pipeline data with all 3 health rows", async () => {
    _mockFetch(async (url) => {
      if (url.endsWith("/api/admin/status/pipeline")) {
        return new Response(
          JSON.stringify({
            schema_version: 1,
            in_flight_review_count: 3,
            last_24h_review_count: 287,
            last_24h_findings_count: 1924,
            last_24h_avg_latency_seconds: 42.5,
            bedrock_health: "healthy",
            postgres_health: "healthy",
            temporal_health: "healthy",
            sampled_at: "2026-05-07T12:00:00Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/api/admin/status/pilot-progress")) {
        return new Response(
          JSON.stringify({
            schema_version: 1,
            total_orgs_onboarded: 6,
            target_orgs: 10,
            total_prs_reviewed_this_week: 213,
            sprint_day: 4,
            sampled_at: "2026-05-07T12:00:00Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(null, { status: 404 });
    });

    _renderWith();
    await screen.findByText("Pipeline");
    expect(await screen.findByText("Bedrock")).toBeInTheDocument();
    expect(await screen.findByText("Postgres")).toBeInTheDocument();
    expect(await screen.findByText("Temporal")).toBeInTheDocument();
    expect((await screen.findAllByText("Healthy")).length).toBe(3);
  });

  test("degraded bedrock label renders", async () => {
    _mockFetch(async (url) => {
      if (url.endsWith("/api/admin/status/pipeline")) {
        return new Response(
          JSON.stringify({
            schema_version: 1,
            in_flight_review_count: 0,
            last_24h_review_count: 12,
            last_24h_findings_count: 4,
            last_24h_avg_latency_seconds: 30.0,
            bedrock_health: "degraded",
            postgres_health: "healthy",
            temporal_health: "healthy",
            sampled_at: "2026-05-07T12:00:00Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/api/admin/status/pilot-progress")) {
        return new Response(JSON.stringify({}), { status: 403 });
      }
      return new Response(null, { status: 404 });
    });

    _renderWith();
    expect(await screen.findByText("Degraded")).toBeInTheDocument();
  });

  test("down bedrock label renders", async () => {
    _mockFetch(async (url) => {
      if (url.endsWith("/api/admin/status/pipeline")) {
        return new Response(
          JSON.stringify({
            schema_version: 1,
            in_flight_review_count: 0,
            last_24h_review_count: 0,
            last_24h_findings_count: 0,
            last_24h_avg_latency_seconds: 0,
            bedrock_health: "down",
            postgres_health: "healthy",
            temporal_health: "healthy",
            sampled_at: "2026-05-07T12:00:00Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/api/admin/status/pilot-progress")) {
        return new Response(JSON.stringify({}), { status: 403 });
      }
      return new Response(null, { status: 404 });
    });

    _renderWith();
    expect(await screen.findByText("Down")).toBeInTheDocument();
  });

  test("pilot 403 renders empty state in pilot card; pipeline still renders", async () => {
    _mockFetch(async (url) => {
      if (url.endsWith("/api/admin/status/pipeline")) {
        return new Response(
          JSON.stringify({
            schema_version: 1,
            in_flight_review_count: 1,
            last_24h_review_count: 5,
            last_24h_findings_count: 2,
            last_24h_avg_latency_seconds: 30.0,
            bedrock_health: "healthy",
            postgres_health: "healthy",
            temporal_health: "healthy",
            sampled_at: "2026-05-07T12:00:00Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/api/admin/status/pilot-progress")) {
        return new Response(JSON.stringify({}), { status: 403 });
      }
      return new Response(null, { status: 404 });
    });

    _renderWith();
    expect(await screen.findByText("Pipeline")).toBeInTheDocument();
    expect(
      await screen.findByText("Pilot progress unavailable"),
    ).toBeInTheDocument();
  });

  test("pilot zero-state renders normally with zeros", async () => {
    _mockFetch(async (url) => {
      if (url.endsWith("/api/admin/status/pipeline")) {
        return new Response(
          JSON.stringify({
            schema_version: 1,
            in_flight_review_count: 0,
            last_24h_review_count: 0,
            last_24h_findings_count: 0,
            last_24h_avg_latency_seconds: 0,
            bedrock_health: "healthy",
            postgres_health: "healthy",
            temporal_health: "healthy",
            sampled_at: "2026-05-07T12:00:00Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/api/admin/status/pilot-progress")) {
        return new Response(
          JSON.stringify({
            schema_version: 1,
            total_orgs_onboarded: 0,
            target_orgs: 10,
            total_prs_reviewed_this_week: 0,
            sprint_day: 1,
            sampled_at: "2026-05-07T12:00:00Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(null, { status: 404 });
    });

    _renderWith();
    expect(await screen.findByText("Pilot Stage 2")).toBeInTheDocument();
    expect(await screen.findByText(/Behind target/)).toBeInTheDocument();
  });

  test("pipeline 503 hides pipeline data", async () => {
    _mockFetch(async (url) => {
      if (url.endsWith("/api/admin/status/pipeline")) {
        return new Response(JSON.stringify({}), { status: 503 });
      }
      if (url.endsWith("/api/admin/status/pilot-progress")) {
        return new Response(JSON.stringify({}), { status: 503 });
      }
      return new Response(null, { status: 404 });
    });

    _renderWith();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText("Bedrock")).not.toBeInTheDocument();
  });
});
