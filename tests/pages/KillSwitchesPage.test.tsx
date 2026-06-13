/**
 * Sprint 14 / S14.C — KillSwitchesPage unit tests.
 *
 * Pins the wiring contract laid out in sprint-14.md S14.C:
 *
 *   • GET /api/admin/flags on mount; loading / error / 401 / 403 are
 *     fail-closed via the shared admin-query guard.
 *   • PUT /api/admin/flags/{name} sends If-Match (taken from the row's
 *     last_changed_at) AND X-CSRF-Token (from the cookie set by the
 *     S14.A CSRF middleware).
 *   • A 409 stale-write opens CollisionDiffModal with the server's
 *     current value alongside the user's attempted value.
 *   • The two-person approval state surfaces correctly:
 *       — pending_second_approver=true + first_approver != current user
 *         → "Approve" CTA enabled.
 *       — pending_second_approver=true + first_approver == current user
 *         → "Approve" disabled (user cannot self-approve their own flip).
 *   • The "Simulate edit conflict" debug element is absent in the
 *     production build (data-testid="simulate-conflict" must not appear).
 *
 * Red commit: these tests fail because the page still imports
 * `getFlags()` from `@/lib/mock/flags` and never hits fetch. The green
 * commit rewires it to TanStack Query against the real endpoint.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import KillSwitchesPage from "@/app/(authed)/kill-switches/page";
import type { FlagListItemV1 } from "@/lib/api/admin";
import type { MeResponse } from "@/lib/auth/use-session";

// ── router mock ────────────────────────────────────────────────────

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// ── session mock ───────────────────────────────────────────────────
//
// The page reads the current user's id via useSession() so it can
// disable the Approve button when the current user is also the first
// approver. We mock it here per-test by overriding the resolved value.

const mockSession: { value: MeResponse | null } = {
  value: {
    schema_version: 1,
    user_id: "current-user-uid",
    role: "platform_owner",
    email: "owner@codemaster.local",
    installation_id: "11111111-1111-1111-1111-111111111111",
  },
};

vi.mock("@/lib/auth/use-session", () => ({
  useSession: () => ({
    data: mockSession.value,
    error: null,
    isLoading: false,
    isError: false,
  }),
  SESSION_QUERY_KEY: ["auth", "me"],
}));

// ── fetch mock ─────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fetchSpy: any;

function mockFetch(impl: typeof globalThis.fetch): void {
  fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(impl as never);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeFlag(overrides: Partial<FlagListItemV1> = {}): FlagListItemV1 {
  return {
    flag_name: "repo_acme_web_paused",
    scope: "repository",
    scope_id: "acme-web-repo-id",
    value_json: '{"paused": false}',
    last_changed_at: "2026-08-01T09:30:00Z",
    last_changed_by_user_id: "alpha-uid",
    pending_second_approver: false,
    pending_first_approver_user_id: null,
    pending_value_json: null,
    pending_set_at: null,
    ...overrides,
  };
}

function setCookie(value: string): void {
  Object.defineProperty(document, "cookie", {
    configurable: true,
    get: () => value,
  });
}

function renderPage(): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrap({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  render(<KillSwitchesPage />, { wrapper: Wrap });
}

beforeEach(() => {
  mockPush.mockReset();
  mockSession.value = {
    schema_version: 1,
    user_id: "current-user-uid",
    role: "platform_owner",
    email: "owner@codemaster.local",
    installation_id: "11111111-1111-1111-1111-111111111111",
  };
  setCookie("csrf_token=tok-xyz");
});

afterEach(() => {
  fetchSpy?.mockRestore();
});

describe("KillSwitchesPage — wiring", () => {
  it("renders the loading skeleton while the request is in flight", () => {
    let resolve: (r: Response) => void = () => {};
    mockFetch(
      () =>
        new Promise<Response>((r) => {
          resolve = r;
        }),
    );
    renderPage();
    expect(screen.getByTestId("kill-switches-loading")).toBeInTheDocument();
    resolve(jsonResponse([]));
  });

  it("calls GET /api/admin/flags on mount", async () => {
    const calls: string[] = [];
    mockFetch(async (url: string | URL | Request) => {
      const u =
        typeof url === "string"
          ? url
          : url instanceof URL
            ? url.toString()
            : url.url;
      calls.push(u);
      return jsonResponse([]);
    });
    renderPage();
    await waitFor(() => {
      expect(calls.some((c) => c.includes("/api/admin/flags"))).toBe(true);
    });
  });

  it("renders the Edit CTA on a non-pending flag", async () => {
    mockFetch(async () => jsonResponse([makeFlag()]));
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^edit$/i }),
      ).toBeInTheDocument();
    });
  });

  it("renders the pending state + enabled Approve CTA when another user staged the flip", async () => {
    mockFetch(async () =>
      jsonResponse([
        makeFlag({
          pending_second_approver: true,
          pending_first_approver_user_id: "beta-uid",
          pending_value_json: '{"paused": true}',
          pending_set_at: "2026-08-01T11:00:00Z",
        }),
      ]),
    );
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByText(/pending second approver/i),
      ).toBeInTheDocument();
    });
    const approve = screen.getByRole("button", { name: /^approve$/i });
    expect(approve).toBeEnabled();
  });

  it("disables the Approve CTA when the current user was the first approver (self-second-approval forbidden)", async () => {
    mockFetch(async () =>
      jsonResponse([
        makeFlag({
          pending_second_approver: true,
          pending_first_approver_user_id: "current-user-uid",
          pending_value_json: '{"paused": true}',
          pending_set_at: "2026-08-01T11:00:00Z",
        }),
      ]),
    );
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByText(/pending second approver/i),
      ).toBeInTheDocument();
    });
    const approve = screen.getByRole("button", { name: /approve/i });
    expect(approve).toBeDisabled();
    expect(
      screen.getByText(/cannot approve your own flip/i),
    ).toBeInTheDocument();
  });

  it("PUT mutation includes If-Match (last_changed_at) + X-CSRF-Token headers", async () => {
    const flag = makeFlag();
    let putCapture: { url: string; init?: RequestInit } | undefined;
    mockFetch(async (url: string | URL | Request, init?: RequestInit) => {
      const u = typeof url === "string" ? url : (url as URL | Request).toString();
      if (u.includes("/api/admin/flags/") && init?.method === "PUT") {
        putCapture = { url: u, init };
        return jsonResponse({
          flag: {
            ...flag,
            pending_second_approver: true,
            pending_first_approver_user_id: "current-user-uid",
            pending_value_json: '{"paused": true}',
            pending_set_at: "2026-08-01T11:00:00Z",
          },
          path: "staged_first",
        });
      }
      return jsonResponse([flag]);
    });
    renderPage();
    const user = userEvent.setup();
    const editBtn = await screen.findByRole("button", { name: /^edit$/i });
    await user.click(editBtn);

    const reasonInput = await screen.findByLabelText(/^reason$/i);
    await user.type(reasonInput, "Cost spike — incident");
    // Repo-scoped flag: no typed-confirm gate; reason ≥5 chars enables submit.
    const submit = screen.getByRole("button", { name: /^stage change$/i });
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);

    await waitFor(() => expect(putCapture).toBeTruthy());
    expect(putCapture!.url).toContain(
      "/api/admin/flags/repo_acme_web_paused",
    );
    const headers = new Headers(putCapture!.init?.headers);
    expect(headers.get("If-Match")).toBe("2026-08-01T09:30:00Z");
    expect(headers.get("X-CSRF-Token")).toBe("tok-xyz");
  });

  it("opens CollisionDiffModal with the server's current value on a 409 stale_write", async () => {
    const flag = makeFlag();
    let listCalls = 0;
    mockFetch(async (url: string | URL | Request, init?: RequestInit) => {
      const u = typeof url === "string" ? url : (url as URL | Request).toString();
      if (u.includes("/api/admin/flags/") && init?.method === "PUT") {
        return jsonResponse(
          {
            code: "stale_write",
            current_value_json: '{"paused": true}',
            current_changed_at: "2026-08-01T11:45:00Z",
          },
          409,
        );
      }
      listCalls += 1;
      return jsonResponse([flag]);
    });
    renderPage();
    const user = userEvent.setup();
    const editBtn = await screen.findByRole("button", { name: /^edit$/i });
    await user.click(editBtn);
    const reasonInput = await screen.findByLabelText(/^reason$/i);
    await user.type(reasonInput, "Cost spike — incident");
    const submit = screen.getByRole("button", { name: /^stage change$/i });
    await user.click(submit);

    await waitFor(() => {
      expect(screen.getByText(/edit conflict/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/use mine/i)).toBeInTheDocument();
    // The server-current value JSON is rendered inside the diff panel.
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/"paused": true/)).toBeInTheDocument();
    expect(listCalls).toBeGreaterThan(0);
  });

  it("'Simulate edit conflict' debug button is absent in the production build", async () => {
    mockFetch(async () => jsonResponse([makeFlag()]));
    renderPage();
    await screen.findByRole("button", { name: /^edit$/i });
    expect(screen.queryByTestId("simulate-conflict")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/simulate edit conflict/i),
    ).not.toBeInTheDocument();
  });

  it("redirects to /login on 401 (fail-closed)", async () => {
    mockFetch(async () => jsonResponse({ detail: "unauthenticated" }, 401));
    renderPage();
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/login");
    });
  });

  it("renders 'Access denied' inline on 403 (fail-closed)", async () => {
    mockFetch(async () => jsonResponse({ detail: "forbidden" }, 403));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/access denied/i)).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalledWith("/login");
  });
});
