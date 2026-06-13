/**
 * Sprint 14 / S14.B — DashboardPage unit tests.
 *
 * Tests:
 *  - Loading skeleton while useQuery is in flight
 *  - Error state on a 500 response
 *  - Empty in-flight section when in_flight_reviews is zero
 *  - Stat cards render the numeric values from DashboardSummaryV1
 *  - Service health rows render with state badges
 *  - GET /api/admin/dashboard is called on mount
 *  - 401 redirects to /login (failure mode 2 — fail-closed)
 *  - 403 renders an "Access denied" inline message (failure mode 3)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import DashboardPage from "@/app/(authed)/dashboard/page";
import type { DashboardSummaryV1, ServiceHealthV1 } from "@/lib/api/admin";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fetchSpy: any;

function mockFetch(impl: typeof globalThis.fetch): void {
  fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(impl as never);
}

function makeService(
  overrides: Partial<ServiceHealthV1> = {},
): ServiceHealthV1 {
  return {
    name: "api",
    state: "healthy",
    detail: "",
    ...overrides,
  };
}

function makeSummary(
  overrides: Partial<DashboardSummaryV1> = {},
): DashboardSummaryV1 {
  return {
    schema_version: 1,
    services: [makeService()],
    reviews_this_hour: 12,
    latency_p95_ms: 1450,
    in_flight_reviews: 3,
    last_updated_at: "2026-05-06T12:00:00Z",
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
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
  render(<DashboardPage />, { wrapper: Wrap });
}

beforeEach(() => {
  mockPush.mockReset();
});

afterEach(() => {
  fetchSpy?.mockRestore();
});

describe("DashboardPage — wiring", () => {
  it("renders the loading skeleton while the request is in flight", () => {
    let resolve: (r: Response) => void = () => {};
    mockFetch(
      () =>
        new Promise<Response>((r) => {
          resolve = r;
        }),
    );
    renderPage();
    expect(screen.getByTestId("dashboard-loading")).toBeInTheDocument();
    resolve(jsonResponse(makeSummary()));
  });

  it("renders the error state on a 500 response", async () => {
    mockFetch(async () => jsonResponse({ detail: "boom" }, 500));
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("dashboard-error")).toBeInTheDocument();
    });
  });

  it("renders the empty in-flight section when in_flight_reviews is zero", async () => {
    mockFetch(async () =>
      jsonResponse(
        makeSummary({ in_flight_reviews: 0, reviews_this_hour: 0 }),
      ),
    );
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByText(/No reviews running right now/i),
      ).toBeInTheDocument();
    });
  });

  it("renders the stat cards with values from DashboardSummaryV1", async () => {
    mockFetch(async () =>
      jsonResponse(
        makeSummary({
          reviews_this_hour: 42,
          latency_p95_ms: 2100,
          in_flight_reviews: 7,
        }),
      ),
    );
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("stat-reviews-this-hour")).toHaveTextContent(
        "42",
      );
    });
    expect(screen.getByTestId("stat-latency-p95")).toHaveTextContent("2100");
    expect(screen.getByTestId("stat-in-flight")).toHaveTextContent("7");
  });

  it("renders one row per service in the services array", async () => {
    mockFetch(async () =>
      jsonResponse(
        makeSummary({
          services: [
            makeService({ name: "api", state: "healthy" }),
            makeService({
              name: "postgres",
              state: "degraded",
              detail: "lag 200ms",
            }),
            makeService({ name: "bedrock", state: "down", detail: "auth" }),
          ],
        }),
      ),
    );
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("api")).toBeInTheDocument();
    });
    expect(screen.getByText("postgres")).toBeInTheDocument();
    expect(screen.getByText("bedrock")).toBeInTheDocument();
    expect(screen.getByText(/lag 200ms/i)).toBeInTheDocument();
  });

  it("calls GET /api/admin/dashboard on mount", async () => {
    const calls: string[] = [];
    mockFetch(async (url: string | URL | Request) => {
      const u =
        typeof url === "string"
          ? url
          : url instanceof URL
            ? url.toString()
            : url.url;
      calls.push(u);
      return jsonResponse(makeSummary());
    });
    renderPage();
    await waitFor(() => {
      expect(calls.some((c) => c.includes("/api/admin/dashboard"))).toBe(true);
    });
  });

  it("redirects to /login on 401 (fail-closed)", async () => {
    mockFetch(async () =>
      jsonResponse({ detail: "unauthenticated" }, 401),
    );
    renderPage();
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/login");
    });
  });

  it("renders ErrorState when the request aborts (timeout, failure mode 4)", async () => {
    // The admin fetcher wraps every request in an AbortController
    // with a 15s timeout. Simulate the timeout by making fetch
    // reject with the AbortError it would surface in production.
    mockFetch(async () => {
      throw Object.assign(new Error("aborted"), { name: "AbortError" });
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("dashboard-error")).toBeInTheDocument();
    });
  });

  it("renders 'Access denied' inline on 403 (fail-closed)", async () => {
    mockFetch(async () =>
      jsonResponse({ detail: "forbidden" }, 403),
    );
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/access denied/i)).toBeInTheDocument();
    });
    // No /login redirect on 403 — the user is signed in but lacks role.
    expect(mockPush).not.toHaveBeenCalledWith("/login");
  });
});
