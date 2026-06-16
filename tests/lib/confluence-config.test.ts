/**
 * Unit tests for the confluence-config API client.
 *
 * Pins the connectivity-probe contract: POST /api/admin/confluence-config/test
 * must forward `auth_email` in the body so the backend uses HTTP-Basic
 * (email:token) for Atlassian Cloud rather than falling back to Bearer-PAT
 * auth (which fails for Cloud). The field is optional — omit it for Server/DC
 * Bearer PATs.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { testConfluenceConfig } from "@/lib/api/confluence-config";

// `any` mirrors the clean fetch-spy pattern in tests/lib/admin-csrf.test.ts —
// typing it as MockInstance trips a parameter-variance error under this repo's
// strict tsconfig (see the pre-existing failures in LlmProviderConfigPage.test.tsx).
let fetchSpy: any;

function mockFetch(
  callback: (url: string, init?: RequestInit) => Response | Promise<Response>,
): void {
  fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      return callback(url, init);
    });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  // No csrf cookie needed; readCsrfToken tolerates absence (sends "").
  Object.defineProperty(document, "cookie", {
    configurable: true,
    get: () => "csrf_token=tok-cf",
  });
});

afterEach(() => {
  fetchSpy?.mockRestore();
});

describe("testConfluenceConfig", () => {
  it("forwards auth_email in the POST body when supplied (Atlassian Cloud HTTP-Basic)", async () => {
    let captured: { url: string; init: RequestInit | undefined } | undefined;
    mockFetch((url, init) => {
      captured = { url, init };
      return jsonResponse({ ok: true, message: "Connected." });
    });

    const result = await testConfluenceConfig({
      base_url: "https://acme.atlassian.net/wiki",
      token: "secret-tok",
      auth_email: "bot@acme.com",
    });

    expect(result).toEqual({ ok: true, message: "Connected." });
    expect(captured?.url).toContain("/api/admin/confluence-config/test");
    expect(captured?.init?.method).toBe("POST");
    const body = JSON.parse(String(captured?.init?.body));
    expect(body).toEqual({
      base_url: "https://acme.atlassian.net/wiki",
      token: "secret-tok",
      auth_email: "bot@acme.com",
    });
  });

  it("omits auth_email from the body when not supplied (Server/DC Bearer PAT)", async () => {
    let captured: { url: string; init: RequestInit | undefined } | undefined;
    mockFetch((url, init) => {
      captured = { url, init };
      return jsonResponse({ ok: true, message: "Connected." });
    });

    await testConfluenceConfig({
      base_url: "https://confluence.internal/wiki",
      token: "pat-tok",
    });

    const body = JSON.parse(String(captured?.init?.body));
    expect(body).toEqual({
      base_url: "https://confluence.internal/wiki",
      token: "pat-tok",
    });
    expect("auth_email" in body).toBe(false);
  });

  it("surfaces {ok:false} with a clear note when the probe is unwired (HTTP 503)", async () => {
    mockFetch(() => new Response(null, { status: 503 }));
    const result = await testConfluenceConfig({
      base_url: "https://acme.atlassian.net/wiki",
      token: "secret-tok",
      auth_email: "bot@acme.com",
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/isn't available in this deployment/i);
  });
});
