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

/** PUT body — the token is write-only (never echoed by GET). auth_email omitted ⇒ Bearer PAT. The token is
 *  OPTIONAL on an UPDATE of an already-configured space (omit to keep the stored one while toggling enabled /
 *  editing the URL); REQUIRED on the initial config (the backend 422s otherwise). */
export interface ConfluenceConfigUpdateV1 {
  base_url: string;
  auth_email?: string;
  token?: string;
  enabled?: boolean;
}

export const CONFLUENCE_CONFIG_QUERY_KEYS = {
  all: ["confluence-config"] as const,
  current: () => [...CONFLUENCE_CONFIG_QUERY_KEYS.all, "current"] as const,
};

/** Result of the connectivity probe (never carries the token). */
export interface ConfluenceTestResult {
  ok: boolean;
  message: string;
}

// ── Fetchers ──────────────────────────────────────────────────────

const CONFLUENCE_CONFIG_URL = "/api/admin/confluence-config";
const CONFLUENCE_TEST_URL = "/api/admin/confluence-config/test";
const DEFAULT_TIMEOUT_MS = 15_000;
// A real connectivity probe can take several seconds.
const TEST_TIMEOUT_MS = 30_000;

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

/**
 * Probe Confluence connectivity with the given base_url + token WITHOUT persisting. Never throws on a
 * failed probe — surfaces {ok:false,message}. Returns ok:false with a clear note when the probe adapter is
 * unwired in this deployment (HTTP 503). Mirrors testLlmCredentials' shape.
 */
export async function testConfluenceConfig(body: {
  base_url: string;
  token: string;
}): Promise<ConfluenceTestResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);
  try {
    const csrf = readCsrfToken();
    const res = await fetch(CONFLUENCE_TEST_URL, {
      method: "POST",
      credentials: "include",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-CSRF-Token": csrf ?? "",
      },
      body: JSON.stringify(body),
    });
    if (res.status === 503) {
      return { ok: false, message: "Connectivity test isn't available in this deployment." };
    }
    if (!res.ok) {
      let message = `connectivity test failed (HTTP ${res.status})`;
      try {
        const json = (await res.json()) as { detail?: string };
        if (typeof json.detail === "string") message = json.detail;
      } catch {
        // body not JSON — keep the default
      }
      return { ok: false, message };
    }
    return (await res.json()) as ConfluenceTestResult;
  } finally {
    clearTimeout(timer);
  }
}
