/**
 * Platform-scope PR2a — Members page renders the `scope` column and
 * groups platform-scope grants under a separate section header.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/auth/use-session", () => ({
  useSession: () => ({
    data: {
      schema_version: 1,
      user_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      role: "super_admin",
      email: "owner@acme.com",
      installation_id: "11111111-2222-3333-4444-555555555555",
    },
    isLoading: false,
    error: null,
  }),
}));

import MembersPage from "@/app/(authed)/members/page";

const _RESPONSE_WITH_PLATFORM_GRANT = {
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
      scope: "platform",
    },
    {
      schema_version: 1,
      user_id: "00000000-0000-0000-0000-000000000002",
      email: "bob@acme.com",
      display_name: "Bob Bell",
      role: "reader",
      granted_at: "2026-05-02T12:00:00Z",
      granted_by_user_id: "00000000-0000-0000-0000-000000000001",
      scope: "installation",
    },
  ],
  pending_changes: [],
};

function _render(response: object) {
  globalThis.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(response), {
      status: 200,
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

describe("MembersPage — platform scope", () => {
  test("renders a Platform grants section when at least one platform row exists", async () => {
    _render(_RESPONSE_WITH_PLATFORM_GRANT);
    await waitFor(() => {
      expect(screen.getByText("Platform grants")).toBeInTheDocument();
    });
    expect(screen.getByText("Alice Adams")).toBeInTheDocument();
  });

  test("renders the Installation grants section for installation-scoped rows", async () => {
    _render(_RESPONSE_WITH_PLATFORM_GRANT);
    await waitFor(() => {
      expect(screen.getByText("Installation grants")).toBeInTheDocument();
    });
    expect(screen.getByText("Bob Bell")).toBeInTheDocument();
  });
});
