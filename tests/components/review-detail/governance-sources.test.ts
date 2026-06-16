import { describe, it, expect } from "vitest";

import { groupCitationsBySource } from "@/components/review-detail/governance-sources";
import type {
  ReviewFindingCitationV1,
  ReviewFindingItemV1,
} from "@/lib/api/admin";

function finding(
  citations: ReviewFindingCitationV1[],
): ReviewFindingItemV1 {
  return {
    finding_id: crypto.randomUUID(),
    file_path: "a.ts",
    start_line: 1,
    end_line: 1,
    severity: "issue",
    title: "t",
    body: "b",
    suggestion: null,
    tool_source: null,
    category: null,
    confidence: null,
    scope: null,
    citations,
  };
}

describe("groupCitationsBySource", () => {
  it("splits confluence, repo knowledge, and linter; excludes policy_rule", () => {
    const groups = groupCitationsBySource([
      finding([
        { kind: "knowledge_chunk", locator: "confluence:payments/intl#chunk=3", excerpt: null },
        { kind: "knowledge_chunk", locator: "repo:docs/readme.md", excerpt: null },
        { kind: "linter_rule", locator: "eslint:no-throwing-intl", excerpt: null },
        { kind: "policy_rule", locator: "SEC-1", excerpt: null },
      ]),
    ]);
    expect(groups.confluence.map((c) => c.locator)).toEqual([
      "confluence:payments/intl#chunk=3",
    ]);
    expect(groups.repoKnowledge.map((c) => c.locator)).toEqual([
      "repo:docs/readme.md",
    ]);
    expect(groups.linter.map((c) => c.locator)).toEqual([
      "eslint:no-throwing-intl",
    ]);
  });

  it("dedupes by locator across findings", () => {
    const cite = {
      kind: "linter_rule" as const,
      locator: "ruff:B008",
      excerpt: null,
    };
    const groups = groupCitationsBySource([finding([cite]), finding([cite])]);
    expect(groups.linter).toHaveLength(1);
  });

  it("returns empty groups for no citations", () => {
    const groups = groupCitationsBySource([finding([])]);
    expect(groups.confluence).toEqual([]);
    expect(groups.linter).toEqual([]);
    expect(groups.repoKnowledge).toEqual([]);
  });
});
