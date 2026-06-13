import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import RetrievalTraceDetailAdminPage from "@/app/(authed)/admin/retrieval-traces/[trace_id]/page";
import * as adminApi from "@/lib/api/admin";
import { DarkModeProvider } from "@/components/ui/dark-mode-provider";

const TRACE_ID = "11111111-1111-1111-1111-111111111111";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => `/admin/retrieval-traces/${TRACE_ID}`,
  useParams: () => ({ trace_id: TRACE_ID }),
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

const SELECTED_CHUNK = {
  schema_version: 1,
  chunk_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  matched_labels: ["lang:python"],
  emitting_detectors: ["language_detector"],
  priority_tier: "tier_a",
  match_specificity_score: 85,
  freshness_score: 0.92,
  selected_because: "tier_a:python_match",
  stage3_base_score: 0.7,
  cosine_component: 0.5,
  freshness_component: 0.2,
  specificity_component: 0.3,
  mmr_diversity_penalty: 0.1,
  final_score: 0.6,
  rank_after_mmr: 1,
  default_scope: null,
  drop_reason: null,
  drop_context: null,
};

const DROPPED_CHUNK = {
  ...SELECTED_CHUNK,
  chunk_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  selected_because: null,
  stage3_base_score: null,
  cosine_component: null,
  freshness_component: null,
  specificity_component: null,
  mmr_diversity_penalty: null,
  final_score: null,
  rank_after_mmr: null,
  drop_reason: "mmr_redundant" as const,
  drop_context: "redundant with chunk aaa…",
};

const TRACE = {
  schema_version: 2,
  trace_id: TRACE_ID,
  review_id: "22222222-2222-2222-2222-222222222222",
  pr_id: "33333333-3333-3333-3333-333333333333",
  captured_at: "2026-05-28T10:00:00Z",
  taxonomy_version: 1,
  pipeline_version: 1,
  detectors: [],
  effective_labels: ["lang:python"],
  platform_exposed_labels_count: 12,
  repo_include_attempts_filtered: [],
  stage1: { schema_version: 1 },
  stage2: { schema_version: 1 },
  stage3: {
    schema_version: 2,
    track_a_default: {
      schema_version: 2,
      selection_basis: "track_a_default_basis",
      selected_chunk_ids: [SELECTED_CHUNK.chunk_id],
      dropped_chunk_ids: [DROPPED_CHUNK.chunk_id],
      selected_chunks_detail: [SELECTED_CHUNK],
      dropped_chunks_detail: [DROPPED_CHUNK],
    },
    track_b_non_default: {
      schema_version: 2,
      selection_basis: "track_b_basis",
      selected_chunk_ids: [],
      dropped_chunk_ids: [],
      selected_chunks_detail: [],
      dropped_chunks_detail: [],
    },
    starvation_observed: true,
    starvation_tiers: ["tier_b"],
    lambda_mmr: 0.7,
  },
  token_accounting: { total_tokens: 0, system_tokens: 0 },
};

describe("RetrievalTraceDetailAdminPage", () => {
  beforeEach(() => {
    vi.spyOn(adminApi, "fetchRetrievalTraceDetail").mockResolvedValue(
      TRACE as unknown as adminApi.RetrievalTraceV2,
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the trace header + selected/dropped tables", async () => {
    render(withProviders(<RetrievalTraceDetailAdminPage />));
    await waitFor(() =>
      expect(screen.getByText(TRACE_ID)).toBeInTheDocument(),
    );
    expect(screen.getByText(/track a — default corpus/i)).toBeInTheDocument();
    expect(screen.getByText(/track b — non-default/i)).toBeInTheDocument();
    expect(screen.getByText(/tier_a:python_match/i)).toBeInTheDocument();
    expect(screen.getByText(/mmr_redundant/i)).toBeInTheDocument();
    expect(screen.getByText(/starvation observed/i)).toBeInTheDocument();
  });
});
