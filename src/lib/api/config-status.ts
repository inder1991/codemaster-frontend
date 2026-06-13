/**
 * API client for GET /api/admin/config-status — the go-live setup checklist.
 *
 * Reports, per non-blocking feature (GitHub / Confluence / auth / LLM), whether it is configured and
 * from which source (db = UI-saved, env, file, or none). NEVER returns secret values — only presence +
 * source. The pod is Ready regardless of these (only DB + the field-encryption key block boot), so this
 * drives the operator's "what's left to configure" view, not a health gate.
 *
 * Hand-rolled fetch wrapper (the llm-provider-config.ts pattern) — these endpoints are not yet in
 * contracts/openapi.json, so the typed apiClient can't reach them.
 */

import { AdminApiError } from "@/lib/api/admin";

// ── Wire types ────────────────────────────────────────────────────

export type ConfigStatusState = "configured" | "pending";
export type ConfigStatusSource = "db" | "env" | "file" | "none";

export interface ConfigStatusItem {
  /** Stable key, e.g. "github_app.app_id" | "llm.provider" | "confluence.token". */
  key: string;
  state: ConfigStatusState;
  source: ConfigStatusSource;
  /** Human note on what this gates (e.g. "no PR reviews until configured"). */
  gates?: string;
}

export interface ConfigStatusResponse {
  items: ConfigStatusItem[];
}

export const CONFIG_STATUS_QUERY_KEYS = {
  all: ["config-status"] as const,
  list: () => [...CONFIG_STATUS_QUERY_KEYS.all, "list"] as const,
};

// ── Fetcher ───────────────────────────────────────────────────────

const CONFIG_STATUS_URL = "/api/admin/config-status";
const DEFAULT_TIMEOUT_MS = 15_000;

export async function fetchConfigStatus(): Promise<ConfigStatusItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(CONFIG_STATUS_URL, {
      credentials: "include",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (res.status === 401) {
      throw new AdminApiError("unauthenticated", 401, CONFIG_STATUS_URL, null);
    }
    if (res.status === 403) {
      throw new AdminApiError("forbidden", 403, CONFIG_STATUS_URL, null);
    }
    if (!res.ok) {
      throw new AdminApiError(
        `config-status GET failed (${res.status})`,
        res.status,
        CONFIG_STATUS_URL,
        null,
      );
    }
    const json = (await res.json()) as ConfigStatusResponse;
    return json.items;
  } finally {
    clearTimeout(timer);
  }
}
