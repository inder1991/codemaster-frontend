/**
 * API client for GET/PUT /api/admin/github-config — UI-editable GitHub App credentials.
 *
 * GET returns ONLY the non-secret view (configured + app_id + enabled) — the private key + webhook secret
 * NEVER come back. PUT (super_admin) writes the platform singleton; the secrets go out only on the PUT
 * body. At runtime the app resolves these DB > env > Vault, so a UI save takes effect without a redeploy.
 *
 * Hand-rolled fetch wrapper (the llm-provider-config.ts pattern) — not yet in contracts/openapi.json.
 */

import { AdminApiError, readCsrfToken } from "@/lib/api/admin";

// ── Wire types ────────────────────────────────────────────────────

/** GET response — non-secret view. `appId`/`enabled` present only when `configured`. */
export interface GitHubConfigV1 {
  configured: boolean;
  appId?: string;
  enabled?: boolean;
}

/** PUT body — the secrets are write-only (never echoed by GET). */
export interface GitHubConfigUpdateV1 {
  app_id: string;
  private_key_pem: string;
  webhook_secret: string;
  enabled?: boolean;
}

export const GITHUB_CONFIG_QUERY_KEYS = {
  all: ["github-config"] as const,
  current: () => [...GITHUB_CONFIG_QUERY_KEYS.all, "current"] as const,
};

// ── Fetchers ──────────────────────────────────────────────────────

const GITHUB_CONFIG_URL = "/api/admin/github-config";
const DEFAULT_TIMEOUT_MS = 15_000;

export async function fetchGitHubConfig(): Promise<GitHubConfigV1> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(GITHUB_CONFIG_URL, {
      credentials: "include",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (res.status === 401) {
      throw new AdminApiError("unauthenticated", 401, GITHUB_CONFIG_URL, null);
    }
    if (res.status === 403) {
      throw new AdminApiError("forbidden", 403, GITHUB_CONFIG_URL, null);
    }
    if (!res.ok) {
      throw new AdminApiError(
        `github-config GET failed (${res.status})`,
        res.status,
        GITHUB_CONFIG_URL,
        null,
      );
    }
    return (await res.json()) as GitHubConfigV1;
  } finally {
    clearTimeout(timer);
  }
}

export async function putGitHubConfig(body: GitHubConfigUpdateV1): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const csrf = readCsrfToken();
    const res = await fetch(GITHUB_CONFIG_URL, {
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
      throw new AdminApiError("unauthenticated", 401, GITHUB_CONFIG_URL, null);
    }
    if (res.status === 403) {
      throw new AdminApiError("forbidden", 403, GITHUB_CONFIG_URL, null);
    }
    if (res.status === 400 || res.status === 422) {
      const json = (await res.json().catch(() => null)) as unknown;
      throw new AdminApiError("request body invalid", res.status, GITHUB_CONFIG_URL, json);
    }
    if (!res.ok) {
      throw new AdminApiError(
        `github-config PUT failed (${res.status})`,
        res.status,
        GITHUB_CONFIG_URL,
        null,
      );
    }
  } finally {
    clearTimeout(timer);
  }
}
