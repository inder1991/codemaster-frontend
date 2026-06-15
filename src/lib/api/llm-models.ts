/**
 * ADR-0060 — canonical API client for the LLM model catalog + purpose→model
 * routing endpoints. Powers the MODELS + JOB ROUTING sections of /admin/llm.
 *
 * Mirrors the conventions of `llm-provider-config.ts`:
 *   - AdminApiError + readCsrfToken from `@/lib/api/admin`.
 *   - AbortController + per-call timeout (PUT/test issue a real preflight
 *     ping → longer timeout).
 *   - Status-code branching: 401 → unauthenticated, 403 → forbidden,
 *     409/422 → parsed typed error envelopes.
 *   - `credentials: "include"` on every call; CSRF header on mutations.
 *
 * Typed error envelopes:
 *   - 409 on DELETE → LlmModelInUseError (carries dependent purposes).
 *   - 422 on PUT model / PUT routing → LlmModelDetailError (code + message).
 *
 * Hand-authored TS mirror of the ADR-0060 contracts (codegen will absorb
 * on the next OpenAPI export pass).
 */

import { AdminApiError, readCsrfToken } from "@/lib/api/admin";

// ── Wire types ────────────────────────────────────────────────────

export type LlmModelProvider = "anthropic_direct" | "bedrock";

export type LlmModelValidationStatus = "untested" | "ok" | "failed";

/** One row in the model catalog (`core.llm_models`). */
export interface LlmModelV1 {
  provider: LlmModelProvider;
  model_id: string;
  display_name: string | null;
  enabled: boolean;
  last_validation_status: LlmModelValidationStatus;
  last_validation_error: string | null;
  last_validated_at: string | null;
}

/** PUT body for upserting a catalog row. */
export interface LlmModelUpsertV1 {
  schema_version: 1;
  provider: LlmModelProvider;
  model_id: string;
  display_name?: string | null;
  enabled: boolean;
}

/** Shape returned by the per-model preflight Test endpoint. */
export interface LlmModelTestResult {
  ok: boolean;
  message: string;
}

/**
 * ALL 8 purpose values the backend/DB can store (generated contract:
 * `LlmPurposeModelV1.purpose` in contracts.ts ~2672).
 * Used for GET response rows so legacy/orphan rows typecheck cleanly.
 */
export type AnyLlmPurpose =
  | "review_summary"
  | "review_finding"
  | "chat_reply"
  | "walkthrough"
  | "redaction_check"
  | "cost_estimate"
  | "analysis_curator"
  | "fix_prompt";

/** The 4 executable LlmPurposeV1 values the runtime consumes (WRITE only). */
export type LlmPurpose =
  | "review_finding"
  | "walkthrough"
  | "analysis_curator"
  | "fix_prompt";

/**
 * One purpose→model assignment row from the GET response (`core.llm_purpose_model`).
 * Uses the broad AnyLlmPurpose so legacy/orphan rows returned by the backend
 * are not silently truncated.
 */
export interface LlmPurposeModelV1 {
  purpose: AnyLlmPurpose;
  model_id: string;
}

/** PUT body for assigning a purpose to a model (narrow 4-value set only). */
export interface LlmPurposeRoutingUpsertV1 {
  schema_version: 1;
  purpose: LlmPurpose;
  model_id: string;
}

/** 409 body when a delete is blocked by an in-use model. */
export interface LlmModelInUseDetail {
  code: "llm_model_in_use";
  message: string;
  purposes: string[];
}

/** 422 body when an upsert / assignment is rejected by the backend. */
export interface LlmModelDetail {
  code: string;
  message: string;
}

// ── Typed errors ──────────────────────────────────────────────────

/** Thrown on a 409 from DELETE — the model still routes ≥1 purpose. */
export class LlmModelInUseError extends Error {
  detail: LlmModelInUseDetail;
  constructor(detail: LlmModelInUseDetail) {
    super(detail.message);
    this.name = "LlmModelInUseError";
    this.detail = detail;
  }
}

/**
 * Thrown on a 422 from a model upsert (model_id not in the engine's
 * accepted set) or a purpose assignment (model not in catalog / disabled
 * / not preflight-validated).
 */
export class LlmModelDetailError extends Error {
  detail: LlmModelDetail;
  constructor(detail: LlmModelDetail) {
    super(detail.message);
    this.name = "LlmModelDetailError";
    this.detail = detail;
  }
}

// ── Query keys ────────────────────────────────────────────────────

export const LLM_MODELS_QUERY_KEYS = {
  all: ["llm-models"] as const,
  catalog: () => [...LLM_MODELS_QUERY_KEYS.all, "catalog"] as const,
  routing: () => [...LLM_MODELS_QUERY_KEYS.all, "purpose-routing"] as const,
};

// ── URLs + timeouts ───────────────────────────────────────────────

const LLM_MODELS_BASE = "/api/admin/llm-models";
const LLM_PURPOSE_ROUTING_BASE = "/api/admin/llm-purpose-routing";
const DEFAULT_TIMEOUT_MS = 15_000;
// PUT / test issue a real provider preflight ping → can take several seconds.
const PREFLIGHT_TIMEOUT_MS = 30_000;

// ── Helpers ───────────────────────────────────────────────────────

async function _parseJson(res: Response): Promise<unknown> {
  try {
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Pull a `{code, message}`-shaped detail out of a FastAPI error body. */
function _extractDetail(body: unknown): { code: string; message: string } | null {
  // FastAPI wraps custom payloads under `.detail`; some handlers return the
  // payload at the top level. Accept both.
  const candidate =
    body !== null &&
    typeof body === "object" &&
    "detail" in body &&
    (body as { detail: unknown }).detail !== undefined
      ? (body as { detail: unknown }).detail
      : body;
  if (
    candidate !== null &&
    typeof candidate === "object" &&
    "code" in candidate &&
    "message" in candidate &&
    typeof (candidate as { code: unknown }).code === "string" &&
    typeof (candidate as { message: unknown }).message === "string"
  ) {
    return candidate as { code: string; message: string };
  }
  return null;
}

function _mutationHeaders(): HeadersInit {
  const csrf = readCsrfToken();
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-CSRF-Token": csrf ?? "",
  };
}

// ── Catalog: list ─────────────────────────────────────────────────

export async function listLlmModels(): Promise<LlmModelV1[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(LLM_MODELS_BASE, {
      credentials: "include",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (res.status === 401) {
      throw new AdminApiError("unauthenticated", 401, LLM_MODELS_BASE, null);
    }
    if (res.status === 403) {
      throw new AdminApiError("forbidden", 403, LLM_MODELS_BASE, null);
    }
    if (!res.ok) {
      throw new AdminApiError(
        `llm-models GET failed (${res.status})`,
        res.status,
        LLM_MODELS_BASE,
        null,
      );
    }
    const json = (await res.json()) as { models?: LlmModelV1[] };
    // Defend against a malformed/partial body: a missing or non-array
    // `models` degrades to the empty-state, never an undefined.length crash.
    return Array.isArray(json?.models) ? json.models : [];
  } finally {
    clearTimeout(timer);
  }
}

// ── Catalog: upsert ───────────────────────────────────────────────

export async function upsertLlmModel(
  body: LlmModelUpsertV1,
): Promise<LlmModelV1> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PREFLIGHT_TIMEOUT_MS);
  try {
    const res = await fetch(LLM_MODELS_BASE, {
      method: "PUT",
      credentials: "include",
      signal: controller.signal,
      headers: _mutationHeaders(),
      body: JSON.stringify(body),
    });
    if (res.status === 401) {
      throw new AdminApiError("unauthenticated", 401, LLM_MODELS_BASE, null);
    }
    if (res.status === 403) {
      throw new AdminApiError("forbidden", 403, LLM_MODELS_BASE, null);
    }
    if (res.status === 409) {
      const json = await _parseJson(res);
      const detail = _extractDetail(json);
      if (detail) throw new LlmModelDetailError(detail);
      throw new AdminApiError("conflict", 409, LLM_MODELS_BASE, json);
    }
    if (res.status === 422) {
      const json = await _parseJson(res);
      const detail = _extractDetail(json);
      if (detail) throw new LlmModelDetailError(detail);
      throw new AdminApiError("request body invalid", 422, LLM_MODELS_BASE, json);
    }
    if (!res.ok) {
      throw new AdminApiError(
        `llm-models PUT failed (${res.status})`,
        res.status,
        LLM_MODELS_BASE,
        null,
      );
    }
    return (await res.json()) as LlmModelV1;
  } finally {
    clearTimeout(timer);
  }
}

// ── Catalog: delete ───────────────────────────────────────────────

export async function deleteLlmModel(
  provider: LlmModelProvider,
  modelId: string,
): Promise<void> {
  const url = `${LLM_MODELS_BASE}/${encodeURIComponent(provider)}/${encodeURIComponent(modelId)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "DELETE",
      credentials: "include",
      signal: controller.signal,
      headers: _mutationHeaders(),
    });
    if (res.status === 204 || res.status === 200) return;
    if (res.status === 401) {
      throw new AdminApiError("unauthenticated", 401, url, null);
    }
    if (res.status === 403) {
      throw new AdminApiError("forbidden", 403, url, null);
    }
    if (res.status === 409) {
      const json = await _parseJson(res);
      const candidate =
        json !== null &&
        typeof json === "object" &&
        "detail" in json &&
        (json as { detail: unknown }).detail !== undefined
          ? (json as { detail: unknown }).detail
          : json;
      if (
        candidate !== null &&
        typeof candidate === "object" &&
        "code" in candidate &&
        (candidate as { code: unknown }).code === "llm_model_in_use"
      ) {
        const c = candidate as Partial<LlmModelInUseDetail>;
        throw new LlmModelInUseError({
          code: "llm_model_in_use",
          message: c.message ?? "Model is in use by one or more purposes.",
          purposes: Array.isArray(c.purposes) ? c.purposes : [],
        });
      }
      throw new AdminApiError("conflict", 409, url, json);
    }
    if (res.status === 404) {
      throw new AdminApiError("model not found", 404, url, null);
    }
    if (!res.ok) {
      throw new AdminApiError(
        `llm-models DELETE failed (${res.status})`,
        res.status,
        url,
        null,
      );
    }
  } finally {
    clearTimeout(timer);
  }
}

// ── Catalog: preflight test ───────────────────────────────────────

export async function testLlmModel(
  provider: LlmModelProvider,
  modelId: string,
): Promise<LlmModelTestResult> {
  const url = `${LLM_MODELS_BASE}/${encodeURIComponent(provider)}/${encodeURIComponent(modelId)}/test`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PREFLIGHT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      signal: controller.signal,
      headers: _mutationHeaders(),
    });
    if (res.status === 401) {
      throw new AdminApiError("unauthenticated", 401, url, null);
    }
    if (res.status === 403) {
      throw new AdminApiError("forbidden", 403, url, null);
    }
    if (!res.ok) {
      // Treat any other non-200 as a failed preflight rather than throwing.
      let message = `preflight failed (HTTP ${res.status})`;
      const json = await _parseJson(res);
      const detail = _extractDetail(json);
      if (detail) message = detail.message;
      return { ok: false, message };
    }
    return (await res.json()) as LlmModelTestResult;
  } finally {
    clearTimeout(timer);
  }
}

// ── Purpose routing: list ─────────────────────────────────────────

export async function listPurposeRouting(): Promise<LlmPurposeModelV1[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(LLM_PURPOSE_ROUTING_BASE, {
      credentials: "include",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (res.status === 401) {
      throw new AdminApiError("unauthenticated", 401, LLM_PURPOSE_ROUTING_BASE, null);
    }
    if (res.status === 403) {
      throw new AdminApiError("forbidden", 403, LLM_PURPOSE_ROUTING_BASE, null);
    }
    if (!res.ok) {
      throw new AdminApiError(
        `llm-purpose-routing GET failed (${res.status})`,
        res.status,
        LLM_PURPOSE_ROUTING_BASE,
        null,
      );
    }
    const json = (await res.json()) as { assignments?: LlmPurposeModelV1[] };
    // Defend against a malformed/partial body — mirrors the guard in listLlmModels.
    return Array.isArray(json?.assignments) ? json.assignments : [];
  } finally {
    clearTimeout(timer);
  }
}

// ── Purpose routing: assign ───────────────────────────────────────

export async function assignPurpose(
  body: LlmPurposeRoutingUpsertV1,
): Promise<LlmPurposeModelV1> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(LLM_PURPOSE_ROUTING_BASE, {
      method: "PUT",
      credentials: "include",
      signal: controller.signal,
      headers: _mutationHeaders(),
      body: JSON.stringify(body),
    });
    if (res.status === 401) {
      throw new AdminApiError("unauthenticated", 401, LLM_PURPOSE_ROUTING_BASE, null);
    }
    if (res.status === 403) {
      throw new AdminApiError("forbidden", 403, LLM_PURPOSE_ROUTING_BASE, null);
    }
    if (res.status === 422) {
      const json = await _parseJson(res);
      const detail = _extractDetail(json);
      if (detail) throw new LlmModelDetailError(detail);
      throw new AdminApiError(
        "request body invalid",
        422,
        LLM_PURPOSE_ROUTING_BASE,
        json,
      );
    }
    if (!res.ok) {
      throw new AdminApiError(
        `llm-purpose-routing PUT failed (${res.status})`,
        res.status,
        LLM_PURPOSE_ROUTING_BASE,
        null,
      );
    }
    return (await res.json()) as LlmPurposeModelV1;
  } finally {
    clearTimeout(timer);
  }
}

// ── Purpose routing: delete (reset to default) ────────────────────

/**
 * DELETE /api/admin/llm-purpose-routing/:purpose
 * Resets a purpose to default (no explicit assignment).
 * Both 204 (deleted) and 404 (already default) are treated as success.
 */
export async function deletePurposeRouting(purpose: string): Promise<void> {
  const url = `${LLM_PURPOSE_ROUTING_BASE}/${encodeURIComponent(purpose)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "DELETE",
      credentials: "include",
      signal: controller.signal,
      headers: _mutationHeaders(),
    });
    // 204 = successfully deleted; 404 = already at default. Both are success.
    if (res.status === 204 || res.status === 404) return;
    if (res.status === 401) {
      throw new AdminApiError("unauthenticated", 401, url, null);
    }
    if (res.status === 403) {
      throw new AdminApiError("forbidden", 403, url, null);
    }
    if (!res.ok) {
      throw new AdminApiError(
        `llm-purpose-routing DELETE failed (${res.status})`,
        res.status,
        url,
        null,
      );
    }
  } finally {
    clearTimeout(timer);
  }
}
