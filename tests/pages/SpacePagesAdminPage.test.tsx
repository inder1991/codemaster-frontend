import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import SpacePagesAdminPage from "@/app/(authed)/admin/confluence/spaces/[integration_id]/pages/page";
import * as adminApi from "@/lib/api/admin";
import { DarkModeProvider } from "@/components/ui/dark-mode-provider";

const INTEGRATION_ID = "11111111-1111-1111-1111-111111111111";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => `/admin/confluence/spaces/${INTEGRATION_ID}/pages`,
  useParams: () => ({ integration_id: INTEGRATION_ID }),
}));

function withProviders(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return (
    <DarkModeProvider>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </DarkModeProvider>
  );
}

const PAGE_APPROVED = {
  schema_version: 1,
  space_key: "ACME",
  page_id: "p-approved",
  page_title: "Onboarding (approved)",
  page_version: 3,
  labels: ["default"],
  last_modified_at: "2026-05-15T10:00:00Z",
  approval_status: "approved" as const,
  approver_email: "ops@example.com",
  approved_at_utc: "2026-05-20T11:00:00Z",
  revoked_at: null,
  revoked_by: null,
};

const PAGE_PENDING = {
  ...PAGE_APPROVED,
  page_id: "p-none",
  page_title: "Pending page",
  approval_status: "none" as const,
  approver_email: null,
  approved_at_utc: null,
};

describe("SpacePagesAdminPage", () => {
  beforeEach(() => {
    vi.spyOn(adminApi, "fetchPages").mockResolvedValue({
      schema_version: 1,
      rows: [PAGE_APPROVED, PAGE_PENDING],
      next_cursor: null,
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders pages with their approval status", async () => {
    render(withProviders(<SpacePagesAdminPage />));
    await waitFor(() =>
      expect(screen.getByText("Onboarding (approved)")).toBeInTheDocument(),
    );
    expect(screen.getByText("Pending page")).toBeInTheDocument();
    // Approved row shows the approver email
    expect(screen.getByText("ops@example.com")).toBeInTheDocument();
  });

  it("approve flow: opens the modal, submits, mutation fires", async () => {
    const postSpy = vi
      .spyOn(adminApi, "postPageApproval")
      .mockResolvedValue({
        schema_version: 1,
        approval_id: "00000000-0000-0000-0000-000000000099",
        space_key: "ACME",
        page_id: "p-none",
        approver_email: "ops@example.com",
        approved_at_utc: "2026-05-28T12:00:00Z",
        approval_artifact_url: "https://board.example.com/m-42",
        scope_justification:
          "Approved by IDP governance board for default corpus.",
        default_scope: "universal",
        revoked_at: null,
        revoked_by: null,
        created_at: "2026-05-28T12:00:00Z",
        updated_at: "2026-05-28T12:00:00Z",
      });
    const user = userEvent.setup();
    render(withProviders(<SpacePagesAdminPage />));
    await waitFor(() =>
      expect(screen.getByText("Pending page")).toBeInTheDocument(),
    );
    // Approve button only on the non-approved row
    await user.click(screen.getByRole("button", { name: /^approve$/i }));
    // Modal opens
    expect(
      await screen.findByRole("heading", { name: /approve "pending page"/i }),
    ).toBeInTheDocument();
    await user.type(
      screen.getByLabelText(/artifact url/i),
      "https://board.example.com/m-42",
    );
    await user.type(
      screen.getByLabelText(/justification/i),
      "Approved by IDP governance board for default-corpus inclusion.",
    );
    // The submit button is inside the modal — disambiguate to the
    // modal submit (the row's Approve button is also present).
    const submitBtns = screen.getAllByRole("button", { name: /^approve$/i });
    await user.click(submitBtns[submitBtns.length - 1]!);
    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(1));
    expect(postSpy.mock.calls[0]![0]!.body.page_id).toBe("p-none");
    expect(postSpy.mock.calls[0]![0]!.integration_id).toBe(INTEGRATION_ID);
  });

  it("revoke flow: opens confirm modal then DELETE", async () => {
    const delSpy = vi
      .spyOn(adminApi, "deletePageApproval")
      .mockResolvedValue();
    const user = userEvent.setup();
    render(withProviders(<SpacePagesAdminPage />));
    await waitFor(() =>
      expect(screen.getByText("Onboarding (approved)")).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /^revoke$/i }));
    const confirmBtn = await screen.findByRole("button", {
      name: /^revoke approval$/i,
    });
    await user.click(confirmBtn);
    await waitFor(() => expect(delSpy).toHaveBeenCalledTimes(1));
    expect(delSpy.mock.calls[0]![0]!.page_id).toBe("p-approved");
    expect(delSpy.mock.calls[0]![0]!.integration_id).toBe(INTEGRATION_ID);
  });
});
