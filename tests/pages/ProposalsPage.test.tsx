/**
 * Sprint 15 / S15.C — ProposalsPage wiring tests.
 *
 * Pins the contract from sprint-15.md S15.C:
 *   • GET /api/admin/knowledge/proposals on mount.
 *   • Approve / Reject buttons fire the corresponding POST endpoints
 *     with the CSRF token.
 *   • 403 → inline error ("two-person rule").
 *   • `window.alert` is NOT present in the production code path
 *     (statically verified at the file level by the page wiring; the
 *     runtime test confirms no `alert` calls on click).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import ProposalsQueuePage from "@/app/(authed)/knowledge/proposals/page";
import type { ProposalV1 } from "@/lib/api/knowledge";
import type { MeResponse } from "@/lib/auth/use-session";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const mockSession: { value: MeResponse | null } = {
  value: {
    schema_version: 1,
    user_id: "u-1",
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fetchSpy: any = null;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function emptyResponse(status = 204): Response {
  return new Response(null, { status });
}

function setCookie(value: string): void {
  Object.defineProperty(document, "cookie", {
    configurable: true,
    get: () => value,
  });
}

function makeProposal(o: Partial<ProposalV1> = {}): ProposalV1 {
  return {
    proposal_id: "p-1",
    title: "Pending proposal",
    body_markdown: "Body of the proposal",
    repo: "acme/web",
    proposed_by_user_id: "00000000-0000-0000-0000-000000000a02",
    created_at: "2026-08-01T10:00:00Z",
    ...o,
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
  render(<ProposalsQueuePage />, { wrapper: Wrap });
}

beforeEach(() => {
  setCookie("csrf_token=tok-xyz");
});

afterEach(() => {
  fetchSpy?.mockRestore();
  fetchSpy = null;
});

describe("ProposalsPage — wiring", () => {
  it("hits GET /api/admin/knowledge/proposals on mount", async () => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({"rows": [], "next_cursor": null}));
    renderPage();
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/admin\/knowledge\/proposals$/),
        expect.objectContaining({ credentials: "include" }),
      );
    });
  });

  it("renders the empty state when no proposals", async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({"rows": [], "next_cursor": null}));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/No proposals waiting/i)).toBeInTheDocument();
    });
  });

  it("renders proposal rows for the data state", async () => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        jsonResponse({"rows": [
          makeProposal({ proposal_id: "p-a", title: "Alpha proposal" }),
          makeProposal({ proposal_id: "p-b", title: "Beta proposal" }),
        ], "next_cursor": null}),
      );
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Alpha proposal")).toBeInTheDocument();
      expect(screen.getByText("Beta proposal")).toBeInTheDocument();
    });
  });

  it("approve flow fires POST .../approve with CSRF token", async () => {
    let approveCalled = false;
    let approveCsrfHeader: string | null = null;
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url, init) => {
        const u = String(url);
        if (init?.method === "POST" && u.includes("/proposals/p-a/approve")) {
          approveCalled = true;
          const headers = init.headers as Record<string, string>;
          approveCsrfHeader = headers["X-CSRF-Token"] ?? null;
          return emptyResponse(204);
        }
        return jsonResponse({"rows": [
          makeProposal({ proposal_id: "p-a", title: "Alpha", repo: "acme/web" }),
        ], "next_cursor": null});
      });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Alpha")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByTestId("approve-btn-p-a"));
    // Modal opens; confirm.
    await waitFor(() => {
      expect(screen.getByText(/Approve learning/i)).toBeInTheDocument();
    });
    // The first match is the row's Approve button (clicked already
    // — opens the modal); the LAST match is the modal's primary
    // CTA. Click the latter to fire the actual mutation.
    {
      const approveButtons = screen.getAllByText(/^Approve$/);
      await userEvent.click(approveButtons[approveButtons.length - 1]);
    }
    await waitFor(() => {
      expect(approveCalled).toBe(true);
    });
    expect(approveCsrfHeader).toBe("tok-xyz");
  });

  it("reject flow fires POST .../reject with reason body", async () => {
    let rejectBody: unknown = null;
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url, init) => {
        const u = String(url);
        if (init?.method === "POST" && u.includes("/proposals/p-r/reject")) {
          rejectBody = JSON.parse(String(init.body));
          return emptyResponse(204);
        }
        return jsonResponse({"rows": [
          makeProposal({ proposal_id: "p-r", title: "RejectMe", repo: "acme/web" }),
        ], "next_cursor": null});
      });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("RejectMe")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByTestId("reject-btn-p-r"));
    await waitFor(() => {
      expect(screen.getByText(/Reject learning proposal/i)).toBeInTheDocument();
    });
    const textarea = screen.getByLabelText(/reason/i);
    await userEvent.type(
      textarea,
      "This proposal duplicates an existing learning.",
    );
    // Click the modal's Reject button (not the row's).
    const rejectButtons = screen.getAllByText(/^Reject$/);
    await userEvent.click(rejectButtons[rejectButtons.length - 1]);
    await waitFor(() => {
      expect(rejectBody).not.toBeNull();
    });
    expect(rejectBody).toMatchObject({
      reason: expect.stringContaining("duplicates"),
    });
  });

  it("shows the two-person error inline when the server returns 403", async () => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url, init) => {
        const u = String(url);
        if (init?.method === "POST" && u.includes("/approve")) {
          return jsonResponse({ detail: "self-approval refused" }, 403);
        }
        return jsonResponse({"rows": [
          makeProposal({ proposal_id: "p-self", title: "Self", repo: "acme/web" }),
        ], "next_cursor": null});
      });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Self")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByTestId("approve-btn-p-self"));
    await waitFor(() =>
      expect(screen.getByText(/Approve learning/i)).toBeInTheDocument(),
    );
    // The first match is the row's Approve button (clicked already
    // — opens the modal); the LAST match is the modal's primary
    // CTA. Click the latter to fire the actual mutation.
    {
      const approveButtons = screen.getAllByText(/^Approve$/);
      await userEvent.click(approveButtons[approveButtons.length - 1]);
    }
    await waitFor(() => {
      expect(
        screen.getByText(/two-person rule/i),
      ).toBeInTheDocument();
    });
  });

  it("never fires window.alert", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url, init) => {
        if (init?.method === "POST") return emptyResponse(204);
        return jsonResponse({"rows": [
          makeProposal({ proposal_id: "p-no-alert", title: "NoAlert", repo: "acme/web" }),
        ], "next_cursor": null});
      });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("NoAlert")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByTestId("approve-btn-p-no-alert"));
    await waitFor(() =>
      expect(screen.getByText(/Approve learning/i)).toBeInTheDocument(),
    );
    // The first match is the row's Approve button (clicked already
    // — opens the modal); the LAST match is the modal's primary
    // CTA. Click the latter to fire the actual mutation.
    {
      const approveButtons = screen.getAllByText(/^Approve$/);
      await userEvent.click(approveButtons[approveButtons.length - 1]);
    }
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
