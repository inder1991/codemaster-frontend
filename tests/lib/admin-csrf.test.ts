/**
 * Sprint 14 / S14.C — lib/api admin CSRF + new fetchers, smoke tests.
 *
 * The page-level tests cover end-to-end behavior; this file isolates
 * the small new utilities in `@/lib/api/admin` that S14.C introduces:
 *
 *   • `readCsrfToken()` — parses the JS-readable `csrf_token` cookie
 *     the backend CSRF middleware sets on every safe-method response.
 *   • `putFlag()` — sends `If-Match` + `X-CSRF-Token` headers and
 *     posts the value_json body the backend `_PutFlagV1` expects.
 *   • `searchAuditEvents()` — surfaces `X-Vault-Degraded` from the
 *     response headers as the `vault_degraded` field on the result.
 *   • `deleteIntegration()` — sends DELETE with the CSRF header.
 *
 * Red commit: these tests fail because the symbols above do not yet
 * exist in `@/lib/api/admin`. The green commit adds them.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

import {
  readCsrfToken,
  putFlag,
  deleteIntegration,
  postConfluenceSpace,
  searchAuditEvents,
  fetchQuarantinedChunks,
  fetchPages,
  postPageApproval,
  deletePageApproval,
  postTaxonomySuggestion,
} from "@/lib/api/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fetchSpy: any;

function mockFetch(impl: typeof globalThis.fetch): void {
  fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(impl as never);
}

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function setCookie(value: string): void {
  Object.defineProperty(document, "cookie", {
    configurable: true,
    get: () => value,
  });
}

beforeEach(() => {
  setCookie("");
});

afterEach(() => {
  fetchSpy?.mockRestore();
});

describe("readCsrfToken", () => {
  it("returns the csrf_token cookie value when present", () => {
    setCookie("foo=bar; csrf_token=deadbeef; other=v");
    expect(readCsrfToken()).toBe("deadbeef");
  });

  it("returns null when the cookie is absent", () => {
    setCookie("foo=bar; baz=qux");
    expect(readCsrfToken()).toBeNull();
  });

  it("decodes URL-encoded cookie values", () => {
    setCookie("csrf_token=abc%2Fdef");
    expect(readCsrfToken()).toBe("abc/def");
  });
});

describe("putFlag", () => {
  it("sends If-Match and X-CSRF-Token headers + value_json body", async () => {
    setCookie("csrf_token=tok-123");
    const seen: { url: string; init: RequestInit | undefined }[] = [];
    mockFetch(async (url: string | URL | Request, init?: RequestInit) => {
      seen.push({ url: String(url), init });
      return jsonResponse({
        flag: {
          flag_name: "f",
          scope: "repository",
          scope_id: "r",
          value_json: '{"paused": true}',
          last_changed_at: "2026-08-01T11:00:00Z",
          last_changed_by_user_id: "u",
          pending_second_approver: false,
          pending_first_approver_user_id: null,
          pending_value_json: null,
          pending_set_at: null,
        },
        path: "staged_first",
      });
    });
    await putFlag({
      flag_name: "repo_acme_web_paused",
      new_value_json: '{"paused": true}',
      if_match: "2026-08-01T09:30:00Z",
    });
    const { url, init } = seen[0]!;
    expect(url).toContain("/api/admin/flags/repo_acme_web_paused");
    expect(init?.method).toBe("PUT");
    const headers = new Headers(init?.headers);
    expect(headers.get("If-Match")).toBe("2026-08-01T09:30:00Z");
    expect(headers.get("X-CSRF-Token")).toBe("tok-123");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual({
      value_json: '{"paused": true}',
    });
  });

  it("forwards X-Typed-Confirm-Phrase when provided", async () => {
    setCookie("csrf_token=tok");
    let captured: Headers | undefined;
    mockFetch(async (url, init?: RequestInit) => {
      // S16.F.5 — skip the telemetry-endpoint fetch so
      // `captured` reflects the mutation's headers, not telemetry's.
      if (String(url).includes("/api/telemetry")) {
        return new Response(null, { status: 204 });
      }
      captured = new Headers(init?.headers);
      return jsonResponse({
        flag: {
          flag_name: "f",
          scope: "global",
          scope_id: null,
          value_json: '{"x": 1}',
          last_changed_at: "2026-08-01T11:00:00Z",
          last_changed_by_user_id: "u",
          pending_second_approver: false,
          pending_first_approver_user_id: null,
          pending_value_json: null,
          pending_set_at: null,
        },
        path: "staged_first",
      });
    });
    await putFlag({
      flag_name: "f",
      new_value_json: '{"x": 1}',
      if_match: "2026-08-01T09:00:00Z",
      typed_confirm_phrase: "flip f",
    });
    expect(captured!.get("X-Typed-Confirm-Phrase")).toBe("flip f");
  });

  it("on 409 surfaces the parsed body via AdminApiError", async () => {
    setCookie("csrf_token=tok");
    const conflict = {
      code: "stale_write",
      current_value_json: '{"paused": true}',
      current_changed_at: "2026-08-01T12:00:00Z",
    };
    mockFetch(async () => jsonResponse(conflict, 409));
    await expect(
      putFlag({
        flag_name: "f",
        new_value_json: '{"paused": false}',
        if_match: "2026-08-01T09:00:00Z",
      }),
    ).rejects.toMatchObject({ status: 409, body: conflict });
  });
});

describe("postConfluenceSpace + deleteIntegration", () => {
  it("postConfluenceSpace sends X-CSRF-Token + JSON body", async () => {
    setCookie("csrf_token=tok-77");
    let captured: { url: string; init: RequestInit | undefined } | undefined;
    mockFetch(async (url, init?: RequestInit) => {
      // S16.F.5 — skip telemetry fetches so `captured` carries
      // the mutation, not the telemetry emit.
      if (String(url).includes("/api/telemetry")) {
        return new Response(null, { status: 204 });
      }
      captured = { url: String(url), init };
      return jsonResponse(
        {
          integration_id: "int-1",
          kind: "confluence_space",
          config_json: "{}",
          enabled: true,
          last_validated_at: "2026-08-01T11:00:00Z",
          last_validation_error: null,
          created_at: "2026-08-01T11:00:00Z",
          updated_at: "2026-08-01T11:00:00Z",
        },
        201,
      );
    });
    await postConfluenceSpace({
      space_key: "ACME",
      space_name: "Acme",
      scope: "whole_space",
      page_tree_root_id: null,
      // Sub-spec C T5 fields (added to _AddConfluenceSpaceV1 alongside
      // T12 modal extension); CSRF test doesn't care about values, only
      // that the request structure validates.
      trust_tier: "trusted",
      governance_ack: false,
      visibility: "platform",
      strict_label_mode: false,
    });
    expect(captured!.url).toContain("/api/admin/integrations/confluence-spaces");
    expect(captured!.init!.method).toBe("POST");
    expect(new Headers(captured!.init!.headers).get("X-CSRF-Token")).toBe(
      "tok-77",
    );
  });

  it("deleteIntegration sends DELETE with X-CSRF-Token", async () => {
    setCookie("csrf_token=tok-99");
    let captured: { url: string; init: RequestInit | undefined } | undefined;
    mockFetch(async (url, init?: RequestInit) => {
      // S16.F.5 — skip telemetry fetches so `captured` carries
      // the mutation, not the telemetry emit.
      if (String(url).includes("/api/telemetry")) {
        return new Response(null, { status: 204 });
      }
      captured = { url: String(url), init };
      return new Response(null, { status: 204 });
    });
    await deleteIntegration("int-1");
    expect(captured!.url).toContain("/api/admin/integrations/int-1");
    expect(captured!.init!.method).toBe("DELETE");
    expect(new Headers(captured!.init!.headers).get("X-CSRF-Token")).toBe(
      "tok-99",
    );
  });
});

describe("searchAuditEvents", () => {
  it("threads filter params and surfaces vault_degraded from headers", async () => {
    let capturedUrl = "";
    mockFetch(async (url) => {
      capturedUrl = String(url);
      return jsonResponse(
        {
          rows: [
            {
              audit_event_id: "ae-1",
              actor_user_id: "alpha",
              action: "flag.put",
              target_id: "flag",
              occurred_at: "2026-08-01T11:00:00Z",
              before_excerpt: "",
              after_excerpt: "",
            },
          ],
          next_cursor: "cur-2",
        },
        200,
        { "X-Vault-Degraded": "true" },
      );
    });
    const result = await searchAuditEvents({
      actor: "alpha",
      action: "flag.put",
      from_at: "2026-07-25T00:00:00Z",
      to_at: "2026-08-01T23:59:59Z",
      cursor: "cur-1",
      size: 25,
    });
    expect(capturedUrl).toContain("/api/admin/audit-events?");
    expect(capturedUrl).toMatch(/actor=alpha/);
    expect(capturedUrl).toMatch(/action=flag\.put/);
    expect(capturedUrl).toMatch(/from_at=/);
    expect(capturedUrl).toMatch(/cursor=cur-1/);
    expect(capturedUrl).toMatch(/size=25/);
    expect(result.rows).toHaveLength(1);
    expect(result.next_cursor).toBe("cur-2");
    expect(result.vault_degraded).toBe(true);
  });

  it("vault_degraded is false when the header is absent", async () => {
    mockFetch(async () =>
      jsonResponse({ rows: [], next_cursor: null }),
    );
    const result = await searchAuditEvents();
    expect(result.vault_degraded).toBe(false);
  });
});

describe("fetchQuarantinedChunks (Sub-spec C T13)", () => {
  it("issues GET to the confluence-spaces nested path", async () => {
    let capturedUrl: string | undefined;
    mockFetch(async (url) => {
      if (String(url).includes("/api/telemetry")) {
        return new Response(null, { status: 204 });
      }
      capturedUrl = String(url);
      return jsonResponse({
        schema_version: 1,
        rows: [],
        next_cursor: null,
      });
    });
    await fetchQuarantinedChunks({
      integration_id: "11111111-2222-3333-4444-555555555555",
    });
    expect(capturedUrl).toContain(
      "/api/admin/integrations/confluence-spaces/11111111-2222-3333-4444-555555555555/quarantined-chunks",
    );
  });

  it("forwards cursor + page_size as query params", async () => {
    let capturedUrl: string | undefined;
    mockFetch(async (url) => {
      if (String(url).includes("/api/telemetry")) {
        return new Response(null, { status: 204 });
      }
      capturedUrl = String(url);
      return jsonResponse({
        schema_version: 1,
        rows: [],
        next_cursor: null,
      });
    });
    await fetchQuarantinedChunks({
      integration_id: "11111111-2222-3333-4444-555555555555",
      cursor: "50",
      page_size: 100,
    });
    expect(capturedUrl).toContain("cursor=50");
    expect(capturedUrl).toContain("page_size=100");
  });
});

describe("page approvals fetchers (Sub-spec C T14)", () => {
  it("fetchPages issues GET to the nested confluence-spaces path", async () => {
    let capturedUrl: string | undefined;
    mockFetch(async (url) => {
      if (String(url).includes("/api/telemetry")) {
        return new Response(null, { status: 204 });
      }
      capturedUrl = String(url);
      return jsonResponse({ schema_version: 1, rows: [], next_cursor: null });
    });
    await fetchPages({
      integration_id: "11111111-1111-1111-1111-111111111111",
    });
    expect(capturedUrl).toContain(
      "/api/admin/integrations/confluence-spaces/11111111-1111-1111-1111-111111111111/pages",
    );
  });

  it("postPageApproval sends POST with CSRF + JSON body", async () => {
    setCookie("csrf_token=tok-pa");
    let captured: { url: string; init: RequestInit | undefined } | undefined;
    mockFetch(async (url, init) => {
      if (String(url).includes("/api/telemetry")) {
        return new Response(null, { status: 204 });
      }
      captured = { url: String(url), init };
      return jsonResponse(
        {
          schema_version: 1,
          approval_id: "00000000-0000-0000-0000-000000000099",
          space_key: "ACME",
          page_id: "p-1",
          approver_email: "ops@example.com",
          approved_at_utc: "2026-05-28T12:00:00Z",
          approval_artifact_url: "https://board.example.com/min-42",
          scope_justification:
            "Approved by IDP governance board (cite link).",
          default_scope: "universal",
          revoked_at: null,
          revoked_by: null,
          created_at: "2026-05-28T12:00:00Z",
          updated_at: "2026-05-28T12:00:00Z",
        },
        201,
      );
    });
    await postPageApproval({
      integration_id: "11111111-1111-1111-1111-111111111111",
      page_id: "p-1",
      body: {
        schema_version: 1,
        space_key: "ACME",
        page_id: "p-1",
        approved_at_utc: "2026-05-28T12:00:00Z",
        approval_artifact_url: "https://board.example.com/min-42",
        scope_justification:
          "Approved by IDP governance board (cite link).",
        default_scope: "universal",
      },
    });
    expect(captured!.url).toContain(
      "/api/admin/integrations/confluence-spaces/11111111-1111-1111-1111-111111111111/pages/p-1/approval",
    );
    expect(captured!.init!.method).toBe("POST");
    expect(new Headers(captured!.init!.headers).get("X-CSRF-Token")).toBe(
      "tok-pa",
    );
    // P0-1 audit: body MUST NOT carry approver_email
    expect(String(captured!.init!.body)).not.toContain("approver_email");
  });

  it("deletePageApproval sends DELETE with CSRF", async () => {
    setCookie("csrf_token=tok-rev");
    let captured: { url: string; init: RequestInit | undefined } | undefined;
    mockFetch(async (url, init) => {
      if (String(url).includes("/api/telemetry")) {
        return new Response(null, { status: 204 });
      }
      captured = { url: String(url), init };
      return new Response(null, { status: 204 });
    });
    await deletePageApproval({
      integration_id: "11111111-1111-1111-1111-111111111111",
      page_id: "p-1",
    });
    expect(captured!.init!.method).toBe("DELETE");
    expect(new Headers(captured!.init!.headers).get("X-CSRF-Token")).toBe(
      "tok-rev",
    );
  });
});

describe("admin dashboards fetchers (Sub-spec C T15)", () => {
  it("postTaxonomySuggestion sends POST with CSRF + JSON body", async () => {
    setCookie("csrf_token=tok-tax");
    let captured: { url: string; init: RequestInit | undefined } | undefined;
    mockFetch(async (url, init) => {
      if (String(url).includes("/api/telemetry")) {
        return new Response(null, { status: 204 });
      }
      captured = { url: String(url), init };
      return jsonResponse(
        {
          schema_version: 1,
          suggestion_id: "00000000-0000-0000-0000-000000000077",
          queued_at: "2026-05-28T12:30:00Z",
        },
        201,
      );
    });
    await postTaxonomySuggestion({
      schema_version: 1,
      label: "unrecognized:cobol",
      proposed_canonical_label: "lang:cobol",
      rationale: "We have a few COBOL repos and reviews need that scope.",
      suggester_email: null,
    });
    expect(captured!.url).toContain("/api/admin/taxonomy/suggestions");
    expect(captured!.init!.method).toBe("POST");
    expect(new Headers(captured!.init!.headers).get("X-CSRF-Token")).toBe(
      "tok-tax",
    );
  });
});
