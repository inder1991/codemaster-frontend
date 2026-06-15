/* eslint-disable jsx-a11y/aria-role -- role is a custom component prop (not HTML ARIA); test files render <LlmProviderCard role="primary|secondary" /> */
/**
 * S21.LLM-DUAL.1 task 13 — unit tests for <LlmProviderCard>.
 *
 * Covers the component-level contracts:
 *   - Primary card title, no secondary notice.
 *   - Secondary card title + "not yet routed" notice.
 *   - Bedrock default: region field visible.
 *   - anthropic_direct: region field hidden.
 *   - Model ID field removed (model selection moved to catalog — ADR-0060).
 *   - Test and Save buttons disabled until API key passes local validation.
 *   - Test button calls the model-less /test-credentials endpoint.
 *   - Save form submission calls putLlmProviderConfig with role +
 *     back-compat default model_id.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { LlmProviderCard } from "@/components/admin/LlmProviderCard";

// ── Helpers ───────────────────────────────────────────────────────

let fetchSpy: ReturnType<typeof vi.spyOn> | null = null;

function mockFetch(
  callback: (url: string, init?: RequestInit) => Response | Promise<Response>,
): void {
  fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      return callback(url, init);
    },
  );
}

beforeEach(() => {
  fetchSpy = null;
});

afterEach(() => {
  fetchSpy?.mockRestore();
  fetchSpy = null;
});

// ── Tests ─────────────────────────────────────────────────────────

describe("LlmProviderCard role='primary'", () => {
  test("renders primary card title without secondary notice", () => {
    render(<LlmProviderCard role="primary" />);
    // PART 3 §3: simplified titles — rail says "Providers", card says "Primary"/"Secondary".
    expect(screen.getByText("Primary")).toBeInTheDocument();
    expect(
      screen.queryByTestId("secondary-card-notice"),
    ).not.toBeInTheDocument();
  });

  test("shows region field by default (provider=bedrock)", () => {
    render(<LlmProviderCard role="primary" />);
    expect(screen.getByTestId("primary-region-field")).toBeInTheDocument();
  });

  test("hides region field when provider switches to anthropic_direct", () => {
    render(<LlmProviderCard role="primary" />);
    const select = screen.getByTestId(
      "primary-provider-select",
    ) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "anthropic_direct" } });
    expect(
      screen.queryByTestId("primary-region-field"),
    ).not.toBeInTheDocument();
  });

  test("model id select is removed (model selection moved to catalog)", () => {
    render(<LlmProviderCard role="primary" />);
    expect(
      screen.queryByTestId("primary-model-id-select"),
    ).not.toBeInTheDocument();
  });

  test("test and save buttons are disabled when api key is empty", () => {
    render(<LlmProviderCard role="primary" />);
    const testBtn = screen.getByTestId("primary-test-btn") as HTMLButtonElement;
    const saveBtn = screen.getByTestId("primary-save-btn") as HTMLButtonElement;
    expect(testBtn).toBeDisabled();
    expect(saveBtn).toBeDisabled();
  });

  test("test and save buttons stay disabled when api key is too short", () => {
    render(<LlmProviderCard role="primary" />);
    const card = screen.getByTestId("llm-provider-card-primary");
    const keyInput = card.querySelector(
      "input[type='password']",
    ) as HTMLInputElement;
    fireEvent.change(keyInput, { target: { value: "short" } });
    const testBtn = screen.getByTestId("primary-test-btn") as HTMLButtonElement;
    const saveBtn = screen.getByTestId("primary-save-btn") as HTMLButtonElement;
    expect(testBtn).toBeDisabled();
    expect(saveBtn).toBeDisabled();
  });

  test("test and save buttons are enabled once api key is valid", () => {
    render(<LlmProviderCard role="primary" />);
    const card = screen.getByTestId("llm-provider-card-primary");
    const keyInput = card.querySelector(
      "input[type='password']",
    ) as HTMLInputElement;
    fireEvent.change(keyInput, { target: { value: "bedrock-api-key-aaaaaaaaaaaa" } });
    const testBtn = screen.getByTestId("primary-test-btn") as HTMLButtonElement;
    const saveBtn = screen.getByTestId("primary-save-btn") as HTMLButtonElement;
    expect(testBtn).not.toBeDisabled();
    expect(saveBtn).not.toBeDisabled();
  });

  test("test button calls the model-less /test-credentials endpoint", async () => {
    let capturedUrl: string | null = null;
    let capturedBody: Record<string, unknown> | null = null;

    mockFetch(async (url, init) => {
      if (url.includes("test-credentials")) {
        capturedUrl = url;
        capturedBody = JSON.parse(init?.body as string) as Record<string, unknown>;
        return new Response(
          JSON.stringify({ ok: true, message: "connection ok" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(null, { status: 404 });
    });

    render(<LlmProviderCard role="primary" />);

    const card = screen.getByTestId("llm-provider-card-primary");
    const keyInput = card.querySelector(
      "input[type='password']",
    ) as HTMLInputElement;
    fireEvent.change(keyInput, { target: { value: "bedrock-api-key-aaaaaaaaaaaa" } });

    fireEvent.click(screen.getByTestId("primary-test-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("llm-test-result-badge")).toBeInTheDocument();
    });

    expect(screen.getByTestId("llm-test-result-badge").textContent).toContain(
      "connection ok",
    );
    expect(capturedUrl).toContain(
      "/api/admin/llm-provider-config/test-credentials",
    );
    // Model-less payload: provider + region + api_key, NO model_id.
    expect(capturedBody).toMatchObject({
      schema_version: 1,
      provider: "bedrock",
      region: "us-east-1",
      api_key: "bedrock-api-key-aaaaaaaaaaaa",
    });
    expect(capturedBody).not.toHaveProperty("model_id");
  });

  test("save form calls PUT with role='primary'", async () => {
    let capturedBody: unknown = null;

    mockFetch(async (url, init) => {
      if (init?.method === "PUT") {
        capturedBody = JSON.parse(init.body as string);
        return new Response(
          JSON.stringify({
            schema_version: 1,
            model_id: "claude-sonnet-4-6",
            region: "us-east-1",
            api_key_fingerprint: "abcd",
            enabled: true,
            last_validated_at: null,
            last_validation_status: null,
            last_rotated_at: "2026-05-12T00:00:00Z",
            last_rotated_by_user_id: "00000000-0000-0000-0000-000000000001",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(null, { status: 404 });
    });

    render(<LlmProviderCard role="primary" />);

    const card = screen.getByTestId("llm-provider-card-primary");
    const keyInput = card.querySelector(
      "input[type='password']",
    ) as HTMLInputElement;
    fireEvent.change(keyInput, { target: { value: "bedrock-api-key-aaaaaaaaaaaa" } });

    fireEvent.click(screen.getByTestId("primary-save-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("primary-save-success")).toBeInTheDocument();
    });

    expect(capturedBody).toMatchObject({
      role: "primary",
      provider: "bedrock",
      schema_version: 1,
      // Back-compat default model_id sent even though it's no longer a field.
      model_id: "claude-sonnet-4-6",
    });
    // API key cleared after success.
    expect(keyInput.value).toBe("");
  });
});

describe("LlmProviderCard role='secondary'", () => {
  test("renders secondary card title with 'not yet routed' notice", () => {
    render(<LlmProviderCard role="secondary" />);
    // PART 3 §3: simplified title.
    expect(screen.getByText("Secondary")).toBeInTheDocument();
    const notice = screen.getByTestId("secondary-card-notice");
    expect(notice).toBeInTheDocument();
    expect(notice.textContent).toContain("not yet routed");
    expect(notice.textContent).toContain("future milestone");
  });

  test("save form calls PUT with role='secondary'", async () => {
    let capturedBody: unknown = null;

    mockFetch(async (url, init) => {
      if (init?.method === "PUT") {
        capturedBody = JSON.parse(init.body as string);
        return new Response(
          JSON.stringify({
            schema_version: 1,
            model_id: "claude-sonnet-4-6",
            region: null,
            api_key_fingerprint: "efgh",
            enabled: true,
            last_validated_at: null,
            last_validation_status: null,
            last_rotated_at: "2026-05-12T00:00:00Z",
            last_rotated_by_user_id: "00000000-0000-0000-0000-000000000002",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(null, { status: 404 });
    });

    render(<LlmProviderCard role="secondary" />);

    // Switch to anthropic_direct.
    const providerSelect = screen.getByTestId(
      "secondary-provider-select",
    ) as HTMLSelectElement;
    fireEvent.change(providerSelect, { target: { value: "anthropic_direct" } });

    const card = screen.getByTestId("llm-provider-card-secondary");
    const keyInput = card.querySelector(
      "input[type='password']",
    ) as HTMLInputElement;
    fireEvent.change(keyInput, {
      target: { value: "sk-ant-aaaaaaaaaaaaaaaaaaaaa" },
    });

    fireEvent.click(screen.getByTestId("secondary-save-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("secondary-save-success")).toBeInTheDocument();
    });

    expect(capturedBody).toMatchObject({
      role: "secondary",
      provider: "anthropic_direct",
      region: null,
      schema_version: 1,
      model_id: "claude-sonnet-4-6",
    });
  });
});
