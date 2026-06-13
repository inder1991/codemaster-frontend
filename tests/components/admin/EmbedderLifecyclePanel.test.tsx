/**
 * Task 5.6 — unit tests for <EmbedderLifecyclePanel>.
 *
 * Pins the per-spec component contracts:
 *   1. Renders active + pending state header.
 *   2. Renders generation history table with one row per generation.
 *   3. Activate button disabled when validation_passed=false.
 *   4. Activate button (via confirm modal) POSTs /reembed/activate.
 *   5. Cancel button shows on backfilling row + POSTs /reembed/cancel.
 *   6. Validate button POSTs /reembed/validate.
 *   7. GC button disabled when retention window has not elapsed.
 *   8. "View report" opens the validation-report modal.
 *   9. Retrieval-mode flip succeeds when coverage gap=0.
 *  10. Retrieval-mode flip 422 coverage_gap_present → error banner.
 *  11. Coverage gauge surfaces missing counts.
 *  12. Throttling controls collapsed by default; expand renders defaults.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { EmbedderLifecyclePanel } from "@/components/admin/EmbedderLifecyclePanel";
import type {
  EmbedderCoverageV1,
  EmbedderStateV1,
  EmbeddingGenerationV1,
} from "@/lib/api/admin-embedder";

// ── Fixtures ──────────────────────────────────────────────────────

function makeGen(
  overrides: Partial<EmbeddingGenerationV1> = {},
): EmbeddingGenerationV1 {
  return {
    schema_version: 1,
    generation_id: 1,
    state: "active",
    generation_label: null,
    generation_reason: null,
    provider_name: "qwen",
    provider_version: null,
    model_name: "qwen3-embed-0.6b",
    embedding_dimension: 1024,
    created_from_generation: null,
    chunker_version: "v1",
    preprocessing_version: "v1",
    normalization_version: "v1",
    created_at: "2026-05-20T10:00:00Z",
    created_by_email: "ops@example.com",
    backfill_started_at: "2026-05-20T10:01:00Z",
    backfill_completed_at: "2026-05-20T11:00:00Z",
    validation_started_at: "2026-05-20T11:05:00Z",
    validation_completed_at: "2026-05-20T11:10:00Z",
    validation_passed: true,
    activated_at: "2026-05-20T11:15:00Z",
    retired_at: null,
    retire_reason: null,
    gc_started_at: null,
    gc_completed_at: null,
    total_chunks: 50_000,
    chunks_backfilled: 50_000,
    chunks_failed: 0,
    last_error: null,
    ...overrides,
  };
}

function makeState(
  overrides: Partial<EmbedderStateV1> = {},
): EmbedderStateV1 {
  return {
    schema_version: 1,
    active_generation: 1,
    active_model_name: "qwen3-embed-0.6b",
    pending_generation: null,
    pending_model_name: null,
    config_version: 7,
    retrieval_mode: "fallback",
    updated_at: "2026-05-25T09:00:00Z",
    updated_by_email: "ops@example.com",
    generations: [makeGen()],
    ...overrides,
  };
}

function makeCoverage(
  overrides: Partial<EmbedderCoverageV1> = {},
): EmbedderCoverageV1 {
  return {
    schema_version: 1,
    confluence_missing: 0,
    knowledge_missing: 0,
    total_missing: 0,
    active_generation: 1,
    ...overrides,
  };
}

// ── Helpers ───────────────────────────────────────────────────────

let fetchSpy: ReturnType<typeof vi.spyOn> | null = null;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Wire one mocked /state response, one mocked /coverage response, and
 * a callback for POST mutations. The default POST handler echoes back
 * the request body as a generation row.
 */
function mockFetchDefaults({
  state,
  coverage,
  postHandler,
}: {
  state?: EmbedderStateV1;
  coverage?: EmbedderCoverageV1;
  postHandler?: (
    url: string,
    init: RequestInit,
  ) => Response | Promise<Response>;
}): {
  capturedPosts: { url: string; body: unknown }[];
} {
  const captured: { url: string; body: unknown }[] = [];
  const _state = state ?? makeState();
  const _coverage = coverage ?? makeCoverage();
  fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (method === "GET" && url.endsWith("/state")) {
          return jsonResponse(_state);
        }
        if (method === "GET" && url.endsWith("/coverage")) {
          return jsonResponse(_coverage);
        }
        if (method === "GET" && url.includes("/reembed/status")) {
          return jsonResponse(_state.generations[0]);
        }
        if (method === "POST" && init?.body) {
          captured.push({
            url,
            body: JSON.parse(init.body as string),
          });
          if (postHandler) return postHandler(url, init);
          return jsonResponse(_state.generations[0] ?? makeGen());
        }
        return jsonResponse({}, 404);
      },
    );
  return { capturedPosts: captured };
}

function renderPanel(): void {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  function Wrap({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  render(<EmbedderLifecyclePanel />, { wrapper: Wrap });
}

beforeEach(() => {
  fetchSpy = null;
  Object.defineProperty(document, "cookie", {
    configurable: true,
    get: () => "csrf_token=tok-embed",
  });
});

afterEach(() => {
  fetchSpy?.mockRestore();
  fetchSpy = null;
});

// ── Tests ─────────────────────────────────────────────────────────

describe("EmbedderLifecyclePanel — header", () => {
  test("renders active + pending state header", async () => {
    mockFetchDefaults({
      state: makeState({
        active_generation: 1,
        active_model_name: "qwen3-embed-0.6b",
        pending_generation: 2,
        pending_model_name: "qwen3-embed-1.7b",
        generations: [
          makeGen(),
          makeGen({
            generation_id: 2,
            state: "backfilling",
            model_name: "qwen3-embed-1.7b",
            validation_completed_at: null,
            validation_passed: null,
            activated_at: null,
          }),
        ],
      }),
    });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId("active-generation")).toBeInTheDocument();
    });

    expect(screen.getByTestId("active-generation").textContent).toContain(
      "gen 1",
    );
    expect(screen.getByTestId("active-generation").textContent).toContain(
      "qwen3-embed-0.6b",
    );
    expect(screen.getByTestId("pending-generation").textContent).toContain(
      "gen 2",
    );
    expect(screen.getByTestId("pending-generation").textContent).toContain(
      "qwen3-embed-1.7b",
    );
  });
});

describe("EmbedderLifecyclePanel — generation history", () => {
  test("renders generation history table with one row per generation", async () => {
    mockFetchDefaults({
      state: makeState({
        generations: [
          makeGen({ generation_id: 1, state: "active" }),
          makeGen({
            generation_id: 2,
            state: "ready",
            validation_passed: true,
          }),
          makeGen({
            generation_id: 3,
            state: "retired",
            validation_passed: false,
            retired_at: "2026-04-01T00:00:00Z",
            retire_reason: "demoted",
          }),
        ],
      }),
    });

    renderPanel();

    await waitFor(() => {
      expect(
        screen.getByTestId("generation-history-table"),
      ).toBeInTheDocument();
    });

    expect(screen.getByTestId("gen-row-1")).toBeInTheDocument();
    expect(screen.getByTestId("gen-row-2")).toBeInTheDocument();
    expect(screen.getByTestId("gen-row-3")).toBeInTheDocument();
  });
});

describe("EmbedderLifecyclePanel — per-row actions", () => {
  test("Activate button disabled when validation_passed=false", async () => {
    mockFetchDefaults({
      state: makeState({
        generations: [
          makeGen({
            generation_id: 2,
            state: "ready",
            validation_passed: false,
            activated_at: null,
          }),
        ],
      }),
    });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId("btn-activate-2")).toBeInTheDocument();
    });

    const activateBtn = screen.getByTestId(
      "btn-activate-2",
    ) as HTMLButtonElement;
    expect(activateBtn).toBeDisabled();
  });

  test("Activate button POSTs /reembed/activate after confirmation", async () => {
    const { capturedPosts } = mockFetchDefaults({
      state: makeState({
        generations: [
          makeGen({
            generation_id: 2,
            state: "ready",
            validation_passed: true,
            activated_at: null,
          }),
        ],
      }),
    });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId("btn-activate-2")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("btn-activate-2"));

    // Confirm modal opens — primary action label "Activate"
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Activate" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Activate" }));

    await waitFor(() => {
      const activateCall = capturedPosts.find((c) =>
        c.url.endsWith("/reembed/activate"),
      );
      expect(activateCall).toBeDefined();
      expect(activateCall?.body).toEqual({
        schema_version: 1,
        generation_id: 2,
      });
    });
  });

  test("Cancel button shows on backfilling row and POSTs /reembed/cancel", async () => {
    const { capturedPosts } = mockFetchDefaults({
      state: makeState({
        pending_generation: 2,
        pending_model_name: "qwen3-embed-1.7b",
        generations: [
          makeGen({
            generation_id: 2,
            state: "backfilling",
            validation_completed_at: null,
            validation_passed: null,
            activated_at: null,
          }),
        ],
      }),
    });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId("btn-cancel-2")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("btn-cancel-2"));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Cancel re-embed" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Cancel re-embed" }),
    );

    await waitFor(() => {
      const cancelCall = capturedPosts.find((c) =>
        c.url.endsWith("/reembed/cancel"),
      );
      expect(cancelCall).toBeDefined();
      expect(cancelCall?.body).toEqual({ generation_id: 2 });
    });
  });

  test("Validate button POSTs /reembed/validate after confirm", async () => {
    const { capturedPosts } = mockFetchDefaults({
      state: makeState({
        generations: [
          makeGen({
            generation_id: 2,
            state: "ready",
            validation_passed: null,
            validation_completed_at: null,
            activated_at: null,
          }),
        ],
      }),
    });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId("btn-validate-2")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("btn-validate-2"));

    await waitFor(() => {
      // Confirm modal: secondary "Cancel" + primary "Validate"; uniquely
      // identify via the modal title.
      expect(screen.getByText("Re-run validation")).toBeInTheDocument();
    });

    // Two "Validate" buttons now exist: the row trigger + the modal
    // primary action. The modal one is rendered last in the DOM, so
    // pick the trailing one.
    const validateButtons = screen.getAllByRole("button", {
      name: "Validate",
    });
    fireEvent.click(validateButtons[validateButtons.length - 1]!);

    await waitFor(() => {
      const validateCall = capturedPosts.find((c) =>
        c.url.endsWith("/reembed/validate"),
      );
      expect(validateCall).toBeDefined();
      expect(validateCall?.body).toEqual({ generation_id: 2 });
    });
  });

  test("GC button disabled when retention window has not elapsed", async () => {
    // retired_at = 1 day ago → 29 days short of the 30-day window.
    const oneDayAgo = new Date(
      Date.now() - 1 * 24 * 60 * 60 * 1000,
    ).toISOString();
    mockFetchDefaults({
      state: makeState({
        generations: [
          makeGen({
            generation_id: 3,
            state: "retired",
            validation_passed: false,
            retired_at: oneDayAgo,
            retire_reason: "demoted",
            activated_at: null,
          }),
        ],
      }),
    });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId("btn-gc-3")).toBeInTheDocument();
    });

    const gcBtn = screen.getByTestId("btn-gc-3") as HTMLButtonElement;
    expect(gcBtn).toBeDisabled();

    // Rollback is enabled on the same row.
    const rollbackBtn = screen.getByTestId(
      "btn-rollback-3",
    ) as HTMLButtonElement;
    expect(rollbackBtn).not.toBeDisabled();
  });
});

describe("EmbedderLifecyclePanel — validation report modal", () => {
  test("View report opens modal showing the ValidationReportViewer", async () => {
    mockFetchDefaults({
      state: makeState({
        generations: [
          makeGen({
            generation_id: 1,
            state: "active",
            validation_passed: true,
            validation_report: {
              schema_version: 1,
              sample_size: 250,
              tokenization_drift: {
                mean_pct_diff: 0.02,
                max_pct_diff: 0.15,
              },
              norm_distribution_old: {
                mean: 1.0,
                stddev: 0.1,
                p50: 1.0,
                p99: 1.2,
              },
              norm_distribution_new: {
                mean: 0.95,
                stddev: 0.12,
                p50: 0.95,
                p99: 1.15,
              },
              truncation_count: 3,
              retrieval_overlap: {
                at_5: 0.92,
                at_10: 0.88,
                fixture_size: 20.0,
              },
              warnings: [],
              passed: true,
            },
          }),
        ],
      }),
    });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId("btn-view-report-1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("btn-view-report-1"));

    await waitFor(() => {
      expect(screen.getByTestId("report-modal-body")).toBeInTheDocument();
    });

    // The body renders the real T5.5 ValidationReportViewer fed by
    // gen.validation_report.
    expect(screen.getByTestId("validation-report-viewer")).toBeInTheDocument();
    expect(screen.getByTestId("passed-badge").textContent).toBe("Passed");
    // Sample size from fixture is surfaced (proves we're rendering the
    // structured report, not a stub).
    expect(screen.getByTestId("sample-size").textContent).toBe("250");
    // Truncation count from fixture is surfaced.
    expect(screen.getByTestId("truncation-count").textContent).toBe("3");
    // Overlap@5 value (0.92, formatted as 3-decimal) is surfaced.
    expect(
      screen.getByTestId("overlap-row-Overlapat5").textContent,
    ).toContain("0.920");
    // The stub-era followup note is GONE.
    expect(
      screen.queryByTestId("report-followup-note"),
    ).not.toBeInTheDocument();
  });

  test("View report with no validation_report shows placeholder", async () => {
    mockFetchDefaults({
      state: makeState({
        generations: [
          makeGen({
            generation_id: 1,
            state: "active",
            // validation_passed is non-null (so the "View report" button
            // is shown) but validation_report is null (the workflow
            // hasn't finished writing the structured report yet).
            validation_passed: true,
            validation_report: null,
          }),
        ],
      }),
    });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId("btn-view-report-1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("btn-view-report-1"));

    await waitFor(() => {
      expect(screen.getByTestId("report-modal-body")).toBeInTheDocument();
    });

    expect(screen.getByTestId("report-not-available")).toBeInTheDocument();
    expect(
      screen.getByTestId("report-not-available").textContent,
    ).toContain("No validation report available");
    // No ValidationReportViewer rendered.
    expect(
      screen.queryByTestId("validation-report-viewer"),
    ).not.toBeInTheDocument();
  });
});

describe("EmbedderLifecyclePanel — retrieval-mode flip", () => {
  test("Retrieval-mode flip succeeds when coverage gap=0", async () => {
    const { capturedPosts } = mockFetchDefaults({
      state: makeState({ retrieval_mode: "fallback" }),
      coverage: makeCoverage({
        confluence_missing: 0,
        knowledge_missing: 0,
        total_missing: 0,
      }),
    });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId("retrieval-mode-flip-btn")).toBeInTheDocument();
    });

    // Wait for coverage to load (so the flip button enables).
    await waitFor(() => {
      const btn = screen.getByTestId(
        "retrieval-mode-flip-btn",
      ) as HTMLButtonElement;
      expect(btn).not.toBeDisabled();
    });

    fireEvent.click(screen.getByTestId("retrieval-mode-flip-btn"));

    await waitFor(() => {
      const flipCall = capturedPosts.find((c) =>
        c.url.endsWith("/retrieval-mode"),
      );
      expect(flipCall).toBeDefined();
      expect(flipCall?.body).toEqual({
        schema_version: 1,
        mode: "generation_only",
      });
    });

    await waitFor(() => {
      expect(
        screen.getByTestId("embedder-success-banner"),
      ).toBeInTheDocument();
    });
  });

  test("Retrieval-mode flip 422 coverage_gap_present surfaces error banner", async () => {
    mockFetchDefaults({
      state: makeState({ retrieval_mode: "fallback" }),
      coverage: makeCoverage({
        confluence_missing: 0,
        knowledge_missing: 0,
        total_missing: 0,
      }),
      postHandler: (url) => {
        if (url.endsWith("/retrieval-mode")) {
          return jsonResponse(
            {
              detail: {
                error: "coverage_gap_present",
                msg: "Coverage gap detected",
              },
            },
            422,
          );
        }
        return jsonResponse({}, 404);
      },
    });

    renderPanel();

    await waitFor(() => {
      const btn = screen.getByTestId(
        "retrieval-mode-flip-btn",
      ) as HTMLButtonElement;
      expect(btn).not.toBeDisabled();
    });

    fireEvent.click(screen.getByTestId("retrieval-mode-flip-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("embedder-error-banner")).toBeInTheDocument();
    });

    expect(
      screen.getByTestId("embedder-error-banner").textContent,
    ).toContain("Coverage gap present");
  });
});

describe("EmbedderLifecyclePanel — coverage gauge", () => {
  test("Coverage gauge shows missing counts", async () => {
    mockFetchDefaults({
      coverage: makeCoverage({
        confluence_missing: 12,
        knowledge_missing: 34,
        total_missing: 46,
      }),
    });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId("coverage-confluence")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByTestId("coverage-confluence").textContent).toContain(
        "12 missing",
      );
    });
    expect(screen.getByTestId("coverage-knowledge").textContent).toContain(
      "34 missing",
    );
  });
});

describe("EmbedderLifecyclePanel — throttling controls", () => {
  test("Throttling controls collapsed by default; expand renders defaults", async () => {
    mockFetchDefaults({});

    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId("throttling-toggle")).toBeInTheDocument();
    });

    // Collapsed: fields container not rendered.
    expect(screen.queryByTestId("throttling-fields")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("throttling-toggle"));

    await waitFor(() => {
      expect(screen.getByTestId("throttling-fields")).toBeInTheDocument();
    });

    const mif = screen.getByTestId(
      "throttle-input-max_in_flight_batches",
    ) as HTMLInputElement;
    expect(mif.value).toBe("4");

    const rps = screen.getByTestId(
      "throttle-input-max_qwen_rps",
    ) as HTMLInputElement;
    expect(rps.value).toBe("50");

    expect(
      screen.getByTestId("throttling-followup-note").textContent,
    ).toContain("FOLLOW-UP-embedder-throttling-controls-wire-to-start");
  });
});
