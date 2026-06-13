import { describe, it, expect } from "vitest";

import { stripRunPrefix } from "@/lib/review-title";

describe("stripRunPrefix", () => {
  it("strips a [run:<uuid>] prefix", () => {
    expect(
      stripRunPrefix(
        "[run:019e8858-934a-7b96-a484-4d962c428b6f] smoke validation",
      ),
    ).toBe("smoke validation");
  });

  it("is case-insensitive and tolerates surrounding space", () => {
    expect(stripRunPrefix("  [RUN:abc]   feat: thing  ")).toBe("feat: thing");
  });

  it("leaves a normal title untouched", () => {
    expect(stripRunPrefix("Add formatCurrency helper")).toBe(
      "Add formatCurrency helper",
    );
  });

  it("falls back to the original when stripping would empty it", () => {
    expect(stripRunPrefix("[run:abc]")).toBe("[run:abc]");
  });

  it("does not strip a non-run bracket tag", () => {
    expect(stripRunPrefix("[WIP] refactor")).toBe("[WIP] refactor");
  });
});
