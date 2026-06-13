/**
 * Sprint 12 / S12.2.4 — reject-proposal modal.
 *
 * Locked UX (sprint-12.md AC #8):
 *   - Reason field required, min_length=10 enforced client-side
 *     (server enforces too — this is the soft gate).
 *   - Reject button stays disabled until valid.
 *   - Live character counter so the user can see when they cross
 *     the threshold.
 */

"use client";

import { useState } from "react";

import { Modal } from "@/components/ui/overlays/Modal";
import { cn } from "@/lib/cn";
import { colors, motion, radius, type as t } from "@/lib/design-tokens";
import type { ProposalV1 } from "@/lib/api/knowledge";

const MIN_REASON_LENGTH = 10;

export interface RejectModalProps {
  open: boolean;
  proposal: ProposalV1;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  errorMessage?: string;
  submitting?: boolean;
}

export function RejectModal({
  open,
  proposal,
  onConfirm,
  onCancel,
  errorMessage,
  submitting,
}: RejectModalProps) {
  const [reason, setReason] = useState("");
  const trimmedLen = reason.trim().length;
  const valid = trimmedLen >= MIN_REASON_LENGTH;

  const handleClose = (next: boolean) => {
    if (!next) {
      setReason("");
      onCancel();
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Reject learning proposal"
      description={`The reviewer who nominated "${proposal.title}" will see your reason. Be specific — the reason becomes part of the audit trail.`}
      iconTone="danger"
      primaryAction={{
        label: submitting ? "Rejecting…" : "Reject",
        onClick: () => onConfirm(reason.trim()),
        disabled: !valid || Boolean(submitting),
        variant: "danger",
      }}
      secondaryAction={{ label: "Cancel", onClick: onCancel }}
    >
      <div className="space-y-3">
        <label
          htmlFor="reject-reason"
          className={cn("block", t.meta, colors.text.primary)}
        >
          Reason for rejection
        </label>
        <textarea
          id="reject-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          placeholder="e.g., This is already covered by L-203, which fires on the same finding."
          className={cn(
            "block w-full px-3 py-2 resize-y",
            radius.sm,
            t.body,
            colors.bg.surface,
            colors.text.primary,
            "outline-1 -outline-offset-1",
            "outline-[oklch(80%_0.01_80)] dark:outline-[oklch(40%_0.014_270)]",
            "placeholder:text-[oklch(60%_0.006_80)]",
            "focus:outline-2 focus:-outline-offset-2",
            "focus:outline-[oklch(72%_0.16_65)]",
            motion.fast,
          )}
        />
        <p
          className={cn(
            t.caption,
            valid ? colors.text.faint : colors.text.muted,
          )}
        >
          {valid ? (
            <>
              <span className="tabular-nums">{trimmedLen}</span> characters
            </>
          ) : (
            <>
              <span className="tabular-nums">{trimmedLen}</span> /{" "}
              <span className="tabular-nums">{MIN_REASON_LENGTH}</span>{" "}
              minimum characters
            </>
          )}
        </p>
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
