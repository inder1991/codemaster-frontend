/**
 * API client for GET/PUT /api/admin/confluence-config — UI-editable Confluence credentials.
 *
 * GET returns ONLY the non-secret view (configured + base_url + auth_email + enabled) — the token NEVER
 * comes back. PUT (super_admin) writes the platform singleton; the token goes out only on the PUT body. At
 * runtime the app resolves these DB > env > Vault, so a UI save takes effect without a redeploy.
 *
 * Hand-rolled fetch wrapper (the github-config.ts / llm-provider-config.ts pattern) — not in openapi.json.
 */

import { AdminApiError, readCsrfToken } from "@/lib/api/admin";

// ── Wire types ────────────────────────────────────────────────────

/** GET response — non-secret view. Fields present only when `configured`. */
export interface ConfluenceConfigV1 {
  configured: boolean;
  baseUrl?: string;
  /** Atlassian Cloud account email (HTTP-Basic); null for Bearer-PAT (Server/DC). */
  authEmail?: string | null;
  enabled?: boolean;
}

/** PUT body — the token is write-only (never echoed by GET). auth_email omitted ⇒ Bearer PAT. */
export interface ConfluenceConfigUpdateV1 {
  base_url: string;
  auth_email?: string;
  token: string;
  enabled?: boolean;
}

export const CONFLUENCE_CONFIG_QUERY_KEYS = {
  all: ["confluence-config"] as const,
  current: () => [...CONFLUENCE_CONFIG_QUERY_KEYS.all, "current"] as const,
};

// ── Fetchers ──────────────────────────────────────────────────────

const CONFLUENCE_CONFIG_URL = "/api/admin/confluence-config";
const DEFAULT_TIMEOUT_MS = 15_000;

export async function fetchConfluenceConfig(): Promise<ConfluenceConfigV1> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(CONFLUENCE_CONFIG_URL, {
      credentials: "include",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (res.status === 401) {
      throw new AdminApiError("unauthenticated", 401, CONFLUENCE_CONFIG_URL, null);
    }
    if (res.status === 403) {
      throw new AdminApiError("forbidden", 403, CONFLUENCE_CONFIG_URL, null);
    }
    if (!res.ok) {
      throw new AdminApiError(
        `confluence-config GET failed (${res.status})`,
        res.status,
        CONFLUENCE_CONFIG_URL,
        null,
      );
    }
    return (await res.json()) as ConfluenceConfigV1;
  } finally {
    clearTimeout(timer);
  }
}

export async function putConfluenceConfig(body: ConfluenceConfigUpdateV1): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const csrf = readCsrfToken();
    const res = await fetch(CONFLUENCE_CONFIG_URL, {
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
      throw new AdminApiError("unauthenticated", 401, CONFLUENCE_CONFIG_URL, null);
    }
    if (res.status === 403) {
      throw new AdminApiError("forbidden", 403, CONFLUENCE_CONFIG_URL, null);
    }
    if (res.status === 400 || res.status === 422) {
      const json = (await res.json().catch(() => null)) as unknown;
      throw new AdminApiError("request body invalid", res.status, CONFLUENCE_CONFIG_URL, json);
    }
    if (!res.ok) {
      throw new AdminApiError(
        `confluence-config PUT failed (${res.status})`,
        res.status,
        CONFLUENCE_CONFIG_URL,
        null,
      );
    }
  } finally {
    clearTimeout(timer);
  }
}
