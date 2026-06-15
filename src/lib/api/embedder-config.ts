/**
 * API client for the DB-backed embedder config — GET/PUT /api/admin/embedder-config + POST .../test.
 *
 * Replaces the old Vault `embedder.qwen` platform-credentials path (removed backend-side). The embedder
 * base_url + model + api key now live in core.embedder_provider_settings (field-codec ciphertext); GET
 * returns ONLY the non-secret view (key_present, never the key). PUT (super_admin) STAGES the config
 * (resets validation). POST /test probes the STAGED config and, on success, PROMOTES it — so the selected
 * model is what the worker actually embeds with, recorded as provenance, no redeploy.
 *
 * Hand-rolled fetch wrapper (the confluence-config.ts / llm-provider-config.ts pattern) — not in openapi.json.
 */

import { AdminApiError, readCsrfToken } from "@/lib/api/admin";

// ── Wire types (snake_case — match the backend EmbedderConfigV1 / TestPlatformCredentialsResponseV1) ──

export type EmbedderValidationStatus = "ok" | "failed";

/** GET response — the non-secret view. `*_name`/`base_url` are null when unconfigured; the api key is NEVER
 *  returned (only `key_present`). */
export interface EmbedderConfigV1 {
  provider: "openai_compat";
  base_url: string | null;
  model_name: string | null;
  key_present: boolean;
  enabled: boolean;
  last_validation_status: EmbedderValidationStatus | null;
  last_validation_error: string | null;
  last_validated_at: string | null;
  last_rotated_at: string | null;
  last_rotated_by: string | null;
  updated_at: string | null;
}

/** PUT body — provider is server-owned (never sent). `api_key` is TRI-STATE:
 *   - absent (undefined) → keep the existing key;
 *   - null               → clear it (keyless embedder, e.g. a sidecar Ollama/vLLM);
 *   - non-empty string   → set / rotate the key. */
export interface EmbedderConfigUpdateV1 {
  base_url: string;
  model_name: string;
  api_key?: string | null;
  enabled?: boolean;
}

/** POST /test result (reuses the backend TestPlatformCredentialsResponseV1). 200 even on probe failure;
 *  409 → the staged config changed during validation (re-run). */
export interface EmbedderTestResult {
  ok: boolean;
  error: string | null;
  error_detail: string | null;
  latency_ms: number | null;
  detected_dimension: number | null;
  corpus_dimension: number | null;
}

export const EMBEDDER_CONFIG_QUERY_KEYS = {
  all: ["embedder-config"] as const,
  current: () => [...EMBEDDER_CONFIG_QUERY_KEYS.all, "current"] as const,
};

// ── Fetchers ──────────────────────────────────────────────────────

const EMBEDDER_CONFIG_URL = "/api/admin/embedder-config";
const EMBEDDER_TEST_URL = "/api/admin/embedder-config/test";
const DEFAULT_TIMEOUT_MS = 15_000;
// A real embed probe (one round-trip to the embedder + a promotion transaction) can take a few seconds.
const TEST_TIMEOUT_MS = 30_000;

export async function fetchEmbedderConfig(): Promise<EmbedderConfigV1> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(EMBEDDER_CONFIG_URL, {
      credentials: "include",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (res.status === 401) {
      throw new AdminApiError("unauthenticated", 401, EMBEDDER_CONFIG_URL, null);
    }
    if (res.status === 403) {
      throw new AdminApiError("forbidden", 403, EMBEDDER_CONFIG_URL, null);
    }
    if (!res.ok) {
      throw new AdminApiError(
        `embedder-config GET failed (${res.status})`,
        res.status,
        EMBEDDER_CONFIG_URL,
        null,
      );
    }
    return (await res.json()) as EmbedderConfigV1;
  } finally {
    clearTimeout(timer);
  }
}

export async function putEmbedderConfig(body: EmbedderConfigUpdateV1): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const csrf = readCsrfToken();
    const res = await fetch(EMBEDDER_CONFIG_URL, {
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
      throw new AdminApiError("unauthenticated", 401, EMBEDDER_CONFIG_URL, null);
    }
    if (res.status === 403) {
      throw new AdminApiError("forbidden", 403, EMBEDDER_CONFIG_URL, null);
    }
    // 409 = a model change rejected on a non-greenfield corpus (the day-2 re-embed path); 400/422 = bad body.
    if (res.status === 409 || res.status === 400 || res.status === 422) {
      const json = (await res.json().catch(() => null)) as { detail?: string } | null;
      const detail = json?.detail ?? "request rejected";
      throw new AdminApiError(detail, res.status, EMBEDDER_CONFIG_URL, json);
    }
    if (!res.ok) {
      throw new AdminApiError(
        `embedder-config PUT failed (${res.status})`,
        res.status,
        EMBEDDER_CONFIG_URL,
        null,
      );
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Probe + (on success) PROMOTE the STAGED embedder config. Never throws on a probe failure — surfaces
 * {ok:false, error, error_detail}. A 503 means the probe is unwired in this deployment; a 409 means the
 * staged config changed during validation OR a model change on a non-greenfield corpus (re-run). The api
 * key is never sent here (the backend reads the staged ciphertext).
 */
export async function testEmbedderConfig(): Promise<EmbedderTestResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);
  try {
    const csrf = readCsrfToken();
    const res = await fetch(EMBEDDER_TEST_URL, {
      method: "POST",
      credentials: "include",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-CSRF-Token": csrf ?? "",
      },
    });
    if (res.status === 503) {
      return {
        ok: false,
        error: "connectivity_error",
        error_detail: "The embedder test isn't available in this deployment.",
        latency_ms: null,
        detected_dimension: null,
        corpus_dimension: null,
      };
    }
    if (res.status === 409 || res.status === 422) {
      const json = (await res.json().catch(() => null)) as { detail?: string } | null;
      return {
        ok: false,
        error: "validation_failed",
        error_detail: json?.detail ?? `embedder test rejected (HTTP ${res.status})`,
        latency_ms: null,
        detected_dimension: null,
        corpus_dimension: null,
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        error: "connectivity_error",
        error_detail: `embedder test failed (HTTP ${res.status})`,
        latency_ms: null,
        detected_dimension: null,
        corpus_dimension: null,
      };
    }
    return (await res.json()) as EmbedderTestResult;
  } finally {
    clearTimeout(timer);
  }
}
