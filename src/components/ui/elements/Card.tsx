/**
 * Sprint 12 / S12.2.x — soft-elevated content container.
 *
 * Wraps a section's CONTENT (not its heading) so the page reads as
 * structured chunks rather than text floating on a blank surface.
 * The section <h2> stays bare ABOVE the card.
 *
 * Locked invariants (DESIGN.md, head-of-UI 2026-05-04 calibration):
 *   - Card surface uses `bg.elevated` (lighter than the page's
 *     warm-cream `bg.surface`) so the card lifts.
 *   - 1px `border.default` so the boundary is visible without
 *     needing a heavy shadow.
 *   - Single elevation tier — no nested cards. Inside a card,
 *     content separates via `divide-y` hairlines or spacing.
 *   - `radius.md` (10px) — same as buttons, modals nest larger
 *     (radius.lg).
 *   - Padding defaults to `p-0` (the consumer chooses) so list
 *     surfaces with full-bleed rows don't gain unwanted insets.
 */

import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";
import { colors, elevation, radius } from "@/lib/design-tokens";

type CardPadding = "none" | "sm" | "md" | "lg";

const PADDING: Record<CardPadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding;
  raised?: boolean;
  children: ReactNode;
}

export function Card({
  padding = "none",
  raised = true,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        radius.md,
        colors.bg.elevated,
        "border",
        colors.border.default,
        raised && elevation.raised,
        PADDING[padding],
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
