/**
 * Sprint 15 / S15.H — EditCostCapOverrideModal.
 *
 * Adds (or edits) a per-tenant cost-cap override. Same dollar
 * input + validation as `EditCostCapModal`, plus an
 * `installation_id` selector and an optional `expires_at` for
 * temporary boosts (auto-revert).
 *
 * Submits a `CostCapChangeRequestV1` with target_kind =
 * "per_org_override"; the second-person-approval flow is
 * identical.
 */

"use client";

import { useState } from "react";

import { Modal } from "@/components/ui/overlays/Modal";
import {
  HARD_CEILING_CENTS,
  validateCostCapInput,
} from "@/lib/api/cost-caps";

const DOLLARS_HARD_CEILING = HARD_CEILING_CENTS / 100;

export interface InstallationOption {
  installation_id: string;
  installation_name: string;
}

export interface EditCostCapOverrideModalProps {
  open: boolean;
  onClose: () => void;
  /** Pre-fill the form when editing an existing override. None
   *  for the "+ Add override" path. */
  initial?: {
    installation_id: string;
    installation_name: string;
    cap_cents: number;
    expires_at: string | null;
  } | null;
  installationOptions: InstallationOption[];
  onSubmit: (args: {
    installationId: string;
    newCapCents: number;
    expiresAt: string | null;
  }) => void;
  submitting?: boolean;
  errorMessage?: string | null;
  now?: Date;
}

export function EditCostCapOverrideModal({
  open,
  onClose,
  initial,
  installationOptions,
  onSubmit,
  submitting = false,
  errorMessage = null,
  now,
}: EditCostCapOverrideModalProps) {
  const [installationId, setInstallationId] = useState<string>(
    initial?.installation_id ?? installationOptions[0]?.installation_id ?? "",
  );
  const [dollars, setDollars] = useState<string>(
    initial ? (initial.cap_cents / 100).toString() : "",
  );
  const [expiresAt, setExpiresAt] = useState<string>(initial?.expires_at ?? "");
  const [touched, setTouched] = useState(false);

  const parsed = parseDollarString(dollars);
  const newCapCents = parsed === null ? -1 : Math.round(parsed * 100);
  const expiresAtIso =
    expiresAt.trim() === "" ? null : new Date(expiresAt).toISOString();

  const validation =
    parsed === null
      ? { field: "new_cap_cents" as const, message: "Enter a dollar amount." }
      : !installationId
        ? { field: "target_id" as const, message: "Select an installation." }
        : validateCostCapInput({
            newCapCents,
            targetKind: "per_org_override",
            targetId: installationId,
            expiresAt: expiresAtIso,
            now: now ?? new Date(),
          });

  const title = initial ? "Edit per-tenant override" : "Add per-tenant override";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description="Override the default per-org cap for one tenant. Optional expiry auto-reverts to the default."
      primaryAction={{
        label: submitting ? "Submitting…" : "Queue for approval",
        onClick: () => {
          setTouched(true);
          if (validation === null && parsed !== null && installationId) {
            onSubmit({
              installationId,
              newCapCents,
              expiresAt: expiresAtIso,
            });
          }
        },
        disabled: submitting || validation !== null,
      }}
      secondaryAction={{ label: "Cancel", onClick: onClose }}
    >
      <div className="mt-3 space-y-3 text-sm">
        <div>
          <label
            htmlFor="override-installation"
            className="block font-medium text-gray-700 dark:text-gray-200"
          >
            Installation
          </label>
          <select
            id="override-installation"
            value={installationId}
            onChange={(e) => {
              setInstallationId(e.target.value);
              setTouched(true);
            }}
            disabled={!!initial}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            data-testid="override-installation-select"
          >
            {installationOptions.map((opt) => (
              <option key={opt.installation_id} value={opt.installation_id}>
                {opt.installation_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="override-cap-dollars"
            className="block font-medium text-gray-700 dark:text-gray-200"
          >
            Cap (USD/day)
          </label>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              $
            </span>
            <input
              id="override-cap-dollars"
              type="text"
              inputMode="decimal"
              value={dollars}
              onChange={(e) => {
                setDollars(e.target.value);
                setTouched(true);
              }}
              className="block w-full rounded-md border border-gray-300 bg-white pl-7 pr-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              data-testid="override-cap-input"
            />
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Maximum: ${DOLLARS_HARD_CEILING.toLocaleString()}/day.
          </p>
        </div>
        <div>
          <label
            htmlFor="override-expires-at"
            className="block font-medium text-gray-700 dark:text-gray-200"
          >
            Expires at (optional)
          </label>
          <input
            id="override-expires-at"
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => {
              setExpiresAt(e.target.value);
              setTouched(true);
            }}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            data-testid="override-expires-input"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Leave blank for a permanent override; pick a future date for a
            temporary boost that auto-reverts.
          </p>
        </div>
        {touched && validation !== null && (
          <p
            className="text-sm text-red-600 dark:text-red-400"
            data-testid="override-validation-error"
          >
            {validation.message}
          </p>
        )}
        {errorMessage && (
          <p
            className="text-sm text-red-600 dark:text-red-400"
            data-testid="override-submit-error"
          >
            {errorMessage}
          </p>
        )}
      </div>
    </Modal>
  );
}

function parseDollarString(raw: string): number | null {
  const trimmed = raw.trim().replace(/,/g, "");
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}
