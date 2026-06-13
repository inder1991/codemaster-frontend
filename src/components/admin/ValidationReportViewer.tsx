/**
 * Task 5.5 — ValidationReportViewer (spec §9 + v4 §4.7).
 *
 * Pure presentational component — no fetching, no business logic.
 * Consumed by T5.6 EmbedderLifecyclePanel inside a modal triggered from
 * the validation-report cell of the generation history table.
 *
 * Sections:
 *   1. Header: passed/failed badge + sample_size
 *   2. Retrieval overlap (v4 HARD pass criterion — visually prominent):
 *        overlap@5 and @10 with threshold context; green if pass, red if fail
 *   3. Tokenization drift: mean_pct_diff + max_pct_diff
 *   4. Norm distribution side-by-side (mean/stddev/p50/p99) with
 *      simple CSS-bar visualization (no external chart lib)
 *   5. Truncation count (red if > 1% of sample)
 *   6. Warnings: chips; "no warnings" placeholder when empty
 */

import type { JSX } from "react";

import type { components } from "@/lib/api/generated/contracts";
import { cn } from "@/lib/cn";
import { colors, type as t } from "@/lib/design-tokens";

export type ValidationReportV1 =
  components["schemas"]["ValidationReportV1"];

// ── Thresholds (v4 §4.7 HARD pass criteria) ───────────────────────

const OVERLAP_AT5_THRESHOLD = 0.80;
const OVERLAP_AT10_THRESHOLD = 0.70;
const TRUNCATION_WARN_RATIO = 0.01; // > 1% of sample_size is red

// ── Sub-components ────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className={cn(
        t.bodyStrong,
        colors.text.primary,
        "mb-2",
      )}
    >
      {children}
    </h3>
  );
}

function MetaLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className={cn(t.meta, colors.text.muted)}>{children}</span>
  );
}

function MetaValue({ children }: { children: React.ReactNode }) {
  return (
    <span className={cn(t.numericBody, colors.text.primary)}>{children}</span>
  );
}

function MetaRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-x-2">
      <MetaLabel>{label}</MetaLabel>
      <MetaValue>{value}</MetaValue>
    </div>
  );
}

/** Simple text-based bar chart, 0–1 scale using block characters. */
function MiniBar({ value, max }: { value: number; max: number }) {
  const BARS = 10;
  const filled = max > 0 ? Math.round((value / max) * BARS) : 0;
  const empty = BARS - filled;
  return (
    <span
      className={cn(t.caption, colors.text.accent, "font-mono select-none")}
      aria-hidden="true"
    >
      {"█".repeat(filled)}
      {"░".repeat(empty)}
    </span>
  );
}

// ── Retrieval overlap row ─────────────────────────────────────────

function OverlapRow({
  label,
  value,
  threshold,
}: {
  label: string;
  value: number;
  threshold: number;
}) {
  const pass = value >= threshold;
  return (
    <div
      className="flex items-center gap-x-3 py-1"
      data-testid={`overlap-row-${label.replace("@", "at")}`}
    >
      <span className={cn(t.meta, colors.text.muted, "w-24 shrink-0")}>
        {label}
      </span>
      <span
        className={cn(
          t.numericBody,
          "font-semibold",
          pass ? colors.status.healthy : colors.status.down,
        )}
      >
        {value.toFixed(3)}
      </span>
      <span className={cn(t.caption, colors.text.faint)}>
        (threshold &ge;{threshold.toFixed(2)})
      </span>
      <span
        className={cn(
          "ml-auto text-xs font-medium px-2 py-0.5 rounded-full",
          pass
            ? cn(colors.statusBg.healthy, colors.status.healthy)
            : cn(colors.statusBg.down, colors.status.down),
        )}
        data-testid={`overlap-pass-badge-${label.replace("@", "at")}`}
      >
        {pass ? "Pass" : "Fail"}
      </span>
    </div>
  );
}

// ── Norm distribution table ───────────────────────────────────────

const NORM_KEYS: { key: string; label: string }[] = [
  { key: "mean", label: "Mean" },
  { key: "stddev", label: "Std dev" },
  { key: "p50", label: "p50" },
  { key: "p99", label: "p99" },
];

function NormDistributionPanel({
  label,
  dist,
  maxMean,
  testIdPrefix,
}: {
  label: string;
  dist: Record<string, number>;
  maxMean: number;
  testIdPrefix: string;
}) {
  return (
    <div className="flex-1 min-w-0">
      <p
        className={cn(t.meta, colors.text.muted, "mb-2 font-semibold")}
        data-testid={`${testIdPrefix}-label`}
      >
        {label}
      </p>
      <div className="space-y-1">
        {NORM_KEYS.map(({ key, label: rowLabel }) => {
          const val = dist[key] ?? 0;
          return (
            <div
              key={key}
              className="flex items-center gap-x-2"
              data-testid={`${testIdPrefix}-${key}`}
            >
              <span className={cn(t.caption, colors.text.faint, "w-12 shrink-0")}>
                {rowLabel}
              </span>
              <span className={cn(t.numericBody, colors.text.primary, "w-16 text-right")}>
                {val.toFixed(4)}
              </span>
              {key === "mean" && (
                <MiniBar value={val} max={maxMean} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Warning chip ──────────────────────────────────────────────────

function WarningChip({ text }: { text: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded text-xs font-medium",
        colors.statusBg.degraded,
        colors.status.degraded,
        "border border-yellow-300",
      )}
      data-testid="warning-chip"
    >
      {text}
    </span>
  );
}

// ── Section wrapper ───────────────────────────────────────────────

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn("border-t pt-4", colors.divider)}>
      {children}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────

export interface ValidationReportViewerProps {
  report: ValidationReportV1;
}

export function ValidationReportViewer({
  report,
}: ValidationReportViewerProps): JSX.Element {
  const {
    passed,
    sample_size,
    retrieval_overlap,
    tokenization_drift,
    norm_distribution_old,
    norm_distribution_new,
    truncation_count,
    warnings,
  } = report;

  const truncationExceedsThreshold =
    sample_size > 0 &&
    truncation_count / sample_size > TRUNCATION_WARN_RATIO;

  // For the norm-distribution mini-bars: scale bars relative to the
  // larger of the two means so both panels share the same scale.
  const maxMean = Math.max(
    norm_distribution_old["mean"] ?? 0,
    norm_distribution_new["mean"] ?? 0,
    0.0001, // prevent division by zero when both are 0
  );

  const at5 = retrieval_overlap["at_5"] ?? 0;
  const at10 = retrieval_overlap["at_10"] ?? 0;
  const fixtureSize = retrieval_overlap["fixture_size"] ?? 0;

  return (
    <div className="space-y-4" data-testid="validation-report-viewer">
      {/* ── Section 1: Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-x-3">
          <span
            className={cn(
              "inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold",
              passed
                ? cn(colors.statusBg.healthy, colors.status.healthy, "border border-green-300")
                : cn(colors.statusBg.down, colors.status.down, "border border-red-300"),
            )}
            data-testid="passed-badge"
          >
            {passed ? "Passed" : "Failed"}
          </span>
          <span className={cn(t.meta, colors.text.muted)}>
            Sample size:{" "}
            <span className={cn(t.numericBody, colors.text.primary)} data-testid="sample-size">
              {sample_size.toLocaleString()}
            </span>
          </span>
        </div>
      </div>

      {/* ── Section 2: Retrieval overlap (v4 §4.7 HARD pass criterion) ── */}
      <Section>
        <SectionHeader>Retrieval overlap (v4 hard pass criterion)</SectionHeader>
        <div
          className={cn(
            "rounded-lg border p-3",
            passed
              ? "border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800"
              : "border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800",
          )}
        >
          <OverlapRow
            label="Overlap@5"
            value={at5}
            threshold={OVERLAP_AT5_THRESHOLD}
          />
          <OverlapRow
            label="Overlap@10"
            value={at10}
            threshold={OVERLAP_AT10_THRESHOLD}
          />
          <div className="mt-2 pt-2 border-t border-current/10">
            <MetaRow
              label="Fixture size:"
              value={`${Math.round(fixtureSize)} queries`}
            />
          </div>
        </div>
      </Section>

      {/* ── Section 3: Tokenization drift ── */}
      <Section>
        <SectionHeader>Tokenization drift</SectionHeader>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          <MetaRow
            label="Mean % diff"
            value={
              tokenization_drift["mean_pct_diff"] !== undefined
                ? `${tokenization_drift["mean_pct_diff"].toFixed(2)}%`
                : "—"
            }
          />
          <MetaRow
            label="Max % diff"
            value={
              tokenization_drift["max_pct_diff"] !== undefined
                ? `${tokenization_drift["max_pct_diff"].toFixed(2)}%`
                : "—"
            }
          />
        </div>
      </Section>

      {/* ── Section 4: Norm distribution ── */}
      <Section>
        <SectionHeader>Norm distribution</SectionHeader>
        <div className="flex gap-x-6">
          <NormDistributionPanel
            label="Active generation"
            dist={norm_distribution_old}
            maxMean={maxMean}
            testIdPrefix="norm-old"
          />
          <div
            className={cn("w-px self-stretch", colors.divider)}
            aria-hidden="true"
          />
          <NormDistributionPanel
            label="Candidate generation"
            dist={norm_distribution_new}
            maxMean={maxMean}
            testIdPrefix="norm-new"
          />
        </div>
      </Section>

      {/* ── Section 5: Truncation count ── */}
      <Section>
        <SectionHeader>Truncation</SectionHeader>
        <div className="flex items-center gap-x-3">
          <span
            className={cn(
              t.numericBody,
              "font-semibold",
              truncationExceedsThreshold
                ? colors.status.down
                : colors.text.primary,
            )}
            data-testid="truncation-count"
          >
            {truncation_count.toLocaleString()}
          </span>
          {truncationExceedsThreshold && (
            <span
              className={cn(
                "text-xs font-medium px-2 py-0.5 rounded",
                colors.statusBg.down,
                colors.status.down,
              )}
              data-testid="truncation-warn"
            >
              &gt;1% of sample
            </span>
          )}
          <MetaLabel>
            truncated
            {sample_size > 0 && (
              <> ({((truncation_count / sample_size) * 100).toFixed(1)}%)</>
            )}
          </MetaLabel>
        </div>
      </Section>

      {/* ── Section 6: Warnings ── */}
      <Section>
        <SectionHeader>Warnings</SectionHeader>
        {warnings.length === 0 ? (
          <p
            className={cn(t.meta, colors.text.faint)}
            data-testid="no-warnings"
          >
            No warnings
          </p>
        ) : (
          <div
            className="flex flex-wrap gap-2"
            data-testid="warnings-list"
          >
            {warnings.map((w, i) => (
              <WarningChip key={i} text={w} />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
