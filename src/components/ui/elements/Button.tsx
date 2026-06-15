/**
 * @adopted-from vendor/application-ui-v4/react/elements/buttons/01-primary-buttons.jsx
 *
 * Locked button primitive. Sprint 12 / S12.1.1 + impeccable
 * adopt-by-copy catch-up 2026-05-04.
 *
 * Variants:
 *   - primary: amber accent, warm-cream foreground (DEFAULT).
 *   - secondary: card surface + border, primary text.
 *   - danger: warm-red. Use for destructive actions only.
 *   - ghost: bare label, hover muted bg.
 *
 * Sizes follow vendor catalog rungs (xs..lg). Default `md`
 * matches the size used everywhere in batch 1 (px-3 py-2).
 *
 * NEVER inline button utility strings in pages. If you need a
 * variant we don't have here, add it in this file (and DESIGN.md)
 * rather than reaching for `bg-indigo-*` or `bg-amber-*` directly.
 */

"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/cn";
import { colors, motion, radius, type as t } from "@/lib/design-tokens";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "xs" | "sm" | "md" | "lg";

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Optional leading icon. Receives `aria-hidden` automatically. */
  leadingIcon?: ReactNode;
  /** Optional trailing icon. Receives `aria-hidden` automatically. */
  trailingIcon?: ReactNode;
  /** Stretch to full width of the parent flex/grid track. */
  fullWidth?: boolean;
}

const SIZE: Record<ButtonSize, string> = {
  xs: cn("px-2 py-1", t.caption),
  sm: cn("px-2.5 py-1.5", t.meta),
  md: cn("px-3 py-2", t.bodyStrong),
  lg: cn("px-3.5 py-2.5", t.bodyStrong),
};

const VARIANT: Record<ButtonVariant, string> = {
  primary: cn(
    colors.accent.solid,
    colors.accent.onSolid,
    colors.accent.ring,
  ),
  secondary: cn(
    colors.bg.elevated,
    colors.text.primary,
    "border",
    colors.border.strong,
    colors.hover.bgElevated,
    "focus-visible:outline focus-visible:outline-2",
    "focus-visible:outline-[oklch(72%_0.16_65)]",
  ),
  danger: cn(
    "bg-[oklch(60%_0.18_25)] hover:bg-[oklch(54%_0.18_25)]",
    "dark:bg-[oklch(64%_0.18_25)] dark:hover:bg-[oklch(58%_0.18_25)]",
    colors.accent.onSolid,
    "focus-visible:outline focus-visible:outline-2",
    "focus-visible:outline-[oklch(60%_0.18_25)]",
  ),
  ghost: cn(
    colors.text.muted,
    colors.hover.text.primary,
    colors.hover.bg,
    "focus-visible:outline focus-visible:outline-2",
    "focus-visible:outline-[oklch(72%_0.16_65)]",
  ),
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    leadingIcon,
    trailingIcon,
    fullWidth,
    className,
    children,
    type = "button",
    disabled,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-x-2",
        radius.md,
        SIZE[size],
        VARIANT[variant],
        motion.fast,
        fullWidth && "w-full",
        "c-btn-disabled",
        disabled && "cursor-not-allowed",
        className,
      )}
      {...rest}
    >
      {leadingIcon ? (
        <span aria-hidden="true" className="inline-flex shrink-0">
          {leadingIcon}
        </span>
      ) : null}
      {children}
      {trailingIcon ? (
        <span aria-hidden="true" className="inline-flex shrink-0">
          {trailingIcon}
        </span>
      ) : null}
    </button>
  );
});
