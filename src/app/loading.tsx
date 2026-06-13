/**
 * Sprint X.7 (2026-05-11) — app-level loading state.
 *
 * Next.js convention file: rendered while a route segment's data
 * is loading on the server side (Suspense boundary). Keeps the
 * navigation from blanking to white between page-paint.
 *
 * Per-page <Loading> components (under `components/ui/states/`)
 * remain in use for in-page spinners; this is the framework-
 * level fallback for the first paint of every route.
 *
 * Tracked: docs/superpowers/plans/2026-05-11-frontend-FINAL-sprint-plan.md
 *         → Sprint X / X.7.
 */

import type { JSX } from "react";

import { Loading } from "@/components/ui/states/Loading";
import { cn } from "@/lib/cn";
import { colors } from "@/lib/design-tokens";

export default function AppLoading(): JSX.Element {
  return (
    <main
      id="main-content"
      className={cn(
        "min-h-screen flex items-center justify-center",
        colors.bg.surface,
      )}
    >
      <Loading label="Loading…" />
    </main>
  );
}
