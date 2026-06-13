/**
 * Sprint 14 / S14.C — IntegrationsPage unit tests.
 *
 * Pins the wiring contract laid out in sprint-14.md S14.C:
 *
 *   • GET /api/admin/integrations on mount.
 *   • DELETE /api/admin/integrations/{id} fires from a Modal-based
 *     confirm (NOT window.confirm) and applies an optimistic update
 *     that rolls back on backend error.
 *   • POST /api/admin/integrations/confluence-spaces fires from the
 *     AddConfluenceSpaceModal; 201 appends the row, 409 surfaces an
 *     inline "already configured" error.
 *   • All mutations forward X-CSRF-Token from the csrf_token cookie.
 *   • The component tree contains no `window.alert` / `window.confirm`
 *     calls — the production-build grep gate `make validate-fast`
 *     enforces (S14.C AC #4).
 *
 * Red commit: these tests fail because the page still imports
 * `getIntegrations()` from `@/lib/mock/integrations` and uses
 * `window.confirm` for the delete flow. The green commit rewires it.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import * as fs from "node:fs";
import * as path from "node:path";

import IntegrationsPage from "@/app/(authed)/integrations/page";
import type { IntegrationV1 } from "@/lib/api/admin";

// ── router mock ────────────────────────────────────────────────────

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
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

function makeIntegration(
  overrides: Partial<IntegrationV1> = {},
): IntegrationV1 {
  return {
    integration_id: "int-101",
    kind: "confluence_space",
    config_json: JSON.stringify({
      space_key: "ACME",
      space_name: "Acme Engineering Wiki",
      scope: "whole_space",
      page_tree_root_id: null,
    }),
    enabled: true,
    last_validated_at: "2026-08-01T11:00:00Z",
    last_validation_error: null,
    created_at: "2026-07-20T10:00:00Z",
    updated_at: "2026-08-01T11:00:00Z",
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
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrap({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  render(<IntegrationsPage />, { wrapper: Wrap });
}

beforeEach(() => {
  mockPush.mockReset();
  setCookie("csrf_token=tok-int");
});

afterEach(() => {
  fetchSpy?.mockRestore();
});

describe("IntegrationsPage — wiring", () => {
  it("renders the loading skeleton while the request is in flight", () => {
    let resolve: (r: Response) => void = () => {};
    mockFetch(
      () =>
        new Promise<Response>((r) => {
          resolve = r;
        }),
    );
    renderPage();
    expect(screen.getByTestId("integrations-loading")).toBeInTheDocument();
    resolve(jsonResponse({"rows": [], "next_cursor": null}));
  });

  it("calls GET /api/admin/integrations on mount and renders rows", async () => {
    const calls: string[] = [];
    mockFetch(async (url: string | URL | Request) => {
      const u =
        typeof url === "string"
          ? url
          : url instanceof URL
            ? url.toString()
            : url.url;
      calls.push(u);
      return jsonResponse({"rows": [
        makeIntegration(),
        makeIntegration({
          integration_id: "int-102",
          config_json: JSON.stringify({
            space_key: "PLAT",
            space_name: "Platform team — runbooks",
            scope: "page_tree",
            page_tree_root_id: "page-9911",
          }),
        }),
      ], "next_cursor": null});
    });
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByText("Acme Engineering Wiki"),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText("Platform team — runbooks"),
    ).toBeInTheDocument();
    expect(calls.some((c) => c.endsWith("/api/admin/integrations"))).toBe(
      true,
    );
  });

  it("renders the Empty state when the list is empty", async () => {
    mockFetch(async () => jsonResponse({"rows": [], "next_cursor": null}));
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByText(/No integrations yet/i),
      ).toBeInTheDocument();
    });
  });

  it("DELETE confirms via a Modal (no window.confirm) + optimistically removes the row + sends X-CSRF-Token", async () => {
    let deleted = false;
    let deleteCapture: { url: string; init?: RequestInit } | undefined;
    mockFetch(async (url: string | URL | Request, init?: RequestInit) => {
      const u = typeof url === "string" ? url : (url as URL | Request).toString();
      if (init?.method === "DELETE") {
        deleteCapture = { url: u, init };
        deleted = true;
        return new Response(null, { status: 204 });
      }
      return jsonResponse({"rows": deleted ? [] : [makeIntegration()], "next_cursor": null});
    });
    // Spy on window.confirm so we can assert the page does NOT call it.
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockImplementation(() => true);

    renderPage();
    const user = userEvent.setup();
    const removeBtn = await screen.findByRole("button", { name: /remove/i });
    await user.click(removeBtn);

    // The Modal-based confirm should appear; window.confirm must not.
    const dialogConfirm = await screen.findByRole("button", {
      name: /^remove integration$/i,
    });
    expect(confirmSpy).not.toHaveBeenCalled();
    await user.click(dialogConfirm);

    await waitFor(() => expect(deleteCapture).toBeTruthy());
    expect(deleteCapture!.url).toContain("/api/admin/integrations/int-101");
    expect(new Headers(deleteCapture!.init!.headers).get("X-CSRF-Token")).toBe(
      "tok-int",
    );

    await waitFor(() => {
      expect(
        screen.queryByText("Acme Engineering Wiki"),
      ).not.toBeInTheDocument();
    });
    confirmSpy.mockRestore();
  });

  it("DELETE rolls back the optimistic update when the backend errors", async () => {
    const initial = [makeIntegration()];
    let deleteCalled = 0;
    mockFetch(async (_url, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        deleteCalled += 1;
        return jsonResponse({ detail: "boom" }, 500);
      }
      return jsonResponse({"rows": initial, "next_cursor": null});
    });
    renderPage();
    const user = userEvent.setup();
    const removeBtn = await screen.findByRole("button", { name: /remove/i });
    await user.click(removeBtn);
    const dialogConfirm = await screen.findByRole("button", {
      name: /^remove integration$/i,
    });
    await user.click(dialogConfirm);

    await waitFor(() => expect(deleteCalled).toBe(1));
    // The row should reappear after rollback (the list refetch returns
    // the original data).
    await waitFor(() => {
      expect(screen.getByText("Acme Engineering Wiki")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/couldn't remove the integration/i),
    ).toBeInTheDocument();
  });

  it("POST opens the AddConfluenceSpaceModal → 201 → the new row appears", async () => {
    const created: IntegrationV1 = makeIntegration({
      integration_id: "int-201",
      config_json: JSON.stringify({
        space_key: "NEW",
        space_name: "New space",
        scope: "whole_space",
        page_tree_root_id: null,
      }),
    });
    let posted = false;
    mockFetch(async (_url, init?: RequestInit) => {
      if (init?.method === "POST") {
        posted = true;
        return jsonResponse(created, 201);
      }
      return jsonResponse({"rows": posted ? [created] : [], "next_cursor": null});
    });
    renderPage();
    const user = userEvent.setup();
    // Wait for the empty-state to render so we can click its primary CTA
    // (the page has two "Add Confluence space" affordances when the list
    // is empty: the header button + the empty-state CTA).
    const addBtns = await screen.findAllByRole("button", {
      name: /Add Confluence space/i,
    });
    await user.click(addBtns[0]!);
    await user.type(screen.getByLabelText(/space key/i), "NEW");
    await user.type(screen.getByLabelText(/display name/i), "New space");
    const submit = screen.getByRole("button", { name: /^add$/i });
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);
    await waitFor(() => {
      expect(screen.getByText("New space")).toBeInTheDocument();
    });
  });

  it("POST sends X-CSRF-Token + JSON body to confluence-spaces endpoint", async () => {
    let postCapture: { url: string; init?: RequestInit } | undefined;
    mockFetch(async (url: string | URL | Request, init?: RequestInit) => {
      const u = typeof url === "string" ? url : (url as URL | Request).toString();
      // S16.F.5 — skip the telemetry-endpoint POST so `postCapture`
      // reflects the integration POST, not the telemetry emit.
      if (u.includes("/api/telemetry")) {
        return new Response(null, { status: 204 });
      }
      if (init?.method === "POST") {
        postCapture = { url: u, init };
        return jsonResponse(makeIntegration({ integration_id: "int-300" }), 201);
      }
      // Return a non-empty list so only the header CTA is visible.
      return jsonResponse({"rows": [makeIntegration()], "next_cursor": null});
    });
    renderPage();
    const user = userEvent.setup();
    const addBtn = await screen.findByRole("button", {
      name: /Add Confluence space/i,
    });
    await user.click(addBtn);
    await user.type(screen.getByLabelText(/space key/i), "OPS");
    await user.type(screen.getByLabelText(/display name/i), "Ops space");
    await user.click(screen.getByRole("button", { name: /^add$/i }));
    await waitFor(() => expect(postCapture).toBeTruthy());
    expect(postCapture!.url).toContain(
      "/api/admin/integrations/confluence-spaces",
    );
    const headers = new Headers(postCapture!.init!.headers);
    expect(headers.get("X-CSRF-Token")).toBe("tok-int");
    const body = JSON.parse(String(postCapture!.init!.body));
    expect(body).toEqual({
      space_key: "OPS",
      space_name: "Ops space",
      scope: "whole_space",
      page_tree_root_id: null,
      // Sub-spec C T12 — modal sends the four governance fields on
      // every submit. Defaults are the contract defaults; the test
      // exercises the no-touch path.
      trust_tier: "trusted",
      governance_ack: false,
      visibility: "platform",
      strict_label_mode: false,
    });
  });

  it("POST 409 surfaces an inline 'already configured' error in the modal", async () => {
    mockFetch(async (_url, init?: RequestInit) => {
      if (init?.method === "POST") {
        return jsonResponse(
          { code: "duplicate", space_key: "DUP" },
          409,
        );
      }
      return jsonResponse({"rows": [makeIntegration()], "next_cursor": null});
    });
    renderPage();
    const user = userEvent.setup();
    const addBtn = await screen.findByRole("button", {
      name: /Add Confluence space/i,
    });
    await user.click(addBtn);
    await user.type(screen.getByLabelText(/space key/i), "DUP");
    await user.type(screen.getByLabelText(/display name/i), "Dup space");
    await user.click(screen.getByRole("button", { name: /^add$/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/already configured/i),
      ).toBeInTheDocument();
    });
  });

  it("source contains no `window.alert` or `window.confirm` calls (production-build invariant)", () => {
    // Static-source check — the runtime tests exercise the Modal-based
    // confirm path; this assertion guards against a regression where a
    // future edit reintroduces a native dialog. Aligned with the
    // S14.C AC #4 grep gate (`grep -r "window\\.alert" frontend/src` → 0).
    const pageSrc = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/app/(authed)/integrations/page.tsx",
      ),
      "utf8",
    );
    expect(pageSrc).not.toMatch(/window\.alert\b/);
    expect(pageSrc).not.toMatch(/window\.confirm\b/);
  });

  // ── S21.PLATFORM-SCOPE.PR3 Task 10 — platform-shared copy ────────

  it("header subtext communicates platform-shared corpus shape (not per-tenant)", async () => {
    // S21.LLM-DUAL.1-PLATFORM PR 3 Task 10: the integrations page must
    // communicate that Confluence is a platform-shared corpus — one
    // configuration serves every codemaster-installed organization.
    // The old copy said "Per-tenant content sources"; the new copy
    // says "Platform-shared content sources … One configuration serves
    // every codemaster-installed organization."
    mockFetch(async () => jsonResponse({ rows: [], next_cursor: null }));
    renderPage();
    await waitFor(() => {
      // New copy asserts platform-shared shape.
      expect(
        screen.getByText(/Platform-shared content sources/i),
      ).toBeInTheDocument();
      // Old copy must be gone.
      expect(
        screen.queryByText(/Per-tenant content sources/i),
      ).not.toBeInTheDocument();
    });
    // The subtext should also mention that one configuration serves all orgs.
    expect(
      screen.getByText(/One configuration serves every/i),
    ).toBeInTheDocument();
  });

  it("empty-state body communicates platform ingest semantics (not per-tenant cycle)", async () => {
    // S21.LLM-DUAL.1-PLATFORM PR 3 Task 10: the empty-state body must
    // reflect that pages are ingested once and served to every installed
    // org — not per-installation.
    mockFetch(async () => jsonResponse({ rows: [], next_cursor: null }));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/No integrations yet/i)).toBeInTheDocument();
    });
    expect(
      screen.getByText(/ingests pages once and serves every installed org/i),
    ).toBeInTheDocument();
  });

  it("GET /api/admin/integrations does not send installation_id query param", async () => {
    // S21.LLM-DUAL.1-PLATFORM PR 3 Task 10: the integrations API client
    // must NOT scope requests by installation_id — the corpus is
    // platform-shared, not per-tenant.
    let capturedUrl: string | undefined;
    mockFetch(async (url: string | URL | Request) => {
      const u =
        typeof url === "string"
          ? url
          : url instanceof URL
            ? url.toString()
            : (url as Request).url;
      if (u.includes("/api/admin/integrations")) {
        capturedUrl = u;
      }
      return jsonResponse({ rows: [], next_cursor: null });
    });
    renderPage();
    await waitFor(() => expect(capturedUrl).toBeDefined());
    expect(new URL(capturedUrl!, "http://localhost").searchParams.has("installation_id")).toBe(false);
  });

  // ── T5.7 — PlatformCredentialsCard on /integrations page ─────────

  it("renders PlatformCredentialsCard for confluence provider above the table", async () => {
    // T5.7 spec §9: the credentials card must appear above the
    // integrations table. We verify the card's test-id is present and
    // that it appears in the DOM before the table section.
    mockFetch(async (url: string | URL | Request) => {
      const u =
        typeof url === "string"
          ? url
          : url instanceof URL
            ? url.toString()
            : (url as Request).url;
      // Respond to the platform-credentials meta fetch (no token present).
      if (u.includes("/api/admin/platform-credentials/confluence")) {
        return jsonResponse({
          credential_key: "confluence",
          token_present: false,
          base_url: null,
          last_rotated_at: null,
          last_rotated_by: null,
          last_validated_at: null,
          last_validation_error: null,
        });
      }
      // Integrations list + quarantine probes.
      return jsonResponse({ rows: [], next_cursor: null });
    });

    renderPage();

    // The card renders immediately (its own loading state) and the
    // test-id is always present.
    const card = await screen.findByTestId(
      "platform-credentials-card-confluence",
    );
    expect(card).toBeInTheDocument();

    // The card must appear above the integrations table / empty-state.
    // findByTestId returning truthy is sufficient for presence; DOM order
    // is asserted by checking the card is before the table section via
    // compareDocumentPosition.
    const emptyState = await screen.findByText(/No integrations yet/i);
    expect(
      card.compareDocumentPosition(emptyState) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("existing integrations table still renders below when list is non-empty", async () => {
    // T5.7 — verifies the card + table coexist correctly.
    mockFetch(async (url: string | URL | Request) => {
      const u =
        typeof url === "string"
          ? url
          : url instanceof URL
            ? url.toString()
            : (url as Request).url;
      if (u.includes("/api/admin/platform-credentials/confluence")) {
        return jsonResponse({
          credential_key: "confluence",
          token_present: false,
          base_url: null,
          last_rotated_at: null,
          last_rotated_by: null,
          last_validated_at: null,
          last_validation_error: null,
        });
      }
      // One integration so the table renders (not the empty state).
      return jsonResponse({ rows: [makeIntegration()], next_cursor: null });
    });

    renderPage();

    const card = await screen.findByTestId(
      "platform-credentials-card-confluence",
    );
    expect(card).toBeInTheDocument();

    // Integration row renders below the card.
    const spaceRow = await screen.findByText("Acme Engineering Wiki");
    expect(spaceRow).toBeInTheDocument();
    expect(
      card.compareDocumentPosition(spaceRow) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
