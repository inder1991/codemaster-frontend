/**
 * Sprint 13 / S13.1.1 — flag-edit modal.
 * Sprint 14 / S14.C — switched the input shape to `FlagListItemV1`
 * from `lib/api/admin` so the kill-switches page can drive it
 * directly with the typed list response. Helpers `isTenantWide` and
 * `expectedTypedConfirmPhrase` are inlined; they were previously
 * exported by the mock file that S14.C deletes.
 *
 * Two modes:
 *   - First approval (flag.pending_second_approver=false): user
 *     types the new value JSON; for tenant-wide flags the typed-
 *     confirmation phrase gate ALSO fires; submit stages the
 *     change.
 *   - Second approval (flag.pending_second_approver=true): user
 *     reviews the staged value side-by-side with the live value;
 *     primary CTA is "Approve & commit" (variant=danger because
 *     the commit is the irreversible step).
 *
 * The Modal primitive is composed for focus-trap + a11y.
 *
 * The modal does NOT perform the network call: the parent page owns
 * the `useMutation` so the same modal works against test fakes,
 * MSW, and the real backend without conditionals here.
 */

"use client";

import { useState } from "react";

import { Modal } from "@/components/ui/overlays/Modal";
import type { FlagListItemV1, FlagScope } from "@/lib/api/admin";
import { cn } from "@/lib/cn";
import { colors, motion, radius, type as t } from "@/lib/design-tokens";

const REASON_PRESETS = ["Cost spike", "P0 incident", "Scheduled maintenance"];

function isTenantWide(scope: FlagScope): boolean {
  return scope === "global";
}

/** Locked typed-confirmation phrase mirrors the backend's
 *  `_typed_confirm_phrase_for` helper in `flags.py`. */
function expectedTypedConfirmPhrase(flagName: string): string {
  return `flip ${flagName}`;
}

export interface FlagEditModalProps {
  open: boolean;
  flag: FlagListItemV1;
  onConfirm: (input: {
    new_value_json: string;
    reason: string;
    typed_confirm_phrase: string | null;
  }) => void;
  onCancel: () => void;
  errorMessage?: string;
  submitting?: boolean;
}

export function FlagEditModal({
  open,
  flag,
  onConfirm,
  onCancel,
  errorMessage,
  submitting,
}: FlagEditModalProps) {
  const tenantWide = isTenantWide(flag.scope);
  const isCommit = flag.pending_second_approver;
  // In commit mode the value is fixed (the staged pending value).
  // In first-approval mode the user types the new value.
  const [draftValue, setDraftValue] = useState(
    isCommit
      ? (flag.pending_value_json ?? "")
      : prettyJSON(flag.value_json),
  );
  const [reason, setReason] = useState("");
  const [typedConfirm, setTypedConfirm] = useState("");

  const expectedPhrase = expectedTypedConfirmPhrase(flag.flag_name);
  const valueValid =
    isCommit ||
    (draftValue.trim().length > 0 && parseable(draftValue));
  const reasonValid = reason.trim().length >= 5;
  const typedConfirmValid = !tenantWide || typedConfirm.trim() === expectedPhrase;
  const canSubmit = valueValid && reasonValid && typedConfirmValid;

  const reset = () => {
    setReason("");
    setTypedConfirm("");
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      reset();
      onCancel();
    }
  };

  const submit = () =>
    onConfirm({
      new_value_json: isCommit
        ? (flag.pending_value_json ?? flag.value_json)
        : compactJSON(draftValue),
      reason: reason.trim(),
      typed_confirm_phrase: tenantWide ? typedConfirm.trim() : null,
    });

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isCommit ? "Approve flag change" : "Stage flag change"}
      description={
        isCommit
          ? "A first approver staged this change. Confirming will commit it; the live value updates immediately and an audit row is written."
          : tenantWide
            ? "Tenant-wide flags require two-person approval. After you stage this change, a second platform owner must approve before it goes live."
            : "Repo-scoped flags still require a second platform owner to approve before going live."
      }
      iconTone={isCommit ? "danger" : "warning"}
      primaryAction={{
        label: submitting
          ? isCommit
            ? "Committing…"
            : "Staging…"
          : isCommit
            ? "Approve & commit"
            : "Stage change",
        onClick: submit,
        disabled: !canSubmit || Boolean(submitting),
        variant: isCommit ? "danger" : "default",
      }}
      secondaryAction={{ label: "Cancel", onClick: onCancel }}
    >
      <div className="space-y-4">
        {/* Before/after diff */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Pane label="Current (live)" tone="neutral">
            {prettyJSON(flag.value_json)}
          </Pane>
          <Pane label={isCommit ? "Staged (pending)" : "Your change"} tone="warning">
            {isCommit ? prettyJSON(flag.pending_value_json ?? "") : draftValue}
          </Pane>
        </div>

        {/* Editor (first-approval mode only) */}
        {!isCommit ? (
          <Field id="flag-value" label="New value (JSON)">
            <textarea
              id="flag-value"
              value={draftValue}
              onChange={(e) => setDraftValue(e.target.value)}
              rows={6}
              spellCheck={false}
              className={cn(
                inputClass,
                "font-mono",
                !valueValid && draftValue.length > 0 && "ring-2 ring-red-500/30",
              )}
            />
            {!valueValid && draftValue.length > 0 ? (
              <p className={cn("mt-1", t.caption, colors.status.down)}>
                Not valid JSON.
              </p>
            ) : null}
          </Field>
        ) : null}

        {/* Reason */}
        <Field
          id="flag-reason"
          label="Reason"
          hint="≥5 chars; chosen preset OR free-form. Becomes part of the audit row."
        >
          <div className="mt-1 flex flex-wrap gap-1.5">
            {REASON_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setReason(p)}
                className={cn(
                  "px-2 py-1",
                  radius.sm,
                  t.caption,
                  reason === p
                    ? cn(colors.bg.muted, colors.text.primary)
                    : cn(colors.text.muted, colors.hover.bg),
                  motion.fast,
                )}
              >
                {p}
              </button>
            ))}
          </div>
          <textarea
            id="flag-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="e.g., Cost spike — Sonnet runaway-decoding incident at 14:22 UTC"
            className={cn(inputClass, "mt-2")}
          />
        </Field>

        {/* Tenant-wide typed-confirm gate */}
        {tenantWide ? (
          <Field
            id="flag-typed-confirm"
            label="Typed confirmation"
            hint={`Type ${"`"}${expectedPhrase}${"`"} to confirm.`}
          >
            <input
              id="flag-typed-confirm"
              type="text"
              value={typedConfirm}
              onChange={(e) => setTypedConfirm(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className={cn(inputClass, "font-mono")}
            />
          </Field>
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

const inputClass = cn(
  "block w-full px-3 py-2",
  radius.sm,
  t.body,
  colors.bg.surface,
  colors.text.primary,
  "outline-1 -outline-offset-1",
  "outline-[oklch(80%_0.01_80)] dark:outline-[oklch(40%_0.014_270)]",
  "focus:outline-2 focus:-outline-offset-2",
  "focus:outline-[oklch(72%_0.16_65)]",
  motion.fast,
);

function Pane({
  label,
  tone,
  children,
}: {
  label: string;
  tone: "neutral" | "warning";
  children: React.ReactNode;
}) {
  const bg =
    tone === "warning"
      ? "bg-[oklch(94%_0.06_80)] dark:bg-[oklch(26%_0.10_80)]"
      : colors.bg.muted;
  return (
    <div className={cn("px-3 py-2", radius.sm, bg)}>
      <p
        className={cn(
          t.caption,
          colors.text.faint,
          "uppercase tracking-wider",
        )}
      >
        {label}
      </p>
      <pre
        className={cn(
          "mt-1 max-h-32 overflow-auto whitespace-pre-wrap font-mono",
          t.meta,
          colors.text.primary,
        )}
      >
        {children}
      </pre>
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className={cn("block", t.meta, colors.text.primary)}
      >
        {label}
      </label>
      {children}
      {hint ? (
        <p className={cn("mt-1", t.caption, colors.text.faint)}>{hint}</p>
      ) : null}
    </div>
  );
}

function prettyJSON(json: string): string {
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}

function compactJSON(json: string): string {
  try {
    return JSON.stringify(JSON.parse(json));
  } catch {
    return json;
  }
}

function parseable(json: string): boolean {
  try {
    JSON.parse(json);
    return true;
  } catch {
    return false;
  }
}
