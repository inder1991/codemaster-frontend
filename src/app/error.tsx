/**
 * Sprint X.7 (2026-05-11) — app-level error boundary.
 *
 * Next.js convention file: when a render error escapes ANY page or
 * layout in the App Router, Next.js renders this component as the
 * route content. Without this file, an uncaught render error blanks
 * the entire SidebarShell to a generic browser error page.
 *
 * The error reference ID is what users paste into support tickets;
 * `error.digest` is Next.js's stable identifier (8-char hash of the
 * stack + props). We surface it visibly so the operator can search
 * Loki for the matching server-side log.
 *
 * Tracked: docs/superpowers/plans/2026-05-11-frontend-FINAL-sprint-plan.md
 *         → Sprint X / X.7.
 */

"use client";

import { useEffect } from "react";
import type { JSX } from "react";

import { Button } from "@/components/ui/elements/Button";
import { cn } from "@/lib/cn";
import { colors, radius, type as t } from "@/lib/design-tokens";

interface AppErrorProps {
  /** The error caught by Next.js's error boundary. */
  error: Error & { digest?: string };
  /** Re-render the offending segment. */
  reset: () => void;
}

export default function AppError({ error, reset }: AppErrorProps): JSX.Element {
  useEffect(() => {
    // Console log here is the local-dev signal. Server-side error logs
    // are the source-of-truth and `error.digest` is the join key.
    if (typeof window !== "undefined") {
      console.error("app-error-boundary:", error);
    }
  }, [error]);

  return (
    <main
      id="main-content"
      role="alert"
      className={cn(
        "min-h-screen flex items-center justify-center px-6 py-12",
        colors.bg.surface,
      )}
    >
      <div className="w-full max-w-md text-center">
        <h1 className={cn(t.display, colors.text.primary)}>
          Something went wrong.
        </h1>
        <p className={cn("mt-3", t.body, colors.text.muted)}>
          The page hit an unexpected error. Try reloading; if the
          problem persists, share the reference ID below with
          platform-owners@acme.io.
        </p>
        {error.digest ? (
          <p
            className={cn(
              "mt-6 inline-block px-3 py-1.5 font-mono",
              radius.md,
              colors.bg.muted,
              colors.text.faint,
              t.caption,
            )}
            data-testid="error-digest"
          >
            ref&nbsp;
            <span className={colors.text.primary}>{error.digest}</span>
          </p>
        ) : null}
        <div className="mt-8 flex items-center justify-center gap-x-3">
          <Button variant="primary" onClick={reset} size="md">
            Try again
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              if (typeof window !== "undefined") window.location.href = "/";
            }}
          >
            Go home
          </Button>
        </div>
      </div>
    </main>
  );
}
