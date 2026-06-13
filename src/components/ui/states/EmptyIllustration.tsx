/**
 * Sprint 12 / S12.1.1b — friendly empty-state illustration.
 *
 * Inline line-art SVG: a stylized PR card with a question mark.
 * Uses `currentColor` so the parent's text-color token applies.
 * Sized to ~96px square. Decorative — the parent's `<h3>` is the
 * accessible name; this carries `aria-hidden` upstream.
 */

import type { SVGProps } from "react";

export function EmptyIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 96 96"
      width="96"
      height="96"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Outer card */}
      <rect x="14" y="20" width="68" height="56" rx="6" />
      {/* Top bar (PR title placeholder) */}
      <line x1="22" y1="32" x2="58" y2="32" />
      {/* Sub line (PR meta placeholder) */}
      <line x1="22" y1="40" x2="46" y2="40" strokeOpacity="0.5" />
      {/* Question mark inside, centered in lower-half */}
      <path
        d="M44 54c0-3 2-5 5-5s5 2 5 5c0 2-1 3-3 4-2 1-3 2-3 4"
        strokeLinecap="round"
      />
      <circle cx="48" cy="68" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}
