/**
 * Sprint Y.11 (2026-05-11) — confirm-dangerous-action modal primitive.
 *
 * Reusable two-gate confirm pattern for irreversible / sensitive
 * admin actions. Mirrors the backend contract (`flags.py`,
 * `knowledge.py`, future admin mutation routes) that requires
 * the caller to send both:
 *
 *   * `reason: string` (≥5 chars) — operator's justification,
 *     persisted into the `audit_events` row.
 *   * `typed_confirm_phrase: string` — deliberate friction;
 *     forces the operator to type something like
 *     `delete acme/web` to confirm they understand the scope.
 *
 * Spec line 1687: "Dangerous actions require confirmation +
 * reason."
 *
 * The primitive does NOT perform the network call — the parent
 * component owns the `useMutation` so the same modal works
 * against test fakes, MSW, and the real backend without
 * conditionals.
 *
 * For complex flows that need staged commits / two-person
 * approval (FlagEditModal pattern), prefer composing the Modal
 * primitive directly. This primitive is for the common case:
 * one button → typed-confirm + reason → fire.
 */

"use client";

import { useState, type JSX } from "react";

import { Modal } from "@/components/ui/overlays/Modal";

const _MIN_REASON_LENGTH = 5;

export interface ConfirmDangerousActionPayload {
  reason: string;
  typed_confirm_phrase: string;
}

export interface ConfirmDangerousActionModalProps {
  open: boolean;
  /** Title shown in the modal header (e.g., "Delete repository"). */
  title: string;
  /** Body explaining what the action does + the audit-trail
   *  consequence. */
  description: string;
  /** The exact string the operator must type to enable the confirm
   *  button. Compared case-sensitively after `.trim()` (matches the
   *  existing FlagEditModal pattern; mirrors backend's exact-string
   *  compare). */
  expectedPhrase: string;
  /** Pending-label override for the confirm button when submitting.
   *  Default: derives from title (e.g., "Delete repository" →
   *  "Deleting…"). Pass when the auto-derivation reads oddly. */
  pendingLabel?: string;
  onConfirm: (payload: ConfirmDangerousActionPayload) => void;
  onCancel: () => void;
  errorMessage?: string;
  submitting?: boolean;
}

function _derivePendingLabel(title: string): string {
  // "Delete repository" → "Deleting…"; "Remove integration" →
  // "Removing…". Falls back to "Working…" when the title doesn't
  // start with a verb we recognise.
  const verb = title.split(/\s+/)[0]?.toLowerCase();
  if (!verb) return "Working…";
  // Common admin verbs the backend's audit_action enum carries.
  const map: Record<string, string> = {
    delete: "Deleting…",
    remove: "Removing…",
    revoke: "Revoking…",
    disable: "Disabling…",
    rotate: "Rotating…",
    flip: "Flipping…",
    approve: "Approving…",
  };
  return map[verb] ?? "Working…";
}

export function ConfirmDangerousActionModal({
  open,
  title,
  description,
  expectedPhrase,
  pendingLabel,
  onConfirm,
  onCancel,
  errorMessage,
  submitting = false,
}: ConfirmDangerousActionModalProps): JSX.Element | null {
  const [reason, setReason] = useState("");
  const [typedConfirm, setTypedConfirm] = useState("");

  if (!open) return null;

  const reasonTrimmed = reason.trim();
  const typedTrimmed = typedConfirm.trim();
  const reasonValid = reasonTrimmed.length >= _MIN_REASON_LENGTH;
  const phraseValid = typedTrimmed === expectedPhrase;
  const canSubmit = !submitting && reasonValid && phraseValid;

  const handleClose = (nextOpen: boolean): void => {
    if (!nextOpen && !submitting) {
      setReason("");
      setTypedConfirm("");
      onCancel();
    }
  };

  const handleCancel = (): void => {
    if (submitting) return;
    setReason("");
    setTypedConfirm("");
    onCancel();
  };

  const handleConfirm = (): void => {
    if (!canSubmit) return;
    onConfirm({
      reason: reasonTrimmed,
      typed_confirm_phrase: typedTrimmed,
    });
  };

  const derivedPending = pendingLabel ?? _derivePendingLabel(title);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      description={description}
      iconTone="danger"
      primaryAction={{
        label: submitting ? derivedPending : title,
        onClick: handleConfirm,
        disabled: !canSubmit,
        variant: "danger",
      }}
      secondaryAction={{
        label: "Cancel",
        onClick: handleCancel,
        disabled: submitting,
      }}
    >
      <div className="mt-2 space-y-4 text-left">
        <div>
          <label
            htmlFor="dangerous-action-reason"
            className="block text-sm font-medium"
          >
            Reason{" "}
            <span className="text-xs font-normal opacity-70">
              (min {_MIN_REASON_LENGTH} chars; recorded in audit log)
            </span>
          </label>
          <input
            id="dangerous-action-reason"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={submitting}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
            autoComplete="off"
          />
        </div>
        <div>
          <label
            htmlFor="dangerous-action-phrase"
            className="block text-sm font-medium"
          >
            Type to confirm:{" "}
            <code className="font-mono text-xs">{expectedPhrase}</code>
          </label>
          <input
            id="dangerous-action-phrase"
            type="text"
            value={typedConfirm}
            onChange={(e) => setTypedConfirm(e.target.value)}
            disabled={submitting}
            className="mt-1 w-full rounded-md border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
        {errorMessage ? (
          <p
            role="alert"
            className="text-sm text-red-700 dark:text-red-300"
          >
            {errorMessage}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
