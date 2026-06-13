/**
 * Sub-spec C T15 (2026-05-28) — operator-submitted suggestion to
 * formalize an unrecognized:* label as a curated taxonomy entry.
 * Backend stores in core.taxonomy_suggestions; IDP team reviews
 * out-of-band.
 */

"use client";

import { useEffect, useState } from "react";

import { Modal } from "@/components/ui/overlays/Modal";
import { cn } from "@/lib/cn";
import { colors, motion, radius, type as t } from "@/lib/design-tokens";
import type { TaxonomySuggestionV1 } from "@/lib/api/admin";

const CANONICAL_LABEL_REGEX =
  /^(default|(lang|framework|infra|topic|org|version):[a-z][a-z0-9_-]*)$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SuggestTaxonomyModalProps {
  open: boolean;
  unrecognizedLabel: string;
  onConfirm: (body: TaxonomySuggestionV1) => void;
  onCancel: () => void;
  submitting?: boolean;
  errorMessage?: string;
}

export function SuggestTaxonomyModal({
  open,
  unrecognizedLabel,
  onConfirm,
  onCancel,
  submitting,
  errorMessage,
}: SuggestTaxonomyModalProps) {
  const [proposed, setProposed] = useState("");
  const [rationale, setRationale] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!open) {
      setProposed("");
      setRationale("");
      setEmail("");
    }
  }, [open]);

  const proposedValid = CANONICAL_LABEL_REGEX.test(proposed);
  const rationaleValid =
    rationale.trim().length >= 20 && rationale.length <= 2000;
  const emailValid = email === "" || EMAIL_REGEX.test(email);
  const formValid = proposedValid && rationaleValid && emailValid;

  const submit = () => {
    if (!formValid) return;
    const body: TaxonomySuggestionV1 = {
      schema_version: 1,
      label: unrecognizedLabel,
      proposed_canonical_label: proposed,
      rationale: rationale.trim(),
      suggester_email: email.trim() === "" ? null : email.trim(),
    };
    onConfirm(body);
  };

  return (
    <Modal
      open={open}
      onClose={(next) => {
        if (!next) onCancel();
      }}
      title={`Suggest taxonomy entry for ${unrecognizedLabel}`}
      description="Propose a curated label name; the IDP team will review and may add it to the platform taxonomy."
      iconTone="info"
      primaryAction={{
        label: submitting ? "Submitting…" : "Submit",
        onClick: submit,
        disabled: !formValid || Boolean(submitting),
      }}
      secondaryAction={{ label: "Cancel", onClick: onCancel }}
    >
      <div className="space-y-4">
        <div>
          <label
            htmlFor="suggest-proposed"
            className={cn("block", t.meta, colors.text.primary)}
          >
            Proposed canonical label
          </label>
          <input
            id="suggest-proposed"
            type="text"
            value={proposed}
            onChange={(e) => setProposed(e.target.value.toLowerCase())}
            placeholder="lang:cobol"
            autoComplete="off"
            spellCheck={false}
            className={_inputClass}
          />
          <p className={cn("mt-1", t.caption, colors.text.faint)}>
            Format: <code>default</code> or{" "}
            <code>(lang|framework|infra|topic|org|version):value</code>
          </p>
          {proposed.length > 0 && !proposedValid ? (
            <p className={cn("mt-1", t.caption, colors.status.down)}>
              Doesn&apos;t match the canonical-label pattern.
            </p>
          ) : null}
        </div>
        <div>
          <label
            htmlFor="suggest-rationale"
            className={cn("block", t.meta, colors.text.primary)}
          >
            Rationale
          </label>
          <textarea
            id="suggest-rationale"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="Why should the platform curate this label?"
            rows={4}
            className={_inputClass}
          />
          <p className={cn("mt-1", t.caption, colors.text.faint)}>
            {rationale.trim().length} / 2000 (minimum 20)
          </p>
        </div>
        <div>
          <label
            htmlFor="suggest-email"
            className={cn("block", t.meta, colors.text.primary)}
          >
            Your email (optional)
          </label>
          <input
            id="suggest-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="off"
            className={_inputClass}
          />
          {email.length > 0 && !emailValid ? (
            <p className={cn("mt-1", t.caption, colors.status.down)}>
              Enter a valid email or leave blank.
            </p>
          ) : null}
        </div>
        {errorMessage ? (
          <p
            role="alert"
            className={cn(
              "px-3 py-2",
              radius.sm,
              t.body,
              colors.status.down,
            )}
          >
            {errorMessage}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

const _inputClass = cn(
  "mt-1 block w-full px-3 py-2",
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
