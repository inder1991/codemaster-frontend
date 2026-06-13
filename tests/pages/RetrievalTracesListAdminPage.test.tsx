import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import RetrievalTracesListAdminPage from "@/app/(authed)/admin/retrieval-traces/page";
import * as adminApi from "@/lib/api/admin";
import { DarkModeProvider } from "@/components/ui/dark-mode-provider";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/retrieval-traces",
}));

function withProviders(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <DarkModeProvider>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </DarkModeProvider>
  );
}

const ROW_A = {
  schema_version: 1,
  trace_id: "11111111-1111-1111-1111-111111111111",
  review_id: "22222222-2222-2222-2222-222222222222",
  pr_id: "33333333-3333-3333-3333-333333333333",
  captured_at: "2026-05-28T10:00:00Z",
  taxonomy_version: 1,
  pipeline_version: 1,
  trace_schema_version: 2,
  effective_labels_count: 7,
  repo_include_attempts_filtered_count: 0,
  starvation_observed: true,
  selected_chunks_count: 12,
  dropped_chunks_count: 4,
  budget_total: 100,
  budget_remaining: 38,
};

describe("RetrievalTracesListAdminPage", () => {
  beforeEach(() => {
    vi.spyOn(adminApi, "fetchRetrievalTraces").mockResolvedValue({
      schema_version: 1,
      rows: [ROW_A],
      next_cursor: null,
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders rows with truncated UUIDs + selected/dropped counts", async () => {
    render(withProviders(<RetrievalTracesListAdminPage />));
    await waitFor(() =>
      expect(screen.getByText("11111111…")).toBeInTheDocument(),
    );
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText(/starved/i)).toBeInTheDocument();
  });

  it("toggles starvation_only and refetches", async () => {
    const spy = vi.spyOn(adminApi, "fetchRetrievalTraces");
    const user = userEvent.setup();
    render(withProviders(<RetrievalTracesListAdminPage />));
    // Wait for the table to render past the loading skeleton.
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: /starvation/i })).toBeInTheDocument(),
    );
    const callsBefore = spy.mock.calls.length;
    await user.click(
      screen.getByRole("checkbox", { name: /starvation/i }),
    );
    await waitFor(() =>
      expect(spy.mock.calls.length).toBeGreaterThan(callsBefore),
    );
    const lastCall = spy.mock.calls[spy.mock.calls.length - 1]!;
    expect(lastCall[0]!.starvation_only).toBe(true);
  });

  it("trace_id renders as a link to the detail page", async () => {
    render(withProviders(<RetrievalTracesListAdminPage />));
    await waitFor(() =>
      expect(screen.getByText("11111111…")).toBeInTheDocument(),
    );
    const link = screen.getByRole("link", { name: /11111111…/ });
    expect(link).toHaveAttribute(
      "href",
      "/admin/retrieval-traces/11111111-1111-1111-1111-111111111111",
    );
  });
});
