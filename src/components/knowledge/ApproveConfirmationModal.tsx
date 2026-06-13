/**
 * Sprint 12 / S12.2.4 — approve-confirmation modal.
 *
 * Locked UX (sprint-12.md AC #7):
 *   - Required confirmation step before any approve fires.
 *   - Renders the proposal's title + body in full so the
 *     reviewer reads the whole thing one last time.
 *   - For tenant-wide proposals (`repo === null`), a typed-
 *     confirmation field gates the Confirm button: the user
 *     must type `approve tenant-wide` exactly. Repo-scoped
 *     proposals skip the typed gate.
 *
 * Composes the locked `Modal` primitive so the focus-trap, ARIA
 * `aria-labelledby`, motion timings, and design tokens all match
 * other modals in the app.
 */

"use client";

import { useState } from "react";

import { Modal } from "@/components/ui/overlays/Modal";
import { cn } from "@/lib/cn";
import { colors, motion, radius, type as t } from "@/lib/design-tokens";
import type { ProposalV1 } from "@/lib/api/knowledge";

const TYPED_CONFIRM_PHRASE = "approve tenant-wide";

export interface ApproveConfirmationModalProps {
  open: boolean;
  proposal: ProposalV1;
  onConfirm: () => void;
  onCancel: () => void;
  /** Surface a server error inline (e.g., 503 retry-after). */
  errorMessage?: string;
  /** Disable the primary while the request is in flight. */
  submitting?: boolean;
}

export function ApproveConfirmationModal({
  open,
  proposal,
  onConfirm,
  onCancel,
  errorMessage,
  submitting,
}: ApproveConfirmationModalProps) {
  const isTenantWide = proposal.repo === null;
  const [typed, setTyped] = useState("");
  const typedOk = !isTenantWide || typed.trim() === TYPED_CONFIRM_PHRASE;

  const handleClose = (next: boolean) => {
    if (!next) {
      setTyped("");
      onCancel();
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={
        isTenantWide
          ? "Approve learning, tenant-wide"
          : "Approve learning"
      }
      description={
        isTenantWide
          ? "This learning will fire on every review across every repo in the tenant. Read the body below; type the confirmation phrase to enable the Approve button."
          : `This learning will fire on every review against ${proposal.repo}.`
      }
      iconTone="warning"
      primaryAction={{
        label: submitting ? "Approving…" : "Approve",
        onClick: onConfirm,
        disabled: !typedOk || Boolean(submitting),
      }}
      secondaryAction={{ label: "Cancel", onClick: onCancel }}
    >
      <div className="space-y-4">
        <div>
          <p className={cn(t.caption, colors.text.faint, "uppercase tracking-wider")}>
            Proposal title
          </p>
          <p className={cn("mt-1", t.bodyStrong, colors.text.primary)}>
            {proposal.title}
          </p>
        </div>
        <div>
          <p className={cn(t.caption, colors.text.faint, "uppercase tracking-wider")}>
            Proposal body
          </p>
          <p
            className={cn(
              "mt-1 max-h-48 overflow-y-auto",
              t.body,
              colors.text.muted,
              "leading-6",
            )}
          >
            {proposal.body_markdown.length > 280
              ? proposal.body_markdown.slice(0, 280) + "…"
              : proposal.body_markdown}
          </p>
        </div>
        {isTenantWide ? (
          <div>
            <label
              htmlFor="approve-typed-confirm"
              className={cn(
                "block",
                t.meta,
                colors.text.primary,
              )}
            >
              Type{" "}
              <code
                className={cn(
                  "px-1 py-0.5",
                  radius.sm,
                  colors.bg.muted,
                  "font-mono",
                )}
              >
                {TYPED_CONFIRM_PHRASE}
              </code>{" "}
              to confirm
            </label>
            <input
              id="approve-typed-confirm"
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className={cn(
                "mt-2 block w-full px-3 py-2",
                radius.sm,
                t.body,
                colors.bg.surface,
                colors.text.primary,
                "outline-1 -outline-offset-1",
                "outline-[oklch(80%_0.01_80)] dark:outline-[oklch(40%_0.014_270)]",
                "focus:outline-2 focus:-outline-offset-2",
                "focus:outline-[oklch(72%_0.16_65)]",
                motion.fast,
              )}
            />
          </div>
        ) : null}
        {errorMessage ? (
          <p
            role="alert"
            className={cn(
              "px-3 py-2",
              radius.sm,
              t.body,
              "bg-[oklch(94%_0.06_25)] dark:bg-[oklch(26%_0.10_25)]",
              "text-[oklch(45%_0.14_25)] dark:text-[oklch(80%_0.12_25)]",
            )}
          >
            {errorMessage}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
