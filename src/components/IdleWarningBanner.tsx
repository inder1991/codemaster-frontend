/**
 * Sprint X.9 (2026-05-11) — idle-warning toast.
 *
 * Shows a non-blocking banner ~5 minutes before the idle limit
 * fires. The user picks "Stay signed in" (dismiss; the next user
 * interaction resets the timer anyway) or "Sign out now" (manual
 * logout).
 *
 * The actual timer + activity tracking lives in
 * `frontend/src/lib/auth/use-idle-timer.ts`. This component is
 * just the UI.
 */

"use client";

import { useState } from "react";
import type { JSX } from "react";

import { Button } from "@/components/ui/elements/Button";
import { cn } from "@/lib/cn";
import { colors, radius, type as t } from "@/lib/design-tokens";

export interface IdleWarningBannerProps {
  /**
   * When non-null, the banner is visible. Value is the approximate
   * remaining ms until auto-logout; rendered as "X minutes".
   */
  remainingMs: number | null;
  /** Dismiss the banner without logging out. */
  onDismiss: () => void;
  /** Sign the user out immediately. */
  onSignOut: () => void;
}

export function IdleWarningBanner({
  remainingMs,
  onDismiss,
  onSignOut,
}: IdleWarningBannerProps): JSX.Element | null {
  // Local dismissed state — once dismissed, stays dismissed until
  // the parent flips remainingMs to null + back (i.e., a fresh warn).
  const [dismissed, setDismissed] = useState(false);
  if (remainingMs === null || dismissed) return null;

  const minutes = Math.max(1, Math.round(remainingMs / 60_000));

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="idle-warning-banner"
      className={cn(
        "fixed bottom-4 right-4 z-50 flex items-start gap-x-3 p-4",
        "max-w-sm border shadow-lg",
        radius.md,
        colors.bg.elevated,
        colors.border.default,
      )}
    >
      <div className="flex-1">
        <p className={cn(t.bodyStrong, colors.text.primary)}>
          You&apos;re about to be signed out
        </p>
        <p className={cn("mt-1", t.body, colors.text.muted)}>
          For security, your session will end in about {minutes}{" "}
          minute{minutes === 1 ? "" : "s"} of inactivity.
        </p>
        <div className="mt-3 flex items-center gap-x-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setDismissed(true);
              onDismiss();
            }}
          >
            Stay signed in
          </Button>
          <Button variant="secondary" size="sm" onClick={onSignOut}>
            Sign out now
          </Button>
        </div>
      </div>
    </div>
  );
}
