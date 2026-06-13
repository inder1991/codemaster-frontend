/**
 * Sub-spec C T15 dashboard 3 (2026-05-28) — default-corpus health.
 * Aggregated snapshot for the default-tag corpus. 5 stat cards +
 * per-scope hit-rate table.
 */

"use client";

import { useQuery } from "@tanstack/react-query";

import {
  fetchDefaultCorpusHealth,
  QUERY_KEYS,
} from "@/lib/api/admin";
import { useAdminQueryGuards } from "@/lib/api/use-admin-query-guards";
import { cn } from "@/lib/cn";
import { colors, radius, type as t } from "@/lib/design-tokens";

export default function DefaultCorpusHealthAdminPage() {
  const query = useQuery({
    queryKey: QUERY_KEYS.defaultCorpusHealth(),
    queryFn: fetchDefaultCorpusHealth,
  });
  const { guardElement } = useAdminQueryGuards(
    query,
    "default-corpus-health",
  );
  if (guardElement !== null) return guardElement;

  const data = query.data;
  if (!data) {
    return <p className={cn(t.body, colors.text.muted)}>Loading…</p>;
  }

  const stalePct =
    data.total_default_chunks > 0
      ? (data.stale_default_chunks / data.total_default_chunks) * 100
      : 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className={cn(t.display, colors.text.primary)}>
          Default-corpus health
        </h1>
        <p className={cn(t.body, colors.text.muted)}>
          Snapshot taken {new Date(data.captured_at).toLocaleString()}.
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Default chunks"
          value={data.total_default_chunks.toLocaleString()}
        />
        <StatCard
          label="Stale"
          value={data.stale_default_chunks.toLocaleString()}
          hint={`${stalePct.toFixed(1)}% of corpus`}
          {...(stalePct > 10 ? { tone: "warn" as const } : {})}
        />
        <StatCard
          label="Total tokens"
          value={data.total_tokens.toLocaleString()}
        />
        <StatCard
          label="Spaces"
          value={data.spaces_with_defaults.toLocaleString()}
        />
      </section>

      <section className="space-y-2">
        <h2 className={cn(t.h3, colors.text.primary)}>
          Hit rate by scope (24h)
        </h2>
        {data.hit_rate_24h_by_scope.length === 0 ? (
          <p className={cn(t.body, colors.text.muted)}>
            No per-scope data captured in this snapshot.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className={cn(t.meta, colors.text.muted, "text-left")}>
                  <th className="px-3 py-2">Scope</th>
                  <th className="px-3 py-2 text-right">In corpus</th>
                  <th className="px-3 py-2 text-right">Retrieved (24h)</th>
                  <th className="px-3 py-2 text-right">Hit rate</th>
                </tr>
              </thead>
              <tbody>
                {data.hit_rate_24h_by_scope.map((row) => (
                  <tr
                    key={row.scope}
                    className={cn("border-t", colors.border.default)}
                  >
                    <td
                      className={cn(
                        "px-3 py-2",
                        t.bodyStrong,
                        colors.text.primary,
                      )}
                    >
                      {row.scope}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right",
                        t.meta,
                      )}
                    >
                      {row.chunks_in_corpus.toLocaleString()}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right",
                        t.meta,
                        colors.text.muted,
                      )}
                    >
                      {row.chunks_retrieved_24h.toLocaleString()}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right",
                        t.meta,
                        row.hit_rate_24h < 0.05
                          ? colors.status.down
                          : colors.text.primary,
                      )}
                    >
                      {(row.hit_rate_24h * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "warn";
}) {
  return (
    <div className={cn("p-4 space-y-1", radius.md, colors.bg.elevated)}>
      <p className={cn(t.caption, colors.text.faint)}>{label}</p>
      <p
        className={cn(
          t.display,
          tone === "warn" ? colors.status.down : colors.text.primary,
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className={cn(t.caption, colors.text.muted)}>{hint}</p>
      ) : null}
    </div>
  );
}
