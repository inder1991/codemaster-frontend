/**
 * Sprint 14 / S14.B — YourReviewsPage unit tests.
 *
 * Tests:
 *  - Loading skeleton while useQuery is in flight
 *  - Error state on a 5xx response
 *  - Empty authored AND assigned both render their empty states
 *  - Authored-only populated case
 *  - Assigned-only populated case
 *  - GET /api/admin/your-reviews called on mount
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import YourReviewsPage from "@/app/(authed)/your-reviews/page";
import type {
  ReviewListItemV1,
  YourReviewsPageV1,
} from "@/lib/api/admin";

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

function makeRow(overrides: Partial<ReviewListItemV1> = {}): ReviewListItemV1 {
  return {
    review_id: "rev-001",
    repo: "acme/web",
    pr_number: 42,
    pr_title: "Add formatCurrency helper",
    state: "complete",
    severity_max: "issue",
    finding_count: 3,
    started_at: "2026-05-05T10:00:00Z",
    completed_at: "2026-05-05T10:05:00Z",
    ...overrides,
  };
}

function makePage(
  overrides: Partial<YourReviewsPageV1> = {},
): YourReviewsPageV1 {
  return {
    schema_version: 1,
    authored: [],
    assigned: [],
    user_id: "alpha",
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
  render(<YourReviewsPage />, { wrapper: Wrap });
}

beforeEach(() => {
  mockPush.mockReset();
});

afterEach(() => {
  fetchSpy?.mockRestore();
});

describe("YourReviewsPage — wiring", () => {
  it("renders the loading skeleton while the request is in flight", () => {
    let resolve: (r: Response) => void = () => {};
    mockFetch(
      () =>
        new Promise<Response>((r) => {
          resolve = r;
        }),
    );
    renderPage();
    expect(screen.getByTestId("your-reviews-loading")).toBeInTheDocument();
    resolve(jsonResponse(makePage()));
  });

  it("renders the error state on a 500 response", async () => {
    mockFetch(async () => jsonResponse({ detail: "boom" }, 500));
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("your-reviews-error")).toBeInTheDocument();
    });
  });

  it("renders both empty states when authored AND assigned are empty", async () => {
    mockFetch(async () =>
      jsonResponse(makePage({ authored: [], assigned: [] })),
    );
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByText(/No reviews on your PRs/i),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Nothing waiting on your review/i),
    ).toBeInTheDocument();
  });

  it("renders authored rows when authored is populated", async () => {
    mockFetch(async () =>
      jsonResponse(
        makePage({
          authored: [
            makeRow({
              review_id: "rev-A",
              pr_title: "alpha PR title",
              pr_number: 7,
            }),
          ],
          assigned: [],
        }),
      ),
    );
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("alpha PR title")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Nothing waiting on your review/i),
    ).toBeInTheDocument();
  });

  it("renders assigned rows when assigned is populated", async () => {
    mockFetch(async () =>
      jsonResponse(
        makePage({
          authored: [],
          assigned: [
            makeRow({
              review_id: "rev-B",
              pr_title: "bravo PR title",
              pr_number: 9,
            }),
          ],
        }),
      ),
    );
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("bravo PR title")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/No reviews on your PRs/i),
    ).toBeInTheDocument();
  });

  it("calls GET /api/admin/your-reviews on mount", async () => {
    const calls: string[] = [];
    mockFetch(async (url: string | URL | Request) => {
      const u =
        typeof url === "string"
          ? url
          : url instanceof URL
            ? url.toString()
            : url.url;
      calls.push(u);
      return jsonResponse(makePage());
    });
    renderPage();
    await waitFor(() => {
      expect(
        calls.some((c) => c.includes("/api/admin/your-reviews")),
      ).toBe(true);
    });
  });
});
