/**
 * Task 5.3 — unit tests for <PlatformCredentialsCard>.
 *
 * Pins the per-spec component contracts:
 *   - Meta header renders last_rotated_at + last_rotated_by + last_validated_at.
 *   - Token-present badge flips text on `meta.token_present`.
 *   - Save button disabled when BOTH base_url and token are empty.
 *   - PATCH body contains only the filled fields (URL-only OR token-only OR both).
 *   - PATCH 422 with structured detail surfaces the human-mapped message.
 *   - Test connection: success path shows latency; failure path maps error code.
 *   - extraFields slot renders inside the form.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { PlatformCredentialsCard } from "@/components/admin/PlatformCredentialsCard";
import type { PlatformCredentialsMetaV1 } from "@/lib/api/admin-platform-credentials";

// ── Helpers ───────────────────────────────────────────────────────

let fetchSpy: ReturnType<typeof vi.spyOn> | null = null;

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

function makeMeta(
  overrides: Partial<PlatformCredentialsMetaV1> = {},
): PlatformCredentialsMetaV1 {
  return {
    base_url: "https://example.atlassian.net/wiki",
    credential_key: "confluence",
    last_rotated_at: "2026-05-28T14:32:00Z",
    last_rotated_by: "ops@example.com",
    last_validated_at: "2026-05-28T14:33:00Z",
    last_validation_error: null,
    schema_version: 1,
    token_present: true,
    ...overrides,
  };
}

function renderCard(
  props: Parameters<typeof PlatformCredentialsCard>[0],
): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrap({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  render(<PlatformCredentialsCard {...props} />, { wrapper: Wrap });
}

beforeEach(() => {
  fetchSpy = null;
  // Prime a csrf_token so _mutationHeaders sets the header.
  Object.defineProperty(document, "cookie", {
    configurable: true,
    get: () => "csrf_token=tok-plat",
  });
});

afterEach(() => {
  fetchSpy?.mockRestore();
  fetchSpy = null;
});

// ── Tests ─────────────────────────────────────────────────────────

describe("PlatformCredentialsCard — meta rendering", () => {
  test("renders meta loaded state with last_rotated_at + last_rotated_by", async () => {
    mockFetch(async (url, init) => {
      if (init?.method === undefined && url.endsWith("/confluence")) {
        return jsonResponse(makeMeta());
      }
      return jsonResponse(null, 404);
    });

    renderCard({ provider: "confluence" });

    await waitFor(() => {
      expect(screen.getByTestId("meta-last-rotated")).toBeInTheDocument();
    });

    const rotated = screen.getByTestId("meta-last-rotated").textContent ?? "";
    // Date.toLocaleString output is locale-dependent, but the operator
    // email is unambiguous.
    expect(rotated).toContain("ops@example.com");

    expect(screen.getByTestId("meta-last-validated")).toBeInTheDocument();
    expect(screen.getByTestId("token-present-badge").textContent).toBe(
      "Configured",
    );
  });

  test('renders "Not configured" badge when token_present=false', async () => {
    mockFetch(async () =>
      jsonResponse(
        makeMeta({
          token_present: false,
          last_rotated_at: null,
          last_rotated_by: null,
          last_validated_at: null,
        }),
      ),
    );

    renderCard({ provider: "confluence" });

    await waitFor(() => {
      expect(screen.getByTestId("token-present-badge")).toBeInTheDocument();
    });

    expect(screen.getByTestId("token-present-badge").textContent).toBe(
      "Not configured",
    );
  });
});

describe("PlatformCredentialsCard — Save button + PATCH body", () => {
  test("Save button disabled when both fields empty", async () => {
    mockFetch(async () => jsonResponse(makeMeta()));

    renderCard({ provider: "confluence" });

    await waitFor(() => {
      expect(screen.getByTestId("token-present-badge")).toBeInTheDocument();
    });

    const saveBtn = screen.getByTestId(
      "platform-credentials-card-confluence-save-btn",
    ) as HTMLButtonElement;
    expect(saveBtn).toBeDisabled();
  });

  test("Save button PATCHes with only base_url when only base_url filled", async () => {
    let capturedBody: unknown = null;
    mockFetch(async (url, init) => {
      if (init?.method === "PATCH") {
        capturedBody = JSON.parse(init.body as string);
        return jsonResponse(makeMeta({ base_url: "https://new.example/wiki" }));
      }
      return jsonResponse(makeMeta());
    });

    renderCard({ provider: "confluence" });

    await waitFor(() => {
      expect(screen.getByTestId("token-present-badge")).toBeInTheDocument();
    });

    const urlInput = screen.getByTestId(
      "platform-credentials-card-confluence-base-url-input",
    ) as HTMLInputElement;
    fireEvent.change(urlInput, {
      target: { value: "https://new.example/wiki" },
    });

    fireEvent.click(
      screen.getByTestId("platform-credentials-card-confluence-save-btn"),
    );

    await waitFor(() => {
      expect(
        screen.getByTestId(
          "platform-credentials-card-confluence-success-banner",
        ),
      ).toBeInTheDocument();
    });

    expect(capturedBody).toEqual({
      schema_version: 1,
      base_url: "https://new.example/wiki",
    });
  });

  test("Save button PATCHes with only token when only token filled (re-validate path also covered)", async () => {
    let capturedBody: unknown = null;
    mockFetch(async (url, init) => {
      if (init?.method === "PATCH") {
        capturedBody = JSON.parse(init.body as string);
        return jsonResponse(makeMeta());
      }
      return jsonResponse(makeMeta());
    });

    renderCard({ provider: "confluence" });

    await waitFor(() => {
      expect(screen.getByTestId("token-present-badge")).toBeInTheDocument();
    });

    const tokenInput = screen.getByTestId(
      "platform-credentials-card-confluence-token-input",
    ) as HTMLInputElement;
    fireEvent.change(tokenInput, {
      target: { value: "new-secret-token" },
    });

    fireEvent.click(
      screen.getByTestId("platform-credentials-card-confluence-save-btn"),
    );

    await waitFor(() => {
      expect(
        screen.getByTestId(
          "platform-credentials-card-confluence-success-banner",
        ),
      ).toBeInTheDocument();
    });

    expect(capturedBody).toEqual({
      schema_version: 1,
      token: "new-secret-token",
    });
    // Token field cleared after success (secret should not linger in DOM).
    expect(tokenInput.value).toBe("");
  });

  test("PATCH 422 https_required maps to human message", async () => {
    mockFetch(async (url, init) => {
      if (init?.method === "PATCH") {
        return jsonResponse(
          { detail: { error: "https_required", msg: "URL is http" } },
          422,
        );
      }
      return jsonResponse(makeMeta());
    });

    renderCard({ provider: "confluence" });

    await waitFor(() => {
      expect(screen.getByTestId("token-present-badge")).toBeInTheDocument();
    });

    fireEvent.change(
      screen.getByTestId(
        "platform-credentials-card-confluence-base-url-input",
      ),
      { target: { value: "http://insecure.example" } },
    );

    fireEvent.click(
      screen.getByTestId("platform-credentials-card-confluence-save-btn"),
    );

    await waitFor(() => {
      expect(
        screen.getByTestId(
          "platform-credentials-card-confluence-error-banner",
        ),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByTestId(
        "platform-credentials-card-confluence-error-banner",
      ).textContent,
    ).toContain("URL must use https");
  });
});

describe("PlatformCredentialsCard — Test connection", () => {
  test("Test connection success shows latency", async () => {
    mockFetch(async (url, init) => {
      if (init?.method === "POST" && url.endsWith("/test")) {
        return jsonResponse({
          ok: true,
          error: null,
          error_detail: null,
          latency_ms: 142,
          corpus_dimension: null,
          detected_dimension: null,
          schema_version: 1,
        });
      }
      return jsonResponse(makeMeta());
    });

    renderCard({ provider: "confluence" });

    await waitFor(() => {
      expect(screen.getByTestId("token-present-badge")).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByTestId("platform-credentials-card-confluence-test-btn"),
    );

    await waitFor(() => {
      expect(
        screen.getByTestId(
          "platform-credentials-card-confluence-success-banner",
        ),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByTestId(
        "platform-credentials-card-confluence-success-banner",
      ).textContent,
    ).toContain("142ms");
  });

  test("Test connection failure maps error code (auth_error → human message)", async () => {
    mockFetch(async (url, init) => {
      if (init?.method === "POST" && url.endsWith("/test")) {
        return jsonResponse({
          ok: false,
          error: "auth_error",
          error_detail: "401 from upstream",
          latency_ms: 89,
          corpus_dimension: null,
          detected_dimension: null,
          schema_version: 1,
        });
      }
      return jsonResponse(makeMeta());
    });

    renderCard({ provider: "confluence" });

    await waitFor(() => {
      expect(screen.getByTestId("token-present-badge")).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByTestId("platform-credentials-card-confluence-test-btn"),
    );

    await waitFor(() => {
      expect(
        screen.getByTestId(
          "platform-credentials-card-confluence-error-banner",
        ),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByTestId(
        "platform-credentials-card-confluence-error-banner",
      ).textContent,
    ).toContain("Authentication failed");
  });
});

describe("PlatformCredentialsCard — extraFields slot", () => {
  test("extraFields slot renders inside the form (Qwen provider)", async () => {
    mockFetch(async () =>
      jsonResponse(
        makeMeta({
          credential_key: "embedder.qwen",
          base_url: "https://qwen.internal.platform.com/v1",
        }),
      ),
    );

    renderCard({
      provider: "embedder.qwen",
      extraFields: (
        <div data-testid="extra-fields-content">model name picker placeholder</div>
      ),
    });

    await waitFor(() => {
      expect(screen.getByTestId("token-present-badge")).toBeInTheDocument();
    });

    expect(screen.getByTestId("extra-fields-content")).toBeInTheDocument();
    expect(
      screen.getByTestId("platform-credentials-card-embedder-qwen-extra-fields"),
    ).toBeInTheDocument();
    // URL routing reaches /embedder/qwen, not /embedder.qwen.
    expect(
      (fetchSpy?.mock.calls?.[0]?.[0] as string | undefined) ?? "",
    ).toContain("/embedder/qwen");
  });
});
