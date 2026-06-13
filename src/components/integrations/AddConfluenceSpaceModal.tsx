/**
 * Sprint 13 / S13.1.3 — add-Confluence-space modal.
 *
 * Composes the locked `Modal` primitive. Fields:
 *   - Space key (regex-validated against ^[A-Z0-9_-]{1,255}$)
 *   - Space name (free text)
 *   - Scope: whole space vs page tree (radio)
 *   - Page-tree root id (only when scope = page_tree)
 *
 * The Add button is disabled until the form is valid. On submit
 * the parent calls the `/api/admin/integrations/confluence-spaces`
 * endpoint; this component does NOT perform the network call so
 * the parent can swap stub / real impls without changes here.
 */

"use client";

import { useState } from "react";

import { Modal } from "@/components/ui/overlays/Modal";
import type { AddConfluenceSpaceInputV1 } from "@/lib/api/admin";
import { cn } from "@/lib/cn";
import { colors, motion, radius, type as t } from "@/lib/design-tokens";

type ConfluenceScope = AddConfluenceSpaceInputV1["scope"];
type TrustTier = AddConfluenceSpaceInputV1["trust_tier"];
type VisibilityChoice = "platform" | "org";

const SPACE_KEY_REGEX = /^[A-Z0-9_-]{1,255}$/;
const ORG_SLUG_REGEX = /^[a-z][a-z0-9_-]*$/;

export interface AddConfluenceSpaceModalProps {
  open: boolean;
  onConfirm: (input: AddConfluenceSpaceInputV1) => void;
  onCancel: () => void;
  errorMessage?: string;
  submitting?: boolean;
}

export function AddConfluenceSpaceModal({
  open,
  onConfirm,
  onCancel,
  errorMessage,
  submitting,
}: AddConfluenceSpaceModalProps) {
  const [spaceKey, setSpaceKey] = useState("");
  const [spaceName, setSpaceName] = useState("");
  const [scope, setScope] = useState<ConfluenceScope>("whole_space");
  const [rootId, setRootId] = useState("");
  const [trustTier, setTrustTier] = useState<TrustTier>("trusted");
  const [governanceAck, setGovernanceAck] = useState(false);
  const [visibilityChoice, setVisibilityChoice] =
    useState<VisibilityChoice>("platform");
  const [orgSlug, setOrgSlug] = useState("");
  const [strictLabelMode, setStrictLabelMode] = useState(false);

  const keyValid = SPACE_KEY_REGEX.test(spaceKey);
  const nameValid = spaceName.trim().length > 0;
  const rootValid = scope === "whole_space" || rootId.trim().length > 0;
  const orgSlugValid =
    visibilityChoice === "platform" || ORG_SLUG_REGEX.test(orgSlug);
  const formValid = keyValid && nameValid && rootValid && orgSlugValid;

  const reset = () => {
    setSpaceKey("");
    setSpaceName("");
    setScope("whole_space");
    setRootId("");
    setTrustTier("trusted");
    setGovernanceAck(false);
    setVisibilityChoice("platform");
    setOrgSlug("");
    setStrictLabelMode(false);
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      reset();
      onCancel();
    }
  };

  const submit = () =>
    onConfirm({
      space_key: spaceKey,
      space_name: spaceName.trim(),
      scope,
      page_tree_root_id: scope === "page_tree" ? rootId.trim() : null,
      trust_tier: trustTier,
      governance_ack: governanceAck,
      visibility:
        visibilityChoice === "platform" ? "platform" : `org:${orgSlug}`,
      strict_label_mode: strictLabelMode,
    });

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add a Confluence space"
      description="Codemaster will ingest this space's pages on a 30-minute cycle and surface them in review citations."
      iconTone="info"
      primaryAction={{
        label: submitting ? "Validating…" : "Add",
        onClick: submit,
        disabled: !formValid || Boolean(submitting),
      }}
      secondaryAction={{ label: "Cancel", onClick: onCancel }}
    >
      <div className="space-y-4">
        <Field
          id="confluence-space-key"
          label="Space key"
          hint="Atlassian space key (uppercase letters, digits, _ -)"
          {...(spaceKey.length > 0 && !keyValid
            ? { error: "Invalid format. Use A-Z, 0-9, _ or - only." }
            : {})}
          mono
        >
          <input
            id="confluence-space-key"
            type="text"
            value={spaceKey}
            onChange={(e) => setSpaceKey(e.target.value.toUpperCase())}
            placeholder="ACME"
            autoComplete="off"
            spellCheck={false}
            className={inputClass}
          />
        </Field>
        <Field id="confluence-space-name" label="Display name">
          <input
            id="confluence-space-name"
            type="text"
            value={spaceName}
            onChange={(e) => setSpaceName(e.target.value)}
            placeholder="Acme Engineering Wiki"
            autoComplete="off"
            className={inputClass}
          />
        </Field>
        <fieldset className="space-y-2">
          <legend className={cn(t.meta, colors.text.primary)}>Scope</legend>
          <div className="space-y-1.5">
            <ScopeRadio
              checked={scope === "whole_space"}
              onChange={() => setScope("whole_space")}
              label="Whole space"
              description="Ingest every page; deletions are mirrored automatically."
            />
            <ScopeRadio
              checked={scope === "page_tree"}
              onChange={() => setScope("page_tree")}
              label="Page tree"
              description="Ingest only descendants of one root page."
            />
          </div>
        </fieldset>
        {scope === "page_tree" ? (
          <Field id="confluence-root-id" label="Root page id">
            <input
              id="confluence-root-id"
              type="text"
              value={rootId}
              onChange={(e) => setRootId(e.target.value)}
              placeholder="123456"
              autoComplete="off"
              className={inputClass}
            />
          </Field>
        ) : null}
        <fieldset className="space-y-2">
          <legend className={cn(t.meta, colors.text.primary)}>Trust tier</legend>
          <div className="space-y-1.5">
            <ScopeRadio
              checked={trustTier === "trusted"}
              onChange={() => setTrustTier("trusted")}
              label="Trusted"
              description="Surfaces in the trusted knowledge tier — for system-authoritative content."
            />
            <ScopeRadio
              checked={trustTier === "semi"}
              onChange={() => setTrustTier("semi")}
              label="Semi-trusted"
              description="Surfaces in the semi tier — appropriate for user-authored policy and design docs."
            />
          </div>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className={cn(t.meta, colors.text.primary)}>Visibility</legend>
          <div className="space-y-1.5">
            <ScopeRadio
              checked={visibilityChoice === "platform"}
              onChange={() => setVisibilityChoice("platform")}
              label="Platform-wide"
              description="Every installation can retrieve from this space."
            />
            <ScopeRadio
              checked={visibilityChoice === "org"}
              onChange={() => setVisibilityChoice("org")}
              label="Scoped to org"
              description="Only the named org can retrieve from this space."
            />
          </div>
        </fieldset>
        {visibilityChoice === "org" ? (
          <Field
            id="confluence-org-slug"
            label="Org slug"
            hint="Lowercase letters, digits, _ or -. Prefixed with `org:` on submit."
            {...(orgSlug.length > 0 && !ORG_SLUG_REGEX.test(orgSlug)
              ? { error: "Invalid slug. Start with a letter; use a-z, 0-9, _ or -." }
              : {})}
            mono
          >
            <input
              id="confluence-org-slug"
              type="text"
              value={orgSlug}
              onChange={(e) => setOrgSlug(e.target.value.toLowerCase())}
              placeholder="acme-eng"
              autoComplete="off"
              spellCheck={false}
              className={inputClass}
            />
          </Field>
        ) : null}
        <CheckboxField
          id="confluence-strict-label-mode"
          checked={strictLabelMode}
          onChange={setStrictLabelMode}
          label="Strict label mode"
          description="Reject pages whose labels are NOT in the platform-exposed taxonomy."
        />
        <CheckboxField
          id="confluence-governance-ack"
          checked={governanceAck}
          onChange={setGovernanceAck}
          label="Governance acknowledgement"
          description="I confirm IDP-team / board-level approval was obtained for this space's data to be ingested by codemaster."
        />
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

function Field({
  id,
  label,
  hint,
  error,
  mono,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  mono?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className={cn(
          "block",
          t.meta,
          colors.text.primary,
          mono && "font-mono",
        )}
      >
        {label}
      </label>
      {children}
      {hint ? (
        <p className={cn("mt-1", t.caption, colors.text.faint)}>{hint}</p>
      ) : null}
      {error ? (
        <p className={cn("mt-1", t.caption, colors.status.down)}>{error}</p>
      ) : null}
    </div>
  );
}

function ScopeRadio({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  description: string;
}) {
  const id = `confluence-scope-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div
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
        onChange={onChange}
        className="mt-1 size-4 accent-[oklch(72%_0.16_65)] cursor-pointer"
      />
      <label htmlFor={id} className="cursor-pointer">
        <span className={cn("block", t.bodyStrong, colors.text.primary)}>
          {label}
        </span>
        <span className={cn("block mt-0.5", t.meta, colors.text.muted)}>
          {description}
        </span>
      </label>
    </div>
  );
}

function CheckboxField({
  id,
  checked,
  onChange,
  label,
  description,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-x-2 px-3 py-2",
        radius.sm,
        checked ? colors.bg.muted : colors.hover.bg,
        motion.fast,
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-4 accent-[oklch(72%_0.16_65)] cursor-pointer"
      />
      <label htmlFor={id} className="cursor-pointer">
        <span className={cn("block", t.bodyStrong, colors.text.primary)}>
          {label}
        </span>
        <span className={cn("block mt-0.5", t.meta, colors.text.muted)}>
          {description}
        </span>
      </label>
    </div>
  );
}
