/**
 * Sprint 12 / S12.1.1b — Loading state component.
 *
 * Two variants:
 *   - "skeleton" (default) for content-loading; animated bars
 *     stand in for table rows / cards while data fetches.
 *   - "spinner" for action-in-flight (e.g., a submit button
 *     with a pending request).
 */

import type { JSX } from "react";

import { cn } from "@/lib/cn";
import { colors } from "@/lib/design-tokens";

export interface LoadingProps {
  variant?: "skeleton" | "spinner";
  /** Number of skeleton rows to render. Defaults to 3. */
  rows?: number;
  /** Optional aria-label override. */
  label?: string;
}

export function Loading({
  variant = "skeleton",
  rows = 3,
  label = "Loading",
}: LoadingProps): JSX.Element {
  if (variant === "spinner") {
    return (
      <div
        role="status"
        aria-label={label}
        className="inline-flex items-center justify-center"
      >
        <svg
          className={cn("size-5 animate-spin", colors.text.muted)}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
        <span className="sr-only">{label}</span>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label={label}
      aria-busy="true"
      className="space-y-3"
    >
      {Array.from({ length: Math.max(1, rows) }).map((_, i) => (
        <div
          key={i}
          className="h-4 w-full animate-pulse rounded-md bg-[oklch(94%_0.008_80)] dark:bg-[oklch(26%_0.014_270)]"
        />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}
