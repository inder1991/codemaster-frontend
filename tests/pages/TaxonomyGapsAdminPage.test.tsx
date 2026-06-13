import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import TaxonomyGapsAdminPage from "@/app/(authed)/admin/confluence/taxonomy-gaps/page";
import * as adminApi from "@/lib/api/admin";
import { DarkModeProvider } from "@/components/ui/dark-mode-provider";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/confluence/taxonomy-gaps",
}));

function withProviders(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return (
    <DarkModeProvider>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </DarkModeProvider>
  );
}

const ROW_A = {
  schema_version: 1,
  label: "unrecognized:cobol",
  chunks_carrying: 42,
  pages_carrying: 7,
  spaces_carrying: 2,
  most_recent_use: "2026-05-25T10:00:00Z",
};

describe("TaxonomyGapsAdminPage", () => {
  beforeEach(() => {
    vi.spyOn(adminApi, "fetchTaxonomyGaps").mockResolvedValue({
      schema_version: 1,
      rows: [ROW_A],
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders gap rows with chunk counts", async () => {
    render(withProviders(<TaxonomyGapsAdminPage />));
    await waitFor(() =>
      expect(screen.getByText("unrecognized:cobol")).toBeInTheDocument(),
    );
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("suggest flow: opens modal, submits, mutation fires", async () => {
    const postSpy = vi
      .spyOn(adminApi, "postTaxonomySuggestion")
      .mockResolvedValue({
        schema_version: 1,
        suggestion_id: "00000000-0000-0000-0000-000000000077",
        queued_at: "2026-05-28T12:30:00Z",
      });
    const user = userEvent.setup();
    render(withProviders(<TaxonomyGapsAdminPage />));
    await waitFor(() =>
      expect(screen.getByText("unrecognized:cobol")).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /suggest curation/i }));
    expect(
      await screen.findByRole("heading", {
        name: /suggest taxonomy entry for unrecognized:cobol/i,
      }),
    ).toBeInTheDocument();
    await user.type(
      screen.getByLabelText(/proposed canonical label/i),
      "lang:cobol",
    );
    await user.type(
      screen.getByLabelText(/rationale/i),
      "We have a few COBOL repos and reviews need that scope.",
    );
    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(1));
    expect(postSpy.mock.calls[0]![0]!.label).toBe("unrecognized:cobol");
    expect(postSpy.mock.calls[0]![0]!.proposed_canonical_label).toBe(
      "lang:cobol",
    );
  });
});
