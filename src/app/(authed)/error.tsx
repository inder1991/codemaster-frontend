/**
 * Sprint Y.5 (2026-05-11) — segment-level error boundary for the
 * authed shell.
 *
 * Distinct from `frontend/src/app/error.tsx` (Sprint X.7) which
 * catches errors that escape the root layout (rare; usually means
 * a top-level provider crashed). This file catches errors thrown
 * inside ANY authed page or its descendants — the sidebar stays
 * visible, only the page content is replaced with the error card.
 *
 * Why both?
 *   - Root error.tsx is the last-resort floor (shell unavailable).
 *   - Segment error.tsx is the per-page boundary (shell stays).
 *
 * Without this file, errors in a page (e.g., a render error in
 * KnowledgeProposalsPage) would bubble to the root boundary and
 * blank the whole shell. Users lose navigation context; support
 * tickets get harder.
 *
 * The error reference ID (`error.digest`) is what users paste into
 * support tickets so on-call can grep Loki for the matching
 * server-side log.
 */

"use client";

import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { useEffect, type JSX } from "react";

import { Button } from "@/components/ui/elements/Button";
import { cn } from "@/lib/cn";
import { colors, radius, type as t } from "@/lib/design-tokens";

interface SegmentErrorProps {
  /** The error caught by Next.js's per-segment error boundary. */
  error: Error & { digest?: string };
  /** Re-render the offending segment in place. */
  reset: () => void;
}

export default function AuthedSegmentError({
  error,
  reset,
}: SegmentErrorProps): JSX.Element {
  useEffect(() => {
    if (typeof window !== "undefined") {
      console.error("authed-segment-error:", error);
    }
  }, [error]);

  return (
    <div
      role="alert"
      className={cn(
        "mx-auto my-12 max-w-2xl px-6 py-10 text-center",
        radius.lg,
        colors.bg.surface,
        "border",
        colors.border.default,
      )}
    >
      <ExclamationTriangleIcon
        className={cn("mx-auto h-10 w-10", colors.status.down)}
        aria-hidden="true"
      />
      <h2 className={cn("mt-4", t.h2, colors.text.primary)}>
        Couldn&apos;t load this page
      </h2>
      <p className={cn("mt-2", t.body, colors.text.muted)}>
        The page hit an unexpected error. Try again; if it persists,
        share the reference ID with{" "}
        <a
          href="mailto:platform-owners@acme.io"
          className={cn("underline", colors.text.primary)}
        >
          platform-owners@acme.io
        </a>
        .
      </p>
      {error.digest ? (
        <p
          data-testid="error-digest"
          className={cn(
            "mt-4 inline-block px-3 py-1.5 font-mono",
            radius.md,
            colors.bg.muted,
            colors.text.faint,
            t.caption,
          )}
        >
          ref&nbsp;
          <span className={colors.text.primary}>{error.digest}</span>
        </p>
      ) : null}
      <div className="mt-6 flex items-center justify-center gap-x-3">
        <Button variant="primary" onClick={reset} size="md">
          Try again
        </Button>
      </div>
    </div>
  );
}
