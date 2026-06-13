/**
 * Sprint 14 / S14.C — AuditLogPage unit tests.
 *
 * Pins the wiring contract laid out in sprint-14.md S14.C:
 *
 *   • GET /api/admin/audit-events called on mount with filter
 *     query params; the page surfaces the typed envelope.
 *   • Filter state survives a refresh because it lives in URL
 *     search params (the page is the source of truth, not a
 *     useState ref).
 *   • Cursor pagination: "Load more" appends rows by re-fetching
 *     with `cursor=<next_cursor>`.
 *   • The backend's `X-Vault-Degraded: true` response header
 *     surfaces as a yellow banner above the results.
 *   • 401 → /login redirect; 403 → "Access denied" inline; 5xx
 *     → ErrorState. Empty result renders the Empty component.
 *
 * Red commit: these tests fail because the page still imports
 * `getAuditEvents()` from `@/lib/mock/audit-events` and never
 * hits fetch. The green commit rewires it.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import AuditLogPage from "@/app/(authed)/audit-log/page";
import type { AuditEventListItemV1 } from "@/lib/api/admin";

// ── router mock ────────────────────────────────────────────────────

const mockPush = vi.fn();
const mockReplace = vi.fn();
let currentSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => currentSearchParams,
  usePathname: () => "/audit-log",
}));

// ── fetch mock ─────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fetchSpy: any;

function mockFetch(impl: typeof globalThis.fetch): void {
  fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(impl as never);
}

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function makeEvent(
  overrides: Partial<AuditEventListItemV1> = {},
): AuditEventListItemV1 {
  return {
    audit_event_id: "ae-9001",
    actor_user_id: "alpha-uid",
    action: "flag.put",
    target_id: "bedrock_global_daily_cap_cents",
    occurred_at: "2026-08-01T11:25:00Z",
    before_excerpt: '{"value": 240000}',
    after_excerpt: '{"value": 120000}',
    ...overrides,
  };
}

function renderPage(): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrap({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  render(<AuditLogPage />, { wrapper: Wrap });
}

beforeEach(() => {
  mockPush.mockReset();
  mockReplace.mockReset();
  currentSearchParams = new URLSearchParams();
});

afterEach(() => {
  fetchSpy?.mockRestore();
});

describe("AuditLogPage — wiring", () => {
  it("calls GET /api/admin/audit-events on mount and renders rows", async () => {
    const calls: string[] = [];
    mockFetch(async (url: string | URL | Request) => {
      const u =
        typeof url === "string"
          ? url
          : url instanceof URL
            ? url.toString()
            : url.url;
      calls.push(u);
      return jsonResponse({ rows: [makeEvent()], next_cursor: null });
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("flag.put")).toBeInTheDocument();
    });
    expect(calls.some((c) => c.includes("/api/admin/audit-events"))).toBe(
      true,
    );
  });

  it("renders the Empty component when the result has zero rows", async () => {
    mockFetch(async () => jsonResponse({ rows: [], next_cursor: null }));
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByText(/no matching audit events/i),
      ).toBeInTheDocument();
    });
  });

  it("typing into the actor filter pushes the value into the URL search params", async () => {
    mockFetch(async () => jsonResponse({ rows: [], next_cursor: null }));
    renderPage();
    const user = userEvent.setup();
    const actorInput = await screen.findByLabelText(/^actor$/i);
    await user.type(actorInput, "alpha");
    await waitFor(() => {
      const lastCall = mockReplace.mock.calls.at(-1);
      expect(lastCall?.[0]).toMatch(/actor=alpha/);
    });
  });

  it("clicking 'Reset filters' clears the URL search params", async () => {
    currentSearchParams = new URLSearchParams("actor=alpha&action=flag.put");
    mockFetch(async () => jsonResponse({ rows: [], next_cursor: null }));
    renderPage();
    const user = userEvent.setup();
    const resetBtn = await screen.findByRole("button", {
      name: /reset filters/i,
    });
    await user.click(resetBtn);
    await waitFor(() => {
      const lastCall = mockReplace.mock.calls.at(-1);
      // After reset, the URL has no query string (or just the
      // pathname + a trailing "?").
      const target = String(lastCall?.[0] ?? "");
      expect(target).not.toMatch(/actor=/);
      expect(target).not.toMatch(/action=/);
    });
  });

  it("'Load more' fetches the next page with `cursor=` query param", async () => {
    const calls: string[] = [];
    mockFetch(async (url: string | URL | Request) => {
      const u =
        typeof url === "string"
          ? url
          : url instanceof URL
            ? url.toString()
            : url.url;
      calls.push(u);
      if (u.includes("cursor=")) {
        return jsonResponse({
          rows: [makeEvent({ audit_event_id: "ae-9000", action: "flag.put" })],
          next_cursor: null,
        });
      }
      return jsonResponse({
        rows: [makeEvent({ audit_event_id: "ae-9001", action: "flag.put" })],
        next_cursor: "cur-page-2",
      });
    });
    renderPage();
    const user = userEvent.setup();
    const loadMore = await screen.findByRole("button", { name: /load more/i });
    await user.click(loadMore);
    await waitFor(() => {
      expect(calls.some((c) => c.includes("cursor=cur-page-2"))).toBe(true);
    });
  });

  it("renders a yellow Vault-degraded banner when the response carries X-Vault-Degraded: true", async () => {
    mockFetch(async () =>
      jsonResponse(
        { rows: [makeEvent()], next_cursor: null },
        200,
        { "X-Vault-Degraded": "true" },
      ),
    );
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByTestId("audit-vault-degraded"),
      ).toBeInTheDocument();
    });
  });

  it("renders 'Access denied' inline on 403 (fail-closed)", async () => {
    mockFetch(async () => jsonResponse({ detail: "forbidden" }, 403));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/access denied/i)).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalledWith("/login");
  });

  it("redirects to /login on 401 (fail-closed)", async () => {
    mockFetch(async () => jsonResponse({ detail: "unauthenticated" }, 401));
    renderPage();
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/login");
    });
  });

  it("rejects a from > to URL filter client-side without firing fetch", async () => {
    // sprint-14.md S14.C edge case 5: a shared URL whose `from_at` is
    // after `to_at` must trigger client-side validation, render an
    // inline error, and skip the network round-trip. Backends are
    // entitled to return 422 for the same input but the UI is the
    // first line of defence so the user sees actionable feedback
    // immediately.
    currentSearchParams = new URLSearchParams(
      "from_at=2026-08-01T00:00:00Z&to_at=2026-04-01T00:00:00Z",
    );
    const calls: string[] = [];
    mockFetch(async (url: string | URL | Request) => {
      const u =
        typeof url === "string"
          ? url
          : url instanceof URL
            ? url.toString()
            : url.url;
      calls.push(u);
      return jsonResponse({ rows: [], next_cursor: null });
    });
    renderPage();
    // Validation error must render and the audit-events fetch must
    // never be issued.
    expect(
      await screen.findByTestId("audit-filter-error"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/from date must precede to date/i),
    ).toBeInTheDocument();
    // Settle and confirm fetch was never called.
    await new Promise((r) => setTimeout(r, 50));
    expect(
      calls.some((c) => c.includes("/api/admin/audit-events")),
    ).toBe(false);
  });
});
