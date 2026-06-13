/**
 * Review-detail P1-B — finding category ordering + friendly labels.
 *
 * Findings are grouped by category as the primary triage spine: an
 * engineer asks "is there a security problem? a correctness bug? a perf
 * regression?" in that order. "bug" surfaces as "Logic" in the UI.
 */

import type { FindingCategory, ReviewFindingItemV1 } from "@/lib/api/admin";

// Display order = engineer triage order (scariest question first).
export const CATEGORY_ORDER: FindingCategory[] = [
  "security",
  "bug",
  "performance",
  "test",
  "config",
  "style",
  "docs",
  "context_breaks_consumer",
  "other",
];

export const CATEGORY_LABEL: Record<FindingCategory, string> = {
  security: "Security",
  bug: "Logic",
  performance: "Performance",
  test: "Tests",
  config: "Config",
  style: "Style",
  docs: "Docs",
  context_breaks_consumer: "Breaks consumer",
  other: "Other",
};

export interface FindingCategoryGroup {
  category: FindingCategory;
  label: string;
  findings: ReviewFindingItemV1[];
}

/** Group findings by category in triage order; null category → "other".
 *  Categories with no findings are omitted. Order within a group is the
 *  caller's input order (the reader already sorts by severity). */
export function groupByCategory(
  findings: ReviewFindingItemV1[],
): FindingCategoryGroup[] {
  const buckets = new Map<FindingCategory, ReviewFindingItemV1[]>();
  for (const finding of findings) {
    const category: FindingCategory = finding.category ?? "other";
    const existing = buckets.get(category);
    if (existing) {
      existing.push(finding);
    } else {
      buckets.set(category, [finding]);
    }
  }
  return CATEGORY_ORDER.filter((c) => buckets.has(c)).map((category) => ({
    category,
    label: CATEGORY_LABEL[category],
    findings: buckets.get(category)!,
  }));
}
