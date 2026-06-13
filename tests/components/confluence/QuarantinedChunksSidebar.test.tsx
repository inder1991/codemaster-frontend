import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { QuarantinedChunksSidebar } from "@/components/confluence/QuarantinedChunksSidebar";
import * as adminApi from "@/lib/api/admin";
import { DarkModeProvider } from "@/components/ui/dark-mode-provider";

const INTEGRATION_ID = "11111111-2222-3333-4444-555555555555";

const ROW_BASE = {
  schema_version: 1,
  chunk_id: "00000000-0000-0000-0000-000000000001",
  space_key: "ACME",
  page_id: "p-1",
  page_title: "Onboarding Guide",
  page_version: 3,
  last_modified_at: "2026-05-15T10:00:00Z",
  quarantine_reasons: ["restricted_visibility"],
  chunk_text_preview: "This page covers our onboarding…",
};

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

describe("QuarantinedChunksSidebar", () => {
  beforeEach(() => {
    vi.spyOn(adminApi, "fetchQuarantinedChunks").mockResolvedValue({
      schema_version: 1,
      rows: [ROW_BASE],
      next_cursor: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders quarantined-chunk rows from the fetcher", async () => {
    render(
      withProviders(
        <QuarantinedChunksSidebar
          open
          onClose={() => {}}
          integrationId={INTEGRATION_ID}
        />,
      ),
    );
    await waitFor(() =>
      expect(screen.getByText("Onboarding Guide")).toBeInTheDocument(),
    );
    expect(screen.getByText(/restricted_visibility/i)).toBeInTheDocument();
    expect(screen.getByText(/ACME/)).toBeInTheDocument();
  });

  it("shows the empty-state copy when no quarantined chunks exist", async () => {
    vi.spyOn(adminApi, "fetchQuarantinedChunks").mockResolvedValue({
      schema_version: 1,
      rows: [],
      next_cursor: null,
    });
    render(
      withProviders(
        <QuarantinedChunksSidebar
          open
          onClose={() => {}}
          integrationId={INTEGRATION_ID}
        />,
      ),
    );
    await waitFor(() =>
      expect(
        screen.getByText(/no quarantined chunks/i),
      ).toBeInTheDocument(),
    );
  });

  it("calls onClose when the Close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      withProviders(
        <QuarantinedChunksSidebar
          open
          onClose={onClose}
          integrationId={INTEGRATION_ID}
        />,
      ),
    );
    await user.click(screen.getByRole("button", { name: /^close$/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("loads the next page when 'Load more' is clicked", async () => {
    const spy = vi
      .spyOn(adminApi, "fetchQuarantinedChunks")
      .mockResolvedValueOnce({
        schema_version: 1,
        rows: [ROW_BASE],
        next_cursor: "1",
      })
      .mockResolvedValueOnce({
        schema_version: 1,
        rows: [
          {
            ...ROW_BASE,
            chunk_id: "00000000-0000-0000-0000-000000000002",
            page_title: "Second Page",
          },
        ],
        next_cursor: null,
      });
    const user = userEvent.setup();
    render(
      withProviders(
        <QuarantinedChunksSidebar
          open
          onClose={() => {}}
          integrationId={INTEGRATION_ID}
        />,
      ),
    );
    await waitFor(() =>
      expect(screen.getByText("Onboarding Guide")).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /load more/i }));
    await waitFor(() =>
      expect(screen.getByText("Second Page")).toBeInTheDocument(),
    );
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
