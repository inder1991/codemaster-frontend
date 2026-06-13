/**
 * Sprint 16 / S16.D.3 — typed fetch wrappers for /api/admin/status.
 * Sprint X.1 (2026-05-11) — rewritten on top of the typed
 * `openapi-fetch` client.
 *
 * This file is the canonical example for the X.1 migration pattern.
 * The other lib/api/*.ts files migrate to the same shape in
 * subsequent commits.
 *
 * Compared with the pre-X.1 file (95 LoC of hand-written
 * `_statusFetch` + URL string + manual AbortController):
 *   • URL strings + path params are typed against `openapi.json`.
 *     A typo (`/api/admin/pipelin`) fails `pnpm typecheck`.
 *   • Wire types come from `./generated/contracts.ts` directly
 *     — no more hand-rolled TS mirrors that drift.
 *   • CSRF + Accept headers attached by the shared middleware in
 *     `client.ts` — no per-file repetition.
 *   • Error mapping shared via `asAdminApiError` — every callsite
 *     gets the same `AdminApiError` shape that page-level guards
 *     already understand.
 */

import {
  AdminApiError,
  apiClient,
  asAdminApiError,
} from "./client";
import type { components } from "./generated/contracts";

// ── Wire types — re-export from generated for consumer ergonomics ─

export type HealthState =
  components["schemas"]["PipelineStatusV1"]["bedrock_health"];
export type PipelineStatusV1 = components["schemas"]["PipelineStatusV1"];
export type PilotProgressV1 = components["schemas"]["PilotProgressV1"];

// ── Query keys ────────────────────────────────────────────────────

export const STATUS_QUERY_KEYS = {
  all: ["status"] as const,
  pipeline: () => [...STATUS_QUERY_KEYS.all, "pipeline"] as const,
  pilotProgress: () => [...STATUS_QUERY_KEYS.all, "pilot-progress"] as const,
};

// ── Fetchers ──────────────────────────────────────────────────────

export async function fetchPipelineStatus(): Promise<PipelineStatusV1> {
  const { data, error, response } = await apiClient.GET(
    "/api/admin/status/pipeline",
  );
  if (error !== undefined || !response.ok) {
    throw asAdminApiError(
      response.status,
      "/api/admin/status/pipeline",
      error ?? null,
    );
  }
  if (data === undefined) {
    // openapi-fetch types `data` as `Schema | undefined` because the
    // OpenAPI spec doesn't prove a body is present. The route IS
    // documented to return a body on 200, so this branch is
    // defense-in-depth.
    throw new AdminApiError(
      "empty body",
      response.status,
      "/api/admin/status/pipeline",
      null,
    );
  }
  return data;
}

export async function fetchPilotProgress(): Promise<PilotProgressV1> {
  const { data, error, response } = await apiClient.GET(
    "/api/admin/status/pilot-progress",
  );
  if (error !== undefined || !response.ok) {
    throw asAdminApiError(
      response.status,
      "/api/admin/status/pilot-progress",
      error ?? null,
    );
  }
  if (data === undefined) {
    throw new AdminApiError(
      "empty body",
      response.status,
      "/api/admin/status/pilot-progress",
      null,
    );
  }
  return data;
}
