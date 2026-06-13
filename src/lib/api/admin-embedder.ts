/**
 * Task 5.6 — Admin embedder lifecycle API client.
 *
 * Typed fetch wrappers for the embedder lifecycle endpoints introduced
 * by T3.3 (CRUD) + T4.2B (coverage + retrieval-mode flip), all mounted
 * per T5.1:
 *
 *   GET    /api/admin/embedder/state                 (poll every 30s)
 *   GET    /api/admin/embedder/coverage              (poll every 60s)
 *   GET    /api/admin/embedder/reembed/status?generation_id=N
 *   POST   /api/admin/embedder/reembed/start
 *   POST   /api/admin/embedder/reembed/cancel
 *   POST   /api/admin/embedder/reembed/validate
 *   POST   /api/admin/embedder/reembed/activate
 *   POST   /api/admin/embedder/reembed/rollback
 *   POST   /api/admin/embedder/reembed/manual-retire
 *   POST   /api/admin/embedder/reembed/gc
 *   POST   /api/admin/embedder/retrieval-mode
 *
 * Wire types are re-exported from the OpenAPI-generated module so
 * field drift between the Pydantic contract and the frontend types is
 * caught by `make codegen`.
 *
 * Error envelopes:
 *   409 body: {"detail": {"error": "<code>", "msg": "<human msg>"}}
 *   422 body: {"detail": {"error": "<code>", "msg": "<human msg>"}}
 *
 * Known wire error codes (see codemaster/api/admin/embedder.py):
 *   - invalid_state_transition       (409)
 *   - pending_generation_in_flight    (409)
 *   - generation_data_collected       (409)
 *   - gc_retention_not_elapsed        (409)
 *   - validation_not_passed           (422)
 *   - coverage_gap_present            (422)
 */

import type { components } from "./generated/contracts";
import { readCsrfToken } from "@/lib/api/admin";

// ── Wire types (re-exported from generated) ───────────────────────

export type EmbedderStateV1 = components["schemas"]["EmbedderStateV1"];
export type EmbeddingGenerationV1 =
  components["schemas"]["EmbeddingGenerationV1"];
export type EmbedderCoverageV1 =
  components["schemas"]["EmbedderCoverageV1"];
export type RetrievalModeRequestV1 =
  components["schemas"]["RetrievalModeRequestV1"];
export type StartReembedRequestV1 =
  components["schemas"]["StartReembedRequestV1"];
export type ActivateGenerationRequestV1 =
  components["schemas"]["ActivateGenerationRequestV1"];
export type RollbackGenerationRequestV1 =
  components["schemas"]["RollbackGenerationRequestV1"];

/** Body for the cancel / manual-retire / gc endpoints (single
 *  generation_id; the backend ships this as ``_GenerationIdRequest``). */
export interface GenerationIdRequest {
  generation_id: number;
}

/** Body for POST /reembed/validate. */
export interface ValidateRequest {
  generation_id: number;
  sample_size?: number | null;
}

/** Active retrieval-mode literal (mirrors the EmbedderStateV1 enum). */
export type RetrievalMode = "fallback" | "generation_only";

/** Generation state literal (mirrors EmbeddingGenerationV1.state). */
export type GenerationState =
  | "backfilling"
  | "ready"
  | "active"
  | "retired";

// ── Error vocabulary (wire-stable; matches backend literals) ──────

/** 409 / 422 error codes emitted by codemaster/api/admin/embedder.py. */
export type EmbedderErrorCode =
  | "invalid_state_transition"
  | "pending_generation_in_flight"
  | "generation_data_collected"
  | "gc_retention_not_elapsed"
  | "validation_not_passed"
  | "coverage_gap_present";

/**
 * Thrown by every mutation in this module when the server returns a
 * non-2xx response. Carries the parsed `{error, msg}` detail when the
 * backend emitted the structured envelope.
 */
export class EmbedderActionError extends Error {
  readonly status: number;
  readonly errorCode: EmbedderErrorCode | string | null;
  readonly errorDetail: string | null;

  constructor(
    message: string,
    status: number,
    errorCode: EmbedderErrorCode | string | null,
    errorDetail: string | null,
  ) {
    super(message);
    this.name = "EmbedderActionError";
    this.status = status;
    this.errorCode = errorCode;
    this.errorDetail = errorDetail;
  }
}

// ── React Query keys ──────────────────────────────────────────────

export const EMBEDDER_QUERY_KEYS = {
  all: ["embedder"] as const,
  state: () => ["embedder", "state"] as const,
  coverage: () => ["embedder", "coverage"] as const,
  status: (generationId: number) =>
    ["embedder", "status", generationId] as const,
} as const;

// ── Fetchers ──────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 15_000;
// Mutations may dispatch a Temporal workflow + Vault round-trip.
const MUTATION_TIMEOUT_MS = 30_000;

const BASE = "/api/admin/embedder";

function _csrfHeaders(): Record<string, string> {
  const csrf = readCsrfToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (csrf !== null) headers["X-CSRF-Token"] = csrf;
  return headers;
}

async function _parseErrorEnvelope(
  res: Response,
): Promise<{ code: string | null; detail: string | null }> {
  let code: string | null = null;
  let detail: string | null = null;
  try {
    const json = (await res.json()) as {
      detail?: { error?: string; msg?: string } | string;
    };
    const d = json.detail;
    if (typeof d === "object" && d !== null) {
      code = d.error ?? null;
      detail = d.msg ?? null;
    } else if (typeof d === "string") {
      detail = d;
    }
  } catch {
    // non-JSON body; leave both null
  }
  return { code, detail };
}

async function _postJson<TBody, TResp>(
  path: string,
  body: TBody,
): Promise<TResp> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MUTATION_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      credentials: "include",
      signal: controller.signal,
      headers: _csrfHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const { code, detail } = await _parseErrorEnvelope(res);
      throw new EmbedderActionError(
        code ?? detail ?? `POST ${path} failed: ${res.status}`,
        res.status,
        code,
        detail,
      );
    }
    return (await res.json()) as TResp;
  } finally {
    clearTimeout(timer);
  }
}

// ── GET endpoints ─────────────────────────────────────────────────

export async function fetchEmbedderState(): Promise<EmbedderStateV1> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/state`, {
      credentials: "include",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`fetchEmbedderState failed: ${res.status}`);
    }
    return (await res.json()) as EmbedderStateV1;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchEmbedderCoverage(): Promise<EmbedderCoverageV1> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/coverage`, {
      credentials: "include",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`fetchEmbedderCoverage failed: ${res.status}`);
    }
    return (await res.json()) as EmbedderCoverageV1;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchReembedStatus(
  generationId: number,
): Promise<EmbeddingGenerationV1> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${BASE}/reembed/status?generation_id=${encodeURIComponent(
        String(generationId),
      )}`,
      {
        credentials: "include",
        signal: controller.signal,
        headers: { Accept: "application/json" },
      },
    );
    if (!res.ok) {
      throw new Error(
        `fetchReembedStatus(${generationId}) failed: ${res.status}`,
      );
    }
    return (await res.json()) as EmbeddingGenerationV1;
  } finally {
    clearTimeout(timer);
  }
}

// ── POST endpoints (lifecycle actions) ────────────────────────────

export function startReembed(
  body: StartReembedRequestV1,
): Promise<EmbeddingGenerationV1> {
  return _postJson<StartReembedRequestV1, EmbeddingGenerationV1>(
    "/reembed/start",
    body,
  );
}

export function cancelReembed(
  body: GenerationIdRequest,
): Promise<EmbeddingGenerationV1> {
  return _postJson<GenerationIdRequest, EmbeddingGenerationV1>(
    "/reembed/cancel",
    body,
  );
}

export function validateReembed(
  body: ValidateRequest,
): Promise<EmbeddingGenerationV1> {
  return _postJson<ValidateRequest, EmbeddingGenerationV1>(
    "/reembed/validate",
    body,
  );
}

export function activateGeneration(
  body: ActivateGenerationRequestV1,
): Promise<EmbedderStateV1> {
  return _postJson<ActivateGenerationRequestV1, EmbedderStateV1>(
    "/reembed/activate",
    body,
  );
}

export function rollbackGeneration(
  body: RollbackGenerationRequestV1,
): Promise<EmbedderStateV1> {
  return _postJson<RollbackGenerationRequestV1, EmbedderStateV1>(
    "/reembed/rollback",
    body,
  );
}

export function manualRetireGeneration(
  body: GenerationIdRequest,
): Promise<EmbeddingGenerationV1> {
  return _postJson<GenerationIdRequest, EmbeddingGenerationV1>(
    "/reembed/manual-retire",
    body,
  );
}

export function gcGeneration(
  body: GenerationIdRequest,
): Promise<EmbeddingGenerationV1> {
  return _postJson<GenerationIdRequest, EmbeddingGenerationV1>(
    "/reembed/gc",
    body,
  );
}

export function setRetrievalMode(
  body: RetrievalModeRequestV1,
): Promise<EmbedderStateV1> {
  return _postJson<RetrievalModeRequestV1, EmbedderStateV1>(
    "/retrieval-mode",
    body,
  );
}
