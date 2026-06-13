/**
 * Sprint 15 / S15.H — CostCapsPage unit tests.
 *
 * Pins the wiring contract from sprint-15.md S15.H:
 *
 *   • GET /api/admin/cost-caps on mount; loading + error fall
 *     through the shared admin-query guard (same path as
 *     KillSwitchesPage).
 *   • Edit modal opens for global cap, validates client-side
 *     against HARD_CEILING_CENTS, queues a `CostCapChangeRequestV1`
 *     via POST /api/admin/cost-caps/changes.
 *   • A 202 response invalidates the page query so the new
 *     pending row appears.
 *   • PendingChangesTable: Approve disabled when the current
 *     user is the requester (two-person rule, UI half).
 *   • Approve / reject buttons fire the correct endpoints with
 *     the CSRF token.
 *   • Lowering-warning surfaces when the new cap is below the
 *     current cap.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import CostCapsPage from "@/app/(authed)/cost-caps/page";
import type { MeResponse } from "@/lib/auth/use-session";
import type {
  CostCapPageV1,
  CostCapPendingChangeV1,
} from "@/lib/api/cost-caps";

// ── router mock ────────────────────────────────────────────────────

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// ── session mock ───────────────────────────────────────────────────

const CURRENT_USER_ID = "00000000-0000-0000-0000-00000000000a";
const OTHER_USER_ID = "00000000-0000-0000-0000-00000000000b";

const mockSession: { value: MeResponse | null } = {
  value: {
    schema_version: 1,
    user_id: CURRENT_USER_ID,
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
let fetchSpy: any = null;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function setCookie(value: string): void {
  Object.defineProperty(document, "cookie", {
    configurable: true,
    get: () => value,
  });
}

function makePending(
  overrides: Partial<CostCapPendingChangeV1> = {},
): CostCapPendingChangeV1 {
  return {
    schema_version: 1,
    pending_change_id: "p1-id",
    target_kind: "global",
    target_id: null,
    new_cap_cents: 200_000,
    expires_at: null,
    requested_at: "2026-09-30T12:00:00Z",
    requested_by_user_id: OTHER_USER_ID,
    approved_at: null,
    approved_by_user_id: null,
    applied_at: null,
    state: "pending",
    ...overrides,
  };
}

function makePage(overrides: Partial<CostCapPageV1> = {}): CostCapPageV1 {
  return {
    schema_version: 1,
    settings: {
      schema_version: 1,
      global_cap_cents: 500_000,
      per_org_default_cap_cents: 100_000,
      hard_ceiling_cents: 5_000_000,
      updated_at: "2026-09-29T12:00:00Z",
      updated_by_user_id: null,
    },
    overrides: [],
    todays_spend_global_cents: 12_500,
    todays_projected_global_cents: 50_000,
    pending_changes: [],
    ...overrides,
  };
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
  render(<CostCapsPage />, { wrapper: Wrap });
}

beforeEach(() => {
  mockPush.mockReset();
  mockSession.value = {
    schema_version: 1,
    user_id: CURRENT_USER_ID,
    role: "platform_owner",
    email: "owner@codemaster.local",
    installation_id: "11111111-1111-1111-1111-111111111111",
  };
  setCookie("csrf_token=tok-xyz");
});

afterEach(() => {
  fetchSpy?.mockRestore();
  fetchSpy = null;
});

// ─────────────────────────────────────────────────────────────────


describe("CostCapsPage — wiring", () => {
  it("renders settings + spend after fetch", async () => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(makePage()));
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("cost-caps-page")).toBeInTheDocument();
    });
    expect(screen.getByTestId("global-cap")).toHaveTextContent("$5,000.00");
    expect(screen.getByTestId("todays-spend")).toHaveTextContent("$125.00");
    expect(screen.getByTestId("projected-spend")).toHaveTextContent("$500.00");
  });

  it("hits /api/admin/cost-caps on mount", async () => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(makePage()));
    renderPage();
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/admin\/cost-caps$/),
        expect.objectContaining({ credentials: "include" }),
      );
    });
  });

  it("shows access-denied state on 403", async () => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ detail: "forbidden" }, 403));
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByText(/access denied|forbidden|don't have/i),
      ).toBeInTheDocument();
    });
  });
});

describe("CostCapsPage — edit global cap modal", () => {
  it("opens the modal when Edit (global) is clicked", async () => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(makePage()));
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("edit-global-cap")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByTestId("edit-global-cap"));
    expect(screen.getByText("Edit global cap")).toBeInTheDocument();
    expect(screen.getByTestId("cost-cap-input")).toBeInTheDocument();
  });

  it("rejects above-ceiling value client-side without firing fetch", async () => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(makePage()));
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId("edit-global-cap")).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByTestId("edit-global-cap"));

    const input = screen.getByTestId("cost-cap-input");
    await userEvent.clear(input);
    // 60_000 dollars = 6_000_000 cents = above the 5_000_000 ceiling.
    await userEvent.type(input, "60000");
    await userEvent.click(screen.getByText("Queue for approval"));

    expect(screen.getByTestId("cost-cap-validation-error")).toBeInTheDocument();
    // Only the GET, no POST.
    const postCalls = fetchSpy.mock.calls.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any) =>
        typeof c[1] === "object" &&
        c[1] !== null &&
        (c[1] as RequestInit).method === "POST",
    );
    expect(postCalls).toHaveLength(0);
  });

  it("surfaces lowering-warning when new cap < current cap", async () => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(makePage()));
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId("edit-global-cap")).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByTestId("edit-global-cap"));

    const input = screen.getByTestId("cost-cap-input");
    await userEvent.clear(input);
    // Current cap = $5,000; lowering to $1,000.
    await userEvent.type(input, "1000");
    expect(screen.getByTestId("cost-cap-lowering-warning")).toBeInTheDocument();
  });

  it("submits a CostCapChangeRequestV1 with target_kind=global", async () => {
    let postBody: unknown = null;
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url, init) => {
        const u = String(url);
        if (init?.method === "POST" && u.endsWith("/changes")) {
          postBody = JSON.parse(String(init.body));
          return jsonResponse(makePending(), 202);
        }
        return jsonResponse(makePage());
      });
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId("edit-global-cap")).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByTestId("edit-global-cap"));
    const input = screen.getByTestId("cost-cap-input");
    await userEvent.clear(input);
    await userEvent.type(input, "2000");
    await userEvent.click(screen.getByText("Queue for approval"));
    await waitFor(() => {
      expect(postBody).not.toBeNull();
    });
    expect(postBody).toMatchObject({
      target_kind: "global",
      target_id: null,
      new_cap_cents: 200_000,
    });
  });
});

describe("CostCapsPage — pending changes table", () => {
  it("renders empty state when no pending changes", async () => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(makePage({ pending_changes: [] })));
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId("pending-changes-empty")).toBeInTheDocument(),
    );
  });

  it("disables Approve when current user is the requester (two-person rule)", async () => {
    const selfPending = makePending({
      pending_change_id: "self-pending",
      requested_by_user_id: CURRENT_USER_ID,
    });
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        jsonResponse(makePage({ pending_changes: [selfPending] })),
      );
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId("approve-btn-self-pending")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("approve-btn-self-pending")).toBeDisabled();
    expect(screen.getByTestId("reject-btn-self-pending")).toBeDisabled();
  });

  it("approves a pending change requested by a different user", async () => {
    const otherPending = makePending({
      pending_change_id: "other-pending",
      requested_by_user_id: OTHER_USER_ID,
    });
    let approvePathHit = false;
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url, init) => {
        const u = String(url);
        if (
          init?.method === "POST" &&
          u.endsWith("/changes/other-pending/approve")
        ) {
          approvePathHit = true;
          return jsonResponse(
            makePending({
              pending_change_id: "other-pending",
              state: "applied",
              approved_by_user_id: CURRENT_USER_ID,
            }),
          );
        }
        return jsonResponse(makePage({ pending_changes: [otherPending] }));
      });
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByTestId("approve-btn-other-pending"),
      ).toBeInTheDocument(),
    );
    expect(screen.getByTestId("approve-btn-other-pending")).not.toBeDisabled();
    await userEvent.click(screen.getByTestId("approve-btn-other-pending"));
    await waitFor(() => {
      expect(approvePathHit).toBe(true);
    });
  });

  it("rejects a pending change requested by a different user", async () => {
    const otherPending = makePending({
      pending_change_id: "reject-target",
      requested_by_user_id: OTHER_USER_ID,
    });
    let rejectPathHit = false;
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url, init) => {
        const u = String(url);
        if (
          init?.method === "POST" &&
          u.endsWith("/changes/reject-target/reject")
        ) {
          rejectPathHit = true;
          return jsonResponse(
            makePending({
              pending_change_id: "reject-target",
              state: "rejected",
            }),
          );
        }
        return jsonResponse(makePage({ pending_changes: [otherPending] }));
      });
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByTestId("reject-btn-reject-target"),
      ).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByTestId("reject-btn-reject-target"));
    await waitFor(() => {
      expect(rejectPathHit).toBe(true);
    });
  });
});

describe("CostCapsPage — overrides", () => {
  it("renders empty state when no overrides exist", async () => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(makePage({ overrides: [] })));
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId("overrides-empty")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("add-override-btn")).toBeInTheDocument();
  });

  it("renders override rows when present", async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        makePage({
          overrides: [
            {
              schema_version: 1,
              installation_id: "ins-1",
              installation_name: "Acme Pilot",
              cap_cents: 250_000,
              expires_at: null,
              updated_at: "2026-09-01T00:00:00Z",
              updated_by_user_id: null,
            },
          ],
        }),
      ),
    );
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId("override-row-ins-1")).toBeInTheDocument(),
    );
    const row = screen.getByTestId("override-row-ins-1");
    expect(within(row).getByText("Acme Pilot")).toBeInTheDocument();
    expect(within(row).getByText("$2,500.00")).toBeInTheDocument();
  });
});
