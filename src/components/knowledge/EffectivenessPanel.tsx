/**
 * Sprint 12 / S12.2.4 — effectiveness panel.
 *
 * Surfaces how often this learning fires and what fraction of
 * fires the reviewer accepted. Three stat tiles up top + an
 * inline 30-day bar chart underneath. No external chart lib —
 * the chart is a hand-rolled SVG so the warm-cream identity
 * carries through and Sprint 12 doesn't pull in a chart bundle.
 *
 * Locked invariants (DESIGN.md):
 *   - Tabular numerals on every metric value.
 *   - Status NEVER carries color as the sole signal: each tile
 *     has a label.
 *   - The bar chart is decorative; the data is also surfaced as
 *     a screen-reader summary.
 */

"use client";

import { cn } from "@/lib/cn";
import { colors, type as t } from "@/lib/design-tokens";

export interface EffectivenessPanelProps {
  firedCount: number;
  acceptRate: number;
  lastFiredAtLabel: string | null;
  /** 30 daily counts, oldest → newest. */
  last30dFires: ReadonlyArray<number>;
}

export function EffectivenessPanel({
  firedCount,
  acceptRate,
  lastFiredAtLabel,
  last30dFires,
}: EffectivenessPanelProps) {
  const acceptPct = Math.round(acceptRate * 100);
  const total30d = last30dFires.reduce((a, b) => a + b, 0);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile label="Times fired" value={String(firedCount)} />
        <Tile label="Accept rate" value={`${acceptPct}%`} />
        <Tile
          label="Last fired"
          value={lastFiredAtLabel ?? "never"}
          numeric={false}
        />
      </div>
      <Last30dChart fires={last30dFires} total={total30d} />
    </div>
  );
}

function Tile({
  label,
  value,
  numeric = true,
}: {
  label: string;
  value: string;
  numeric?: boolean;
}) {
  return (
    <div>
      <p
        className={cn(
          t.caption,
          colors.text.faint,
          "uppercase tracking-wider",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-1",
          numeric ? t.numericLarge : t.h3,
          colors.text.primary,
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Last30dChart({
  fires,
  total,
}: {
  fires: ReadonlyArray<number>;
  total: number;
}) {
  const maxValue = Math.max(...fires, 1);
  const barCount = fires.length;
  // Layout constants (in SVG userspace units; the SVG scales
  // responsively via `width="100%"`).
  const W = 600;
  const H = 56;
  const gap = 4;
  const barWidth = (W - gap * (barCount - 1)) / barCount;

  return (
    <div>
      <div className="flex items-center justify-between">
        <p
          className={cn(
            t.caption,
            colors.text.faint,
            "uppercase tracking-wider",
          )}
        >
          Last 30 days
        </p>
        <p className={cn(t.meta, colors.text.muted)}>
          <span className="tabular-nums font-medium">{total}</span> total
          fires
        </p>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={`30-day fire history: ${total} total fires`}
        className="mt-2"
        preserveAspectRatio="none"
      >
        {fires.map((n, i) => {
          const h = n === 0 ? 2 : Math.max(2, (n / maxValue) * (H - 4));
          const x = i * (barWidth + gap);
          const y = H - h;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barWidth}
              height={h}
              rx={2}
              className={
                n === 0
                  ? "fill-[oklch(88%_0.022_80)] dark:fill-[oklch(30%_0.012_270)]"
                  : "fill-[oklch(72%_0.16_65)] dark:fill-[oklch(76%_0.14_65)]"
              }
            />
          );
        })}
      </svg>
      <div className="mt-1 flex items-center justify-between">
        <span className={cn(t.caption, colors.text.faint)}>30 days ago</span>
        <span className={cn(t.caption, colors.text.faint)}>today</span>
      </div>
    </div>
  );
}
