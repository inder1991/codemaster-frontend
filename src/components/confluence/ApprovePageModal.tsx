/**
 * Sub-spec C T14 (2026-05-28) — approve a Confluence page for default-
 * corpus inclusion. Carries the 4-field CreatePageApprovalRequestV1
 * body (P0-1 audit-fix: approver_email is INTENTIONALLY absent — the
 * backend derives it from the authenticated session).
 *
 * The 20-char justification minimum matches the backend contract; the
 * URL field is validated against URL constructor; the scope dropdown
 * enumerates the 5 Literal values.
 */

"use client";

import { useEffect, useState } from "react";

import { Modal } from "@/components/ui/overlays/Modal";
import { cn } from "@/lib/cn";
import { colors, motion, radius, type as t } from "@/lib/design-tokens";
import type { CreatePageApprovalRequestV1 } from "@/lib/api/admin";

type DefaultScope = CreatePageApprovalRequestV1["default_scope"];

const SCOPES: ReadonlyArray<{ value: DefaultScope; label: string; hint: string }> = [
  {
    value: "universal",
    label: "Universal",
    hint: "Surfaces in every review regardless of topic.",
  },
  {
    value: "security_only",
    label: "Security only",
    hint: "Surfaces only when the review touches security-tagged paths.",
  },
  {
    value: "compliance_only",
    label: "Compliance only",
    hint: "Surfaces only on compliance-tagged paths.",
  },
  {
    value: "framework_only",
    label: "Framework only",
    hint: "Surfaces only when the review references a known framework.",
  },
  {
    value: "language_only",
    label: "Language only",
    hint: "Surfaces only for the matched programming language.",
  },
];

export interface ApprovePageModalProps {
  open: boolean;
  spaceKey: string;
  pageId: string;
  pageTitle: string;
  onConfirm: (body: CreatePageApprovalRequestV1) => void;
  onCancel: () => void;
  submitting?: boolean;
  errorMessage?: string;
}

export function ApprovePageModal({
  open,
  spaceKey,
  pageId,
  pageTitle,
  onConfirm,
  onCancel,
  submitting,
  errorMessage,
}: ApprovePageModalProps) {
  const [artifactUrl, setArtifactUrl] = useState("");
  const [justification, setJustification] = useState("");
  const [scope, setScope] = useState<DefaultScope>("universal");

  useEffect(() => {
    if (!open) {
      setArtifactUrl("");
      setJustification("");
      setScope("universal");
    }
  }, [open]);

  const urlValid = _isHttpUrl(artifactUrl);
  const justificationValid =
    justification.trim().length >= 20 && justification.length <= 2000;
  const formValid = urlValid && justificationValid;

  const submit = () => {
    if (!formValid) return;
    const body: CreatePageApprovalRequestV1 = {
      schema_version: 1,
      space_key: spaceKey,
      page_id: pageId,
      approved_at_utc: new Date().toISOString(),
      approval_artifact_url: artifactUrl.trim(),
      scope_justification: justification.trim(),
      default_scope: scope,
    };
    onConfirm(body);
  };

  return (
    <Modal
      open={open}
      onClose={(next) => {
        if (!next) onCancel();
      }}
      title={`Approve "${pageTitle}"`}
      description={`Sign off on this page for default-corpus inclusion (${spaceKey} / ${pageId}). Approver identity is recorded from your authenticated session.`}
      iconTone="info"
      primaryAction={{
        label: submitting ? "Approving…" : "Approve",
        onClick: submit,
        disabled: !formValid || Boolean(submitting),
      }}
      secondaryAction={{ label: "Cancel", onClick: onCancel }}
    >
      <div className="space-y-4">
        <div>
          <label
            htmlFor="approve-artifact-url"
            className={cn("block", t.meta, colors.text.primary)}
          >
            Artifact URL
          </label>
          <input
            id="approve-artifact-url"
            type="url"
            value={artifactUrl}
            onChange={(e) => setArtifactUrl(e.target.value)}
            placeholder="https://board.example.com/minutes-42"
            autoComplete="off"
            spellCheck={false}
            className={cn(
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
            )}
          />
          <p className={cn("mt-1", t.caption, colors.text.faint)}>
            Link to the artifact (board minutes, decision doc) backing this
            approval.
          </p>
          {artifactUrl.length > 0 && !urlValid ? (
            <p className={cn("mt-1", t.caption, colors.status.down)}>
              Enter a valid http(s) URL.
            </p>
          ) : null}
        </div>
        <div>
          <label
            htmlFor="approve-justification"
            className={cn("block", t.meta, colors.text.primary)}
          >
            Scope justification
          </label>
          <textarea
            id="approve-justification"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Why is this page safe to include in the default corpus, and what scope?"
            rows={4}
            className={cn(
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
            )}
          />
          <p className={cn("mt-1", t.caption, colors.text.faint)}>
            {justification.trim().length} / 2000 (minimum 20)
          </p>
        </div>
        <fieldset className="space-y-2">
          <legend className={cn(t.meta, colors.text.primary)}>
            Default scope
          </legend>
          <div className="space-y-1.5">
            {SCOPES.map((s) => {
              const id = `approve-scope-${s.value}`;
              const checked = scope === s.value;
              return (
                <div
                  key={s.value}
                  className={cn(
                    "flex items-start gap-x-2 px-3 py-2",
                    radius.sm,
                    checked ? colors.bg.muted : colors.hover.bg,
                    motion.fast,
                  )}
                >
                  <input
                    id={id}
                    type="radio"
                    checked={checked}
                    onChange={() => setScope(s.value)}
                    className="mt-1 size-4 accent-[oklch(72%_0.16_65)] cursor-pointer"
                  />
                  <label htmlFor={id} className="cursor-pointer">
                    <span className={cn("block", t.bodyStrong, colors.text.primary)}>
                      {s.label}
                    </span>
                    <span className={cn("block mt-0.5", t.meta, colors.text.muted)}>
                      {s.hint}
                    </span>
                  </label>
                </div>
              );
            })}
          </div>
        </fieldset>
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

function _isHttpUrl(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  try {
    const u = new URL(trimmed);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
