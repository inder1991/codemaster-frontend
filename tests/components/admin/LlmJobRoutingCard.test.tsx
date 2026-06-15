/**
 * ADR-0060 — unit tests for <LlmJobRoutingCard> (JOB ROUTING section).
 *
 * Covers:
 *   - renders exactly the 4 executable purposes (PART 4-FE).
 *   - dropdown lists only ok+enabled catalog models (+ default).
 *   - picking "— default —" calls DELETE and re-fetches (PART 4-FE).
 *   - assign success (PUT) reflects the new selection.
 *   - assign rejected by 422 → shows the backend message.
 *   - shared models prop (PART 2): a model validated outside the card
 *     appears in the routing options without remounting.
 */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { LlmJobRoutingCard } from "@/components/admin/LlmJobRoutingCard";
import type { LlmModelV1 } from "@/lib/api/llm-models";

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

/** A pre-made valid model for passing as the `models` prop. */
const VALID_MODEL: LlmModelV1 = {
  provider: "anthropic_direct",
  model_id: "claude-sonnet-4-6",
  display_name: null,
  enabled: true,
  last_validation_status: "ok",
  last_validation_error: null,
  last_validated_at: "2026-05-30T00:00:00Z",
};

beforeEach(() => {
  fetchSpy = null;
});

afterEach(() => {
  fetchSpy?.mockRestore();
  fetchSpy = null;
});

// ── Tests ─────────────────────────────────────────────────────────

describe("LlmJobRoutingCard", () => {
  // PART 4-FE §1 — exactly 4 executable purposes in display order.
  test("renders exactly the 4 executable purposes in display order", async () => {
    mockFetch(async (url) => {
      if (url.endsWith("/llm-models")) return json({ models: [] });
      if (url.endsWith("/llm-purpose-routing")) return json({ assignments: [] });
      return new Response(null, { status: 404 });
    });

    render(<LlmJobRoutingCard models={[]} />);

    await waitFor(() => {
      expect(screen.getByTestId("job-routing-rows")).toBeInTheDocument();
    });

    const rows = screen.getByTestId("job-routing-rows");
    const rowEls = within(rows).getAllByTestId(/^job-routing-row-/);
    // Must be exactly 4.
    expect(rowEls).toHaveLength(4);

    // Display order: review_finding → walkthrough → analysis_curator → fix_prompt
    expect(rowEls[0]).toHaveAttribute("data-testid", "job-routing-row-review_finding");
    expect(rowEls[1]).toHaveAttribute("data-testid", "job-routing-row-walkthrough");
    expect(rowEls[2]).toHaveAttribute("data-testid", "job-routing-row-analysis_curator");
    expect(rowEls[3]).toHaveAttribute("data-testid", "job-routing-row-fix_prompt");

    // Removed purposes must NOT appear.
    expect(screen.queryByTestId("job-routing-row-review_summary")).not.toBeInTheDocument();
    expect(screen.queryByTestId("job-routing-row-chat_reply")).not.toBeInTheDocument();
    expect(screen.queryByTestId("job-routing-row-redaction_check")).not.toBeInTheDocument();
    expect(screen.queryByTestId("job-routing-row-cost_estimate")).not.toBeInTheDocument();
  });

  // PART 4-FE §1 — correct human labels.
  test("renders human-readable labels for the 4 purposes", async () => {
    mockFetch(async (url) => {
      if (url.endsWith("/llm-models")) return json({ models: [] });
      if (url.endsWith("/llm-purpose-routing")) return json({ assignments: [] });
      return new Response(null, { status: 404 });
    });

    render(<LlmJobRoutingCard models={[]} />);

    await waitFor(() => {
      expect(screen.getByText("Code review (chunks)")).toBeInTheDocument();
    });
    expect(screen.getByText("PR walkthrough")).toBeInTheDocument();
    expect(screen.getByText("Quick helper (Tier-1)")).toBeInTheDocument();
    expect(screen.getByText("Fix-prompt synthesis")).toBeInTheDocument();
  });

  // PART 4-FE §2 — "— default —" calls DELETE then re-fetches.
  test("selecting default option issues a DELETE and re-fetches routing", async () => {
    const deletedPurposes: string[] = [];
    let routingFetchCount = 0;

    mockFetch(async (url, init) => {
      const method = init?.method ?? "GET";
      if (method === "GET" && url.endsWith("/llm-models")) {
        return json({ models: [modelRow({ model_id: "valid-ok" })] });
      }
      if (method === "GET" && url.endsWith("/llm-purpose-routing")) {
        routingFetchCount += 1;
        // First load has an assignment; subsequent fetches show it gone.
        const assignments =
          routingFetchCount === 1
            ? [{ purpose: "review_finding", model_id: "valid-ok" }]
            : [];
        return json({ assignments });
      }
      if (method === "DELETE" && url.includes("/llm-purpose-routing/")) {
        const purpose = url.split("/llm-purpose-routing/")[1]!;
        deletedPurposes.push(purpose);
        return new Response(null, { status: 204 });
      }
      return new Response(null, { status: 404 });
    });

    render(<LlmJobRoutingCard models={[VALID_MODEL]} />);

    // Wait for initial load with the assignment.
    await waitFor(() => {
      const select = screen.getByTestId(
        "routing-select-review_finding",
      ) as HTMLSelectElement;
      expect(select.value).toBe("valid-ok");
    });

    // Pick "— default —".
    fireEvent.change(screen.getByTestId("routing-select-review_finding"), {
      target: { value: "__default__" },
    });

    // DELETE must have been issued for review_finding.
    await waitFor(() => {
      expect(deletedPurposes).toContain("review_finding");
    });

    // Routing was re-fetched at least once more after the DELETE.
    await waitFor(() => {
      expect(routingFetchCount).toBeGreaterThanOrEqual(2);
    });

    // After re-fetch the select returns to default.
    await waitFor(() => {
      const select = screen.getByTestId(
        "routing-select-review_finding",
      ) as HTMLSelectElement;
      expect(select.value).toBe("__default__");
    });
  });

  // PART 4-FE §2 — 404 from DELETE is treated as success (already default).
  test("a 404 DELETE response is treated as success (already default)", async () => {
    let deleteCount = 0;

    mockFetch(async (url, init) => {
      const method = init?.method ?? "GET";
      if (method === "GET" && url.endsWith("/llm-models")) {
        return json({ models: [modelRow({ model_id: "valid-ok" })] });
      }
      if (method === "GET" && url.endsWith("/llm-purpose-routing")) {
        return json({
          assignments: [{ purpose: "review_finding", model_id: "valid-ok" }],
        });
      }
      if (method === "DELETE" && url.includes("/llm-purpose-routing/")) {
        deleteCount += 1;
        return new Response(null, { status: 404 }); // already default
      }
      return new Response(null, { status: 500 });
    });

    render(<LlmJobRoutingCard models={[VALID_MODEL]} />);

    await waitFor(() => {
      const select = screen.getByTestId(
        "routing-select-review_finding",
      ) as HTMLSelectElement;
      expect(select.value).toBe("valid-ok");
    });

    fireEvent.change(screen.getByTestId("routing-select-review_finding"), {
      target: { value: "__default__" },
    });

    await waitFor(() => {
      expect(deleteCount).toBe(1);
    });
    // No inline error should appear.
    expect(
      screen.queryByTestId("routing-error-review_finding"),
    ).not.toBeInTheDocument();
  });

  // PART 2 — shared models prop: a model validated externally appears in
  // routing options without remounting the component.
  test("shared models prop: adding a model externally makes it selectable", async () => {
    mockFetch(async (url) => {
      if (url.endsWith("/llm-purpose-routing")) return json({ assignments: [] });
      return new Response(null, { status: 404 });
    });

    const { rerender } = render(<LlmJobRoutingCard models={[]} />);

    await waitFor(() => {
      expect(screen.getByTestId("routing-select-review_finding")).toBeInTheDocument();
    });

    // Initially no options besides default.
    const selectBefore = screen.getByTestId(
      "routing-select-review_finding",
    ) as HTMLSelectElement;
    expect(
      within(selectBefore).queryByRole("option", {
        name: /claude-sonnet-4-6/,
      }),
    ).not.toBeInTheDocument();

    // Parent "validates" a model by updating the models prop.
    rerender(<LlmJobRoutingCard models={[VALID_MODEL]} />);

    // Model should now be an option — no remount needed.
    const selectAfter = screen.getByTestId(
      "routing-select-review_finding",
    ) as HTMLSelectElement;
    expect(
      within(selectAfter).getByRole("option", {
        name: /claude-sonnet-4-6/,
      }),
    ).toBeInTheDocument();
  });

  // Existing: dropdown lists only ok+enabled models plus default.
  test("dropdown lists only ok+enabled models plus default", async () => {
    mockFetch(async (url) => {
      if (url.endsWith("/llm-purpose-routing")) return json({ assignments: [] });
      return new Response(null, { status: 404 });
    });

    const models: LlmModelV1[] = [
      {
        provider: "anthropic_direct",
        model_id: "valid-ok",
        display_name: null,
        enabled: true,
        last_validation_status: "ok",
        last_validation_error: null,
        last_validated_at: "2026-05-30T00:00:00Z",
      },
      {
        provider: "anthropic_direct",
        model_id: "disabled-model",
        display_name: null,
        enabled: false,
        last_validation_status: "ok",
        last_validation_error: null,
        last_validated_at: "2026-05-30T00:00:00Z",
      },
      {
        provider: "anthropic_direct",
        model_id: "failed-model",
        display_name: null,
        enabled: true,
        last_validation_status: "failed",
        last_validation_error: null,
        last_validated_at: "2026-05-30T00:00:00Z",
      },
    ];

    render(<LlmJobRoutingCard models={models} />);

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
  });

  // Existing: assign success (PUT).
  test("assign success PUTs the purpose/model and reflects selection", async () => {
    let putBody: unknown = null;

    mockFetch(async (url, init) => {
      const method = init?.method ?? "GET";
      if (method === "GET" && url.endsWith("/llm-purpose-routing")) {
        return json({ assignments: [] });
      }
      if (method === "PUT" && url.endsWith("/llm-purpose-routing")) {
        putBody = JSON.parse(init?.body as string);
        return json({ purpose: "review_finding", model_id: "valid-ok" });
      }
      return new Response(null, { status: 404 });
    });

    render(<LlmJobRoutingCard models={[{ ...VALID_MODEL, model_id: "valid-ok" }]} />);

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

  // Existing: assign rejected by 422 shows the backend message.
  test("assign rejected by 422 shows the backend message", async () => {
    mockFetch(async (url, init) => {
      const method = init?.method ?? "GET";
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

    render(
      <LlmJobRoutingCard models={[{ ...VALID_MODEL, model_id: "valid-ok" }]} />,
    );

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

  // Fix 3 — unrecognized (orphan) assignments.

  test("renders an Unrecognized assignments row when GET returns a legacy purpose", async () => {
    mockFetch(async (url, init) => {
      const method = init?.method ?? "GET";
      if (method === "GET" && url.endsWith("/llm-purpose-routing")) {
        return json({
          assignments: [{ purpose: "review_summary", model_id: "claude-opus-4" }],
        });
      }
      return new Response(null, { status: 404 });
    });

    render(<LlmJobRoutingCard models={[]} />);

    await waitFor(() => {
      expect(screen.getByTestId("routing-orphan-review_summary")).toBeInTheDocument();
    });

    // The orphan row should show the purpose and a Reset button.
    const orphanRow = screen.getByTestId("routing-orphan-review_summary");
    expect(orphanRow).toBeInTheDocument();
    expect(screen.getByTestId("routing-orphan-reset-review_summary")).toBeInTheDocument();
    // Should NOT appear in the normal 4-purpose rows.
    expect(screen.queryByTestId("job-routing-row-review_summary")).not.toBeInTheDocument();
  });

  test("clicking Reset on an orphan issues DELETE and re-fetches routing", async () => {
    const deletedPurposes: string[] = [];
    let routingFetchCount = 0;

    mockFetch(async (url, init) => {
      const method = init?.method ?? "GET";
      if (method === "GET" && url.endsWith("/llm-purpose-routing")) {
        routingFetchCount += 1;
        // After the delete the orphan disappears.
        const assignments =
          routingFetchCount === 1
            ? [{ purpose: "review_summary", model_id: "claude-opus-4" }]
            : [];
        return json({ assignments });
      }
      if (method === "DELETE" && url.includes("/llm-purpose-routing/")) {
        const purpose = url.split("/llm-purpose-routing/")[1]!;
        deletedPurposes.push(purpose);
        return new Response(null, { status: 204 });
      }
      return new Response(null, { status: 404 });
    });

    render(<LlmJobRoutingCard models={[]} />);

    await waitFor(() => {
      expect(screen.getByTestId("routing-orphan-reset-review_summary")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("routing-orphan-reset-review_summary"));

    await waitFor(() => {
      expect(deletedPurposes).toContain("review_summary");
    });

    // Routing should have been re-fetched after the delete.
    await waitFor(() => {
      expect(routingFetchCount).toBeGreaterThanOrEqual(2);
    });

    // After re-fetch the orphan block disappears.
    await waitFor(() => {
      expect(screen.queryByTestId("routing-orphan-review_summary")).not.toBeInTheDocument();
    });
  });

  test("does not render the Unrecognized assignments block when there are no orphan keys", async () => {
    mockFetch(async (url, init) => {
      const method = init?.method ?? "GET";
      if (method === "GET" && url.endsWith("/llm-purpose-routing")) {
        return json({
          assignments: [{ purpose: "review_finding", model_id: "claude-sonnet-4-6" }],
        });
      }
      return new Response(null, { status: 404 });
    });

    render(<LlmJobRoutingCard models={[]} />);

    await waitFor(() => {
      expect(screen.getByTestId("job-routing-rows")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("job-routing-orphan-block")).not.toBeInTheDocument();
  });

  // L1 — analysis_curator row carries a muted hint about the retrieval reranker.
  test("L1: analysis_curator row shows a hint that it drives the retrieval reranker", async () => {
    mockFetch(async (url) => {
      if (url.endsWith("/llm-purpose-routing")) return json({ assignments: [] });
      return new Response(null, { status: 404 });
    });

    render(<LlmJobRoutingCard models={[]} />);

    await waitFor(() => {
      expect(screen.getByTestId("job-routing-row-analysis_curator")).toBeInTheDocument();
    });

    const hintEl = screen.getByTestId("routing-label-hint-analysis_curator");
    expect(hintEl).toBeInTheDocument();
    expect(hintEl.textContent).toContain("retrieval reranker");
    // Other rows must NOT have a hint element.
    expect(
      screen.queryByTestId("routing-label-hint-review_finding"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("routing-label-hint-fix_prompt"),
    ).not.toBeInTheDocument();
  });

  // L5 — "✓ Saved" auto-clears after ~3 s. Fake timers from the start so the component's auto-clear
  // setTimeout is captured; advanceTimersByTimeAsync drains the async GET/PUT microtask chains between
  // ticks (advancing 0 ms flushes promises WITHOUT firing the 3 s timer), so we never use a real-timer
  // waitFor under fake timers (which would deadlock).
  test("L5: rowSuccess auto-clears after 3 seconds (no stale affirmation)", async () => {
    vi.useFakeTimers();

    mockFetch(async (url, init) => {
      const method = init?.method ?? "GET";
      if (method === "GET" && url.endsWith("/llm-purpose-routing")) {
        return json({ assignments: [] });
      }
      if (method === "PUT" && url.endsWith("/llm-purpose-routing")) {
        return json({ purpose: "review_finding", model_id: "valid-ok" });
      }
      return new Response(null, { status: 404 });
    });

    render(<LlmJobRoutingCard models={[{ ...VALID_MODEL, model_id: "valid-ok" }]} />);

    // Drain the mount GET (0 ms advance → flush microtasks only, not the 3 s clock).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId("routing-select-review_finding")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("routing-select-review_finding"), {
      target: { value: "valid-ok" },
    });
    // Drain the PUT + the routing re-fetch → "✓ Saved" appears.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId("routing-success-review_finding")).toBeInTheDocument();

    // Advance past the 3 s threshold → the affirmation auto-clears.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    expect(
      screen.queryByTestId("routing-success-review_finding"),
    ).not.toBeInTheDocument();

    vi.useRealTimers();
  });
});
