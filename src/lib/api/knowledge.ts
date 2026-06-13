/**
 * Sprint 15 / S15.C + Sprint 16 / S16.A.4 — typed fetch wrappers
 * for /api/admin/knowledge.
 *
 * Wire envelopes re-export from the auto-generated
 * `generated/contracts.ts` per ADR-0005. `make codegen` regenerates
 * from `openapi.json`; CI gate fails PRs that drift the committed
 * spec from a fresh export.
 */

import type { components } from "./generated/contracts";
import { AdminApiError, readCsrfToken } from "@/lib/api/admin";

const KNOWLEDGE_BASE = "/api/admin/knowledge";
const DEFAULT_TIMEOUT_MS = 15_000;

// ── Wire types (Sprint 16 / S16.A.4 — re-exported from generated) ──

export type LearningState =
  components["schemas"]["_LearningListItemHTTP"]["state"];

export type LearningListItemV1 =
  components["schemas"]["_LearningListItemHTTP"];

export type LearningRevisionV1 = components["schemas"]["_RevisionHTTP"];

export type LearningDetailV1 = components["schemas"]["_LearningDetailHTTP"];

export type ProposalV1 = components["schemas"]["_ProposalHTTP"];

export type UpdateLearningBodyV1 =
  components["schemas"]["_UpdateLearningBodyV1"];

/** 409-conflict body shape for stale-write — the router emits this
 *  inline in `HTTPException(409, {...})`; not an OpenAPI schema, so
 *  hand-authored. */
export interface StaleWriteConflictV1 {
  code: "stale_write";
  current_body: string;
  current_version: number;
}

// ── Errors ────────────────────────────────────────────────────────

export class KnowledgeStaleWriteError extends Error {
  conflict: StaleWriteConflictV1;
  constructor(conflict: StaleWriteConflictV1) {
    super("knowledge: stale write — current_version differs");
    this.name = "KnowledgeStaleWriteError";
    this.conflict = conflict;
  }
}

// ── Internals ─────────────────────────────────────────────────────

async function _parseErrorBody(res: Response): Promise<unknown> {
  try {
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

async function _fetch<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${KNOWLEDGE_BASE}${path}`, {
      credentials: "include",
      signal: controller.signal,
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (res.status === 401) {
      throw new AdminApiError(
        "unauthenticated",
        401,
        path,
        await _parseErrorBody(res),
      );
    }
    if (res.status === 403) {
      throw new AdminApiError(
        "forbidden",
        403,
        path,
        await _parseErrorBody(res),
      );
    }
    if (res.status === 409) {
      const body = (await _parseErrorBody(res)) as
        | { detail?: StaleWriteConflictV1 }
        | StaleWriteConflictV1
        | null;
      const conflict =
        body && typeof body === "object" && "code" in body
          ? (body as StaleWriteConflictV1)
          : body && typeof body === "object" && "detail" in body
            ? (body.detail as StaleWriteConflictV1)
            : null;
      if (conflict?.code === "stale_write") {
        throw new KnowledgeStaleWriteError(conflict);
      }
      throw new AdminApiError(
        "conflict",
        409,
        path,
        body,
      );
    }
    if (!res.ok) {
      throw new AdminApiError(
        `knowledge api ${path} returned ${res.status}`,
        res.status,
        path,
        await _parseErrorBody(res),
      );
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function _mutationHeaders(extra?: HeadersInit): HeadersInit {
  const csrf = readCsrfToken();
  const base: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (csrf !== null) base["X-CSRF-Token"] = csrf;
  return { ...base, ...(extra as Record<string, string> | undefined) };
}

// ── Fetchers ──────────────────────────────────────────────────────

export async function fetchLearnings(): Promise<LearningListItemV1[]> {
  // Sprint 16 / S16.E.6 + S16.H.9 — backend returns a paginated
  // envelope: {rows: [...], next_cursor: str | null}. We unwrap
  // `.rows` here so the page.tsx continues to receive an array.
  // The S16.E.6 transitional `Array.isArray` shim was removed in
  // S16.H.9 once page-test mocks migrated to the envelope shape.
  const page = await _fetch<{
    rows: LearningListItemV1[];
    next_cursor: string | null;
  }>("");
  return page.rows;
}

export async function fetchLearning(
  learningId: string,
): Promise<LearningDetailV1> {
  return _fetch<LearningDetailV1>(`/${encodeURIComponent(learningId)}`);
}

export async function updateLearningBody(args: {
  learning_id: string;
  body_markdown: string;
  if_match_version: number;
}): Promise<LearningDetailV1> {
  return _fetch<LearningDetailV1>(
    `/${encodeURIComponent(args.learning_id)}`,
    {
      method: "PUT",
      headers: _mutationHeaders({ "If-Match": String(args.if_match_version) }),
      body: JSON.stringify({ body_markdown: args.body_markdown }),
    },
  );
}

export async function fetchProposals(): Promise<ProposalV1[]> {
  // Sprint 16 / S16.E.6 + S16.H.9 — paginated envelope; unwrap
  // `.rows`. The transitional array-shape shim was removed in
  // S16.H.9 once page-test mocks migrated.
  const page = await _fetch<{
    rows: ProposalV1[];
    next_cursor: string | null;
  }>("/proposals");
  return page.rows;
}

export async function approveProposal(proposalId: string): Promise<void> {
  await _fetch<void>(
    `/proposals/${encodeURIComponent(proposalId)}/approve`,
    {
      method: "POST",
      headers: _mutationHeaders(),
    },
  );
}

export async function rejectProposal(
  proposalId: string,
  reason: string,
): Promise<void> {
  await _fetch<void>(
    `/proposals/${encodeURIComponent(proposalId)}/reject`,
    {
      method: "POST",
      headers: _mutationHeaders(),
      body: JSON.stringify({ reason }),
    },
  );
}

// ── React Query keys ──────────────────────────────────────────────

export const KNOWLEDGE_QUERY_KEYS = {
  list: () => ["admin", "knowledge", "list"] as const,
  detail: (id: string) => ["admin", "knowledge", "detail", id] as const,
  proposals: () => ["admin", "knowledge", "proposals"] as const,
} as const;
