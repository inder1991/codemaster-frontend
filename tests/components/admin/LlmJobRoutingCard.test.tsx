/**
 * ADR-0060 — unit tests for <LlmJobRoutingCard> (JOB ROUTING section).
 *
 * Covers:
 *   - dropdown lists only ok+enabled catalog models (+ default).
 *   - assign success (PUT) reflects the new selection.
 *   - assign rejected by 422 → shows the backend message.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { LlmJobRoutingCard } from "@/components/admin/LlmJobRoutingCard";

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
    display_name: null,
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

describe("LlmJobRoutingCard", () => {
  test("dropdown lists only ok+enabled models plus default", async () => {
    mockFetch(async (url) => {
      if (url.endsWith("/llm-models")) {
        return json({
          models: [
            modelRow({ model_id: "valid-ok" }),
            modelRow({ model_id: "disabled-model", enabled: false }),
            modelRow({ model_id: "failed-model", last_validation_status: "failed" }),
            modelRow({ model_id: "untested-model", last_validation_status: null }),
          ],
        });
      }
      if (url.endsWith("/llm-purpose-routing")) {
        return json({ assignments: [] });
      }
      return new Response(null, { status: 404 });
    });

    render(<LlmJobRoutingCard />);

    await waitFor(() => {
      expect(screen.getByTestId("routing-select-review_finding")).toBeInTheDocument();
    });

    const select = screen.getByTestId(
      "routing-select-review_finding",
    ) as HTMLSelectElement;
    const optionValues = within(select)
      .getAllByRole("option")
      .map((o) => (o as HTMLOptionElement).value);

    expect(optionValues).toContain("__default__");
    expect(optionValues).toContain("valid-ok");
    expect(optionValues).not.toContain("disabled-model");
    expect(optionValues).not.toContain("failed-model");
    expect(optionValues).not.toContain("untested-model");
  });

  test("assign success PUTs the purpose/model and reflects selection", async () => {
    let putBody: unknown = null;

    mockFetch(async (url, init) => {
      const method = init?.method ?? "GET";
      if (method === "GET" && url.endsWith("/llm-models")) {
        return json({ models: [modelRow({ model_id: "valid-ok" })] });
      }
      if (method === "GET" && url.endsWith("/llm-purpose-routing")) {
        return json({ assignments: [] });
      }
      if (method === "PUT" && url.endsWith("/llm-purpose-routing")) {
        putBody = JSON.parse(init?.body as string);
        return json({ purpose: "review_finding", model_id: "valid-ok" });
      }
      return new Response(null, { status: 404 });
    });

    render(<LlmJobRoutingCard />);

    await waitFor(() => {
      expect(screen.getByTestId("routing-select-review_finding")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("routing-select-review_finding"), {
      target: { value: "valid-ok" },
    });

    await waitFor(() => {
      expect(screen.getByTestId("routing-success-review_finding")).toBeInTheDocument();
    });

    expect(putBody).toMatchObject({
      schema_version: 1,
      purpose: "review_finding",
      model_id: "valid-ok",
    });
    expect(
      (screen.getByTestId("routing-select-review_finding") as HTMLSelectElement).value,
    ).toBe("valid-ok");
  });

  test("assign rejected by 422 shows the backend message", async () => {
    mockFetch(async (url, init) => {
      const method = init?.method ?? "GET";
      if (method === "GET" && url.endsWith("/llm-models")) {
        return json({ models: [modelRow({ model_id: "valid-ok" })] });
      }
      if (method === "GET" && url.endsWith("/llm-purpose-routing")) {
        return json({ assignments: [] });
      }
      if (method === "PUT" && url.endsWith("/llm-purpose-routing")) {
        return json(
          {
            detail: {
              code: "model_not_validated",
              message: "Model has not passed preflight.",
            },
          },
          422,
        );
      }
      return new Response(null, { status: 404 });
    });

    render(<LlmJobRoutingCard />);

    await waitFor(() => {
      expect(screen.getByTestId("routing-select-walkthrough")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("routing-select-walkthrough"), {
      target: { value: "valid-ok" },
    });

    await waitFor(() => {
      expect(screen.getByTestId("routing-error-walkthrough")).toBeInTheDocument();
    });
    expect(screen.getByTestId("routing-error-walkthrough").textContent).toContain(
      "has not passed preflight",
    );
  });
});
