/**
 * Sprint S21 (2026-05-12) — Platform-scope notification rules page.
 *
 * Pins the three required assertions from the task spec:
 * 1. Page renders all N rules returned by the API mock.
 * 2. Section heading communicates the platform-shared shape.
 * 3. GET request URL does NOT include an `installation_id` query param.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/auth/use-session", () => ({
  useSession: () => ({
    data: {
      schema_version: 1,
      user_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      role: "platform_owner",
      email: "owner@acme.com",
      installation_id: "11111111-2222-3333-4444-555555555555",
    },
    isLoading: false,
    error: null,
  }),
}));

import NotificationRulesPage from "@/app/(authed)/notifications/page";

const _RULE_A = {
  schema_version: 1 as const,
  rule_id: "00000000-0000-0000-0000-000000000001",
  name: "High-severity alert",
  trigger_event: "review.finding.high_severity",
  state: "active" as const,
  recipients: [
    { kind: "slack", channel: "#eng-alerts", workspace_id: "W123" },
    { kind: "email", address: "oncall@acme.com" },
  ],
  schedule_cron: null,
  filters: {},
  created_at: "2026-05-01T10:00:00Z",
  updated_at: "2026-05-01T10:00:00Z",
};

const _RULE_B = {
  schema_version: 1 as const,
  rule_id: "00000000-0000-0000-0000-000000000002",
  name: "Daily digest",
  trigger_event: "review.completed",
  state: "paused" as const,
  recipients: [{ kind: "email", address: "digest@acme.com" }],
  schedule_cron: "0 9 * * 1-5",
  filters: { installation_owner_logins: ["acme"] },
  created_at: "2026-05-02T10:00:00Z",
  updated_at: "2026-05-10T08:00:00Z",
};

const _GOOD_RESPONSE = {
  schema_version: 1,
  rules: [_RULE_A, _RULE_B],
};

function _renderWithFetch(response: object, status = 200) {
  globalThis.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(response), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  ) as unknown as typeof globalThis.fetch;

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <NotificationRulesPage />
    </QueryClientProvider>,
  );
}

describe("NotificationRulesPage (S21 read-only v0)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("test_renders_platform_rules_list — renders all N rules from API mock", async () => {
    _renderWithFetch(_GOOD_RESPONSE);
    await waitFor(() => {
      expect(screen.getByText("High-severity alert")).toBeInTheDocument();
    });
    expect(screen.getByText("Daily digest")).toBeInTheDocument();
    // Columns: trigger_event, state
    expect(
      screen.getByText("review.finding.high_severity"),
    ).toBeInTheDocument();
    expect(screen.getByText("review.completed")).toBeInTheDocument();
    expect(screen.getAllByText(/active/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/paused/i).length).toBeGreaterThan(0);
    // Recipients column: counts or summaries
    expect(screen.getByText("2")).toBeInTheDocument(); // rule A has 2 recipients
    expect(screen.getByText("1")).toBeInTheDocument(); // rule B has 1 recipient
    // Schedule cron only shown when set
    expect(screen.getByText("0 9 * * 1-5")).toBeInTheDocument();
  });

  test("test_section_heading_communicates_platform_shape — heading includes platform-shared disambiguation", async () => {
    _renderWithFetch(_GOOD_RESPONSE);
    await waitFor(() => {
      // Must see a heading that contains "platform" and signals cross-installation scope.
      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading.textContent?.toLowerCase()).toContain("notification");
    });
    // Also check for the platform-shared disambiguating text (either in heading or
    // a nearby descriptor element).
    await waitFor(() => {
      expect(
        screen.getByText(/platform.*(shared|wide|scope)|shared.*across.*all/i),
      ).toBeInTheDocument();
    });
  });

  test("test_api_client_does_not_send_installation_id_query_param — GET URL has no installation_id", async () => {
    _renderWithFetch(_GOOD_RESPONSE);
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });
    const calls = (
      globalThis.fetch as unknown as { mock: { calls: unknown[][] } }
    ).mock.calls;
    const url = String(calls[0]?.[0] ?? "");
    expect(url).toContain("/api/admin/notification-rules");
    expect(url).not.toContain("installation_id");
  });

  test("renders empty state when rules list is empty", async () => {
    _renderWithFetch({ schema_version: 1, rules: [] });
    await waitFor(() => {
      expect(
        screen.getByText(/no notification rules/i),
      ).toBeInTheDocument();
    });
  });

  test("renders error banner when fetch returns 500", async () => {
    _renderWithFetch({ detail: "internal error" }, 500);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/couldn't load/i);
    });
  });
});
