/**
 * ADR-0060 — unit tests for <LlmModelCatalogCard> (MODELS section).
 *
 * Covers:
 *   - list render (table rows + status badges).
 *   - add: Save & test happy path (PUT then /test).
 *   - delete blocked by 409 → shows dependent purposes.
 *   - add unsupported model 422 → shows the engine message.
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
    mockFetch(async (url) => {
      if (url.endsWith("/llm-models")) {
        return json({
          models: [
            modelRow(),
            modelRow({
              model_id: "claude-haiku-4",
              display_name: null,
              last_validation_status: "failed",
              last_validation_error: "model not found",
            }),
          ],
        });
      }
      return new Response(null, { status: 404 });
    });

    render(<LlmModelCatalogCard />);

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
    // Regression: a 200 body without a `models` array used to make
    // listLlmModels() return undefined, white-screening the page on
    // `models.length`. It must coerce to [] and render the empty-state.
    mockFetch(async (url) => {
      if (url.endsWith("/llm-models")) {
        return json({}); // no `models` key
      }
      return new Response(null, { status: 404 });
    });

    render(<LlmModelCatalogCard />);

    await waitFor(() => {
      expect(screen.getByTestId("model-catalog-empty")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("model-catalog-load-error")).not.toBeInTheDocument();
  });

  test("add: Save & test issues PUT then POST /test", async () => {
    const calls: { method: string; url: string; body?: unknown }[] = [];
    let listCallCount = 0;

    mockFetch(async (url, init) => {
      const method = init?.method ?? "GET";
      if (method === "GET" && url.endsWith("/llm-models")) {
        listCallCount += 1;
        // First load: empty; after add: contains the new model.
        const models =
          listCallCount === 1 ? [] : [modelRow({ model_id: "claude-opus-4" })];
        return json({ models });
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

    render(<LlmModelCatalogCard />);

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
  });

  test("delete blocked by 409 shows dependent purposes", async () => {
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

    render(<LlmModelCatalogCard />);

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

    render(<LlmModelCatalogCard />);

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
});
