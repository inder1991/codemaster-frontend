/**
 * Sprint 16 / S16.F.1 — ReviewTimelinePage tests.
 *
 * Six cases covering happy-path + failure modes:
 *   1. No delivery query → guidance empty state.
 *   2. Full chain renders all 5 link rows.
 *   3. Warnings array surfaces a Warnings card.
 *   4. Partial chain → "Missing" labels on absent links.
 *   5. 404 → guard renders (no timeline).
 *   6. 403 → guard renders (no timeline).
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import ReviewTimelinePage from "@/app/(authed)/admin/review-timeline/page";

let mockSearch = "";
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

let fetchSpy: ReturnType<typeof vi.spyOn> | null = null;

function _renderWith(): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ReviewTimelinePage />
    </QueryClientProvider>,
  );
}

function _mockFetch(callback: (url: string) => Response | Promise<Response>): void {
  fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
    async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/telemetry")) {
        return new Response(null, { status: 204 });
      }
      return callback(url);
    },
  );
}

beforeEach(() => {
  mockSearch = "";
  fetchSpy = null;
});

afterEach(() => {
  fetchSpy?.mockRestore();
  fetchSpy = null;
});

describe("ReviewTimelinePage", () => {
  test("no delivery → guidance empty state", () => {
    _renderWith();
    expect(screen.getByText("Provide a delivery_id")).toBeInTheDocument();
  });

  test("full chain renders 5 link rows", async () => {
    mockSearch = "delivery=abc-123";
    _mockFetch(async (url) => {
      if (url.includes("/api/admin/review-timeline")) {
        return new Response(
          JSON.stringify({
            schema_version: 1,
            delivery_id: "abc-123",
            webhook: {
              schema_version: 1,
              webhook_event_id: "11111111-1111-1111-1111-111111111111",
              installation_id: "22222222-2222-2222-2222-222222222222",
              event_type: "pull_request",
              received_at: "2026-05-07T12:00:00Z",
            },
            outbox: {
              schema_version: 1,
              outbox_id: "33333333-3333-3333-3333-333333333333",
              sink: "temporal_workflow_start",
              state: "delivered",
              created_at: "2026-05-07T12:00:01Z",
              leased_until: null,
              workflow_id: "review/x/y/42",
            },
            workflow: {
              schema_version: 1,
              workflow_id: "review/x/y/42",
              run_id: "run-abc",
              status: "completed",
              started_at: "2026-05-07T12:00:01Z",
              closed_at: "2026-05-07T12:00:30Z",
            },
            bedrock_calls: [
              {
                schema_version: 1,
                llm_call_id: "44444444-4444-4444-4444-444444444444",
                model: "anthropic.claude-sonnet-4-6",
                cost_usd_cents: 120,
                latency_ms: 2400,
                status: "ok",
                created_at: "2026-05-07T12:00:10Z",
              },
            ],
            github_postings: [
              {
                schema_version: 1,
                kind: "check_run",
                posted_at: "2026-05-07T12:00:25Z",
                external_id: "cr-1",
                status: "posted",
              },
            ],
            warnings: [],
            sampled_at: "2026-05-07T12:01:00Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(null, { status: 404 });
    });

    _renderWith();
    expect(await screen.findByText("Webhook")).toBeInTheDocument();
    expect(await screen.findByText("Outbox")).toBeInTheDocument();
    expect(await screen.findByText("Workflow")).toBeInTheDocument();
    expect(
      await screen.findByText(/Bedrock calls \(1\)/),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/GitHub postings \(1\)/),
    ).toBeInTheDocument();
    // 5 "Present" badges.
    expect((await screen.findAllByText("Present")).length).toBe(5);
  });

  test("warnings array surfaces a warnings card", async () => {
    mockSearch = "delivery=abc";
    _mockFetch(async () => {
      return new Response(
        JSON.stringify({
          schema_version: 1,
          delivery_id: "abc",
          webhook: {
            schema_version: 1,
            webhook_event_id: "11111111-1111-1111-1111-111111111111",
            installation_id: null,
            event_type: "pull_request",
            received_at: "2026-05-07T12:00:00Z",
          },
          outbox: null,
          workflow: null,
          bedrock_calls: [],
          github_postings: [],
          warnings: ["temporal SDK unreachable"],
          sampled_at: "2026-05-07T12:01:00Z",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    _renderWith();
    expect(await screen.findByText("Warnings")).toBeInTheDocument();
    expect(
      await screen.findByText("temporal SDK unreachable"),
    ).toBeInTheDocument();
  });

  test("partial chain shows Missing labels", async () => {
    mockSearch = "delivery=abc";
    _mockFetch(async () => {
      return new Response(
        JSON.stringify({
          schema_version: 1,
          delivery_id: "abc",
          webhook: {
            schema_version: 1,
            webhook_event_id: "11111111-1111-1111-1111-111111111111",
            installation_id: null,
            event_type: "pull_request",
            received_at: "2026-05-07T12:00:00Z",
          },
          outbox: null,
          workflow: null,
          bedrock_calls: [],
          github_postings: [],
          warnings: [],
          sampled_at: "2026-05-07T12:01:00Z",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    _renderWith();
    expect(await screen.findByText("Webhook")).toBeInTheDocument();
    // 4 missing rows (outbox, workflow, bedrock=0, github=0).
    const missingLabels = await screen.findAllByText("Missing");
    expect(missingLabels.length).toBe(4);
  });

  test("404 hides timeline", async () => {
    mockSearch = "delivery=forged";
    _mockFetch(async () => new Response(JSON.stringify({}), { status: 404 }));

    _renderWith();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByTestId("timeline-render")).not.toBeInTheDocument();
  });

  test("403 hides timeline", async () => {
    mockSearch = "delivery=cross-tenant";
    _mockFetch(async () => new Response(JSON.stringify({}), { status: 403 }));

    _renderWith();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByTestId("timeline-render")).not.toBeInTheDocument();
  });
});
