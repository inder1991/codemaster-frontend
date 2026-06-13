import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import DefaultCorpusHealthAdminPage from "@/app/(authed)/admin/confluence/default-corpus/page";
import * as adminApi from "@/lib/api/admin";
import { DarkModeProvider } from "@/components/ui/dark-mode-provider";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/confluence/default-corpus",
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

const HEALTH = {
  schema_version: 1,
  captured_at: "2026-05-28T10:00:00Z",
  total_default_chunks: 1200,
  stale_default_chunks: 80,
  total_tokens: 45000,
  spaces_with_defaults: 7,
  hit_rate_24h_by_scope: [
    {
      schema_version: 1,
      scope: "universal" as const,
      chunks_in_corpus: 500,
      chunks_retrieved_24h: 150,
      hit_rate_24h: 0.3,
    },
    {
      schema_version: 1,
      scope: "language_only" as const,
      chunks_in_corpus: 100,
      chunks_retrieved_24h: 2,
      hit_rate_24h: 0.02,
    },
  ],
};

describe("DefaultCorpusHealthAdminPage", () => {
  beforeEach(() => {
    vi.spyOn(adminApi, "fetchDefaultCorpusHealth").mockResolvedValue(HEALTH);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders stat cards + per-scope hit-rate table", async () => {
    render(withProviders(<DefaultCorpusHealthAdminPage />));
    await waitFor(() =>
      expect(screen.getByText("1,200")).toBeInTheDocument(),
    );
    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.getByText("45,000")).toBeInTheDocument();
    expect(screen.getByText(/universal/)).toBeInTheDocument();
    expect(screen.getByText(/language_only/)).toBeInTheDocument();
    expect(screen.getByText("30.0%")).toBeInTheDocument();
    expect(screen.getByText("2.0%")).toBeInTheDocument();
  });
});
