/**
 * Unit tests for <ConfluenceConfigCard>.
 *
 * Pins two operator-facing contracts:
 *   - "Test connection" forwards the form's auth_email to
 *     testConfluenceConfig so the backend uses HTTP-Basic (email:token) for
 *     Atlassian Cloud rather than falling back to Bearer-PAT auth.
 *   - The Base URL field carries help text reminding operators to include
 *     the context path (e.g. `/wiki` for Atlassian Cloud).
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConfluenceConfigCard } from "@/components/admin/ConfluenceConfigCard";

// Mock the API client so the card's wiring is the unit under test.
const fetchConfluenceConfig = vi.fn();
const putConfluenceConfig = vi.fn();
const testConfluenceConfig = vi.fn();
vi.mock("@/lib/api/confluence-config", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/api/confluence-config")
  >("@/lib/api/confluence-config");
  return {
    ...actual,
    fetchConfluenceConfig: () => fetchConfluenceConfig(),
    putConfluenceConfig: (body: unknown) => putConfluenceConfig(body),
    testConfluenceConfig: (body: unknown) => testConfluenceConfig(body),
  };
});

function renderCard(): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrap({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  render(<ConfluenceConfigCard />, { wrapper: Wrap });
}

beforeEach(() => {
  fetchConfluenceConfig.mockReset();
  putConfluenceConfig.mockReset();
  testConfluenceConfig.mockReset();
  // Not configured by default → both base_url + token required to test.
  fetchConfluenceConfig.mockResolvedValue({ configured: false });
  testConfluenceConfig.mockResolvedValue({ ok: true, message: "Connected." });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ConfluenceConfigCard — Test connection", () => {
  it("forwards the entered auth_email (alongside base_url + token) to testConfluenceConfig", async () => {
    renderCard();
    const user = userEvent.setup();
    await waitFor(() =>
      expect(screen.getByTestId("confluence-config-card")).toBeInTheDocument(),
    );

    await user.type(
      screen.getByLabelText(/base url/i),
      "https://acme.atlassian.net/wiki",
    );
    await user.type(screen.getByLabelText(/auth email/i), "bot@acme.com");
    await user.type(screen.getByLabelText(/api token/i), "secret-tok");

    const testBtn = screen.getByRole("button", { name: /test connection/i });
    await waitFor(() => expect(testBtn).toBeEnabled());
    await user.click(testBtn);

    await waitFor(() => expect(testConfluenceConfig).toHaveBeenCalledTimes(1));
    expect(testConfluenceConfig).toHaveBeenCalledWith({
      base_url: "https://acme.atlassian.net/wiki",
      token: "secret-tok",
      auth_email: "bot@acme.com",
    });
  });

  it("omits auth_email from the probe when the field is blank (Server/DC Bearer PAT)", async () => {
    renderCard();
    const user = userEvent.setup();
    await waitFor(() =>
      expect(screen.getByTestId("confluence-config-card")).toBeInTheDocument(),
    );

    await user.type(
      screen.getByLabelText(/base url/i),
      "https://confluence.internal/wiki",
    );
    await user.type(screen.getByLabelText(/api token/i), "pat-tok");

    const testBtn = screen.getByRole("button", { name: /test connection/i });
    await waitFor(() => expect(testBtn).toBeEnabled());
    await user.click(testBtn);

    await waitFor(() => expect(testConfluenceConfig).toHaveBeenCalledTimes(1));
    const arg = testConfluenceConfig.mock.calls[0]![0] as Record<string, unknown>;
    expect(arg).toMatchObject({
      base_url: "https://confluence.internal/wiki",
      token: "pat-tok",
    });
    expect("auth_email" in arg).toBe(false);
  });
});

describe("ConfluenceConfigCard — Base URL help text", () => {
  it("reminds operators to include the context path (e.g. /wiki for Atlassian Cloud)", async () => {
    renderCard();
    await waitFor(() =>
      expect(screen.getByTestId("confluence-config-card")).toBeInTheDocument(),
    );
    // The hint is wired to the Base URL input via aria-describedby — assert it
    // exists and mentions the Cloud /wiki context path + the Server/DC context path.
    // (Its text is split across <code> fragments, so match on textContent by id.)
    const baseUrl = screen.getByLabelText(/base url/i);
    const hintId = baseUrl.getAttribute("aria-describedby");
    expect(hintId).toBeTruthy();
    const hint = document.getElementById(hintId!);
    expect(hint).not.toBeNull();
    const text = hint!.textContent ?? "";
    expect(text).toMatch(/atlassian cloud/i);
    expect(text).toMatch(/\/wiki/);
    expect(text).toMatch(/context path/i);
  });
});
