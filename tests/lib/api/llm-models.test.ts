/**
 * Unit tests for the llm-models API client.
 *
 * Covers:
 *   - listPurposeRouting: a 200 body of `{}` (missing `assignments` key)
 *     yields [] instead of throwing.
 *   - listPurposeRouting: a well-formed 200 body returns the array.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { listPurposeRouting } from "@/lib/api/llm-models";

function mockOk(body: unknown) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }) as Response,
  );
}

afterEach(() => vi.restoreAllMocks());

describe("listPurposeRouting", () => {
  it("returns [] when the 200 body is {} (missing assignments key)", async () => {
    mockOk({});
    const result = await listPurposeRouting();
    expect(result).toEqual([]);
  });

  it("returns [] when assignments is null instead of an array", async () => {
    mockOk({ assignments: null });
    const result = await listPurposeRouting();
    expect(result).toEqual([]);
  });

  it("returns the assignments array when the body is well-formed", async () => {
    const assignments = [
      { purpose: "review_finding", model_id: "claude-sonnet-4-6" },
    ];
    mockOk({ assignments });
    const result = await listPurposeRouting();
    expect(result).toEqual(assignments);
  });
});
