/**
 * Admin-console API client — Sprint 14 / S14.B + Sprint 16 / S16.A.4.
 *
 * Typed fetch wrappers for the admin-console endpoints. Schema
 * envelopes that mirror Pydantic contracts re-export from the
 * auto-generated `generated/contracts.ts` (per ADR-0005); local
 * helper types (enums like `ReviewState`, `FindingSeverity`,
 * conflict-body discriminators) stay hand-authored because they
 * have no direct OpenAPI-schema counterpart.
 *
 * Sprint 16 / S16.A.4: `make codegen` regenerates
 * `frontend/src/lib/api/generated/contracts.ts` from the
 * authoritative `openapi.json`. CI gate
 * `scripts/check_openapi_committed.py` fails PRs that drift the
 * committed openapi.json from a fresh export — closes the
 * field-drift class of bug where a Pydantic schema change
 * silently desyncs the frontend.
 */

import type { components } from "./generated/contracts";
import { timedFetch } from "@/lib/telemetry";

const ADMIN_BASE = "/api/admin";

// Lifetime-of-page request timeout. TanStack Query's default 15s suffices
// for normal traffic; the explicit AbortSignal lets us extend on slow
// dashboard endpoints without affecting the global default.
const DEFAULT_TIMEOUT_MS = 15_000;

export class AdminApiError extends Error {
  readonly status: number;
  readonly endpoint: string;
  /** Parsed JSON body of the error response, if any.
   *
   * Surfaced so callers can branch on typed error envelopes — e.g.
   * a 409 stale-write on `PUT /api/admin/flags/{name}` carries
   * `{code, current_value_json, current_changed_at}` that drives the
   * CollisionDiffModal.
   */
  readonly body: unknown;

  constructor(
    message: string,
    status: number,
    endpoint: string,
    body: unknown = null,
  ) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.endpoint = endpoint;
    this.body = body;
  }
}

// ── Shared envelope shapes (mirror contracts/admin/v1.py) ──────────

export type ReviewState = "queued" | "in_progress" | "complete" | "failed";
export type FindingSeverity =
  | "blocker"
  | "issue"
  | "suggestion"
  | "nit"
  | "none";
export type ServiceState = "healthy" | "degraded" | "down";
export type ServiceName = "api" | "workers" | "postgres" | "bedrock";

export interface ServiceHealthV1 {
  name: ServiceName;
  state: ServiceState;
  detail: string;
}

export interface DashboardSummaryV1 {
  schema_version: 1;
  services: ServiceHealthV1[];
  reviews_this_hour: number;
  latency_p95_ms: number;
  in_flight_reviews: number;
  last_updated_at: string; // ISO-8601
}

export interface ReviewListItemV1 {
  review_id: string;
  repo: string;
  pr_number: number;
  pr_title: string;
  state: ReviewState;
  severity_max: "nit" | "suggestion" | "issue" | "blocker" | null;
  finding_count: number;
  started_at: string;
  completed_at: string | null;
}

export interface ReviewsListPageV1 {
  schema_version: 1;
  items: ReviewListItemV1[];
  total: number;
  page: number;
  size: number;
}

export type ReviewFindingCitationKind =
  | "repo_path"
  | "knowledge_chunk"
  | "linter_rule"
  | "policy_rule";

export interface ReviewFindingCitationV1 {
  kind: ReviewFindingCitationKind;
  locator: string;
  excerpt: string | null;
}

export type FindingCategory =
  | "bug"
  | "security"
  | "performance"
  | "style"
  | "test"
  | "docs"
  | "config"
  | "context_breaks_consumer"
  | "other";

export interface ReviewFindingItemV1 {
  finding_id: string;
  file_path: string;
  start_line: number;
  end_line: number;
  severity: FindingSeverity;
  title: string;
  body: string;
  suggestion: string | null;
  tool_source: string | null;
  // P1-A traceability fields (additive; nullable / empty for old payloads).
  category: FindingCategory | null;
  confidence: number | null;
  scope: "chunk_observed" | "cross_chunk" | "pr_global" | null;
  citations?: ReviewFindingCitationV1[];
}

export interface ActivityEventV1 {
  seq: number;
  activity_name: string;
  state: "scheduled" | "started" | "completed" | "failed" | "retrying";
  started_at: string;
  completed_at: string | null;
  detail: string;
}

export interface GovernanceRuleV1 {
  rule_id: string;
  title: string;
  source_file: string;
  category: "security" | "architecture" | "testing" | "performance" | "style";
  intent: "require" | "recommend" | "forbid";
  status: "violated" | "satisfied";
}

export interface GovernancePanelV1 {
  policy_rules: GovernanceRuleV1[];
  applied_count: number;
  violated_count: number;
  satisfied_count: number;
}

export interface WalkthroughFileRowV1 {
  path: string;
  change_summary: string;
  severity_max: "nit" | "suggestion" | "issue" | "blocker";
  finding_count: number;
}

export interface WalkthroughLinkedIssueV1 {
  issue_number: number;
  linkage_kind: "closes" | "fixes" | "resolves" | "mentioned";
  title: string | null;
  state: "open" | "closed" | null;
}

export interface WalkthroughSummaryV1 {
  tldr: string;
  file_rows: WalkthroughFileRowV1[];
  degradation_note: string | null;
  suggested_reviewers: string[];
  linked_issues: WalkthroughLinkedIssueV1[];
}

export interface FixPromptSummaryV1 {
  prompt: string;
  generation_mode: "llm" | "deterministic_fallback";
  finding_count: number;
  truncated: boolean;
  generated_at: string;
}

export interface ReviewDetailV1 {
  schema_version: 1;
  review_id: string;
  repo: string;
  pr_number: number;
  pr_title: string;
  state: ReviewState;
  findings: ReviewFindingItemV1[];
  activities: ActivityEventV1[];
  langfuse_url: string | null;
  temporal_url: string | null;
  posted_at: string | null;
  // P1-A PR meta-row + publication verdict (additive).
  pr_author: string | null;
  base_ref: string | null;
  head_ref: string | null;
  draft: boolean;
  pr_description: string | null;
  publication_outcome:
    | "inline_posted"
    | "body_only_posted"
    | "degraded_unposted"
    | null;
  // P2 governance compliance scorecard (null when no policy bundle).
  governance: GovernancePanelV1 | null;
  // P3 the bot's structured walkthrough (null when not persisted).
  walkthrough: WalkthroughSummaryV1 | null;
  // P4 operator deep-link to the review's retrieval trace (null if none).
  retrieval_trace_id: string | null;
  // fix-prompt the aggregated Claude Code fix prompt (null when not generated).
  fix_prompt: FixPromptSummaryV1 | null;
}

export interface YourReviewsPageV1 {
  schema_version: 1;
  authored: ReviewListItemV1[];
  assigned: ReviewListItemV1[];
  user_id: string;
}

// ── Fetch helpers ──────────────────────────────────────────────────

/**
 * Read the `csrf_token` cookie value the CSRF middleware sets on every
 * safe-method response. The cookie is intentionally JS-readable
 * (HttpOnly=false) so SPA fetches can mirror it back via the
 * `X-CSRF-Token` header on unsafe methods.
 *
 * Returns `null` when the cookie is absent (e.g., first-load mutation
 * before any GET has primed the cookie). The caller decides whether to
 * fail fast or refetch the session.
 */
export function readCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(/;\s*/)
    .map((p) => p.split("=", 2))
    .find(([k]) => k === "csrf_token");
  return match ? decodeURIComponent(match[1] ?? "") : null;
}

async function _parseErrorBody(res: Response): Promise<unknown> {
  // Body may be empty (204), text (e.g., generic 500), or JSON. We
  // try JSON and fall back gracefully so the typed error code paths
  // do not depend on backend response stability for non-409 errors.
  try {
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function _adminFetchRaw(
  endpoint: string,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${ADMIN_BASE}${endpoint}`, {
      credentials: "include",
      signal: controller.signal,
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (res.status === 401) {
      // Caller is responsible for redirecting to /login; the session
      // hook handles that globally. Surface a typed error so caller
      // logic can branch on it.
      throw new AdminApiError(
        "unauthenticated",
        401,
        endpoint,
        await _parseErrorBody(res),
      );
    }
    if (res.status === 403) {
      throw new AdminApiError(
        "forbidden",
        403,
        endpoint,
        await _parseErrorBody(res),
      );
    }
    if (!res.ok) {
      throw new AdminApiError(
        `admin api ${endpoint} returned ${res.status}`,
        res.status,
        endpoint,
        await _parseErrorBody(res),
      );
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function adminFetch<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const res = await _adminFetchRaw(endpoint, init);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function _mutationHeaders(extra?: HeadersInit): HeadersInit {
  // Mutations require the CSRF double-submit token. Reading
  // synchronously avoids a redundant /api/auth/me hop — the cookie is
  // refreshed on every safe response by the backend middleware.
  const csrf = readCsrfToken();
  const base: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (csrf !== null) base["X-CSRF-Token"] = csrf;
  return { ...base, ...(extra as Record<string, string> | undefined) };
}

export async function fetchDashboard(): Promise<DashboardSummaryV1> {
  return adminFetch<DashboardSummaryV1>("/dashboard");
}

export async function fetchReviewsList(
  params: {
    page?: number;
    size?: number;
    q?: string;
    repo?: string;
    state?: string;
    org?: string;
  } = {},
): Promise<ReviewsListPageV1> {
  const qs = new URLSearchParams();
  if (params.page !== undefined) qs.set("page", String(params.page));
  if (params.size !== undefined) qs.set("size", String(params.size));
  for (const key of ["q", "repo", "state", "org"] as const) {
    const v = params[key]?.trim();
    if (v) qs.set(key, v);
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return adminFetch<ReviewsListPageV1>(`/reviews${suffix}`);
}

export interface OrgsListV1 {
  schema_version: 1;
  orgs: string[];
}

export async function fetchReviewOrgs(): Promise<OrgsListV1> {
  return adminFetch<OrgsListV1>("/orgs");
}

export async function fetchReviewDetail(
  reviewId: string,
): Promise<ReviewDetailV1> {
  if (!reviewId) {
    throw new Error("fetchReviewDetail: reviewId is required");
  }
  return adminFetch<ReviewDetailV1>(`/reviews/${encodeURIComponent(reviewId)}`);
}

export async function fetchYourReviews(): Promise<YourReviewsPageV1> {
  return adminFetch<YourReviewsPageV1>("/your-reviews");
}

// ── Finding feedback (review-detail P5) ────────────────────────────

export type FindingFeedbackVerb = "helpful" | "not_helpful" | "wrong";

export interface FindingFeedbackResponseV1 {
  feedback_event_id: string;
}

export async function submitFindingFeedback(args: {
  reviewId: string;
  findingId: string;
  verb: FindingFeedbackVerb;
}): Promise<FindingFeedbackResponseV1> {
  return adminFetch<FindingFeedbackResponseV1>(
    `/reviews/${encodeURIComponent(args.reviewId)}/findings/${encodeURIComponent(
      args.findingId,
    )}/feedback`,
    {
      method: "POST",
      headers: _mutationHeaders(),
      body: JSON.stringify({ verb: args.verb }),
    },
  );
}

// ── Flags / kill-switches (Sprint 13 / S13.1.1 + S13.1.6) ─────────

/** Re-exported from the generated `_FlagDetailHTTP.scope` enum so the
 *  enum stays in lock-step with the Pydantic Literal. */
export type FlagScope = components["schemas"]["_FlagDetailHTTP"]["scope"];

/** Sprint 16 / S16.A.4 — re-export from generated. List + detail
 *  responses share this shape so the kill-switches UI can disable
 *  the Approve CTA on rows where the current user was the first
 *  approver without paying for a detail round-trip. */
export type FlagListItemV1 = components["schemas"]["_FlagDetailHTTP"];

/** Alias retained for the PUT-response shape, where the field
 *  `flag` carries the post-write row in detail form. */
export type FlagDetailV1 = FlagListItemV1;

export type PutFlagPath = components["schemas"]["_PutFlagResponseV1"]["path"];

export type PutFlagResponseV1 = components["schemas"]["_PutFlagResponseV1"];

/** 409 body for stale-write conflicts on `PUT /api/admin/flags/{name}`. */
export interface FlagStaleWriteConflictV1 {
  code: "stale_write";
  current_value_json: string;
  current_changed_at: string;
}

/** 409 body when the same user tries to second-approve their own flip. */
export interface FlagSelfApproverConflictV1 {
  code: "self_second_approver";
}

// ── Integrations (Sprint 13 / S13.1.3) ────────────────────────────

/** Sprint 16 / S16.A.4 — re-export from generated. */
export type IntegrationV1 = components["schemas"]["_IntegrationHTTP"];

export type AddConfluenceSpaceInputV1 =
  components["schemas"]["_AddConfluenceSpaceV1"];

/** 409 body for duplicate-Confluence-space attempts. */
export interface IntegrationDuplicateConflictV1 {
  code: "duplicate";
  space_key: string;
}

// ── Quarantined chunks (Sub-spec C T6 backend, T13 frontend) ─────

export type QuarantinedChunkV1 =
  components["schemas"]["QuarantinedChunkV1"];

export type QuarantinedChunksPageV1 =
  components["schemas"]["QuarantinedChunksPageV1"];

// ── Page approvals (Sub-spec C T7 backend, T14 frontend) ─────────

/** Ingest lifecycle of a Confluence page, independent of approval.
 *
 *   * `ingested` — at least one active chunk exists in the corpus.
 *   * `not_ingested` — no active chunk yet (page is on the live list
 *     but unfetched, or approved-and-awaiting-resync).
 */
export type PageIngestStatus = "ingested" | "not_ingested";

/** Confluence live-approval-view (Phase 6, 2026-06-16).
 *
 * The backend adds `ingest_status` to the per-page row alongside the
 * existing `approval_status`. Hand-authored here (rather than via the
 * generated `components["schemas"]` re-export) because the backend's
 * openapi.json hasn't been regenerated for this field yet; once
 * `make codegen` lands it, this intersection collapses to the plain
 * re-export. Mirrors the `AuditSearchResponseV1` precedent below. */
export type PageWithApprovalV1 =
  components["schemas"]["PageWithApprovalV1"] & {
    ingest_status: PageIngestStatus;
  };

/** Confluence live-approval-view (Phase 6, 2026-06-16).
 *
 * `live_list_available` is `false` when the Confluence live page list
 * couldn't be fetched (auth/rate-limit/outage) and the endpoint
 * degraded to listing only already-ingested pages. The SPA surfaces a
 * subtle inline note in that case. Hand-authored pending codegen, as
 * with `PageWithApprovalV1` above. */
export type PagesListPageV1 =
  Omit<components["schemas"]["PagesListPageV1"], "rows"> & {
    rows: PageWithApprovalV1[];
    live_list_available: boolean;
  };

export type CreatePageApprovalRequestV1 =
  components["schemas"]["CreatePageApprovalRequestV1"];

export type ConfluencePageApprovalV1 =
  components["schemas"]["ConfluencePageApprovalV1"];

// ── Admin dashboards (Sub-spec C T8/T9/T10 backend, T15 frontend) ─

export type TaxonomyGapEntryV1 =
  components["schemas"]["TaxonomyGapEntryV1"];
export type TaxonomyGapListV1 =
  components["schemas"]["TaxonomyGapListV1"];
export type TaxonomySuggestionV1 =
  components["schemas"]["TaxonomySuggestionV1"];
export type TaxonomySuggestionAcceptedV1 =
  components["schemas"]["TaxonomySuggestionAcceptedV1"];

export type RetrievalTraceListEntryV1 =
  components["schemas"]["RetrievalTraceListEntryV1"];
export type RetrievalTraceListPageV1 =
  components["schemas"]["RetrievalTraceListPageV1"];
export type RetrievalTraceV2 = components["schemas"]["RetrievalTraceV2"];

export type DefaultCorpusHealthV1 =
  components["schemas"]["DefaultCorpusHealthV1"];

// ── Audit-events (Sprint 13 / S13.1.2) ─────────────────────────────

/** Sprint 16 / S16.A.4 — re-export from generated. */
export type AuditEventListItemV1 =
  components["schemas"]["_AuditEventListItemHTTP"];

/** Sprint 16 / S16.A.4 — re-exports the generated `rows` + `next_cursor`
 *  shape from openapi, intersected with the frontend-only
 *  `vault_degraded` flag (derived from the `X-Vault-Degraded`
 *  response header, not a JSON field). The page surfaces a yellow
 *  banner when set. */
export type AuditSearchResponseV1 =
  components["schemas"]["_AuditSearchResponseV1"] & {
    vault_degraded: boolean;
  };

/** Filter shape sent to `GET /api/admin/audit-events`. Field names
 *  intentionally match the backend query-string parameters so the URL
 *  search-param round-trip is lossless. */
export interface AuditSearchFilters {
  actor?: string;
  action?: string;
  target_id?: string;
  from_at?: string; // ISO
  to_at?: string; // ISO
  cursor?: string;
  size?: number;
  cross_tenant?: boolean;
}

// ── Fetchers — flags ──────────────────────────────────────────────

export async function fetchFlags(): Promise<FlagListItemV1[]> {
  return adminFetch<FlagListItemV1[]>("/flags");
}

export interface PutFlagArgs {
  flag_name: string;
  new_value_json: string;
  /** The flag's `last_changed_at` from the list response. Sent as the
   *  `If-Match` header verbatim; backend parses it as ISO-8601. */
  if_match: string;
  /** Required on tenant-wide flag flips; backend rejects without it. */
  typed_confirm_phrase?: string | null;
}

export async function putFlag(args: PutFlagArgs): Promise<PutFlagResponseV1> {
  const headers: Record<string, string> = {
    "If-Match": args.if_match,
  };
  if (args.typed_confirm_phrase) {
    headers["X-Typed-Confirm-Phrase"] = args.typed_confirm_phrase;
  }
  // Sprint 16 / S16.F.5 — wrap the mutation in `timedFetch` so
  // its latency surfaces in the frontend-perf Grafana panel.
  // Low-cardinality label (URL pattern, NOT the substituted
  // flag_name) keeps Grafana series count bounded.
  return timedFetch("PUT /api/admin/flags/{flag_name}", () =>
    adminFetch<PutFlagResponseV1>(
      `/flags/${encodeURIComponent(args.flag_name)}`,
      {
        method: "PUT",
        headers: _mutationHeaders(headers),
        body: JSON.stringify({ value_json: args.new_value_json }),
      },
    ),
  );
}

// ── Fetchers — integrations ───────────────────────────────────────

export async function fetchIntegrations(): Promise<IntegrationV1[]> {
  // Sprint 16 / S16.E.6 + S16.H.9 — backend returns a paginated
  // envelope: {rows: [...], next_cursor: str | null}. We unwrap
  // `.rows` here. The transitional `Array.isArray` shim was
  // removed in S16.H.9 once page-test mocks migrated.
  const page = await adminFetch<{
    rows: IntegrationV1[];
    next_cursor: string | null;
  }>("/integrations");
  return page.rows;
}

export async function postConfluenceSpace(
  input: AddConfluenceSpaceInputV1,
): Promise<IntegrationV1> {
  return timedFetch("POST /api/admin/integrations/confluence-spaces", () =>
    adminFetch<IntegrationV1>("/integrations/confluence-spaces", {
      method: "POST",
      headers: _mutationHeaders(),
      body: JSON.stringify(input),
    }),
  );
}

export async function deleteIntegration(id: string): Promise<void> {
  await timedFetch("DELETE /api/admin/integrations/{id}", () =>
    adminFetch<void>(`/integrations/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: _mutationHeaders(),
    }),
  );
}

export interface FetchQuarantinedChunksArgs {
  integration_id: string;
  cursor?: string;
  page_size?: number;
}

export async function fetchQuarantinedChunks(
  args: FetchQuarantinedChunksArgs,
): Promise<QuarantinedChunksPageV1> {
  const qs = new URLSearchParams();
  if (args.cursor !== undefined) qs.set("cursor", args.cursor);
  if (args.page_size !== undefined) qs.set("page_size", String(args.page_size));
  const suffix = qs.toString().length > 0 ? `?${qs.toString()}` : "";
  return timedFetch(
    "GET /api/admin/integrations/confluence-spaces/{integration_id}/quarantined-chunks",
    () =>
      adminFetch<QuarantinedChunksPageV1>(
        `/integrations/confluence-spaces/${encodeURIComponent(args.integration_id)}/quarantined-chunks${suffix}`,
      ),
  );
}

// ── Page approvals (Sub-spec C T7 backend, T14 frontend) ─────────

export interface FetchPagesArgs {
  integration_id: string;
  cursor?: string;
  page_size?: number;
}

export async function fetchPages(
  args: FetchPagesArgs,
): Promise<PagesListPageV1> {
  const qs = new URLSearchParams();
  if (args.cursor !== undefined) qs.set("cursor", args.cursor);
  if (args.page_size !== undefined)
    qs.set("page_size", String(args.page_size));
  const suffix = qs.toString().length > 0 ? `?${qs.toString()}` : "";
  return timedFetch(
    "GET /api/admin/integrations/confluence-spaces/{integration_id}/pages",
    () =>
      adminFetch<PagesListPageV1>(
        `/integrations/confluence-spaces/${encodeURIComponent(args.integration_id)}/pages${suffix}`,
      ),
  );
}

export interface PostPageApprovalArgs {
  integration_id: string;
  page_id: string;
  body: CreatePageApprovalRequestV1;
}

export async function postPageApproval(
  args: PostPageApprovalArgs,
): Promise<ConfluencePageApprovalV1> {
  return timedFetch(
    "POST /api/admin/integrations/confluence-spaces/{integration_id}/pages/{page_id}/approval",
    () =>
      adminFetch<ConfluencePageApprovalV1>(
        `/integrations/confluence-spaces/${encodeURIComponent(args.integration_id)}/pages/${encodeURIComponent(args.page_id)}/approval`,
        {
          method: "POST",
          headers: _mutationHeaders(),
          body: JSON.stringify(args.body),
        },
      ),
  );
}

export interface DeletePageApprovalArgs {
  integration_id: string;
  page_id: string;
}

export async function deletePageApproval(
  args: DeletePageApprovalArgs,
): Promise<void> {
  await timedFetch(
    "DELETE /api/admin/integrations/confluence-spaces/{integration_id}/pages/{page_id}/approval",
    () =>
      adminFetch<void>(
        `/integrations/confluence-spaces/${encodeURIComponent(args.integration_id)}/pages/${encodeURIComponent(args.page_id)}/approval`,
        {
          method: "DELETE",
          headers: _mutationHeaders(),
        },
      ),
  );
}

// ── Admin dashboards (Sub-spec C T8/T9/T10 backend, T15 frontend) ─

export async function fetchTaxonomyGaps(
  limit?: number,
): Promise<TaxonomyGapListV1> {
  const suffix = limit !== undefined ? `?limit=${limit}` : "";
  return timedFetch("GET /api/admin/taxonomy/gaps", () =>
    adminFetch<TaxonomyGapListV1>(`/taxonomy/gaps${suffix}`),
  );
}

export async function postTaxonomySuggestion(
  body: TaxonomySuggestionV1,
): Promise<TaxonomySuggestionAcceptedV1> {
  return timedFetch("POST /api/admin/taxonomy/suggestions", () =>
    adminFetch<TaxonomySuggestionAcceptedV1>(`/taxonomy/suggestions`, {
      method: "POST",
      headers: _mutationHeaders(),
      body: JSON.stringify(body),
    }),
  );
}

export interface FetchRetrievalTracesArgs {
  cursor?: string;
  page_size?: number;
  starvation_only?: boolean;
}

export async function fetchRetrievalTraces(
  args: FetchRetrievalTracesArgs = {},
): Promise<RetrievalTraceListPageV1> {
  const qs = new URLSearchParams();
  if (args.cursor !== undefined) qs.set("cursor", args.cursor);
  if (args.page_size !== undefined)
    qs.set("page_size", String(args.page_size));
  if (args.starvation_only) qs.set("starvation_only", "true");
  const suffix = qs.toString().length > 0 ? `?${qs.toString()}` : "";
  return timedFetch("GET /api/admin/retrieval-traces", () =>
    adminFetch<RetrievalTraceListPageV1>(`/retrieval-traces${suffix}`),
  );
}

export async function fetchRetrievalTraceDetail(
  traceId: string,
): Promise<RetrievalTraceV2> {
  return timedFetch("GET /api/admin/retrieval-traces/{trace_id}", () =>
    adminFetch<RetrievalTraceV2>(
      `/retrieval-traces/${encodeURIComponent(traceId)}`,
    ),
  );
}

export async function fetchDefaultCorpusHealth(): Promise<DefaultCorpusHealthV1> {
  return timedFetch("GET /api/admin/default-corpus/health", () =>
    adminFetch<DefaultCorpusHealthV1>("/default-corpus/health"),
  );
}

// ── Fetchers — audit-events ───────────────────────────────────────

export async function searchAuditEvents(
  filters: AuditSearchFilters = {},
): Promise<AuditSearchResponseV1> {
  const qs = new URLSearchParams();
  if (filters.actor) qs.set("actor", filters.actor);
  if (filters.action) qs.set("action", filters.action);
  if (filters.target_id) qs.set("target_id", filters.target_id);
  if (filters.from_at) qs.set("from_at", filters.from_at);
  if (filters.to_at) qs.set("to_at", filters.to_at);
  if (filters.cursor) qs.set("cursor", filters.cursor);
  if (filters.size !== undefined) qs.set("size", String(filters.size));
  if (filters.cross_tenant) qs.set("cross_tenant", "true");
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const res = await _adminFetchRaw(`/audit-events${suffix}`);
  const body = (await res.json()) as {
    rows: AuditEventListItemV1[];
    next_cursor: string | null;
  };
  return {
    ...body,
    vault_degraded: res.headers.get("X-Vault-Degraded") === "true",
  };
}

// React Query keys — co-located with fetchers so cache invalidation is
// straightforward.
export const QUERY_KEYS = {
  dashboard: () => ["admin", "dashboard"] as const,
  reviewsList: (
    filters: {
      page?: number;
      size?: number;
      q?: string;
      repo?: string;
      state?: string;
      org?: string;
    } = {},
  ) => ["admin", "reviews", filters] as const,
  reviewOrgs: () => ["admin", "review-orgs"] as const,
  reviewDetail: (id: string) => ["admin", "reviews", id] as const,
  yourReviews: () => ["admin", "your-reviews"] as const,
  flags: () => ["admin", "flags"] as const,
  integrations: () => ["admin", "integrations"] as const,
  auditEvents: (filters: AuditSearchFilters = {}) =>
    ["admin", "audit-events", filters] as const,
  quarantinedChunks: (integrationId: string, cursor?: string) =>
    ["admin", "quarantined-chunks", integrationId, cursor ?? null] as const,
  confluencePages: (integrationId: string, cursor?: string) =>
    ["admin", "confluence-pages", integrationId, cursor ?? null] as const,
  taxonomyGaps: (limit?: number) =>
    ["admin", "taxonomy-gaps", limit ?? null] as const,
  retrievalTraces: (starvationOnly?: boolean, cursor?: string) =>
    [
      "admin",
      "retrieval-traces",
      starvationOnly ?? false,
      cursor ?? null,
    ] as const,
  retrievalTraceDetail: (traceId: string) =>
    ["admin", "retrieval-trace", traceId] as const,
  defaultCorpusHealth: () => ["admin", "default-corpus-health"] as const,
} as const;
