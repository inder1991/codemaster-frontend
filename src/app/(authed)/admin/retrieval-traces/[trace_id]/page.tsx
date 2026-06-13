/**
 * Sub-spec C T15 dashboard 2 detail (2026-05-28) — retrieval trace
 * detail page. Renders RetrievalTraceV2 with header + Stage 3
 * selected/dropped tables for both tracks. Stage 1 / Stage 2 raw
 * payloads are surfaced in a collapsible code block — rich rendering
 * is deferred per T15 plan-doc.
 */

"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import {
  fetchRetrievalTraceDetail,
  QUERY_KEYS,
  type RetrievalTraceV2,
} from "@/lib/api/admin";
import { useAdminQueryGuards } from "@/lib/api/use-admin-query-guards";
import { cn } from "@/lib/cn";
import { colors, radius, type as t } from "@/lib/design-tokens";

type RetrievedKnowledgeDecisionV1 =
  RetrievalTraceV2["stage3"]["track_a_default"]["selected_chunks_detail"][number];

export default function RetrievalTraceDetailAdminPage() {
  const params = useParams();
  const traceId = String(params?.trace_id ?? "");

  const query = useQuery({
    queryKey: QUERY_KEYS.retrievalTraceDetail(traceId),
    queryFn: () => fetchRetrievalTraceDetail(traceId),
    enabled: traceId !== "",
  });
  const { guardElement } = useAdminQueryGuards(query, "retrieval-trace-detail");

  const [stage1Open, setStage1Open] = useState(false);
  const [stage2Open, setStage2Open] = useState(false);

  if (guardElement !== null) return guardElement;

  const trace = query.data;
  if (!trace) {
    return (
      <p className={cn(t.body, colors.text.muted)}>Loading…</p>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className={cn(t.display, colors.text.primary)}>
          Retrieval trace
        </h1>
        <p className={cn(t.meta, "font-mono", colors.text.muted)}>
          {trace.trace_id}
        </p>
      </header>

      <section
        className={cn("p-4 grid grid-cols-2 md:grid-cols-4 gap-4", radius.md, colors.bg.elevated)}
      >
        <StatCell label="Captured at" value={new Date(trace.captured_at).toLocaleString()} />
        <StatCell label="Taxonomy version" value={String(trace.taxonomy_version)} />
        <StatCell label="Pipeline version" value={String(trace.pipeline_version)} />
        <StatCell label="Schema version" value={String(trace.schema_version)} />
        <StatCell
          label="Review"
          value={trace.review_id.slice(0, 8) + "…"}
          mono
        />
        <StatCell
          label="PR"
          value={trace.pr_id.slice(0, 8) + "…"}
          mono
        />
        <StatCell
          label="Effective labels"
          value={String(trace.effective_labels.length)}
        />
        <StatCell
          label="Platform-exposed labels"
          value={String(trace.platform_exposed_labels_count)}
        />
      </section>

      <section className="space-y-4">
        <h2 className={cn(t.h3, colors.text.primary)}>Stage 3 — selection</h2>
        <p className={cn(t.body, colors.text.muted)}>
          λ<sub>MMR</sub> = {trace.stage3.lambda_mmr.toFixed(2)} ·{" "}
          {trace.stage3.starvation_observed ? (
            <span className={colors.status.down}>
              starvation observed ({trace.stage3.starvation_tiers.join(", ")})
            </span>
          ) : (
            <span>no starvation</span>
          )}
        </p>
        <TrackSection
          title="Track A — default corpus"
          basis={trace.stage3.track_a_default.selection_basis}
          selected={trace.stage3.track_a_default.selected_chunks_detail}
          dropped={trace.stage3.track_a_default.dropped_chunks_detail}
        />
        <TrackSection
          title="Track B — non-default"
          basis={trace.stage3.track_b_non_default.selection_basis}
          selected={trace.stage3.track_b_non_default.selected_chunks_detail}
          dropped={trace.stage3.track_b_non_default.dropped_chunks_detail}
        />
      </section>

      <section className="space-y-2">
        <h2 className={cn(t.h3, colors.text.primary)}>Raw payloads</h2>
        <Collapsible
          label="Stage 1 (detection)"
          open={stage1Open}
          onToggle={() => setStage1Open((x) => !x)}
          payload={trace.stage1}
        />
        <Collapsible
          label="Stage 2 (retrieval)"
          open={stage2Open}
          onToggle={() => setStage2Open((x) => !x)}
          payload={trace.stage2}
        />
      </section>
    </div>
  );
}

function StatCell({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className={cn(t.caption, colors.text.faint)}>{label}</p>
      <p
        className={cn(
          t.bodyStrong,
          colors.text.primary,
          mono ? "font-mono" : undefined,
        )}
      >
        {value}
      </p>
    </div>
  );
}

function TrackSection({
  title,
  basis,
  selected,
  dropped,
}: {
  title: string;
  basis: string;
  selected: ReadonlyArray<RetrievedKnowledgeDecisionV1>;
  dropped: ReadonlyArray<RetrievedKnowledgeDecisionV1>;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className={cn(t.bodyStrong, colors.text.primary)}>{title}</h3>
        <p className={cn(t.meta, colors.text.muted)}>basis: {basis}</p>
      </div>
      <DecisionTable
        caption={`Selected (${selected.length})`}
        rows={selected}
        kind="selected"
      />
      <DecisionTable
        caption={`Dropped (${dropped.length})`}
        rows={dropped}
        kind="dropped"
      />
    </div>
  );
}

function DecisionTable({
  caption,
  rows,
  kind,
}: {
  caption: string;
  rows: ReadonlyArray<RetrievedKnowledgeDecisionV1>;
  kind: "selected" | "dropped";
}) {
  return (
    <div>
      <p className={cn(t.meta, colors.text.primary, "mb-1")}>{caption}</p>
      {rows.length === 0 ? (
        <p className={cn(t.caption, colors.text.muted)}>—</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className={cn(t.caption, colors.text.muted, "text-left")}>
                <th className="px-2 py-1">Chunk</th>
                <th className="px-2 py-1">Tier</th>
                <th className="px-2 py-1 text-right">Specificity</th>
                <th className="px-2 py-1 text-right">Freshness</th>
                <th className="px-2 py-1">
                  {kind === "selected" ? "Reason selected" : "Drop reason"}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.chunk_id}
                  className={cn("border-t", colors.border.default)}
                >
                  <td
                    className={cn(
                      "px-2 py-1 font-mono",
                      t.caption,
                      colors.text.muted,
                    )}
                  >
                    {row.chunk_id.slice(0, 8)}…
                  </td>
                  <td className={cn("px-2 py-1", t.caption)}>
                    {row.priority_tier}
                  </td>
                  <td className={cn("px-2 py-1 text-right", t.caption)}>
                    {row.match_specificity_score}
                  </td>
                  <td className={cn("px-2 py-1 text-right", t.caption)}>
                    {row.freshness_score.toFixed(2)}
                  </td>
                  <td className={cn("px-2 py-1", t.caption, colors.text.muted)}>
                    {kind === "selected"
                      ? row.selected_because ?? "—"
                      : row.drop_reason ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Collapsible({
  label,
  open,
  onToggle,
  payload,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  payload: unknown;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={cn(t.meta, colors.text.primary, "underline")}
      >
        {open ? "Hide" : "Show"} {label}
      </button>
      {open ? (
        <pre
          className={cn(
            "mt-2 p-3 overflow-x-auto",
            radius.sm,
            t.caption,
            "font-mono",
            colors.bg.muted,
            colors.text.primary,
          )}
        >
          {JSON.stringify(payload, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
