/**
 * CategoryFilterPills -- horizontal pill strip for filtering findings by category.
 *
 * Renders an "All {N}" pill first, then one pill per category present in
 * findings (in triage order from categories.ts). Categories with zero
 * findings are omitted. Null category counts under "other".
 */

"use client";

import { cn } from "@/lib/cn";
import { colors, type as t, radius, motion } from "@/lib/design-tokens";
import type { FindingCategory, ReviewFindingItemV1 } from "@/lib/api/admin";
import {
  CATEGORY_ORDER,
  CATEGORY_LABEL,
} from "@/components/review-detail/categories";

export interface CategoryFilterPillsProps {
  findings: ReviewFindingItemV1[];
  active: FindingCategory | null;
  onChange: (c: FindingCategory | null) => void;
}

const PILL_COMMON = cn(
  t.meta,
  radius.full,
  motion.fast,
  "px-2.5 py-1 cursor-pointer",
);

const PILL_ACTIVE = cn(colors.bg.muted, colors.text.primary);
const PILL_INACTIVE = cn("bg-transparent", colors.text.muted, colors.hover.bg);

export function CategoryFilterPills({
  findings,
  active,
  onChange,
}: CategoryFilterPillsProps) {
  // Build counts per category; null category -> "other".
  const countMap = new Map<FindingCategory, number>();
  for (const finding of findings) {
    const cat: FindingCategory = finding.category ?? "other";
    countMap.set(cat, (countMap.get(cat) ?? 0) + 1);
  }

  // Categories present in findings, in triage order.
  const presentCategories = CATEGORY_ORDER.filter((c) => countMap.has(c));

  const total = findings.length;
  const allActive = active === null;

  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
      {/* All pill */}
      <button
        type="button"
        aria-pressed={allActive}
        className={cn(PILL_COMMON, allActive ? PILL_ACTIVE : PILL_INACTIVE)}
        onClick={() => onChange(null)}
      >
        {`All ${total}`}
      </button>

      {/* Per-category pills */}
      {presentCategories.map((cat) => {
        const count = countMap.get(cat)!;
        const isActive = active === cat;
        return (
          <button
            key={cat}
            type="button"
            aria-pressed={isActive}
            className={cn(PILL_COMMON, isActive ? PILL_ACTIVE : PILL_INACTIVE)}
            onClick={() => onChange(cat)}
          >
            {`${CATEGORY_LABEL[cat]} ${count}`}
          </button>
        );
      })}
    </div>
  );
}
