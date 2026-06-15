/**
 * ADR-0060 — unit tests for <LlmModelCatalogCard> (MODELS section).
 *
 * Covers:
 *   - list render (table rows + status badges).
 *   - add: Save & test happy path (PUT then /test) → green banner.
 *   - add: added-but-preflight-failed → amber/warning banner (PART 3 §5).
 *   - add: failed (PUT error) → red banner (PART 3 §5).
 *   - add: 409 llm_model_id_taken surfaces backend detail (PART 3 §6).
 *   - delete blocked by 409 → shows dependent purposes.
 *   - add unsupported model 422 → shows the engine message.
 *   - refreshModels prop called after mutations (PART 2).
 *   - F1: when refreshModels rejects, card shows load-error banner (not silent empty).
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { LlmModelCatalogCard } from "@/components/admin/LlmModelCatalogCard";

// ── Helpers ───────────────────────────────────────────────────────

let fetchSpy: ReturnType<typeof vi.spyOn> | null = null;

function mockFetch(
  callback: (url: string, init?: RequestInit) => Response | Promise<Response>,
): void {
  fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      return callback(url, init);
    },
  );
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function modelRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    provider: "anthropic_direct",
    model_id: "claude-sonnet-4-6",
    display_name: "Sonnet 4.6",
    enabled: true,
    last_validation_status: "ok",
    last_validation_error: null,
    last_validated_at: "2026-05-30T00:00:00Z",
    ...over,
  };
}

beforeEach(() => {
  fetchSpy = null;
});

afterEach(() => {
  fetchSpy?.mockRestore();
  fetchSpy = null;
});

// ── Tests ─────────────────────────────────────────────────────────

describe("LlmModelCatalogCard", () => {
  test("renders catalog rows with status badge", async () => {
    // The card's table reads from the `models` prop (PART 2).
    // The initial load triggers refreshModels; the parent then passes
    // the populated list back. In this isolated test we supply models directly.
    const models = [
      modelRow() as ReturnType<typeof modelRow>,
      modelRow({
        model_id: "claude-haiku-4",
        display_name: null,
        last_validation_status: "failed",
        last_validation_error: "model not found",
      }) as ReturnType<typeof modelRow>,
    ];

    mockFetch(async (url) => {
      if (url.endsWith("/llm-models")) {
        return json({ models });
      }
      return new Response(null, { status: 404 });
    });

    render(
      <LlmModelCatalogCard
        models={models as unknown as import("@/lib/api/llm-models").LlmModelV1[]}
        refreshModels={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("model-row-claude-sonnet-4-6")).toBeInTheDocument();
    });
    expect(screen.getByTestId("model-status-claude-sonnet-4-6").textContent).toContain(
      "Valid",
    );
    expect(screen.getByTestId("model-status-claude-haiku-4").textContent).toContain(
      "Failed",
    );
  });

  test("malformed list body (no `models` key) degrades to empty-state, never crashes", async () => {
    mockFetch(async (url) => {
      if (url.endsWith("/llm-models")) {
        return json({}); // no `models` key
      }
      return new Response(null, { status: 404 });
    });

    render(<LlmModelCatalogCard models={[]} refreshModels={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("model-catalog-empty")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("model-catalog-load-error")).not.toBeInTheDocument();
  });

  test("add: Save & test issues PUT then POST /test, refreshModels called", async () => {
    const calls: { method: string; url: string; body?: unknown }[] = [];
    const refreshModels = vi.fn();

    mockFetch(async (url, init) => {
      const method = init?.method ?? "GET";
      if (method === "GET" && url.endsWith("/llm-models")) {
        return json({ models: [] });
      }
      if (method === "PUT" && url.endsWith("/llm-models")) {
        calls.push({ method, url, body: JSON.parse(init?.body as string) });
        return json(modelRow({ model_id: "claude-opus-4" }));
      }
      if (method === "POST" && url.includes("/test")) {
        calls.push({ method, url });
        return json({ ok: true, message: "ping ok" });
      }
      return new Response(null, { status: 404 });
    });

    render(<LlmModelCatalogCard models={[]} refreshModels={refreshModels} />);

    await waitFor(() => {
      expect(screen.getByTestId("model-catalog-empty")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("add-model-id-input"), {
      target: { value: "claude-opus-4" },
    });
    fireEvent.click(screen.getByTestId("add-model-save-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("add-model-success")).toBeInTheDocument();
    });

    // Banner is green (healthy) — add+validated path.
    const successBanner = screen.getByTestId("add-model-success");
    expect(successBanner.className).toContain("c-status-healthy");

    const putCall = calls.find((c) => c.method === "PUT");
    const testCall = calls.find((c) => c.method === "POST");
    expect(putCall).toBeDefined();
    expect(putCall?.body).toMatchObject({
      schema_version: 1,
      provider: "anthropic_direct",
      model_id: "claude-opus-4",
      enabled: true,
    });
    expect(testCall).toBeDefined();
    expect(testCall?.url).toContain(
      "/llm-models/anthropic_direct/claude-opus-4/test",
    );

    // PART 2: refreshModels must be called after a successful add.
    expect(refreshModels).toHaveBeenCalled();
  });

  // PART 3 §5 — add-but-preflight-failed → amber/warning banner, not green.
  test("add-but-preflight-failed shows amber warning banner, not green", async () => {
    mockFetch(async (url, init) => {
      const method = init?.method ?? "GET";
      if (method === "GET" && url.endsWith("/llm-models")) {
        return json({ models: [] });
      }
      if (method === "PUT" && url.endsWith("/llm-models")) {
        return json(modelRow({ model_id: "claude-opus-4" }));
      }
      if (method === "POST" && url.includes("/test")) {
        return json({ ok: false, message: "model key not authorised" });
      }
      return new Response(null, { status: 404 });
    });

    render(<LlmModelCatalogCard models={[]} refreshModels={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("model-catalog-empty")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("add-model-id-input"), {
      target: { value: "claude-opus-4" },
    });
    fireEvent.click(screen.getByTestId("add-model-save-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("add-model-success")).toBeInTheDocument();
    });

    const successBanner = screen.getByTestId("add-model-success");
    // Must be amber (degraded), NOT green (healthy).
    expect(successBanner.className).toContain("c-status-degraded");
    expect(successBanner.className).not.toContain("c-status-healthy");
    // Shows the raw result.message — NOT a duplicated "preflight failed:" prefix.
    expect(successBanner.textContent).toContain("model key not authorised");
    expect(successBanner.textContent).not.toMatch(/preflight failed:.*preflight failed:/);
  });

  // PART 3 §6 — 409 llm_model_id_taken → surfaces backend detail message.
  test("add: 409 llm_model_id_taken surfaces the backend detail message", async () => {
    mockFetch(async (url, init) => {
      const method = init?.method ?? "GET";
      if (method === "GET" && url.endsWith("/llm-models")) {
        return json({ models: [] });
      }
      if (method === "PUT" && url.endsWith("/llm-models")) {
        return json(
          {
            detail: {
              code: "llm_model_id_taken",
              message: "claude-sonnet-4-6 is already registered under bedrock.",
              provider: "bedrock",
            },
          },
          409,
        );
      }
      return new Response(null, { status: 404 });
    });

    render(<LlmModelCatalogCard models={[]} refreshModels={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("model-catalog-empty")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("add-model-id-input"), {
      target: { value: "claude-sonnet-4-6" },
    });
    fireEvent.click(screen.getByTestId("add-model-save-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("add-model-error")).toBeInTheDocument();
    });
    expect(screen.getByTestId("add-model-error").textContent).toContain(
      "already registered under bedrock",
    );
  });

  test("delete blocked by 409 shows dependent purposes", async () => {
    const existingModels = [
      modelRow() as unknown as import("@/lib/api/llm-models").LlmModelV1,
    ];

    mockFetch(async (url, init) => {
      const method = init?.method ?? "GET";
      if (method === "GET" && url.endsWith("/llm-models")) {
        return json({ models: [modelRow()] });
      }
      if (method === "DELETE") {
        return json(
          {
            detail: {
              code: "llm_model_in_use",
              message: "Model is routed by 2 purposes.",
              purposes: ["review_finding", "walkthrough"],
            },
          },
          409,
        );
      }
      return new Response(null, { status: 404 });
    });

    render(<LlmModelCatalogCard models={existingModels} refreshModels={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("model-row-claude-sonnet-4-6")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("model-delete-btn-claude-sonnet-4-6"));

    await waitFor(() => {
      expect(screen.getByTestId("model-in-use-claude-sonnet-4-6")).toBeInTheDocument();
    });

    const banner = screen.getByTestId("model-in-use-claude-sonnet-4-6");
    expect(banner.textContent).toContain("review_finding");
    expect(banner.textContent).toContain("walkthrough");
  });

  test("add unsupported model 422 shows the engine message", async () => {
    mockFetch(async (url, init) => {
      const method = init?.method ?? "GET";
      if (method === "GET" && url.endsWith("/llm-models")) {
        return json({ models: [] });
      }
      if (method === "PUT" && url.endsWith("/llm-models")) {
        return json(
          {
            detail: {
              code: "unsupported_model",
              message: "model_id 'bogus-model' is not in the accepted set.",
            },
          },
          422,
        );
      }
      return new Response(null, { status: 404 });
    });

    render(<LlmModelCatalogCard models={[]} refreshModels={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("model-catalog-empty")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("add-model-id-input"), {
      target: { value: "bogus-model" },
    });
    fireEvent.click(screen.getByTestId("add-model-save-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("add-model-error")).toBeInTheDocument();
    });
    expect(screen.getByTestId("add-model-error").textContent).toContain(
      "not in the accepted set",
    );
  });

  // F1 — when refreshModels rejects, the catalog card shows the load-error
  // banner (not a silent empty catalog).  This validates that refreshModels
  // propagates its rejection rather than swallowing it.
  test("F1: when refreshModels rejects, load-error banner is shown (not silent empty)", async () => {
    // refreshModels prop that always rejects — simulates a broken catalog fetch.
    const refreshModels = vi.fn().mockRejectedValue(new Error("Network failure"));

    render(<LlmModelCatalogCard models={[]} refreshModels={refreshModels} />);

    // The load-error banner must appear...
    await waitFor(() => {
      expect(screen.getByTestId("model-catalog-load-error")).toBeInTheDocument();
    });
    expect(screen.getByTestId("model-catalog-load-error").textContent).toContain(
      "Network failure",
    );
    // ...and the empty-state placeholder must NOT appear (we're in error state).
    expect(screen.queryByTestId("model-catalog-empty")).not.toBeInTheDocument();
  });
});
