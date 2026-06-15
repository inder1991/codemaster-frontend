/**
 * Sprint 12 / S12.1.1b — locked design tokens.
 *
 * Pages MUST import from this module. Raw Tailwind palette
 * colors (e.g. `bg-indigo-600`, `text-gray-500`) elsewhere in
 * the app fail the eslint custom rule
 * `design/no-inline-design-values` (eslint.config.mjs). Arbitrary
 * OKLCH values (`bg-[oklch(...)]`) remain the intentional
 * low-level escape hatch the primitives use.
 *
 * 2026-05-04: tokens rewritten to map to REAL CSS CLASSES
 * defined in `app/globals.css` (`.t-*`, `.c-*`) rather than
 * Tailwind v4 arbitrary-value classes. The arbitrary-value
 * approach hit a Tailwind v4 extraction bug where
 * `[color:oklch(15%_0.015_80)]` did not have its underscores
 * converted to spaces, producing invalid CSS. Real CSS classes
 * have no extraction surface and always work.
 *
 * The mapping is one-to-one: each token below resolves to a
 * single class name. Pages and components keep using `cn(...)`
 * exactly as before.
 */

export const colors = {
  bg: {
    surface: "c-bg-surface",
    elevated: "c-bg-elevated",
    muted: "c-bg-muted",
    accent: "c-bg-accent",
  },
  text: {
    primary: "c-text-primary",
    muted: "c-text-muted",
    faint: "c-text-faint",
    inverse: "c-text-inverse",
    accent: "c-text-accent",
  },
  border: {
    default: "c-border-default",
    strong: "c-border-strong",
    accent: "c-border-strong", // alias; accent ring borders are rare
  },
  accent: {
    solid: "c-bg-accent-solid",
    text: "c-text-accent",
    onSolid: "c-text-on-solid",
    ring: "c-accent-ring",
  },
  hover: {
    bg: "c-hover-bg",
    bgElevated: "c-hover-bg-elevated",
    text: {
      primary: "c-hover-text-primary",
      muted: "c-hover-text-muted",
    },
  },
  divider: "c-divider",
  status: {
    healthy: "c-status-healthy",
    degraded: "c-status-degraded",
    down: "c-status-down",
    info: "c-status-info",
    dim: "c-status-dim",
  },
  statusBg: {
    healthy: "c-statusbg-healthy",
    degraded: "c-statusbg-degraded",
    down: "c-statusbg-down",
    info: "c-statusbg-info",
    dim: "c-statusbg-dim",
  },
  // Status border colors — pair with statusBg for tinted callouts /
  // selection states (e.g. a validation pass/fail card). Mirrors the
  // statusBg roles so a colored container never reaches for raw
  // `border-green-300` / `border-red-300`.
  statusBorder: {
    healthy: "c-statusborder-healthy",
    degraded: "c-statusborder-degraded",
    down: "c-statusborder-down",
    info: "c-statusborder-info",
    dim: "c-statusborder-dim",
  },
} as const;

/**
 * Spacing aliases (Tailwind unit indexes; multiply by 4 for px).
 * Pages use these via `p-${spacing.lg}` / `space-y-${...}`.
 */
export const spacing = {
  xs: "1",
  sm: "2",
  md: "3",
  lg: "4",
  xl: "6",
  "2xl": "8",
  "3xl": "12",
} as const;

/**
 * Locked motion durations + easings. These ARE Tailwind utility
 * strings (`duration-[...]` works because the values are simple
 * numbers, not OKLCH literals). globals.css's
 * `prefers-reduced-motion` rule still wins for users who set it.
 */
export const motion = {
  fast: "duration-[120ms] ease-out",
  base: "duration-[200ms] ease-out",
  slow: "duration-[320ms] ease-out",
} as const;

/** Type scale tokens — map to `.t-*` classes in globals.css. */
export const type = {
  display: "t-display",
  h2: "t-h2",
  h3: "t-h3",
  bodyLarge: "t-body-large",
  body: "t-body",
  bodyStrong: "t-body-strong",
  meta: "t-meta",
  caption: "t-caption",
  numericLarge: "t-numeric-large",
  numericBody: "t-numeric-body",
} as const;

/**
 * Border radius. These ARE Tailwind utilities (rounded-*) and work
 * fine because the values are simple keywords or px lengths.
 */
export const radius = {
  sm: "rounded-md",
  md: "rounded-[10px]",
  lg: "rounded-[14px]",
  full: "rounded-full",
} as const;

/**
 * Elevation. Shadows use simple-value Tailwind arbitrary classes
 * which Tailwind v4 handles correctly (no underscores in the
 * payload that need conversion).
 */
export const elevation = {
  flat: "",
  raised:
    "shadow-[0_1px_2px_oklch(0%_0_0/0.04),0_1px_3px_oklch(0%_0_0/0.06)] " +
    "dark:shadow-[0_1px_2px_oklch(0%_0_0/0.5),0_1px_3px_oklch(0%_0_0/0.6)]",
  modal:
    "shadow-[0_8px_24px_oklch(0%_0_0/0.12),0_2px_6px_oklch(0%_0_0/0.08)] " +
    "dark:shadow-[0_8px_24px_oklch(0%_0_0/0.6),0_2px_6px_oklch(0%_0_0/0.5)]",
} as const;

export type StatusKind = keyof typeof colors.status;
