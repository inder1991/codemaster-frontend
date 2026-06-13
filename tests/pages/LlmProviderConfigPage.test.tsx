/**
 * S21.LLM-DUAL.1 task 13 — dual-card /admin/llm page tests.
 *
 * Suites:
 *
 *   1. LegacyBedrockAdminPage — REMOVED in Sprint 26 v4 (/admin/bedrock
 *      now 404s).
 *
 *   2. LlmProviderConfigPage (rebuilt Phase 1 page) — asserts the
 *      Inference tab two-card layout, secondary notice, provider→region
 *      visibility, and per-role save API calls.
 *
 *   3. T5.8 (Sprint 26) — Embedding tab: PlatformCredentialsCard for
 *      embedder.qwen + ModelNamePicker extraFields slot +
 *      EmbedderLifecyclePanel. Asserts the tab wrapping preserves the
 *      Inference content and exposes the new surface when switched.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// vi.mock is hoisted by vitest; factory must not reference outer const.
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import * as NextNavigation from "next/navigation";
import LlmProviderConfigPage from "@/app/(authed)/admin/llm/page";

// ── Helpers ───────────────────────────────────────────────────────

let fetchSpy: ReturnType<typeof vi.spyOn> | null = null;

/**
 * Default GET mock for the embedder + platform-credentials endpoints
 * that the Embedding tab's child components query on mount.
 *
 * Returns `null` to fall through to the test-supplied callback for
 * unmatched URLs (PUT /api/admin/llm-provider-config, etc.).
 */
function defaultGetStub(url: string): Response | null {
  if (url.includes("/api/admin/embedder/state")) {
    return new Response(
      JSON.stringify({
        schema_version: 1,
        active_generation: 1,
        active_model_name: "qwen3-embed-0.6b",
        pending_generation: null,
        pending_model_name: null,
        retrieval_mode: "fallback",
        updated_at: "2026-05-28T00:00:00Z",
        updated_by_email: null,
        generations: [],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
  if (url.includes("/api/admin/embedder/coverage")) {
    return new Response(
      JSON.stringify({
        schema_version: 1,
        confluence_missing: 0,
        knowledge_missing: 0,
        total_missing: 0,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
  if (url.includes("/api/admin/platform-credentials/embedder/qwen")) {
    return new Response(
      JSON.stringify({
        schema_version: 1,
        credential_key: "embedder.qwen",
        base_url: "https://qwen.internal.platform.com/v1",
        token_present: true,
        last_rotated_at: "2026-05-28T12:00:00Z",
        last_rotated_by: "ops@example.com",
        last_validated_at: "2026-05-28T12:01:00Z",
        last_validation_error: null,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
  return null;
}

function renderLlmPage() {
  // Production wraps every authed page in <QueryClientProvider> via
  // app/providers.tsx; the Embedding tab's PlatformCredentialsCard +
  // EmbedderLifecyclePanel rely on useQuery/useMutation, so tests
  // must supply a client too.
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
  render(<LlmProviderConfigPage />, { wrapper: Wrap });
}

function mockFetch(
  callback: (url: string, init?: RequestInit) => Response | Promise<Response>,
): void {
  fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/telemetry")) {
        return new Response(null, { status: 204 });
      }
      // For GET requests issued by the Embedding tab on mount, return
      // a sane default so child components hydrate to a "loaded" state.
      if (!init?.method || init.method === "GET") {
        const stubbed = defaultGetStub(url);
        if (stubbed !== null) return stubbed;
      }
      return callback(url, init);
    },
  );
}

beforeEach(() => {
  fetchSpy = null;
  vi.mocked(NextNavigation.redirect).mockClear();
  // Prime a csrf_token so PATCH/POST/PUT requests emit the header.
  Object.defineProperty(document, "cookie", {
    configurable: true,
    get: () => "csrf_token=tok-llm-page",
  });
  // Default fetch mock: only the GET stubs respond; anything else 404s.
  // Individual tests can override by calling mockFetch() themselves.
  mockFetch(async () => new Response(null, { status: 404 }));
});

afterEach(() => {
  fetchSpy?.mockRestore();
  fetchSpy = null;
});

// ── Suite 1: removed — Sprint 26 v4 deleted /admin/bedrock entirely ─
// Previously: LegacyBedrockAdminPage redirected /admin/bedrock → /admin/llm.
// Now: /admin/bedrock 404s (intentional per spec §3 — bookmarks 404).

// ── Suite 2: rebuilt Phase 1 dual-card page ───────────────────────

describe("LlmProviderConfigPage (/admin/llm) — Phase 1 dual-card", () => {
  test("renders both Primary and Secondary card headings", () => {
    renderLlmPage();
    expect(screen.getByText("Primary LLM Provider")).toBeInTheDocument();
    expect(screen.getByText("Secondary LLM Provider")).toBeInTheDocument();
  });

  test("Inference tab uses a 2-column layout: providers left, models+routing right", () => {
    renderLlmPage();
    // LEFT column — provider cards live under the "Providers" header.
    const providersCol = screen.getByTestId("inference-providers-col");
    expect(providersCol).toBeInTheDocument();
    expect(within(providersCol).getByText("Providers")).toBeInTheDocument();
    expect(
      within(providersCol).getByTestId("llm-provider-card-primary"),
    ).toBeInTheDocument();
    expect(
      within(providersCol).getByTestId("llm-provider-card-secondary"),
    ).toBeInTheDocument();

    // RIGHT column — Models + Job routing section headers (h2). The
    // catalog/routing cards also render their own h3 of the same text,
    // so scope the match to the section-level h2 headings.
    const modelsCol = screen.getByTestId("inference-models-col");
    expect(modelsCol).toBeInTheDocument();
    expect(
      within(modelsCol).getByRole("heading", { level: 2, name: "Models" }),
    ).toBeInTheDocument();
    expect(
      within(modelsCol).getByRole("heading", { level: 2, name: "Job routing" }),
    ).toBeInTheDocument();
    // Provider cards are NOT in the right column.
    expect(
      within(modelsCol).queryByTestId("llm-provider-card-primary"),
    ).not.toBeInTheDocument();
  });

  test("secondary card shows the 'not yet routed' notice", () => {
    renderLlmPage();
    expect(
      screen.getByTestId("secondary-card-notice"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("secondary-card-notice").textContent).toContain(
      "not yet routed",
    );
  });

  test("primary card does not show the secondary notice", () => {
    renderLlmPage();
    const primaryCard = screen.getByTestId("llm-provider-card-primary");
    // The notice is inside secondary card only.
    expect(primaryCard.querySelector("[data-testid='secondary-card-notice']")).toBeNull();
  });

  test("region field is visible when provider is bedrock (default)", () => {
    renderLlmPage();
    // Default provider is bedrock → both cards should show region fields.
    expect(screen.getAllByTestId("primary-region-field")).toHaveLength(1);
    expect(screen.getAllByTestId("secondary-region-field")).toHaveLength(1);
  });

  test("region field is hidden when provider changes to anthropic_direct", () => {
    renderLlmPage();
    const primaryProviderSelect = screen.getByTestId(
      "primary-provider-select",
    ) as HTMLSelectElement;
    fireEvent.change(primaryProviderSelect, {
      target: { value: "anthropic_direct" },
    });
    // Region field should disappear for the primary card.
    expect(
      screen.queryByTestId("primary-region-field"),
    ).not.toBeInTheDocument();
    // Secondary card region field is still present (still bedrock).
    expect(screen.getByTestId("secondary-region-field")).toBeInTheDocument();
  });

  test("save button calls PUT with role='primary' and correct payload", async () => {
    const putSpy = vi.fn().mockResolvedValue({
      schema_version: 1,
      model_id: "claude-sonnet-4-6",
      region: "us-east-1",
      api_key_fingerprint: "abcd",
      enabled: true,
      last_validated_at: null,
      last_validation_status: null,
      last_rotated_at: "2026-05-12T00:00:00Z",
      last_rotated_by_user_id: "00000000-0000-0000-0000-000000000001",
    });

    mockFetch(async (url, init) => {
      if (init?.method === "PUT") {
        const body = JSON.parse(init.body as string) as Record<string, unknown>;
        return new Response(JSON.stringify(putSpy(body)), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(null, { status: 404 });
    });

    renderLlmPage();

    // Fill API key on primary card. Both cards show a bedrock label by default,
    // so query within the primary card element.
    const primaryCard = screen.getByTestId("llm-provider-card-primary");
    const primaryKey = primaryCard.querySelector(
      "input[type='password']",
    ) as HTMLInputElement;
    fireEvent.change(primaryKey, { target: { value: "bedrock-test-key-aaaaaaaaaaaa" } });

    // Click Save on primary.
    fireEvent.click(screen.getByTestId("primary-save-btn"));

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledOnce();
    });

    const calledWith = putSpy.mock.calls[0]![0] as Record<string, unknown>;
    expect(calledWith.role).toBe("primary");
    expect(calledWith.provider).toBe("bedrock");
    expect(calledWith.schema_version).toBe(1);
  });

  test("save button calls PUT with role='secondary'", async () => {
    const putSpy = vi.fn().mockResolvedValue({
      schema_version: 1,
      model_id: "claude-sonnet-4-6",
      region: null,
      api_key_fingerprint: "wxyz",
      enabled: true,
      last_validated_at: null,
      last_validation_status: null,
      last_rotated_at: "2026-05-12T00:00:00Z",
      last_rotated_by_user_id: "00000000-0000-0000-0000-000000000002",
    });

    mockFetch(async (url, init) => {
      if (init?.method === "PUT") {
        const body = JSON.parse(init.body as string) as Record<string, unknown>;
        return new Response(JSON.stringify(putSpy(body)), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(null, { status: 404 });
    });

    renderLlmPage();

    // Switch secondary card to anthropic_direct.
    const secondaryProviderSelect = screen.getByTestId(
      "secondary-provider-select",
    ) as HTMLSelectElement;
    fireEvent.change(secondaryProviderSelect, {
      target: { value: "anthropic_direct" },
    });

    // Fill API key on secondary card.
    // Get the API key input in the secondary card and fill it.
    const secondaryCard = screen.getByTestId("llm-provider-card-secondary");
    const secondarySaveBtn = screen.getByTestId("secondary-save-btn");
    const keyInput = secondaryCard.querySelector(
      "input[type='password']",
    ) as HTMLInputElement;
    fireEvent.change(keyInput, {
      target: { value: "sk-ant-aaaaaaaaaaaaaaaaaaaaa" },
    });

    fireEvent.click(secondarySaveBtn);

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledOnce();
    });

    const calledWith = putSpy.mock.calls[0]![0] as Record<string, unknown>;
    expect(calledWith.role).toBe("secondary");
    expect(calledWith.provider).toBe("anthropic_direct");
    expect(calledWith.region).toBeNull();
  });

  test("save success clears the API key input", async () => {
    mockFetch(async (url, init) => {
      if (init?.method === "PUT") {
        return new Response(
          JSON.stringify({
            schema_version: 1,
            model_id: "claude-sonnet-4-6",
            region: "us-east-1",
            api_key_fingerprint: "zzzz",
            enabled: true,
            last_validated_at: null,
            last_validation_status: null,
            last_rotated_at: "2026-05-12T00:00:00Z",
            last_rotated_by_user_id: "00000000-0000-0000-0000-000000000001",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(null, { status: 404 });
    });

    renderLlmPage();

    const primaryCard = screen.getByTestId("llm-provider-card-primary");
    const keyInput = primaryCard.querySelector(
      "input[type='password']",
    ) as HTMLInputElement;
    fireEvent.change(keyInput, { target: { value: "bedrock-test-key-aaaaaaaaaaaa" } });

    fireEvent.click(screen.getByTestId("primary-save-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("primary-save-success")).toBeInTheDocument();
    });
    // API key cleared.
    expect(keyInput.value).toBe("");
  });

  test("save error displays error message", async () => {
    mockFetch(async (url, init) => {
      if (init?.method === "PUT") {
        return new Response(
          JSON.stringify({
            detail: {
              code: "llm_provider_preflight_failed",
              message: "upstream 401: invalid credentials",
            },
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(null, { status: 404 });
    });

    renderLlmPage();

    const primaryCard = screen.getByTestId("llm-provider-card-primary");
    const keyInput = primaryCard.querySelector(
      "input[type='password']",
    ) as HTMLInputElement;
    fireEvent.change(keyInput, { target: { value: "bedrock-test-key-aaaaaaaaaaaa" } });

    fireEvent.click(screen.getByTestId("primary-save-btn"));

    const errBanner = await screen.findByTestId("primary-save-error");
    expect(errBanner.textContent).toContain("upstream 401");
    expect(screen.queryByTestId("primary-save-success")).not.toBeInTheDocument();
  });
});

// ── Suite 3: T5.8 — Embedding tab (Sprint 26) ─────────────────────

describe("LlmProviderConfigPage (/admin/llm) — T5.8 Embedding tab", () => {
  test("renders the tab list with Inference and Embedding tabs", () => {
    renderLlmPage();
    const tablist = screen.getByTestId("llm-config-tablist");
    expect(tablist).toBeInTheDocument();
    expect(
      screen.getByTestId("llm-config-tab-inference"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("llm-config-tab-embedding"),
    ).toBeInTheDocument();
  });

  test("Inference tab is selected by default and shows the dual-card UI", () => {
    renderLlmPage();
    // The Inference tab is the first child of TabGroup → selected by default.
    // Existing Phase-1 dual-card content is visible on initial render.
    expect(
      screen.getByTestId("llm-provider-card-primary"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("llm-provider-card-secondary"),
    ).toBeInTheDocument();
    // Embedding-tab content should not be mounted yet (Headless UI v2
    // unmounts inactive TabPanels by default).
    expect(
      screen.queryByTestId("platform-credentials-card-embedder-qwen"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("embedder-lifecycle-panel"),
    ).not.toBeInTheDocument();
  });

  test("clicking Embedding tab reveals the Qwen credentials card", async () => {
    renderLlmPage();
    fireEvent.click(screen.getByTestId("llm-config-tab-embedding"));

    // Qwen platform-credentials card mounts.
    const card = await screen.findByTestId(
      "platform-credentials-card-embedder-qwen",
    );
    expect(card).toBeInTheDocument();
    expect(within(card).getByText("Qwen embedder credentials")).toBeInTheDocument();
  });

  test("Embedding tab renders the EmbedderLifecyclePanel", async () => {
    renderLlmPage();
    fireEvent.click(screen.getByTestId("llm-config-tab-embedding"));

    expect(
      await screen.findByTestId("embedder-lifecycle-panel"),
    ).toBeInTheDocument();
    // Lifecycle panel hydrates from the default GET-stub state (active
    // generation 1, qwen3-embed-0.6b).
    await waitFor(() => {
      expect(screen.getByTestId("embedder-header")).toBeInTheDocument();
    });
    expect(screen.getByTestId("active-generation").textContent).toContain(
      "qwen3-embed-0.6b",
    );
  });

  test("ModelNamePicker is rendered as extraFields inside the Qwen card", async () => {
    renderLlmPage();
    fireEvent.click(screen.getByTestId("llm-config-tab-embedding"));

    const card = await screen.findByTestId(
      "platform-credentials-card-embedder-qwen",
    );
    // The extraFields slot uses the data-testid pattern
    // `${cardTestId}-extra-fields`. Inside, the ModelNamePicker renders
    // a `model-name-picker-input` control.
    const extraFields = within(card).getByTestId(
      "platform-credentials-card-embedder-qwen-extra-fields",
    );
    expect(
      within(extraFields).getByTestId("model-name-picker-input"),
    ).toBeInTheDocument();
    // The operator-reference note clarifies the picker is advisory.
    expect(
      within(extraFields).getByTestId("qwen-model-picker-note"),
    ).toBeInTheDocument();
  });

  test("switching tabs back to Inference preserves the dual-card content", async () => {
    renderLlmPage();
    // Switch to Embedding…
    fireEvent.click(screen.getByTestId("llm-config-tab-embedding"));
    expect(
      await screen.findByTestId("platform-credentials-card-embedder-qwen"),
    ).toBeInTheDocument();

    // …and back to Inference.
    fireEvent.click(screen.getByTestId("llm-config-tab-inference"));
    expect(
      await screen.findByTestId("llm-provider-card-primary"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("llm-provider-card-secondary"),
    ).toBeInTheDocument();
    // Embedding-tab content unmounted again.
    expect(
      screen.queryByTestId("platform-credentials-card-embedder-qwen"),
    ).not.toBeInTheDocument();
  });
});
