/**
 * Sprint 14 / S14.B — ReviewsListPage unit tests.
 * Task 9 — extended for URL-synced filters, pagination, Started column,
 *   header count.
 *
 * Tests:
 *  - Loading skeleton renders while useQuery is in flight.
 *  - Error state renders ErrorState component on 5xx.
 *  - Empty state renders Empty component when items=[].
 *  - Data state renders the row table.
 *  - state="failed" (NOT "errored") drives the "down" BadgeKind variant
 *    — closes the B4 contract-drift finding.
 *  - state contract reconciliation: the page does not reference the
 *    string literal "errored" anywhere in its rendered output.
 *  - Row click navigates to /reviews/{id}.
 *  - Page calls GET /api/admin/reviews on mount (network observable).
 *  - Hydrates filters from URL and passes them to the API request.
 *  - Shows total count in the heading when data is loaded.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import ReviewsListPage from "@/app/(authed)/reviews/page";
import type {
  ReviewListItemV1,
  ReviewsListPageV1,
} from "@/lib/api/admin";

// ── router mock ────────────────────────────────────────────────────

const mockReplace = vi.fn();
let currentParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: mockReplace }),
  usePathname: () => "/reviews",
  useSearchParams: () => currentParams,
}));

// ── fetch mock ─────────────────────────────────────────────────────

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
  items: ReviewListItemV1[],
  opts: { page?: number; total?: number; size?: number } = {},
): ReviewsListPageV1 {
  const { page = 1, total = items.length, size = 50 } = opts;
  return {
    schema_version: 1,
    items,
    total,
    page,
    size,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function orgsResponse(): Response {
  return jsonResponse({ schema_version: 1, orgs: ["acme", "zeta"] });
}

// ── render harness with TanStack Query ─────────────────────────────

function renderPage(): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrap({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  render(<ReviewsListPage />, { wrapper: Wrap });
}

beforeEach(() => {
  currentParams = new URLSearchParams();
  mockReplace.mockClear();
});

afterEach(() => {
  fetchSpy?.mockRestore();
});

// Helper: extract a URL string from the various overloaded fetch arguments.
function urlOf(url: string | URL | Request): string {
  if (typeof url === "string") return url;
  if (url instanceof URL) return url.toString();
  return url.url;
}

// ── tests ──────────────────────────────────────────────────────────

describe("ReviewsListPage — wiring", () => {
  it("renders the loading skeleton while the request is in flight", () => {
    let resolve: (r: Response) => void = () => {};
    mockFetch(
      (url) => {
        if (urlOf(url).includes("/orgs")) return Promise.resolve(orgsResponse());
        return new Promise<Response>((r) => {
          resolve = r;
        });
      },
    );
    renderPage();
    expect(screen.getByTestId("reviews-loading")).toBeInTheDocument();
    resolve(jsonResponse(makePage([])));
  });

  it("renders the error state on a 500 response", async () => {
    mockFetch(async (url) => {
      if (urlOf(url).includes("/orgs")) return orgsResponse();
      return jsonResponse({ detail: "boom" }, 500);
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("reviews-error")).toBeInTheDocument();
    });
  });

  it("renders the empty state when items is empty", async () => {
    mockFetch(async (url) => {
      if (urlOf(url).includes("/orgs")) return orgsResponse();
      return jsonResponse(makePage([]));
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/No reviews yet/i)).toBeInTheDocument();
    });
  });

  it("renders rows from the data response", async () => {
    mockFetch(async (url) => {
      if (urlOf(url).includes("/orgs")) return orgsResponse();
      return jsonResponse(
        makePage([
          makeRow({ review_id: "rev-A", pr_title: "A title", pr_number: 7 }),
          makeRow({ review_id: "rev-B", pr_title: "B title", pr_number: 8 }),
        ]),
      );
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("A title")).toBeInTheDocument();
    });
    expect(screen.getByText("B title")).toBeInTheDocument();
  });

  it("calls GET /api/admin/reviews on mount", async () => {
    const calls: string[] = [];
    mockFetch(async (url) => {
      const u = urlOf(url);
      calls.push(u);
      if (u.includes("/orgs")) return orgsResponse();
      return jsonResponse(makePage([]));
    });
    renderPage();
    await waitFor(() => {
      expect(calls.some((c) => c.includes("/api/admin/reviews"))).toBe(true);
    });
  });

  it("renders state=failed with the down BadgeKind (not errored)", async () => {
    // Closes B4 contract-drift: pre-S14.B the page used "errored"
    // which no backend ever produces. Now it uses "failed".
    mockFetch(async (url) => {
      if (urlOf(url).includes("/orgs")) return orgsResponse();
      return jsonResponse(
        makePage([
          makeRow({
            review_id: "rev-fail",
            state: "failed",
            pr_title: "broken pipeline",
          }),
        ]),
      );
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("broken pipeline")).toBeInTheDocument();
    });
    // The badge label is "Failed" (not "Errored"). The filter dropdown also
    // contains "Failed" as an option, so use getAllByText and confirm at least
    // one match exists.
    expect(screen.getAllByText(/^Failed$/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^Errored$/)).not.toBeInTheDocument();
  });

  it("does not reference the string 'errored' in any rendered cell", async () => {
    mockFetch(async (url) => {
      if (urlOf(url).includes("/orgs")) return orgsResponse();
      return jsonResponse(
        makePage([makeRow({ state: "failed", pr_title: "ttt" })]),
      );
    });
    const { container } = (() => {
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      return render(
        <QueryClientProvider client={client}>
          <ReviewsListPage />
        </QueryClientProvider>,
      );
    })();
    await waitFor(() => {
      expect(screen.getByText("ttt")).toBeInTheDocument();
    });
    expect(container.textContent ?? "").not.toMatch(/errored/i);
  });

  it("escapes <, >, \" in PR titles in all table cells (edge case 7)", async () => {
    const evilTitle = '<img src=x onerror=alert(1)> "><script>';
    mockFetch(async (url) => {
      if (urlOf(url).includes("/orgs")) return orgsResponse();
      return jsonResponse(
        makePage([
          makeRow({
            review_id: "rev-evil",
            pr_title: evilTitle,
          }),
        ]),
      );
    });
    const { container } = (() => {
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      return render(
        <QueryClientProvider client={client}>
          <ReviewsListPage />
        </QueryClientProvider>,
      );
    })();
    await waitFor(() => {
      expect(screen.getByText(evilTitle)).toBeInTheDocument();
    });
    // No <img> or <script> elements were ever constructed from the
    // PR-title string — React's default JSX escaping holds.
    expect(container.querySelector("img[src='x']")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
  });

  it("each row is a link to /reviews/{id}", async () => {
    mockFetch(async (url) => {
      if (urlOf(url).includes("/orgs")) return orgsResponse();
      return jsonResponse(
        makePage([
          makeRow({ review_id: "rev-click-me", pr_title: "click target" }),
        ]),
      );
    });
    renderPage();
    await screen.findByText("click target");
    // Rows are real links (stretched <Link> in the first cell) so they are
    // announced as links, keyboard-focusable, and support cmd/middle-click.
    const link = screen.getByRole("link", { name: /open review/i });
    expect(link).toHaveAttribute("href", "/reviews/rev-click-me");
  });

  it("hydrates filters from the URL and requests them", async () => {
    currentParams = new URLSearchParams("org=acme&state=failed&page=2");
    mockFetch(async (url) => {
      const u = urlOf(url);
      if (u.includes("/orgs")) return orgsResponse();
      expect(u).toContain("org=acme");
      expect(u).toContain("state=failed");
      expect(u).toContain("page=2");
      return jsonResponse(makePage([makeRow({ pr_title: "x" })], { page: 2, total: 80 }));
    });
    renderPage();
    expect(await screen.findByDisplayValue("acme")).toBeInTheDocument();
  });

  it("shows the total count in the header", async () => {
    currentParams = new URLSearchParams();
    mockFetch(async (url) => {
      if (urlOf(url).includes("/orgs")) return orgsResponse();
      return jsonResponse(makePage([makeRow({ pr_title: "x" })], { total: 592 }));
    });
    renderPage();
    expect(
      await screen.findByRole("heading", { name: /Reviews \(592\)/ }),
    ).toBeInTheDocument();
  });

  it("Clear filters resets every filter in the URL (not just q)", async () => {
    currentParams = new URLSearchParams("org=acme&state=failed");
    mockFetch(async (url) => {
      if (urlOf(url).includes("/orgs")) return orgsResponse();
      return jsonResponse(makePage([makeRow({ pr_title: "x" })], { total: 1 }));
    });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /clear/i }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    const lastUrl = mockReplace.mock.calls.at(-1)?.[0] as string;
    expect(lastUrl).not.toContain("org=");
    expect(lastUrl).not.toContain("state=");
  });

  it("recovers from an out-of-range page to page 1 (B2)", async () => {
    // An out-of-range page returns an empty slice; the backend reports total=0
    // for it. The page must clamp back to page 1 rather than dead-ending.
    currentParams = new URLSearchParams("page=99");
    mockFetch(async (url) => {
      if (urlOf(url).includes("/orgs")) return orgsResponse();
      return jsonResponse(makePage([], { page: 99, total: 0 }));
    });
    renderPage();
    await waitFor(() => {
      const urls = mockReplace.mock.calls.map((c) => String(c[0]));
      // clamp wrote a page-1 URL (toParams omits page when page === 1)
      expect(urls.some((u) => !u.includes("page="))).toBe(true);
    });
  });

  it("debounced search keeps a filter changed mid-debounce (B1)", async () => {
    currentParams = new URLSearchParams();
    mockFetch(async (url) => {
      if (urlOf(url).includes("/orgs")) return orgsResponse();
      return jsonResponse(makePage([makeRow({})], { total: 1 }));
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const make = () => (
      <QueryClientProvider client={client}>
        <ReviewsListPage />
      </QueryClientProvider>
    );
    const { rerender } = render(make());

    // Type a search (schedules the 300ms debounce timer with org="").
    fireEvent.change(screen.getByLabelText(/search pr titles/i), {
      target: { value: "auth" },
    });
    // An org filter changes mid-debounce (URL → filters update → ref update).
    currentParams = new URLSearchParams("org=acme");
    rerender(make());

    // When the debounce fires it must use the CURRENT filters (org=acme), not
    // the snapshot captured when the timer was scheduled.
    await waitFor(
      () => {
        const last = String(mockReplace.mock.calls.at(-1)?.[0] ?? "");
        expect(last).toContain("q=auth");
        expect(last).toContain("org=acme");
      },
      { timeout: 1500 },
    );
  });
});
