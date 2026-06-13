/**
 * Sprint Z.1 (2026-05-11) — Members admin page (read-only v0).
 *
 * Pins the page's read contract: fetches `MembersPageV1` from
 * `GET /api/admin/members?installation_id={uuid}` and renders the
 * active grants + pending changes. Mutation flows (request /
 * approve / reject) defer to Z.1b.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  session: {
    data: {
      schema_version: 1,
      user_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      role: "platform_owner",
      email: "owner@acme.com",
      installation_id: "11111111-2222-3333-4444-555555555555" as string | null,
    },
    isLoading: false,
    error: null,
  },
}));

vi.mock("@/lib/auth/use-session", () => ({
  useSession: () => mockState.session,
}));

import MembersPage from "@/app/(authed)/members/page";

const _GOOD_RESPONSE = {
  schema_version: 1,
  members: [
    {
      schema_version: 1,
      user_id: "00000000-0000-0000-0000-000000000001",
      email: "alice@acme.com",
      display_name: "Alice Adams",
      role: "platform_owner",
      granted_at: "2026-05-01T12:00:00Z",
      granted_by_user_id: null,
    },
    {
      schema_version: 1,
      user_id: "00000000-0000-0000-0000-000000000002",
      email: "bob@acme.com",
      display_name: "Bob Bell",
      role: "reader",
      granted_at: "2026-05-02T12:00:00Z",
      granted_by_user_id: "00000000-0000-0000-0000-000000000001",
    },
  ],
  pending_changes: [
    {
      schema_version: 1,
      pending_id: "99999999-9999-9999-9999-999999999999",
      subject_kind: "user",
      subject_id: "00000000-0000-0000-0000-000000000003",
      role: "platform_operator",
      action: "grant",
      requested_at: "2026-05-10T09:00:00Z",
      requested_by_user_id: "00000000-0000-0000-0000-000000000001",
      expires_at: "2026-05-17T09:00:00Z",
      approved_at: null,
      approved_by_user_id: null,
      applied_at: null,
      state: "pending",
    },
  ],
};

function _renderWithFetch(response: object, status = 200) {
  globalThis.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(response), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  ) as unknown as typeof globalThis.fetch;

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MembersPage />
    </QueryClientProvider>,
  );
}

describe("MembersPage (Z.1 read-only v0)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.session = {
      data: {
        schema_version: 1,
        user_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        role: "platform_owner",
        email: "owner@acme.com",
        installation_id: "11111111-2222-3333-4444-555555555555",
      },
      isLoading: false,
      error: null,
    };
  });

  test("renders the page heading", async () => {
    _renderWithFetch(_GOOD_RESPONSE);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /members/i }),
      ).toBeInTheDocument();
    });
  });

  test("calls GET /api/admin/members with the session's installation_id", async () => {
    _renderWithFetch(_GOOD_RESPONSE);
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });
    const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } })
      .mock.calls;
    const url = String(calls[0]?.[0] ?? "");
    expect(url).toContain("/api/admin/members");
    expect(url).toContain(
      "installation_id=11111111-2222-3333-4444-555555555555",
    );
  });

  test("renders each active member row", async () => {
    _renderWithFetch(_GOOD_RESPONSE);
    await waitFor(() => {
      expect(screen.getByText("alice@acme.com")).toBeInTheDocument();
      expect(screen.getByText("bob@acme.com")).toBeInTheDocument();
    });
    expect(screen.getByText("Alice Adams")).toBeInTheDocument();
    expect(screen.getByText("Bob Bell")).toBeInTheDocument();
    // Roles surface so an admin sees who has owner-level access.
    expect(screen.getAllByText(/platform_owner/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/reader/i).length).toBeGreaterThan(0);
  });

  test("renders pending change with subject + role + action", async () => {
    _renderWithFetch(_GOOD_RESPONSE);
    await waitFor(() => {
      expect(
        screen.getByText(/pending changes/i),
      ).toBeInTheDocument();
    });
    // Pending row shows the subject_id, target role, and grant/revoke.
    // Word-boundary regex so "Granted" column header doesn't double-match.
    expect(screen.getByText(/\bgrant\b/i)).toBeInTheDocument();
    expect(
      screen.getByText(/platform_operator/i),
    ).toBeInTheDocument();
  });

  test("renders empty state when there are no members", async () => {
    _renderWithFetch({
      schema_version: 1,
      members: [],
      pending_changes: [],
    });
    await waitFor(() => {
      expect(
        screen.getByText(/no members/i),
      ).toBeInTheDocument();
    });
  });

  test("renders error banner when fetch returns 500", async () => {
    _renderWithFetch({ detail: "internal error" }, 500);
    await waitFor(() => {
      expect(
        screen.getByRole("alert"),
      ).toHaveTextContent(/couldn't load/i);
    });
  });

  test("does not fetch when session has no installation scope", async () => {
    mockState.session = {
      data: {
        schema_version: 1,
        user_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        role: "super_admin",
        email: "admin@acme.com",
        installation_id: null,
      },
      isLoading: false,
      error: null,
    };
    _renderWithFetch(_GOOD_RESPONSE);

    expect(
      await screen.findByRole("status"),
    ).toHaveTextContent(/installation-scoped session/i);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
