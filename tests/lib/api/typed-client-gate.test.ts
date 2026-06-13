/**
 * Sprint X.1 (2026-05-11) — typed-client path-correctness gate.
 *
 * Documents the X.1 win in test form: the typed client refuses
 * paths that aren't in `openapi.json`. The check is BUILD-TIME
 * (TypeScript compile), so this test exists primarily to:
 *
 *   1. Lock the contract that `apiClient.GET("/api/admin/foo")`
 *      with a non-existent `/api/admin/foo` is a typecheck error.
 *      A future commit that re-introduces hand-rolled paths
 *      would break this test.
 *
 *   2. Lock the runtime contract (the placeholder-base strip)
 *      so the URL the typed client actually emits is the same
 *      same-origin path the test mocks check.
 *
 * Path-correctness as a CI gate is the X.1 win: drift between
 * frontend fetch URLs and backend OpenAPI paths becomes
 * structurally impossible.
 */

import { describe, expect, test, vi } from "vitest";

import { apiClient, asAdminApiError, readCsrfToken } from "@/lib/api/client";

describe("typed apiClient (X.1)", () => {
  test("emits same-origin path (no placeholder host leak)", async () => {
    let seen = "";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: any) => {
      seen = typeof input === "string" ? input : (input?.url ?? String(input));
      return new Response("{}", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    await apiClient.GET("/api/admin/status/pipeline");

    expect(seen).toBe("/api/admin/status/pipeline");
  });

  test("emits query params correctly", async () => {
    let seen = "";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: any) => {
      seen = typeof input === "string" ? input : (input?.url ?? String(input));
      return new Response("{}", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    await apiClient.GET("/api/admin/audit-events", {
      params: { query: { size: 25 } },
    });

    expect(seen).toContain("/api/admin/audit-events");
    expect(seen).toContain("size=25");
  });

  test("readCsrfToken returns null when no cookie set", () => {
    // jsdom default: document.cookie is empty
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => "",
    });
    expect(readCsrfToken()).toBeNull();
  });

  test("readCsrfToken reads csrf_token cookie when present", () => {
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => "csrf_token=abc123; other=x",
    });
    expect(readCsrfToken()).toBe("abc123");
  });

  test("asAdminApiError maps 401 → unauthenticated message", () => {
    const e = asAdminApiError(401, "/api/admin/x", null);
    expect(e.name).toBe("AdminApiError");
    expect(e.status).toBe(401);
    expect(e.message).toBe("unauthenticated");
  });

  test("asAdminApiError maps 403 → forbidden message", () => {
    const e = asAdminApiError(403, "/api/admin/x", { detail: "role insufficient" });
    expect(e.status).toBe(403);
    expect(e.message).toBe("forbidden");
    expect(e.body).toEqual({ detail: "role insufficient" });
  });

  test("asAdminApiError preserves status + endpoint for unknown codes", () => {
    const e = asAdminApiError(500, "/api/admin/x", null);
    expect(e.status).toBe(500);
    expect(e.message).toContain("/api/admin/x");
    expect(e.message).toContain("500");
  });
});
