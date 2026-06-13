"use client";

import { cn } from "@/lib/cn";
import { colors, motion, radius, type as t } from "@/lib/design-tokens";

export interface PaginationProps {
  total: number;
  page: number;
  size: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ total, page, size, onPageChange }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / size));
  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(page * size, total);

  const rangeText = `Showing ${from}–${to} of ${total}`;

  const summary = (
    <span className={cn(t.meta, colors.text.muted, "tabular-nums")}>
      {rangeText}
    </span>
  );

  if (pages <= 1) {
    return <div className="flex items-center justify-between pt-4">{summary}</div>;
  }

  const btn = cn(
    "px-2.5 py-1 border",
    radius.sm,
    t.meta,
    colors.border.default,
    colors.text.primary,
    colors.hover.bg,
    motion.fast,
    "disabled:opacity-40 disabled:cursor-not-allowed",
    "outline-none focus-visible:ring-1 focus-visible:ring-inset",
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
      {summary}
      <div className="flex items-center gap-x-2">
        <button
          type="button"
          className={btn}
          disabled={page <= 1}
          aria-label="Previous page"
          onClick={() => onPageChange(page - 1)}
        >
          ‹ Prev
        </button>
        <span className={cn(t.meta, colors.text.muted, "tabular-nums")}>
          {`Page ${page} of ${pages}`}
        </span>
        <button
          type="button"
          className={btn}
          disabled={page >= pages}
          aria-label="Next page"
          onClick={() => onPageChange(page + 1)}
        >
          Next ›
        </button>
      </div>
    </div>
  );
}
