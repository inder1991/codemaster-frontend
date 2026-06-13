/**
 * @adopted-from vendor/application-ui-v4/react/elements/badges/10-flat-with-dot.jsx
 *
 * Status-keyed badge. Sprint 12 / S12.1.1 + impeccable adopt-by-copy
 * catch-up 2026-05-04.
 *
 * Locked invariant: status indicators NEVER carry color as the
 * sole signal (DESIGN.md "Accessibility & Inclusion"). Each status
 * variant pairs the colored dot AND a text label. The optional
 * `tone="solid"` flag swaps to a solid-fill chip when the dot is
 * insufficient (e.g., role pills).
 */

"use client";

import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";
import { colors, type StatusKind, type as t } from "@/lib/design-tokens";

export type BadgeKind = StatusKind | "neutral";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /**
   * Color slot. Status kinds (healthy, degraded, down, info, dim)
   * map to the locked DESIGN.md status palette; `neutral` falls
   * back to the muted tinted-neutral surface.
   */
  kind?: BadgeKind;
  /** Render as a pill (rounded-full) instead of rounded rect. */
  pill?: boolean;
  /** Suppress the leading dot. Default true (dot shown). */
  showDot?: boolean;
  /** `xs` is the compact rung used inside dense tables. */
  size?: "xs" | "sm";
  children: ReactNode;
}

const NEUTRAL_BG = "bg-[oklch(94%_0.008_80)] dark:bg-[oklch(28%_0.012_270)]";
const NEUTRAL_TEXT = "text-[oklch(45%_0.008_80)] dark:text-[oklch(80%_0.008_80)]";
const NEUTRAL_DOT = "bg-[oklch(60%_0.006_80)] dark:bg-[oklch(70%_0.008_80)]";

const STATUS_DOT: Record<StatusKind, string> = {
  healthy: "bg-[oklch(72%_0.13_165)] dark:bg-[oklch(76%_0.13_165)]",
  degraded: "bg-[oklch(78%_0.16_80)] dark:bg-[oklch(82%_0.16_80)]",
  down: "bg-[oklch(60%_0.18_25)] dark:bg-[oklch(70%_0.18_25)]",
  info: "bg-[oklch(70%_0.13_235)] dark:bg-[oklch(74%_0.13_235)]",
  dim: "bg-[oklch(70%_0.06_320)] dark:bg-[oklch(74%_0.06_320)]",
};

export function Badge({
  kind = "neutral",
  pill = false,
  showDot = true,
  size = "sm",
  className,
  children,
  ...rest
}: BadgeProps) {
  const isStatus = kind !== "neutral";
  const bgClass = isStatus ? colors.statusBg[kind] : NEUTRAL_BG;
  const textClass = isStatus ? colors.status[kind] : NEUTRAL_TEXT;
  const dotClass = isStatus ? STATUS_DOT[kind] : NEUTRAL_DOT;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-x-1.5",
        pill ? "rounded-full" : "rounded-md",
        size === "xs" ? "px-1.5 py-0.5" : "px-2 py-0.5",
        size === "xs" ? t.caption : t.meta,
        bgClass,
        textClass,
        className,
      )}
      {...rest}
    >
      {showDot ? (
        <span
          aria-hidden="true"
          className={cn("size-1.5 rounded-full", dotClass)}
        />
      ) : null}
      {children}
    </span>
  );
}
