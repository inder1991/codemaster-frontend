/**
 * FindingsLedger -- filterable, keyboard-navigable grid of review findings.
 *
 * Composes SeveritySummaryStrip (severity filter), CategoryFilterPills
 * (category filter), a search input, and a role="grid" of FindingRow
 * items with roving tabIndex and ArrowUp/ArrowDown navigation.
 *
 * When `findings` is empty renders the celebratory Clean-review Empty state.
 * When filters produce no matches renders an inline "no match" paragraph.
 */

"use client";

import {
  useDeferredValue,
  useMemo,
  useState,
  type KeyboardEvent,
} from "react";

import { CheckCircleIcon } from "@heroicons/react/24/outline";

import { cn } from "@/lib/cn";
import { colors, type as t, radius, motion } from "@/lib/design-tokens";
import type { FindingCategory, ReviewFindingItemV1 } from "@/lib/api/admin";
import { SeveritySummaryStrip } from "@/components/review-detail/SeveritySummaryStrip";
import { CategoryFilterPills } from "@/components/review-detail/CategoryFilterPills";
import { FindingRow } from "@/components/review-detail/FindingRow";
import { Empty } from "@/components/ui/states/Empty";

type Severity = ReviewFindingItemV1["severity"];

export interface FindingsLedgerProps {
  findings: ReviewFindingItemV1[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function FindingsLedger({
  findings,
  selectedId,
  onSelect,
}: FindingsLedgerProps) {
  const [severityFilter, setSeverityFilter] = useState<Severity | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<FindingCategory | null>(null);
  const [query, setQuery] = useState("");

  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    let result = findings;

    if (severityFilter !== null) {
      result = result.filter((f) => f.severity === severityFilter);
    }

    if (categoryFilter !== null) {
      result = result.filter(
        (f) => (f.category ?? "other") === categoryFilter,
      );
    }

    const trimmed = deferredQuery.trim();
    if (trimmed !== "") {
      const lower = trimmed.toLowerCase();
      result = result.filter(
        (f) =>
          f.title.toLowerCase().includes(lower) ||
          f.file_path.toLowerCase().includes(lower),
      );
    }

    return result;
  }, [findings, severityFilter, categoryFilter, deferredQuery]);

  const hasActiveFilter =
    severityFilter !== null || categoryFilter !== null || query.trim() !== "";

  function clearFilters() {
    setSeverityFilter(null);
    setCategoryFilter(null);
    setQuery("");
  }

  // ── Clean review (no findings at all) ─────────────────────────────
  if (findings.length === 0) {
    return (
      <Empty
        icon={
          <CheckCircleIcon
            className={cn("size-10", colors.status.healthy)}
            aria-hidden
          />
        }
        title="Clean review"
        body="codemaster found nothing to flag on this pull request."
      />
    );
  }

  // ── Roving tabIndex ────────────────────────────────────────────────
  function rovingIndex(f: ReviewFindingItemV1, i: number): number {
    if (selectedId !== null) {
      return f.finding_id === selectedId ? 0 : -1;
    }
    return i === 0 ? 0 : -1;
  }

  // ── Keyboard navigation ────────────────────────────────────────────
  function handleGridKey(e: KeyboardEvent<HTMLDivElement>) {
    if (filtered.length === 0) return;
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();

    const idx = filtered.findIndex((f) => f.finding_id === selectedId);

    if (e.key === "ArrowDown") {
      // idx === -1 (none selected) moves to 0
      const next = Math.min(idx + 1, filtered.length - 1);
      const target = filtered[next];
      if (target) onSelect(target.finding_id);
    } else {
      // ArrowUp: if idx is -1 or 0, stay at 0
      const next = Math.max(idx <= 0 ? 0 : idx - 1, 0);
      const target = filtered[next];
      if (target) onSelect(target.finding_id);
    }
  }

  return (
    <div className="space-y-3">
      {/* Controls */}
      <SeveritySummaryStrip
        findings={findings}
        active={severityFilter}
        onSelect={setSeverityFilter}
      />

      <div className="flex items-center gap-3 flex-wrap">
        <CategoryFilterPills
          findings={findings}
          active={categoryFilter}
          onChange={setCategoryFilter}
        />

        <input
          type="search"
          aria-label="Search findings"
          placeholder="Search findings..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={cn(
            t.meta,
            colors.bg.elevated,
            colors.text.primary,
            radius.sm,
            "px-2.5 py-1 border",
            colors.border.default,
          )}
        />

        {hasActiveFilter ? (
          <button
            type="button"
            onClick={clearFilters}
            className={cn(
              t.meta,
              colors.text.muted,
              colors.hover.text.primary,
              motion.fast,
              "underline underline-offset-4",
            )}
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {/* Grid */}
      <div
        role="grid"
        aria-label="Findings"
        aria-rowcount={filtered.length}
        onKeyDown={handleGridKey}
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={-1}
      >
        {/* Header row */}
        <div
          role="row"
          className={cn(
            "hidden sm:flex items-center gap-4 px-4 py-1.5 border-b",
            colors.border.default,
          )}
        >
          <div role="columnheader" className={cn("w-24 shrink-0", t.meta, colors.text.muted)}>
            Severity
          </div>
          <div role="columnheader" className={cn("flex-1 min-w-0", t.meta, colors.text.muted)}>
            Finding
          </div>
          <div role="columnheader" className={cn("shrink-0", t.meta, colors.text.muted)}>
            Location
          </div>
        </div>

        {/* Data rows */}
        {filtered.length === 0 ? (
          <div className="py-8 text-center">
            <p className={cn(t.body, colors.text.muted)}>
              No findings match these filters.
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className={cn(
                "mt-1",
                t.meta,
                colors.text.accent,
                "underline underline-offset-4",
                motion.fast,
              )}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className={cn("divide-y", colors.divider)}>
            {filtered.map((f, i) => (
              <FindingRow
                key={f.finding_id}
                finding={f}
                selected={selectedId === f.finding_id}
                onSelect={onSelect}
                tabIndex={rovingIndex(f, i)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
