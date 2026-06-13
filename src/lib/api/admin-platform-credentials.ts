/**
 * Task 5.3 — Admin platform-credentials API client.
 *
 * Typed fetch wrappers for the per-provider Vault-backed credential
 * endpoints introduced by T5.1:
 *
 *   GET    /api/admin/platform-credentials/{confluence|embedder/qwen}
 *   PATCH  /api/admin/platform-credentials/{confluence|embedder/qwen}
 *   POST   /api/admin/platform-credentials/{confluence|embedder/qwen}/test
 *
 * Wire types are re-exported from the OpenAPI-generated module so
 * field drift between the Pydantic contract and the frontend types is
 * caught by `make codegen` (see CLAUDE.md "Architecture invariants"
 * — single source of truth for cross-process data interfaces).
 *
 * PATCH error model (set by `codemaster/api/admin/platform_credentials.py`):
 *
 *   422 body: {"detail": {"error": "<code>", "msg": "<human msg>"}}
 *
 * The known wire error codes are enumerated in `PlatformCredentialPatchErrorCode`
 * so the UI can map them to localized messages without leaning on
 * backend `msg` strings (those move as the backend evolves).
 *
 * Provider key shape:
 *   - URL paths use `/embedder/qwen` (the credential key is namespaced
 *     `embedder.qwen` but FastAPI mounts it with a `/` for tidy URLs).
 *   - TypeScript callers pass `"embedder.qwen"` (canonical credential
 *     key per `PlatformCredentialsMetaV1.credential_key`) and this
 *     module translates to the URL slug.
 */

import type { components } from "./generated/contracts";
import { readCsrfToken } from "@/lib/api/admin";

// ── Wire types (re-exported from generated) ───────────────────────

export type PlatformCredentialsMetaV1 =
  components["schemas"]["PlatformCredentialsMetaV1"];
export type PatchPlatformCredentialsRequestV1 =
  components["schemas"]["PatchPlatformCredentialsRequestV1"];
export type TestPlatformCredentialsResponseV1 =
  components["schemas"]["TestPlatformCredentialsResponseV1"];

// ── Provider key + URL routing ────────────────────────────────────

/** Canonical provider key — mirrors `PlatformCredentialsMetaV1.credential_key`. */
export type PlatformCredentialProvider = "confluence" | "embedder.qwen";

/** Translate the canonical credential key to its FastAPI URL slug.
 *  The router mounts `embedder.qwen` at `/embedder/qwen`. */
function providerSlug(provider: PlatformCredentialProvider): string {
  return provider === "embedder.qwen" ? "embedder/qwen" : provider;
}

function providerBaseUrl(provider: PlatformCredentialProvider): string {
  return `/api/admin/platform-credentials/${providerSlug(provider)}`;
}

// ── Error code vocabulary (wire-stable; matches backend literals) ─

/**
 * PATCH 422 error codes emitted by
 * `codemaster/api/admin/platform_credentials.py`. UI consumers map
 * these to human-readable strings; new codes must be added here and
 * to the consumer mapping in `PlatformCredentialsCard`.
 */
export type PlatformCredentialPatchErrorCode =
  | "https_required"
  | "ssrf_blocked"
  | "userinfo_not_allowed"
  | "dns_resolution_failed"
  | "malformed_url"
  | "dimension_mismatch"
  | "auth_error"
  | "rate_limited"
  | "connectivity_error"
  | "validation_failed"
  | "coverage_gap_present";

/**
 * Thrown by `patchPlatformCredentials` when the server returns a
 * non-2xx response. Carries the parsed `{error, msg}` detail when
 * the backend emitted the structured 422 envelope.
 */
export class PlatformCredentialPatchError extends Error {
  readonly status: number;
  readonly errorCode: PlatformCredentialPatchErrorCode | string | null;
  readonly errorDetail: string | null;

  constructor(
    message: string,
    status: number,
    errorCode: PlatformCredentialPatchErrorCode | string | null,
    errorDetail: string | null,
  ) {
    super(message);
    this.name = "PlatformCredentialPatchError";
    this.status = status;
    this.errorCode = errorCode;
    this.errorDetail = errorDetail;
  }
}

// ── React Query keys ──────────────────────────────────────────────

export const PLATFORM_CREDENTIALS_QUERY_KEYS = {
  all: ["platform-credentials"] as const,
  byProvider: (provider: PlatformCredentialProvider) =>
    ["platform-credentials", provider] as const,
} as const;

// ── Fetchers ──────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 15_000;
// PATCH triggers a Vault round-trip + upstream probe; allow more headroom.
const MUTATION_TIMEOUT_MS = 30_000;

function _csrfHeaders(): Record<string, string> {
  const csrf = readCsrfToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (csrf !== null) headers["X-CSRF-Token"] = csrf;
  return headers;
}

/** GET the redacted credential metadata (no token; never carries the secret). */
export async function fetchPlatformCredentialsMeta(
  provider: PlatformCredentialProvider,
): Promise<PlatformCredentialsMetaV1> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(providerBaseUrl(provider), {
      credentials: "include",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(
        `fetchPlatformCredentialsMeta(${provider}) failed: ${res.status}`,
      );
    }
    return (await res.json()) as PlatformCredentialsMetaV1;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * PATCH the credential. Body fields:
 *   - base_url present → rotate the base URL (alone or with token).
 *   - token present + non-empty → rotate the secret in Vault.
 *   - token omitted or empty string → re-validate only (no Vault write).
 *
 * 422 → throws `PlatformCredentialPatchError` with the wire error code.
 */
export async function patchPlatformCredentials(
  provider: PlatformCredentialProvider,
  body: PatchPlatformCredentialsRequestV1,
): Promise<PlatformCredentialsMetaV1> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MUTATION_TIMEOUT_MS);
  try {
    const res = await fetch(providerBaseUrl(provider), {
      method: "PATCH",
      credentials: "include",
      signal: controller.signal,
      headers: _csrfHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let errorCode: string | null = null;
      let errorDetail: string | null = null;
      try {
        const json = (await res.json()) as {
          detail?: { error?: string; msg?: string } | string;
        };
        const detail = json.detail;
        if (typeof detail === "object" && detail !== null) {
          errorCode = detail.error ?? null;
          errorDetail = detail.msg ?? null;
        } else if (typeof detail === "string") {
          errorDetail = detail;
        }
      } catch {
        // body is not JSON; leave fields null
      }
      throw new PlatformCredentialPatchError(
        errorCode ?? errorDetail ?? `PATCH failed: ${res.status}`,
        res.status,
        errorCode,
        errorDetail,
      );
    }
    return (await res.json()) as PlatformCredentialsMetaV1;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * POST the /test endpoint — re-runs the upstream probe against the
 * CURRENTLY stored Vault credentials. NEVER triggers a Vault write.
 * Returns `{ok, error, error_detail, latency_ms, ...}` so the UI can
 * render a success/failure banner with latency.
 *
 * Backend returns 200 with `ok=false` on failed probes; only true
 * HTTP errors (auth/CSRF/etc.) throw here.
 */
export async function testPlatformCredentials(
  provider: PlatformCredentialProvider,
): Promise<TestPlatformCredentialsResponseV1> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MUTATION_TIMEOUT_MS);
  try {
    const res = await fetch(`${providerBaseUrl(provider)}/test`, {
      method: "POST",
      credentials: "include",
      signal: controller.signal,
      headers: _csrfHeaders(),
    });
    if (!res.ok) {
      throw new Error(
        `testPlatformCredentials(${provider}) failed: ${res.status}`,
      );
    }
    return (await res.json()) as TestPlatformCredentialsResponseV1;
  } finally {
    clearTimeout(timer);
  }
}
