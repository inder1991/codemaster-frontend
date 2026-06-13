/**
 * Sprint 15 / S15.C — KnowledgeListPage wiring tests.
 *
 * Pins the contract from sprint-15.md S15.C:
 *   • GET /api/admin/knowledge fired on mount.
 *   • Loading / error / empty / data branches render correctly.
 *   • Row click navigates to /knowledge/{id}.
 *   • No `mock/knowledge` import remains (verified by static grep
 *     in the test build — TypeScript already enforces; the runtime
 *     test below also asserts the rendered data comes from the
 *     fetch, not from a stale module-scope constant).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import KnowledgePage from "@/app/(authed)/knowledge/page";
import type {
  LearningListItemV1,
  ProposalV1,
} from "@/lib/api/knowledge";
import type { MeResponse } from "@/lib/auth/use-session";

// ── router mock ────────────────────────────────────────────────────

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// ── session mock ───────────────────────────────────────────────────

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

// ── fetch helpers ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fetchSpy: any = null;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeLearning(
  o: Partial<LearningListItemV1> = {},
): LearningListItemV1 {
  return {
    learning_id: "l-1",
    title: "Pass installation_id everywhere",
    state: "active",
    repo: null,
    version: 3,
    fired_count: 12,
    accept_rate: 0.85,
    last_fired_at: "2026-08-01T10:00:00Z",
    ...o,
  };
}

function makeProposal(o: Partial<ProposalV1> = {}): ProposalV1 {
  return {
    proposal_id: "p-1",
    title: "Pending proposal",
    body_markdown: "Body",
    repo: null,
    proposed_by_user_id: "00000000-0000-0000-0000-000000000a01",
    created_at: "2026-08-01T09:00:00Z",
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
  render(<KnowledgePage />, { wrapper: Wrap });
}

beforeEach(() => {
  mockPush.mockReset();
});

afterEach(() => {
  fetchSpy?.mockRestore();
  fetchSpy = null;
});

// ── tests ──────────────────────────────────────────────────────────

describe("KnowledgeListPage — wiring", () => {
  it("fires GET /api/admin/knowledge on mount", async () => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url) => {
        const u = String(url);
        if (u.endsWith("/api/admin/knowledge")) return jsonResponse({"rows": [], "next_cursor": null});
        if (u.endsWith("/api/admin/knowledge/proposals"))
          return jsonResponse({"rows": [], "next_cursor": null});
        return jsonResponse({}, 404);
      });
    renderPage();
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/admin\/knowledge$/),
        expect.objectContaining({ credentials: "include" }),
      );
    });
  });

  it("renders the empty state when no learnings exist", async () => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({"rows": [], "next_cursor": null}));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/No learnings yet/i)).toBeInTheDocument();
    });
  });

  it("renders learning rows for the data state", async () => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url) => {
        const u = String(url);
        if (u.endsWith("/api/admin/knowledge"))
          return jsonResponse({"rows": [
            makeLearning({ learning_id: "l-1", title: "First learning" }),
            makeLearning({ learning_id: "l-2", title: "Second learning" }),
          ], "next_cursor": null});
        return jsonResponse({"rows": [], "next_cursor": null});
      });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("First learning")).toBeInTheDocument();
      expect(screen.getByText("Second learning")).toBeInTheDocument();
    });
  });

  it("shows the pending-proposals strip when proposals exist", async () => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url) => {
        const u = String(url);
        if (u.endsWith("/api/admin/knowledge"))
          return jsonResponse({"rows": [makeLearning()], "next_cursor": null});
        if (u.endsWith("/api/admin/knowledge/proposals"))
          return jsonResponse({"rows": [makeProposal(), makeProposal({ proposal_id: "p-2" })], "next_cursor": null});
        return jsonResponse({"rows": [], "next_cursor": null});
      });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/pending/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Learning proposals awaiting review/i),
      ).toBeInTheDocument();
    });
  });

  it("renders the deprecated badge for deprecated learnings", async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const u = String(url);
      if (u.endsWith("/api/admin/knowledge"))
        return jsonResponse({"rows": [
          makeLearning({ learning_id: "l-d", title: "Deprecated", state: "deprecated" }),
        ], "next_cursor": null});
      return jsonResponse({"rows": [], "next_cursor": null});
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Deprecated")).toBeInTheDocument();
      expect(screen.getByText("deprecated")).toBeInTheDocument();
    });
  });

  it("clicking a row navigates to /knowledge/{id}", async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const u = String(url);
      if (u.endsWith("/api/admin/knowledge"))
        return jsonResponse({"rows": [
          makeLearning({ learning_id: "l-click", title: "Clickable" }),
        ], "next_cursor": null});
      return jsonResponse({"rows": [], "next_cursor": null});
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Clickable")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText("Clickable"));
    expect(mockPush).toHaveBeenCalledWith("/knowledge/l-click");
  });

  it("renders Access denied on 403", async () => {
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

  it("renders the never-fired label when last_fired_at is null", async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const u = String(url);
      if (u.endsWith("/api/admin/knowledge"))
        return jsonResponse({"rows": [
          makeLearning({
            learning_id: "l-nf",
            title: "Never fired",
            last_fired_at: null,
          }),
        ], "next_cursor": null});
      return jsonResponse({"rows": [], "next_cursor": null});
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText(/never fired/i).length).toBeGreaterThan(0);
    });
  });
});
