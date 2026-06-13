import { describe, it, expect } from "vitest";

import {
  CATEGORY_LABEL,
  groupByCategory,
} from "@/components/review-detail/categories";
import type { ReviewFindingItemV1 } from "@/lib/api/admin";

function f(
  category: ReviewFindingItemV1["category"],
  id: string,
): ReviewFindingItemV1 {
  return {
    finding_id: id,
    file_path: "a.ts",
    start_line: 1,
    end_line: 1,
    severity: "issue",
    title: "t",
    body: "b",
    suggestion: null,
    tool_source: null,
    category,
    confidence: null,
    scope: null,
    citations: [],
  };
}

describe("groupByCategory", () => {
  it("orders Security before Logic before Performance (triage order)", () => {
    const groups = groupByCategory([
      f("performance", "1"),
      f("bug", "2"),
      f("security", "3"),
    ]);
    expect(groups.map((g) => g.category)).toEqual([
      "security",
      "bug",
      "performance",
    ]);
  });

  it("labels bug as 'Logic'", () => {
    expect(CATEGORY_LABEL.bug).toBe("Logic");
    expect(CATEGORY_LABEL.security).toBe("Security");
  });

  it("buckets null category under 'other'", () => {
    const groups = groupByCategory([f(null, "1")]);
    expect(groups).toHaveLength(1);
    const group = groups[0]!;
    expect(group.category).toBe("other");
    expect(group.findings).toHaveLength(1);
  });

  it("omits empty categories", () => {
    const groups = groupByCategory([f("security", "1")]);
    expect(groups.map((g) => g.category)).toEqual(["security"]);
  });
});
