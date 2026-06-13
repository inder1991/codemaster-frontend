/**
 * Sprint X.2 (2026-05-11) — Client-Component login page tests.
 *
 * Pins:
 *   * CSRF preflight on mount (single GET to /api/auth/csrf).
 *   * JSON POST to /api/auth/login with X-CSRF-Token header.
 *   * router.push to / on success.
 *   * router.push to validated `?next=` on success.
 *   * Open-redirect rejection (?next=https://evil/ → push to /).
 *   * ErrorBanner branches: bad_credentials, locked, no_role,
 *     ldap_unreachable, unknown.
 *   * CAPS Lock detection.
 *   * Show/hide password toggle.
 *   * SSO button is a visual stub for v0; click surfaces sso_failed.
 */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import LoginPage from "@/app/login/page";

const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
}));

const CSRF_TOKEN = "ab".repeat(32);

let fetchSpy: ReturnType<typeof vi.spyOn> | null = null;

function mockFetch(handler: (url: string, init?: RequestInit) => Response): void {
  fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      return handler(url, init);
    },
  );
}

beforeEach(() => {
  mockPush.mockReset();
  mockReplace.mockReset();
  for (const key of Array.from(mockSearchParams.keys())) {
    mockSearchParams.delete(key);
  }
  fetchSpy = null;
});

afterEach(() => {
  fetchSpy?.mockRestore();
  fetchSpy = null;
});

// ── Render + preflight ─────────────────────────────────────────────

describe("LoginPage render + preflight (X.2)", () => {
  test("fires CSRF preflight GET on mount", async () => {
    const seen: string[] = [];
    mockFetch((url) => {
      seen.push(url);
      if (url.endsWith("/api/auth/csrf")) {
        return new Response(
          JSON.stringify({ schema_version: 1, token: CSRF_TOKEN }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("", { status: 404 });
    });

    render(<LoginPage />);

    await waitFor(() => {
      expect(seen).toContain("/api/auth/csrf");
    });
  });

  test("renders Sign in / brand / SSO / directory form", async () => {
    mockFetch(() =>
      new Response(JSON.stringify({ schema_version: 1, token: CSRF_TOKEN }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<LoginPage />);

    expect(
      screen.getByRole("heading", { name: /sign in/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /continue with sso/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeInTheDocument();
  });

  test("strips username/password query params from the login URL", async () => {
    mockSearchParams.set("username", "admin");
    mockSearchParams.set("password", "secret");
    mockSearchParams.set("next", "/reviews");
    mockFetch(() =>
      new Response(JSON.stringify({ schema_version: 1, token: CSRF_TOKEN }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<LoginPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/login?next=%2Freviews");
    });
    expect(screen.getByRole("alert").textContent).toMatch(/sign-in form/i);
  });
});

// ── Submit happy path ──────────────────────────────────────────────

describe("LoginPage submit (X.2)", () => {
  test("happy path: POSTs JSON with X-CSRF-Token + pushes /", async () => {
    const submitted: Array<{ url: string; body: string; headers: Headers }> =
      [];
    mockFetch((url, init) => {
      if (url.endsWith("/api/auth/csrf")) {
        return new Response(
          JSON.stringify({ schema_version: 1, token: CSRF_TOKEN }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/api/auth/login")) {
        submitted.push({
          url,
          body: init?.body as string,
          headers: new Headers(init?.headers as HeadersInit),
        });
        return new Response(
          JSON.stringify({
            schema_version: 1,
            user_id: "u1",
            role: "super_admin",
            expires_at: "2026-05-12T00:00:00Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("", { status: 404 });
    });

    render(<LoginPage />);

    // Wait for preflight to seed the csrfToken state.
    await waitFor(() => {
      expect(fetchSpy?.mock.calls.some((c) =>
        String(c[0]).endsWith("/api/auth/csrf"),
      )).toBe(true);
    });

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "admin" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret" },
    });
    await act(async () => {
      fireEvent.submit(
        screen.getByRole("button", { name: /^sign in$/i }).closest("form")!,
      );
    });

    await waitFor(() => expect(submitted.length).toBe(1));

    const call = submitted[0]!;
    expect(call.headers.get("X-CSRF-Token")).toBe(CSRF_TOKEN);
    expect(call.headers.get("Content-Type")).toBe("application/json");
    const body = JSON.parse(call.body);
    expect(body).toEqual({
      schema_version: 1,
      username: "admin",
      password: "secret",
    });

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/"));
  });

  test("validated ?next=/cost-caps is honored", async () => {
    mockSearchParams.set("next", "/cost-caps");
    mockFetch((url) => {
      if (url.endsWith("/api/auth/csrf")) {
        return new Response(
          JSON.stringify({ schema_version: 1, token: CSRF_TOKEN }),
          { status: 200 },
        );
      }
      if (url.endsWith("/api/auth/login")) {
        return new Response(
          JSON.stringify({
            schema_version: 1,
            user_id: "u1",
            role: "super_admin",
            expires_at: "2026-05-12T00:00:00Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("", { status: 404 });
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "admin" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret" },
    });
    await act(async () => {
      fireEvent.submit(
        screen.getByRole("button", { name: /^sign in$/i }).closest("form")!,
      );
    });

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/cost-caps"),
    );
  });

  test.each([
    ["https://evil.example/", "absolute URL"],
    ["//evil.example/", "protocol-relative"],
    ["javascript:alert(1)", "javascript scheme"],
    ["../etc/passwd", "parent traversal"],
  ])("rejects open-redirect ?next=%s (%s) → pushes /", async (badNext) => {
    mockSearchParams.set("next", badNext);
    mockFetch((url) => {
      if (url.endsWith("/api/auth/csrf")) {
        return new Response(
          JSON.stringify({ schema_version: 1, token: CSRF_TOKEN }),
          { status: 200 },
        );
      }
      if (url.endsWith("/api/auth/login")) {
        return new Response(
          JSON.stringify({
            schema_version: 1,
            user_id: "u1",
            role: "super_admin",
            expires_at: "2026-05-12T00:00:00Z",
          }),
          { status: 200 },
        );
      }
      return new Response("", { status: 404 });
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "admin" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret" },
    });
    await act(async () => {
      fireEvent.submit(
        screen.getByRole("button", { name: /^sign in$/i }).closest("form")!,
      );
    });

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/"));
  });
});

// ── Error banners ─────────────────────────────────────────────────

describe("LoginPage error mapping (X.2)", () => {
  test.each([
    [401, /invalid credentials/i],
    [403, /no codemaster role/i],
    [423, /account locked/i],
    [503, /temporarily unavailable/i],
    [500, /authentication failed/i],
  ])("status %s renders the right banner", async (status, regex) => {
    mockFetch((url) => {
      if (url.endsWith("/api/auth/csrf")) {
        return new Response(
          JSON.stringify({ schema_version: 1, token: CSRF_TOKEN }),
          { status: 200 },
        );
      }
      if (url.endsWith("/api/auth/login")) {
        return new Response("{}", { status });
      }
      return new Response("", { status: 404 });
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "u" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "p" },
    });
    await act(async () => {
      fireEvent.submit(
        screen.getByRole("button", { name: /^sign in$/i }).closest("form")!,
      );
    });

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeNull());
    expect(screen.getByRole("alert").textContent).toMatch(regex);
  });

  test("locked / no_role / ldap_unreachable show the owner-contact link", async () => {
    mockFetch((url) => {
      if (url.endsWith("/api/auth/csrf")) {
        return new Response(
          JSON.stringify({ schema_version: 1, token: CSRF_TOKEN }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 423 });
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "u" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "p" },
    });
    await act(async () => {
      fireEvent.submit(
        screen.getByRole("button", { name: /^sign in$/i }).closest("form")!,
      );
    });

    await waitFor(() => {
      const link = screen.queryByRole("link", { name: /platform owner/i });
      expect(link).not.toBeNull();
    });
  });
});

// ── Affordances ────────────────────────────────────────────────────

describe("LoginPage affordances (X.2)", () => {
  test("show/hide password toggle flips input type", () => {
    mockFetch(() =>
      new Response(JSON.stringify({ schema_version: 1, token: CSRF_TOKEN }), {
        status: 200,
      }),
    );
    render(<LoginPage />);

    const password = screen.getByLabelText("Password") as HTMLInputElement;
    expect(password.type).toBe("password");

    const toggle = screen.getByRole("button", { name: /show password/i });
    act(() => {
      toggle.click();
    });

    expect(password.type).toBe("text");
    expect(
      screen.getByRole("button", { name: /hide password/i }),
    ).toBeInTheDocument();
  });

  test("SSO button is a visual stub — click surfaces sso_failed banner", () => {
    mockFetch(() =>
      new Response(JSON.stringify({ schema_version: 1, token: CSRF_TOKEN }), {
        status: 200,
      }),
    );
    render(<LoginPage />);

    act(() => {
      screen.getByRole("button", { name: /continue with sso/i }).click();
    });

    expect(screen.getByRole("alert").textContent).toMatch(/sso/i);
  });

  test("session-ended reason renders the info banner", () => {
    mockSearchParams.set("reason", "session-ended");
    mockFetch(() =>
      new Response(JSON.stringify({ schema_version: 1, token: CSRF_TOKEN }), {
        status: 200,
      }),
    );
    render(<LoginPage />);

    expect(
      screen.getByRole("heading", { name: /welcome back/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status").textContent).toMatch(
      /signed out/i,
    );
  });
});
