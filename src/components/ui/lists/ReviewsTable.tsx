/**
 * @adopted-from vendor/application-ui-v4/react/lists/tables/04-full-width.jsx
 *
 * Generic admin-console table. Sprint 12 / S12.1.1, retokenized
 * 2026-05-04 per /impeccable colorize batch 1.
 *
 * - Borderless rows; single 1px `border.default` rule between
 *   header and body (DESIGN.md "Tables").
 * - Hover: `bg.muted`. NEVER `bg-gray-50`.
 * - Caption is sr-only; the visible page <h1> carries the
 *   semantic heading.
 * - Row navigation: prefer `rowHref` (a real stretched `<Link>` in the
 *   first cell) so rows are announced as links, keyboard-focusable with a
 *   visible ring, and support cmd/middle-click. `onRowClick` remains for
 *   non-navigational callers.
 */

"use client";

import Link from "next/link";
import type { JSX, ReactNode } from "react";

import { cn } from "@/lib/cn";
import { colors, motion, type as t } from "@/lib/design-tokens";

export interface Column<TRow> {
  /** Column header text. */
  header: string;
  /**
   * Cell renderer. Receives the row; returns the cell's
   * displayable content. Keeps the table generic.
   */
  cell: (row: TRow) => ReactNode;
  /** Optional column-level CSS class (alignment, width, etc.). */
  className?: string;
  /** Render the column only at >= 640px (sm). */
  hiddenOnMobile?: boolean;
}

export interface ReviewsTableProps<TRow> {
  rows: ReadonlyArray<TRow>;
  columns: ReadonlyArray<Column<TRow>>;
  /** Stable row key extractor. */
  rowKey: (row: TRow) => string;
  /** Optional click handler for the entire row (non-navigational callers). */
  onRowClick?: (row: TRow) => void;
  /** When set, each row is a real link (a11y + cmd/middle-click). */
  rowHref?: (row: TRow) => string;
  /** Accessible name for the row link. Required when `rowHref` is set. */
  rowLabel?: (row: TRow) => string;
  /** Caption surfaced for screen readers. */
  caption: string;
}

export function ReviewsTable<TRow>({
  rows,
  columns,
  rowKey,
  onRowClick,
  rowHref,
  rowLabel,
  caption,
}: ReviewsTableProps<TRow>): JSX.Element {
  return (
    <div className="-mx-4 overflow-x-auto sm:-mx-0">
      <table className={cn("min-w-full divide-y", colors.divider)}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th
                key={col.header}
                scope="col"
                className={cn(
                  "py-3 text-left uppercase tracking-wide font-medium",
                  t.caption,
                  colors.text.muted,
                  idx === 0 ? "pl-4 pr-3 sm:pl-0" : "px-3",
                  col.hiddenOnMobile && "hidden sm:table-cell",
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const href = rowHref?.(row);
            const clickable = href !== undefined || onRowClick !== undefined;
            return (
              <tr
                key={rowKey(row)}
                // Legacy callback path keeps the row itself focusable; the
                // href path delegates focus/keys to the stretched <Link>.
                tabIndex={onRowClick && !href ? 0 : undefined}
                className={cn(
                  clickable && cn("cursor-pointer", colors.hover.bg, motion.fast),
                  href !== undefined && "relative",
                  // Visible focus ring for both paths.
                  onRowClick && !href
                    ? cn(
                        "outline-none focus-visible:ring-1 focus-visible:ring-inset",
                        colors.border.strong,
                      )
                    : href !== undefined &&
                        cn(
                          "has-[a:focus-visible]:ring-1 has-[a:focus-visible]:ring-inset",
                          colors.border.strong,
                        ),
                )}
                onClick={
                  onRowClick && !href ? () => onRowClick(row) : undefined
                }
                onKeyDown={
                  onRowClick && !href
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
              >
                {columns.map((col, idx) => (
                  <td
                    key={col.header}
                    className={cn(
                      "whitespace-nowrap py-3.5",
                      t.body,
                      colors.text.muted,
                      idx === 0
                        ? cn(
                            "pl-4 pr-3 font-medium sm:pl-0",
                            colors.text.primary,
                          )
                        : "px-3",
                      col.hiddenOnMobile && "hidden sm:table-cell",
                    )}
                  >
                    {idx === 0 && href !== undefined ? (
                      <Link
                        href={href}
                        aria-label={rowLabel?.(row)}
                        className="outline-none after:absolute after:inset-0"
                      >
                        {col.cell(row)}
                      </Link>
                    ) : (
                      col.cell(row)
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
