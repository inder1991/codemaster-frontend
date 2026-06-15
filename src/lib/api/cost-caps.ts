/**
 * Sprint 15 / S15.H + Sprint 16 / S16.A.4 — typed fetch wrappers
 * for /api/admin/cost-caps.
 *
 * Wire envelopes re-export from the auto-generated
 * `generated/contracts.ts` per ADR-0005. `make codegen` regenerates
 * from `openapi.json`; CI gate fails PRs that drift the committed
 * spec from a fresh export.
 *
 * Hard ceiling 5_000_000 cents = $50,000/day is locked in three
 * layers: backend Pydantic Field, DB CHECK, and `HARD_CEILING_CENTS`
 * here on the frontend. Client-side validation refuses oversized
 * input before the round-trip.
 */

import type { components } from "./generated/contracts";

// ── Locked constants (mirror contracts/admin/cost_caps/v1.py) ──

export const HARD_CEILING_CENTS = 5_000_000;
export const LOWERING_GRACE_MINUTES = 60;

// ── Wire types (Sprint 16 / S16.A.4 — re-exported from generated) ──

export type CostCapTargetKind =
  components["schemas"]["CostCapPendingChangeV1"]["target_kind"];

export type CostCapPendingState =
  components["schemas"]["CostCapPendingChangeV1"]["state"];

export type CostCapSettingsV1 = components["schemas"]["CostCapSettingsV1"];

export type CostCapOverrideV1 = components["schemas"]["CostCapOverrideV1"];

export type CostCapPendingChangeV1 =
  components["schemas"]["CostCapPendingChangeV1"];

export type CostCapPageV1 = components["schemas"]["CostCapPageV1"];

export type CostCapChangeRequestV1 =
  components["schemas"]["CostCapChangeRequestV1"];

// ── Fetchers ──────────────────────────────────────────────────────
//
// All fetchers credentials-include + send the CSRF double-submit
// token (read from the cookie set by the S14.A middleware) on
// mutations. Errors surface as `AdminApiError` per the existing
// admin client convention.

import { AdminApiError, readCsrfToken } from "@/lib/api/admin";

const COST_CAPS_BASE = "/api/admin/cost-caps";
const DEFAULT_TIMEOUT_MS = 15_000;

async function _parseErrorBody(res: Response): Promise<unknown> {
  try {
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function _fetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${COST_CAPS_BASE}${path}`, {
      credentials: "include",
      signal: controller.signal,
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (res.status === 401) {
      throw new AdminApiError(
        "unauthenticated",
        401,
        path,
        await _parseErrorBody(res),
      );
    }
    if (res.status === 403) {
      throw new AdminApiError(
        "forbidden",
        403,
        path,
        await _parseErrorBody(res),
      );
    }
    if (!res.ok) {
      throw new AdminApiError(
        `cost-caps api ${path} returned ${res.status}`,
        res.status,
        path,
        await _parseErrorBody(res),
      );
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function _mutationHeaders(): HeadersInit {
  const csrf = readCsrfToken();
  const base: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (csrf !== null) base["X-CSRF-Token"] = csrf;
  return base;
}

export async function fetchCostCaps(): Promise<CostCapPageV1> {
  return _fetch<CostCapPageV1>("");
}

export async function requestCostCapChange(
  body: CostCapChangeRequestV1,
): Promise<CostCapPendingChangeV1> {
  return _fetch<CostCapPendingChangeV1>("/changes", {
    method: "POST",
    headers: _mutationHeaders(),
    body: JSON.stringify(body),
  });
}

/** PUT /api/admin/cost-caps/settings body — FIRST-TIME (bootstrap) configuration of the two scope caps.
 *  Re-exported from the generated contracts (the endpoint + schema now live in openapi.json). */
export type CostCapSettingsInitV1 = components["schemas"]["CostCapSettingsInitV1"];

/**
 * First-time (bootstrap) configuration of the global + per-org-default caps. A DIRECT super_admin/
 * platform_owner write (the two-person change flow can't run until the rows exist) — returns the freshly
 * configured page. Throws AdminApiError with status 409 if the caps are ALREADY configured (someone raced
 * you); thereafter edits go through requestCostCapChange. 422 if a cap exceeds the hard ceiling.
 */
export async function initCostCapSettings(
  body: CostCapSettingsInitV1,
): Promise<CostCapPageV1> {
  return _fetch<CostCapPageV1>("/settings", {
    method: "PUT",
    headers: _mutationHeaders(),
    body: JSON.stringify(body),
  });
}

export async function approveCostCapChange(
  pendingChangeId: string,
): Promise<CostCapPendingChangeV1> {
  return _fetch<CostCapPendingChangeV1>(
    `/changes/${encodeURIComponent(pendingChangeId)}/approve`,
    {
      method: "POST",
      headers: _mutationHeaders(),
    },
  );
}

export async function rejectCostCapChange(
  pendingChangeId: string,
): Promise<CostCapPendingChangeV1> {
  return _fetch<CostCapPendingChangeV1>(
    `/changes/${encodeURIComponent(pendingChangeId)}/reject`,
    {
      method: "POST",
      headers: _mutationHeaders(),
    },
  );
}

// ── React Query keys ──────────────────────────────────────────────

export const COST_CAPS_QUERY_KEYS = {
  page: () => ["admin", "cost-caps"] as const,
} as const;

// ── Client-side validation helpers ────────────────────────────────

export interface CapValidationError {
  field: "new_cap_cents" | "expires_at" | "target_id";
  message: string;
}

export function validateCostCapInput(args: {
  newCapCents: number;
  targetKind: CostCapTargetKind;
  targetId: string | null;
  expiresAt: string | null;
  now: Date;
}): CapValidationError | null {
  if (
    !Number.isInteger(args.newCapCents) ||
    args.newCapCents < 0 ||
    args.newCapCents > HARD_CEILING_CENTS
  ) {
    return {
      field: "new_cap_cents",
      message: `Cap must be a whole number between $0 and $${(HARD_CEILING_CENTS / 100).toLocaleString()} (inclusive).`,
    };
  }
  if (args.targetKind === "per_org_override" && !args.targetId) {
    return {
      field: "target_id",
      message: "Per-org override requires an installation.",
    };
  }
  if (args.targetKind !== "per_org_override" && args.targetId) {
    return {
      field: "target_id",
      message: `${args.targetKind} caps do not accept an installation id.`,
    };
  }
  if (args.expiresAt) {
    const exp = new Date(args.expiresAt);
    if (Number.isNaN(exp.getTime())) {
      return { field: "expires_at", message: "Invalid expiry timestamp." };
    }
    if (exp.getTime() <= args.now.getTime()) {
      return { field: "expires_at", message: "Expiry must be in the future." };
    }
  }
  return null;
}

/**
 * Format cents as "$1,234.56". The platform's caps live in cents
 * end-to-end (DB CHECK, contract Field, frontend); the dollar
 * formatting is presentation-only.
 */
export function formatCents(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
