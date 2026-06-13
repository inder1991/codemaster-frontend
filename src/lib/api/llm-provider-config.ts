/**
 * S21.LLM-DUAL.0 task 15 — canonical API client for /api/admin/llm-provider-config.
 * S21.LLM-DUAL.1 task 13 — added per-role typed methods.
 *
 * Renamed from bedrock-config.ts. The old file is now a re-export shim.
 * Phase 1 will add a shared base error class; for now BedrockPreflightError
 * is preserved as-is (name kept per Task 10 convention).
 *
 * Hand-authored TS mirror of `contracts/admin/llm_provider_config/v1.py`
 * (S17.X-ts-mirror-lint will absorb on next codegen pass).
 *
 * The plaintext token NEVER appears in any GET response; it goes
 * out only on the PUT body. The server's pre-save validator pings
 * the provider with the new credentials before persisting; on validator
 * failure the PUT returns 400 with the upstream error embedded.
 */

import { AdminApiError, readCsrfToken } from "@/lib/api/admin";

// ── Wire types ────────────────────────────────────────────────────

export type BedrockHealthState = "ok" | "failed";
export type LlmRole = "primary" | "secondary";
export type LlmProvider = "bedrock" | "anthropic_direct";

export interface LlmProviderConfigV1 {
  schema_version: 1;
  model_id: string;
  /** AWS region for bedrock; null for anthropic_direct. */
  region: string | null;
  /** Last 4 chars of the plaintext token. The only token-derived
   *  field surfaced to the UI. */
  api_key_fingerprint: string;
  enabled: boolean;
  last_validated_at: string | null;
  last_validation_status: BedrockHealthState | null;
  last_rotated_at: string;
  last_rotated_by_user_id: string;
}

export interface LlmProviderConfigUpdateV1 {
  schema_version: 1;
  provider: LlmProvider;
  role: LlmRole;
  model_id: string;
  region: string | null;
  api_key: string;
  enabled: boolean;
}

/** Payload accepted by testLlmProviderConfig (preflight-only, no write). */
export interface LlmProviderPreflightPayload {
  provider: LlmProvider;
  role: LlmRole;
  model_id: string;
  region: string | null;
  api_key: string;
}

/**
 * Payload accepted by the model-less testLlmCredentials endpoint
 * (`POST /api/admin/llm-provider-config/test-credentials`).
 * Validates the key WITHOUT a model_id — anthropic_direct lists models;
 * bedrock pings a default model. Per the head-of-UX redesign, model
 * selection is no longer an operator-facing field (ADR-0060).
 */
export interface LlmCredentialsTestPayload {
  schema_version: 1;
  provider: LlmProvider;
  /** AWS region for bedrock; omitted/undefined for anthropic_direct. */
  region?: string;
  api_key: string;
}

/** Shape returned by the preflight Test endpoint. */
export interface LlmProviderPreflightResult {
  ok: boolean;
  message: string;
}

export interface BedrockPreflightFailedDetail {
  code: "bedrock_preflight_failed" | "llm_provider_preflight_failed";
  message: string;
}

export const LLM_PROVIDER_CONFIG_QUERY_KEYS = {
  all: ["llm-provider-config"] as const,
  current: () => [...LLM_PROVIDER_CONFIG_QUERY_KEYS.all, "current"] as const,
  byRole: (role: LlmRole) =>
    [...LLM_PROVIDER_CONFIG_QUERY_KEYS.all, "role", role] as const,
};

// ── Fetcher ───────────────────────────────────────────────────────

const LLM_PROVIDER_CONFIG_BASE = "/api/admin/llm-provider-config";
const LLM_PROVIDER_PREFLIGHT_URL = "/api/admin/llm-provider-config/preflight";
const LLM_PROVIDER_TEST_CREDENTIALS_URL =
  "/api/admin/llm-provider-config/test-credentials";
const DEFAULT_TIMEOUT_MS = 15_000;
// PUT issues a real provider ping → can take several seconds.
const PUT_TIMEOUT_MS = 30_000;

async function _fetchConfig(url: string): Promise<LlmProviderConfigV1 | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      credentials: "include",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (res.status === 404) {
      // Fresh cluster; no config seeded yet for this role.
      return null;
    }
    if (res.status === 401) {
      throw new AdminApiError("unauthenticated", 401, url, null);
    }
    if (res.status === 403) {
      throw new AdminApiError("forbidden", 403, url, null);
    }
    if (!res.ok) {
      throw new AdminApiError(
        `llm-provider-config GET failed (${res.status})`,
        res.status,
        url,
        null,
      );
    }
    return (await res.json()) as LlmProviderConfigV1;
  } finally {
    clearTimeout(timer);
  }
}

/** Legacy single-call fetcher (Phase 0 compat; returns primary row). */
export async function fetchLlmProviderConfig(): Promise<LlmProviderConfigV1 | null> {
  return _fetchConfig(LLM_PROVIDER_CONFIG_BASE);
}

/**
 * Per-role fetcher (Phase 1+).
 * Appends `?role=<role>` so the backend can serve the correct row.
 */
export async function getLlmProviderConfig(
  role: LlmRole,
): Promise<LlmProviderConfigV1 | null> {
  return _fetchConfig(`${LLM_PROVIDER_CONFIG_BASE}?role=${role}`);
}

export class BedrockPreflightError extends Error {
  detail: BedrockPreflightFailedDetail;
  constructor(detail: BedrockPreflightFailedDetail) {
    super(detail.message);
    this.name = "BedrockPreflightError";
    this.detail = detail;
  }
}

/** Shared PUT logic used by both the legacy and per-role wrappers. */
async function _putConfig(
  body: LlmProviderConfigUpdateV1,
): Promise<LlmProviderConfigV1> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PUT_TIMEOUT_MS);
  try {
    const csrf = readCsrfToken();
    const res = await fetch(LLM_PROVIDER_CONFIG_BASE, {
      method: "PUT",
      credentials: "include",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-CSRF-Token": csrf ?? "",
      },
      body: JSON.stringify(body),
    });
    if (res.status === 401) {
      throw new AdminApiError("unauthenticated", 401, LLM_PROVIDER_CONFIG_BASE, null);
    }
    if (res.status === 403) {
      throw new AdminApiError("forbidden", 403, LLM_PROVIDER_CONFIG_BASE, null);
    }
    if (res.status === 400 || res.status === 422) {
      // Could be Pydantic-shape rejection OR preflight failure.
      const json = (await res.json()) as
        | { detail: BedrockPreflightFailedDetail }
        | { detail: unknown };
      const detail = (json as { detail: unknown }).detail;
      if (
        typeof detail === "object" &&
        detail !== null &&
        "code" in detail &&
        (
          (detail as { code: string }).code === "bedrock_preflight_failed" ||
          (detail as { code: string }).code === "llm_provider_preflight_failed"
        )
      ) {
        throw new BedrockPreflightError(detail as BedrockPreflightFailedDetail);
      }
      throw new AdminApiError(
        "request body invalid",
        res.status,
        LLM_PROVIDER_CONFIG_BASE,
        json,
      );
    }
    if (!res.ok) {
      throw new AdminApiError(
        `llm-provider-config PUT failed (${res.status})`,
        res.status,
        LLM_PROVIDER_CONFIG_BASE,
        null,
      );
    }
    return (await res.json()) as LlmProviderConfigV1;
  } finally {
    clearTimeout(timer);
  }
}

/** Legacy PUT (Phase 0 compat). Body must include provider + role for Phase 1+. */
export async function putLlmProviderConfig(
  body: LlmProviderConfigUpdateV1,
): Promise<LlmProviderConfigV1> {
  return _putConfig(body);
}

/**
 * Trigger a provider preflight check (test connectivity) without writing.
 * POSTs to /api/admin/llm-provider-config/preflight.
 * Returns {ok, message} summarising the result.
 */
export async function testLlmProviderConfig(
  payload: LlmProviderPreflightPayload,
): Promise<LlmProviderPreflightResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PUT_TIMEOUT_MS);
  try {
    const csrf = readCsrfToken();
    const res = await fetch(LLM_PROVIDER_PREFLIGHT_URL, {
      method: "POST",
      credentials: "include",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-CSRF-Token": csrf ?? "",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      // Treat any non-200 as a failed preflight rather than throwing.
      let message = `preflight failed (HTTP ${res.status})`;
      try {
        const json = (await res.json()) as { detail?: { message?: string } | string };
        const d = json.detail;
        if (typeof d === "string") message = d;
        else if (d && typeof d === "object" && "message" in d && typeof d.message === "string") {
          message = d.message;
        }
      } catch {
        // body not JSON — keep the default message
      }
      return { ok: false, message };
    }
    const json = (await res.json()) as { ok: boolean; message: string };
    return json;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Validate provider credentials WITHOUT a model_id (model-less).
 * POSTs to /api/admin/llm-provider-config/test-credentials.
 *
 * Mirrors testLlmProviderConfig's structure (AbortController + timeout;
 * never throws on non-200 — any failure is surfaced as {ok:false,message}).
 * This is the endpoint the redesigned provider card's Test button uses;
 * model selection lives in the catalog / job-routing surface (ADR-0060),
 * so connectivity is validated against the provider, not a specific model.
 */
export async function testLlmCredentials(
  payload: LlmCredentialsTestPayload,
): Promise<LlmProviderPreflightResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PUT_TIMEOUT_MS);
  try {
    const csrf = readCsrfToken();
    const res = await fetch(LLM_PROVIDER_TEST_CREDENTIALS_URL, {
      method: "POST",
      credentials: "include",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-CSRF-Token": csrf ?? "",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      // Treat any non-200 as a failed test rather than throwing.
      let message = `credential test failed (HTTP ${res.status})`;
      try {
        const json = (await res.json()) as { detail?: { message?: string } | string };
        const d = json.detail;
        if (typeof d === "string") message = d;
        else if (d && typeof d === "object" && "message" in d && typeof d.message === "string") {
          message = d.message;
        }
      } catch {
        // body not JSON — keep the default message
      }
      return { ok: false, message };
    }
    const json = (await res.json()) as { ok: boolean; message: string };
    return json;
  } finally {
    clearTimeout(timer);
  }
}

// ── Phase 0 / S21.LLM-DUAL.0 — backward-compat aliases ──────────
// Consumers importing the legacy names from bedrock-config.ts (which
// re-exports this file) continue to work without changes.

export const fetchBedrockConfig = fetchLlmProviderConfig;
export const putBedrockConfig = putLlmProviderConfig;
export type BedrockConfigV1 = LlmProviderConfigV1;
export type BedrockConfigUpdateV1 = LlmProviderConfigUpdateV1;
export const BEDROCK_CONFIG_QUERY_KEYS = LLM_PROVIDER_CONFIG_QUERY_KEYS;

// ── Phase 1+ note ────────────────────────────────────────────────
// getLlmProviderConfig(role) and testLlmProviderConfig(payload) are
// exported above where they are defined. No re-export needed.
