/**
 * Sprint 15 / S15.H — EditCostCapModal.
 *
 * Edits the global or per_org_default cap. Submits as a
 * `CostCapChangeRequestV1` (state="pending"); the actual cap
 * change applies only after a SECOND user approves via
 * `PendingChangesTable`. Hard ceiling 5_000_000 cents = $50,000
 * is rejected client-side via `validateCostCapInput` before the
 * round-trip; the backend's Pydantic Field enforces it again.
 */

"use client";

import { useState } from "react";

import { Modal } from "@/components/ui/overlays/Modal";
import {
  HARD_CEILING_CENTS,
  validateCostCapInput,
  type CostCapTargetKind,
} from "@/lib/api/cost-caps";

export interface EditCostCapModalProps {
  open: boolean;
  onClose: () => void;
  /** "global" or "per_org_default" — global cap is the platform-
   *  wide ceiling; per_org_default is the floor each tenant
   *  starts at unless an override is set. */
  targetKind: Extract<CostCapTargetKind, "global" | "per_org_default">;
  currentCapCents: number;
  /** Triggered with new_cap_cents when the user submits a valid
   *  form. Parent issues `requestCostCapChange` and closes the
   *  modal on success. */
  onSubmit: (newCapCents: number) => void;
  /** Disable the primary CTA while the request is in flight. */
  submitting?: boolean;
  /** Async error from the parent's mutation; rendered inline. */
  errorMessage?: string | null;
  now?: Date;
}

const DOLLARS_HARD_CEILING = HARD_CEILING_CENTS / 100;

export function EditCostCapModal({
  open,
  onClose,
  targetKind,
  currentCapCents,
  onSubmit,
  submitting = false,
  errorMessage = null,
  now,
}: EditCostCapModalProps) {
  const [dollars, setDollars] = useState<string>(
    (currentCapCents / 100).toString(),
  );
  const [touched, setTouched] = useState(false);

  const parsed = parseDollarString(dollars);
  const newCapCents = parsed === null ? -1 : Math.round(parsed * 100);
  const validation =
    parsed === null
      ? {
          field: "new_cap_cents" as const,
          message: "Enter a dollar amount.",
        }
      : validateCostCapInput({
          newCapCents,
          targetKind,
          targetId: null,
          expiresAt: null,
          now: now ?? new Date(),
        });

  const isLowering = parsed !== null && newCapCents < currentCapCents;

  const title =
    targetKind === "global"
      ? "Edit global cap"
      : "Edit per-org default cap";
  const description =
    targetKind === "global"
      ? "Tenant-wide ceiling on Bedrock spend per day. Applies above any per-org override."
      : "Default per-tenant daily cap. Tenants without an explicit override use this value.";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      primaryAction={{
        label: submitting ? "Submitting…" : "Queue for approval",
        onClick: () => {
          setTouched(true);
          if (validation === null && parsed !== null) {
            onSubmit(newCapCents);
          }
        },
        disabled: submitting || validation !== null,
      }}
      secondaryAction={{
        label: "Cancel",
        onClick: onClose,
      }}
    >
      <div className="mt-3 space-y-3 text-sm">
        <label
          htmlFor="cost-cap-dollars"
          className="block font-medium text-gray-700 dark:text-gray-200"
        >
          Daily cap (USD)
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
            $
          </span>
          <input
            id="cost-cap-dollars"
            type="text"
            inputMode="decimal"
            value={dollars}
            onChange={(e) => {
              setDollars(e.target.value);
              setTouched(true);
            }}
            className="block w-full rounded-md border border-gray-300 bg-white pl-7 pr-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            data-testid="cost-cap-input"
          />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Maximum: ${DOLLARS_HARD_CEILING.toLocaleString()}/day. Enter 0 to
          pause Bedrock for this scope (emergency stop).
        </p>
        {touched && validation !== null && (
          <p
            className="text-sm text-red-600 dark:text-red-400"
            data-testid="cost-cap-validation-error"
          >
            {validation.message}
          </p>
        )}
        {isLowering && validation === null && (
          <p
            className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
            data-testid="cost-cap-lowering-warning"
          >
            Lowering takes effect at the LATER of approval + 60 minutes or
            the next 00:00 UTC. In-flight Bedrock invocations against the
            old cap settle first.
          </p>
        )}
        {errorMessage && (
          <p
            className="text-sm text-red-600 dark:text-red-400"
            data-testid="cost-cap-submit-error"
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
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  return n;
}
