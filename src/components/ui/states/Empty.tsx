/**
 * Sprint 12 / S12.1.1b — Empty state component.
 *
 * Redesigned 2026-05-04 (head-of-UI calibration). The prior
 * dashed-border treatment read as wireframe placeholder; this
 * version uses a filled `bg.muted` block with optional illustration
 * slot so the empty state carries the warm-light identity.
 */

import type { JSX, ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  colors,
  motion,
  radius,
  type as t,
} from "@/lib/design-tokens";

export interface EmptyProps {
  /**
   * Optional illustration slot. Pass an inline SVG or an icon
   * sized 64-96px. Receives `aria-hidden` automatically — the
   * accessible name is carried by `title`.
   */
  illustration?: ReactNode;
  /** Backwards-compat alias for `illustration` (legacy callers). */
  icon?: ReactNode;
  title: string;
  body?: string;
  cta?: {
    label: string;
    onClick: () => void;
  };
}

export function Empty({
  illustration,
  icon,
  title,
  body,
  cta,
}: EmptyProps): JSX.Element {
  const visual = illustration ?? icon;
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-10 text-center",
        radius.md,
        colors.bg.muted,
      )}
    >
      {visual ? (
        <div
          aria-hidden="true"
          className={cn("mb-4", colors.text.faint)}
        >
          {visual}
        </div>
      ) : null}
      <h3 className={cn(t.h3, colors.text.primary)}>{title}</h3>
      {body ? (
        <p
          className={cn(
            "mt-2 max-w-md",
            t.bodyLarge,
            colors.text.muted,
          )}
        >
          {body}
        </p>
      ) : null}
      {cta ? (
        <button
          type="button"
          onClick={cta.onClick}
          className={cn(
            "mt-5 px-3 py-2",
            radius.md,
            t.bodyStrong,
            colors.accent.solid,
            colors.accent.onSolid,
            colors.accent.ring,
            motion.fast,
          )}
        >
          {cta.label}
        </button>
      ) : null}
    </div>
  );
}
