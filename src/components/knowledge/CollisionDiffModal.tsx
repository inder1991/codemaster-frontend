/**
 * Sprint 12 / S12.2.4 — collision-diff modal.
 *
 * Locked UX (sprint-12.md AC #6):
 *   - Fires on a 409 stale-write response from the PUT endpoint.
 *   - Side-by-side diff: Yours (left) vs Server (right). Server
 *     panel labels who edited it and how long ago.
 *   - THREE actions:
 *       1. Use mine (overwrite) — primary, danger-toned because
 *          it overwrites someone else's edit.
 *       2. Use theirs (discard mine) — secondary; closes the
 *          editor session and discards local body.
 *       3. Cancel — keep editing locally; do nothing.
 *
 * Purpose-built dialog (does not compose `Modal`) because the
 * three-action footer + side-by-side body grid don't fit the
 * Modal primitive's two-action assumption.
 */

"use client";

import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { ArrowsRightLeftIcon } from "@heroicons/react/24/outline";

import { Button } from "@/components/ui/elements/Button";
import { cn } from "@/lib/cn";
import {
  colors,
  elevation,
  motion,
  radius,
  type as t,
} from "@/lib/design-tokens";

export interface CollisionDiffModalProps {
  open: boolean;
  /** Local in-flight body the user just tried to PUT. */
  yourBody: string;
  /** Server's current body returned in the 409 response. */
  serverBody: string;
  /** Who clobbered it on the server. */
  serverEditedBy: string;
  /** Locale-formatted relative time, e.g. "12 minutes ago". */
  serverEditedAtLabel: string;
  onUseMine: () => void;
  onUseTheirs: () => void;
  onCancel: () => void;
  submitting?: boolean;
}

export function CollisionDiffModal({
  open,
  yourBody,
  serverBody,
  serverEditedBy,
  serverEditedAtLabel,
  onUseMine,
  onUseTheirs,
  onCancel,
  submitting,
}: CollisionDiffModalProps) {
  return (
    <Dialog
      open={open}
      onClose={() => onCancel()}
      className="relative z-50"
    >
      <DialogBackdrop
        transition
        className={cn(
          "fixed inset-0",
          "bg-[oklch(20%_0.01_80)]/80",
          "transition-opacity duration-[160ms] ease-out data-closed:opacity-0",
        )}
      />
      <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <DialogPanel
            transition
            className={cn(
              "relative w-full transform overflow-hidden text-left",
              "transition-all data-closed:translate-y-4 data-closed:opacity-0 data-closed:scale-95",
              "sm:my-8 sm:w-full sm:max-w-4xl",
              radius.lg,
              colors.bg.elevated,
              "border",
              colors.border.default,
              elevation.modal,
            )}
          >
            {/* Header */}
            <div
              className={cn(
                "flex items-start gap-x-3 px-6 pt-6 pb-4",
                "border-b",
                colors.border.default,
              )}
            >
              <div
                className={cn(
                  "inline-flex size-10 shrink-0 items-center justify-center rounded-full",
                  "bg-[oklch(94%_0.06_80)] dark:bg-[oklch(26%_0.10_80)]",
                  "text-[oklch(78%_0.16_80)] dark:text-[oklch(82%_0.16_80)]",
                )}
              >
                <ArrowsRightLeftIcon aria-hidden="true" className="size-5" />
              </div>
              <div className="flex-1">
                <DialogTitle as="h3" className={cn(t.h3, colors.text.primary)}>
                  Edit conflict
                </DialogTitle>
                <p className={cn("mt-1", t.body, colors.text.muted)}>
                  <span className={cn(colors.text.primary, "font-medium")}>
                    {serverEditedBy}
                  </span>{" "}
                  saved a different version {serverEditedAtLabel}. Pick which
                  copy wins, or cancel and keep editing.
                </p>
              </div>
            </div>

            {/* Side-by-side diff */}
            <div className="grid grid-cols-1 sm:grid-cols-2">
              <DiffPanel
                heading="Yours"
                subheading="Local edit, not yet saved"
                body={yourBody}
                tone="local"
              />
              <DiffPanel
                heading="Server"
                subheading={`Edited by ${serverEditedBy}, ${serverEditedAtLabel}`}
                body={serverBody}
                tone="server"
              />
            </div>

            {/* Footer with three actions */}
            <div
              className={cn(
                "flex flex-wrap items-center justify-end gap-2 px-6 py-4",
                "border-t",
                colors.border.default,
              )}
            >
              <Button variant="ghost" size="md" onClick={onCancel}>
                Cancel, keep editing
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={onUseTheirs}
                disabled={submitting}
              >
                Use theirs, discard mine
              </Button>
              <Button
                variant="danger"
                size="md"
                onClick={onUseMine}
                disabled={submitting}
              >
                {submitting ? "Saving…" : "Use mine, overwrite"}
              </Button>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}

function DiffPanel({
  heading,
  subheading,
  body,
  tone,
}: {
  heading: string;
  subheading: string;
  body: string;
  tone: "local" | "server";
}) {
  return (
    <div
      className={cn(
        "px-5 py-4",
        tone === "local" ? colors.bg.elevated : colors.bg.muted,
        // Right panel gets a left border to separate. Stacks on
        // small viewports — the left panel gets a bottom border
        // instead.
        tone === "server"
          ? "border-t sm:border-t-0 sm:border-l"
          : "",
        colors.border.default,
      )}
    >
      <p
        className={cn(
          t.caption,
          colors.text.faint,
          "uppercase tracking-wider",
        )}
      >
        {heading}
      </p>
      <p className={cn("mt-1", t.meta, colors.text.muted)}>{subheading}</p>
      <pre
        className={cn(
          "mt-3 max-h-72 overflow-auto whitespace-pre-wrap font-mono",
          t.body,
          colors.text.primary,
          motion.fast,
        )}
      >
        {body}
      </pre>
    </div>
  );
}
