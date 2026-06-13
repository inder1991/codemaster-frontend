/**
 * Sprint 12 / S12.1.1b — Error state component.
 *
 * Surfaces a user-actionable error with the optional
 * `correlationId` operators paste into support tickets.
 */

import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import type { JSX } from "react";

import { cn } from "@/lib/cn";
import {
  colors,
  motion,
  radius,
  type as t,
} from "@/lib/design-tokens";

export interface ErrorProps {
  title: string;
  body?: string;
  correlationId?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title,
  body,
  correlationId,
  onRetry,
}: ErrorProps): JSX.Element {
  return (
    <div
      role="alert"
      className={cn(
        "border p-4",
        radius.md,
        colors.statusBg.down,
        colors.border.default,
      )}
    >
      <div className="flex">
        <ExclamationTriangleIcon
          aria-hidden="true"
          className={cn("size-5 shrink-0", colors.status.down)}
        />
        <div className="ml-3 flex-1">
          <h3 className={cn(t.bodyStrong, colors.status.down)}>{title}</h3>
          {body ? (
            <p className={cn("mt-1", t.body, colors.text.muted)}>{body}</p>
          ) : null}
          {correlationId ? (
            <p className={cn("mt-2", t.caption, colors.text.muted)}>
              Correlation ID:{" "}
              <code
                className={cn(
                  "px-1 py-0.5 font-mono",
                  radius.sm,
                  colors.bg.muted,
                  colors.text.primary,
                )}
              >
                {correlationId}
              </code>
            </p>
          ) : null}
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className={cn(
                "mt-3 px-3 py-1.5",
                radius.sm,
                t.bodyStrong,
                colors.status.down,
                "ring-1 ring-inset",
                "ring-[oklch(80%_0.10_25)] dark:ring-[oklch(40%_0.10_25)]",
                "hover:bg-[oklch(90%_0.06_25)] dark:hover:bg-[oklch(30%_0.10_25)]",
                motion.fast,
              )}
            >
              Retry
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
