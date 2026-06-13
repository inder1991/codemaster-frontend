/**
 * Sprint X.7 (2026-05-11) — app-level 404 page.
 *
 * Next.js convention file: navigating to an undefined route (or
 * calling `notFound()` from a server component) renders this
 * instead of the framework default. Server component — no
 * "use client" — so the 404 doesn't pull React Query, design-
 * system Client Components, or the SidebarShell into the bundle.
 *
 * Tracked: docs/superpowers/plans/2026-05-11-frontend-FINAL-sprint-plan.md
 *         → Sprint X / X.7.
 */

import Link from "next/link";
import type { JSX } from "react";

import { cn } from "@/lib/cn";
import { colors, radius, type as t } from "@/lib/design-tokens";

export default function NotFound(): JSX.Element {
  return (
    <main
      id="main-content"
      className={cn(
        "min-h-screen flex items-center justify-center px-6 py-12",
        colors.bg.surface,
      )}
    >
      <div className="w-full max-w-md text-center">
        <p
          className={cn(
            "inline-block px-3 py-1 font-mono",
            radius.md,
            colors.bg.muted,
            colors.text.faint,
            t.caption,
          )}
        >
          404
        </p>
        <h1 className={cn("mt-4", t.display, colors.text.primary)}>
          Page not found.
        </h1>
        <p className={cn("mt-3", t.body, colors.text.muted)}>
          The page you&apos;re looking for doesn&apos;t exist or has been
          moved. If you followed a link from another tool, that link
          may be stale.
        </p>
        <div className="mt-8">
          <Link
            href="/"
            className={cn(
              "inline-flex items-center justify-center px-4 py-2",
              radius.md,
              colors.accent.solid,
              colors.accent.onSolid,
              t.bodyStrong,
            )}
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
