/**
 * Sub-spec C T15 dashboard 2 (2026-05-28) — retrieval traces list.
 * Paginated table from RetrievalTraceListPageV1; row links to the
 * detail page. Starvation filter toggles a query-string flag (server-
 * side filtering via the materialized view).
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/elements/Button";
import {
  fetchRetrievalTraces,
  QUERY_KEYS,
} from "@/lib/api/admin";
import { useAdminQueryGuards } from "@/lib/api/use-admin-query-guards";
import { cn } from "@/lib/cn";
import { colors, radius, type as t } from "@/lib/design-tokens";

export default function RetrievalTracesListAdminPage() {
  const [starvationOnly, setStarvationOnly] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  const query = useQuery({
    queryKey: QUERY_KEYS.retrievalTraces(starvationOnly, cursor),
    queryFn: () =>
      fetchRetrievalTraces({
        starvation_only: starvationOnly,
        ...(cursor !== undefined ? { cursor } : {}),
      }),
  });
  const { guardElement } = useAdminQueryGuards(query, "retrieval-traces");
  if (guardElement !== null) return guardElement;

  const rows = query.data?.rows ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className={cn(t.display, colors.text.primary)}>
          Retrieval traces
        </h1>
        <p className={cn(t.body, colors.text.muted)}>
          Per-review retrieval audit log. Click into a trace to see Stage 3
          selection + drop decisions.
        </p>
      </header>

      <label className="flex items-center gap-x-2 cursor-pointer">
        <input
          type="checkbox"
          checked={starvationOnly}
          onChange={(e) => {
            setStarvationOnly(e.target.checked);
            setCursor(undefined);
          }}
          className="size-4 accent-[oklch(72%_0.16_65)] cursor-pointer"
        />
        <span className={cn(t.meta, colors.text.primary)}>
          Show only traces where starvation was observed
        </span>
      </label>

      {rows.length === 0 ? (
        <p className={cn(t.body, colors.text.muted)}>
          No traces in this window.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className={cn(t.meta, colors.text.muted, "text-left")}>
                <th className="px-3 py-2">Captured at</th>
                <th className="px-3 py-2">Trace ID</th>
                <th className="px-3 py-2">Review</th>
                <th className="px-3 py-2 text-right">Selected</th>
                <th className="px-3 py-2 text-right">Dropped</th>
                <th className="px-3 py-2 text-right">Budget</th>
                <th className="px-3 py-2">Starvation</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.trace_id}
                  className={cn("border-t", colors.border.default)}
                >
                  <td className={cn("px-3 py-2", t.meta, colors.text.muted)}>
                    {new Date(row.captured_at).toLocaleString()}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 font-mono",
                      t.meta,
                    )}
                  >
                    <Link
                      href={`/admin/retrieval-traces/${row.trace_id}`}
                      className={cn(colors.text.primary, "underline")}
                    >
                      {row.trace_id.slice(0, 8)}…
                    </Link>
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 font-mono",
                      t.meta,
                      colors.text.muted,
                    )}
                  >
                    {row.review_id.slice(0, 8)}…
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right",
                      t.meta,
                      colors.text.primary,
                    )}
                  >
                    {row.selected_chunks_count}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right",
                      t.meta,
                      colors.text.muted,
                    )}
                  >
                    {row.dropped_chunks_count}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right",
                      t.meta,
                      colors.text.muted,
                    )}
                  >
                    {row.budget_remaining} / {row.budget_total}
                  </td>
                  <td className="px-3 py-2">
                    {row.starvation_observed ? (
                      <span
                        className={cn(
                          "inline-block px-2 py-0.5",
                          radius.sm,
                          t.caption,
                          "bg-[oklch(94%_0.06_25)] dark:bg-[oklch(26%_0.10_25)]",
                          "text-[oklch(45%_0.14_25)] dark:text-[oklch(80%_0.12_25)]",
                        )}
                      >
                        starved
                      </span>
                    ) : (
                      <span className={cn(t.caption, colors.text.faint)}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {query.data?.next_cursor ? (
        <Button
          variant="secondary"
          onClick={() => setCursor(query.data?.next_cursor ?? undefined)}
        >
          Load more
        </Button>
      ) : null}
    </div>
  );
}
