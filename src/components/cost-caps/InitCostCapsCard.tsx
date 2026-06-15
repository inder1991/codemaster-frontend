/**
 * InitCostCapsCard — first-time cost-cap setup.
 *
 * Shown by the cost-caps page when the platform has never been configured (GET returns settings:null). The
 * two-person change flow can't bootstrap the caps (approve reads the current cap, which doesn't exist yet),
 * so the FIRST set is a direct super_admin/platform_owner write via PUT /api/admin/cost-caps/settings. Once
 * configured, all subsequent edits go through the normal two-approver flow.
 *
 * Pre-filled with the platform defaults ($5,000/day global, $1,000/day per-org). super_admin / platform_owner
 * only (the page guard already enforces the role; a non-privileged user never reaches this card).
 */

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Card } from "@/components/ui/elements/Card";
import { AdminApiError } from "@/lib/api/admin";
import {
  COST_CAPS_QUERY_KEYS,
  HARD_CEILING_CENTS,
  initCostCapSettings,
} from "@/lib/api/cost-caps";

const DOLLARS_HARD_CEILING = HARD_CEILING_CENTS / 100;
// Platform defaults (mirror the legacy bedrock_*_daily_cap_cents flags): $5,000/day global, $1,000/day per-org.
const DEFAULT_GLOBAL_DOLLARS = "5000";
const DEFAULT_PER_ORG_DOLLARS = "1000";

/** Parse a dollar string to whole cents, or null when invalid (blank, non-numeric, negative, over ceiling). */
function dollarsToCents(raw: string): number | null {
  const trimmed = raw.trim().replace(/,/g, "");
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  const cents = Math.round(n * 100);
  if (cents > HARD_CEILING_CENTS) return null;
  return cents;
}

export function InitCostCapsCard() {
  const queryClient = useQueryClient();
  const [globalDollars, setGlobalDollars] = useState(DEFAULT_GLOBAL_DOLLARS);
  const [perOrgDollars, setPerOrgDollars] = useState(DEFAULT_PER_ORG_DOLLARS);
  const [touched, setTouched] = useState(false);

  const globalCents = dollarsToCents(globalDollars);
  const perOrgCents = dollarsToCents(perOrgDollars);
  const invalid = globalCents === null || perOrgCents === null;

  const mutation = useMutation({
    mutationFn: initCostCapSettings,
    onSuccess: () => {
      // Re-fetch the page — settings is now non-null, so it renders the governance dashboard.
      void queryClient.invalidateQueries({ queryKey: COST_CAPS_QUERY_KEYS.page() });
    },
  });

  function submit() {
    setTouched(true);
    if (globalCents === null || perOrgCents === null) return;
    mutation.mutate({ global_cap_cents: globalCents, per_org_default_cap_cents: perOrgCents });
  }

  const errorMessage =
    mutation.error instanceof AdminApiError
      ? mutation.error.status === 409
        ? "Cost caps were just configured by someone else — refreshing…"
        : mutation.error.status === 422
          ? "A cap is out of range. Each must be between $0 and the maximum."
          : mutation.error.status === 403
            ? "You don't have permission to configure cost caps."
            : mutation.error.message
      : mutation.error
        ? mutation.error.message
        : null;

  return (
    <Card>
      <div className="space-y-4 p-6" data-testid="cost-caps-init-card">
        <div>
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Set up cost caps
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Cost caps aren&apos;t configured yet. Set the daily Bedrock spend ceilings to activate
            enforcement. You can change them later — but once configured, changes need a second admin&apos;s
            approval.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <DollarField
            id="init-global-cap"
            label="Global cap (USD / day)"
            help="Platform-wide ceiling on Bedrock spend per day."
            value={globalDollars}
            onChange={(v) => {
              setGlobalDollars(v);
              setTouched(true);
            }}
            invalid={touched && globalCents === null}
            testId="init-global-cap-input"
          />
          <DollarField
            id="init-per-org-cap"
            label="Per-org default (USD / day)"
            help="Default per-tenant daily cap (unless an override is set)."
            value={perOrgDollars}
            onChange={(v) => {
              setPerOrgDollars(v);
              setTouched(true);
            }}
            invalid={touched && perOrgCents === null}
            testId="init-per-org-cap-input"
          />
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Maximum: ${DOLLARS_HARD_CEILING.toLocaleString()}/day per cap. Enter 0 to keep Bedrock paused for
          that scope.
        </p>

        {touched && invalid && (
          <p className="text-sm text-red-600 dark:text-red-400" data-testid="cost-caps-init-validation">
            Enter a dollar amount between $0 and ${DOLLARS_HARD_CEILING.toLocaleString()} for each cap.
          </p>
        )}
        {errorMessage && (
          <p className="text-sm text-red-600 dark:text-red-400" data-testid="cost-caps-init-error">
            {errorMessage}
          </p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={mutation.isPending || (touched && invalid)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="cost-caps-init-submit"
        >
          {mutation.isPending ? "Saving…" : "Save & activate caps"}
        </button>
      </div>
    </Card>
  );
}

function DollarField({
  id,
  label,
  help,
  value,
  onChange,
  invalid,
  testId,
}: {
  id: string;
  label: string;
  help: string;
  value: string;
  onChange: (v: string) => void;
  invalid: boolean;
  testId: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-200">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`block w-full rounded-md border bg-white pl-7 pr-3 py-2 text-gray-900 shadow-sm focus:ring-indigo-500 dark:bg-gray-800 dark:text-gray-100 ${
            invalid
              ? "border-red-400 focus:border-red-500"
              : "border-gray-300 focus:border-indigo-500 dark:border-gray-600"
          }`}
          data-testid={testId}
        />
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{help}</p>
    </div>
  );
}
