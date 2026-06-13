/**
 * Sprint 15 / S15.C — KnowledgeDetailPage wiring tests.
 *
 * Pins the contract from sprint-15.md S15.C:
 *   • GET /api/admin/knowledge/{id} on mount.
 *   • PUT /api/admin/knowledge/{id} sends `If-Match: <version>`
 *     header + `X-CSRF-Token` cookie token.
 *   • 409 surfaces the CollisionDiffModal with server-current body.
 *   • 428 (If-Match missing) → inline error preserving local edits.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import KnowledgeDetailPage from "@/app/(authed)/knowledge/[learning_id]/page";
import type { LearningDetailV1 } from "@/lib/api/knowledge";
import type { MeResponse } from "@/lib/auth/use-session";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// MarkdownEditor wraps CodeMirror — hard to drive via userEvent.
// Replace with a plain textarea so the page-level wiring tests can
// exercise the value change → save → mutation pipeline. The
// production MarkdownEditor has its own component-level tests.
vi.mock("@/components/knowledge/MarkdownEditor", () => ({
  MarkdownEditor: ({
    value,
    onChange,
    onBlur,
    ariaLabel,
  }: {
    value: string;
    onChange: (v: string) => void;
    onBlur?: () => void;
    ariaLabel: string;
  }) => (
    <textarea
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      data-testid="markdown-editor-textarea"
    />
  ),
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

function setCookie(value: string): void {
  Object.defineProperty(document, "cookie", {
    configurable: true,
    get: () => value,
  });
}

function makeDetail(o: Partial<LearningDetailV1> = {}): LearningDetailV1 {
  return {
    learning_id: "l-1",
    title: "Test learning",
    body_markdown: "Original body content.",
    state: "active",
    repo: null,
    version: 5,
    fired_count: 0,
    accept_rate: 0,
    last_fired_at: null,
    revisions: [],
    ...o,
  };
}

function resolvedParams(
  learningId: string,
): Promise<{ learning_id: string }> {
  // React 19's `use()` does not suspend on a plain `Promise.resolve`
  // in vitest+jsdom — it needs the status+value already settled.
  // (Same workaround as `ReviewDetailPage.test.tsx`.)
  const p = Promise.resolve({ learning_id: learningId }) as Promise<{
    learning_id: string;
  }> & { status?: string; value?: { learning_id: string } };
  p.status = "fulfilled";
  p.value = { learning_id: learningId };
  return p;
}

function renderPage(learningId = "l-1"): QueryClient {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrap({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  render(<KnowledgeDetailPage params={resolvedParams(learningId)} />, {
    wrapper: Wrap,
  });
  return client;
}

beforeEach(() => {
  setCookie("csrf_token=tok-xyz");
});

afterEach(() => {
  fetchSpy?.mockRestore();
  fetchSpy = null;
});

describe("KnowledgeDetailPage — wiring", () => {
  it("hits GET /api/admin/knowledge/{id} on mount", async () => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(makeDetail()));
    renderPage("l-x");
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/admin\/knowledge\/l-x$/),
        expect.objectContaining({ credentials: "include" }),
      );
    });
  });

  it("renders the learning title + version after fetch", async () => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        jsonResponse(
          makeDetail({ title: "Always sandbox", version: 7, body_markdown: "Body." }),
        ),
      );
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Always sandbox")).toBeInTheDocument();
    });
    expect(screen.getByTestId("version-label")).toHaveTextContent("v7");
  });

  it("PUT sends If-Match: <version> header on save", async () => {
    let putHeaders: Record<string, string> | null = null;
    let putBody: unknown = null;
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      const u = String(url);
      if (init?.method === "PUT" && u.endsWith("/api/admin/knowledge/l-1")) {
        putHeaders = init.headers as Record<string, string>;
        putBody = JSON.parse(String(init.body));
        return jsonResponse(
          makeDetail({ body_markdown: "Edited body", version: 6 }),
        );
      }
      return jsonResponse(makeDetail({ body_markdown: "Original", version: 5 }));
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Test learning")).toBeInTheDocument();
    });
    // Edit the body via the textarea.
    const editor = screen.getByLabelText("Learning body markdown");
    await userEvent.click(editor);
    await userEvent.keyboard(" Edited.");
    const saveBtn = screen.getByTestId("knowledge-save-btn");
    await userEvent.click(saveBtn);
    await waitFor(() => {
      expect(putHeaders).not.toBeNull();
    });
    expect(putHeaders!["If-Match"]).toBe("5");
    expect(putHeaders!["X-CSRF-Token"]).toBe("tok-xyz");
    expect(putBody).toMatchObject({ body_markdown: expect.any(String) });
  });

  it("opens CollisionDiffModal on 409 stale-write", async () => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url, init) => {
        const u = String(url);
        if (init?.method === "PUT" && u.endsWith("/api/admin/knowledge/l-1")) {
          return jsonResponse(
            {
              code: "stale_write",
              current_body: "Server overwrote your changes here.",
              current_version: 9,
            },
            409,
          );
        }
        return jsonResponse(makeDetail({ version: 5 }));
      });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Test learning")).toBeInTheDocument(),
    );
    const editor = screen.getByLabelText("Learning body markdown");
    await userEvent.click(editor);
    await userEvent.keyboard(" Edit.");
    await userEvent.click(screen.getByTestId("knowledge-save-btn"));
    await waitFor(() => {
      expect(
        screen.getByText(/Server overwrote your changes here/),
      ).toBeInTheDocument();
    });
  });

  it("renders inline error on 428 (If-Match missing) preserving edits", async () => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url, init) => {
        const u = String(url);
        if (init?.method === "PUT" && u.endsWith("/api/admin/knowledge/l-1")) {
          return jsonResponse({ detail: "If-Match required" }, 428);
        }
        return jsonResponse(makeDetail({ version: 5, body_markdown: "Original" }));
      });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Test learning")).toBeInTheDocument(),
    );
    const editor = screen.getByLabelText("Learning body markdown");
    await userEvent.click(editor);
    await userEvent.keyboard(" Edit.");
    await userEvent.click(screen.getByTestId("knowledge-save-btn"));
    await waitFor(() => {
      expect(
        screen.getByTestId("knowledge-detail-submit-error"),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByTestId("knowledge-detail-submit-error").textContent,
    ).toMatch(/Precondition required/i);
    // Edits preserved in the editor.
    expect((editor as HTMLTextAreaElement).value).toContain("Edit.");
  });

  it("happy save updates the version label after success", async () => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url, init) => {
        const u = String(url);
        if (init?.method === "PUT" && u.endsWith("/api/admin/knowledge/l-1")) {
          return jsonResponse(
            makeDetail({ version: 6, body_markdown: "Original Edit." }),
          );
        }
        return jsonResponse(makeDetail({ version: 5, body_markdown: "Original" }));
      });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Test learning")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("version-label")).toHaveTextContent("v5");
    const editor = screen.getByLabelText("Learning body markdown");
    await userEvent.click(editor);
    await userEvent.keyboard(" Edit.");
    await userEvent.click(screen.getByTestId("knowledge-save-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("version-label")).toHaveTextContent("v6");
    });
  });

  it("renders the deprecated state badge when state=deprecated", async () => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        jsonResponse(makeDetail({ state: "deprecated" })),
      );
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("deprecated")).toBeInTheDocument();
    });
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

  // ─── Sprint 16 / S16.D.2 — collision-retry race + refetch
  // overwrite regression tests ───────────────────────────────────

  it("'Use mine' retry sends If-Match: <conflict.current_version> on the next PUT", async () => {
    // Pre-S16.D.2 the retry called `setVersion(serverVersion);
    // setTimeout(() => mutate(), 0)` — relying on React's render
    // cycle. `version` state often hadn't flushed before mutate
    // closed over it → retry STILL used the stale version → 409
    // again (the symptom users hit). Now: version threaded
    // through mutation variables explicitly.
    let putAttempts = 0;
    const putHeaders: string[] = [];
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url, init) => {
        const u = String(url);
        if (init?.method === "PUT" && u.endsWith("/api/admin/knowledge/l-1")) {
          putAttempts += 1;
          const headers = new Headers(init.headers);
          putHeaders.push(headers.get("If-Match") ?? "");
          if (putAttempts === 1) {
            // First PUT collides — 409 with current_version=9.
            return jsonResponse(
              {
                code: "stale_write",
                current_body: "Other edit",
                current_version: 9,
              },
              409,
            );
          }
          // Retry succeeds — return the new state.
          return jsonResponse(makeDetail({ version: 10 }));
        }
        return jsonResponse(makeDetail({ version: 5 }));
      });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Test learning")).toBeInTheDocument(),
    );
    const editor = screen.getByLabelText("Learning body markdown");
    await userEvent.click(editor);
    await userEvent.keyboard(" Edit.");
    await userEvent.click(screen.getByTestId("knowledge-save-btn"));
    // First PUT 409s; modal opens.
    await waitFor(() => {
      expect(screen.getByText(/Other edit/)).toBeInTheDocument();
    });
    // Click "Use mine" → triggers retry.
    const useMineBtn = await screen.findByRole("button", { name: /use mine/i });
    await userEvent.click(useMineBtn);
    // Second PUT lands; If-Match should be the conflict's
    // current_version = 9.
    await waitFor(() => {
      expect(putAttempts).toBe(2);
    });
    expect(putHeaders[0]).toBe("5"); // first attempt: original version
    expect(putHeaders[1]).toBe("9"); // retry: conflict's current_version
  });

  it("background refetch does NOT overwrite the user's unsaved edits", async () => {
    // Pre-S16.D.2 `useEffect([learning], ...)` fired on every
    // refetch and called `setBody(learning.body_markdown)` →
    // user's typed edits clobbered. Now: body hydration only on
    // FIRST successful fetch.
    let getCalls = 0;
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      const u = String(url);
      if (u.endsWith("/api/admin/knowledge/l-1") && init?.method !== "PUT") {
        getCalls += 1;
        // First fetch: version=5; second fetch: someone else
        // edited (version=7, different body). TanStack Query's
        // structural sharing requires the data to differ for
        // `learning` to be a NEW reference; without that the
        // useEffect doesn't fire even pre-fix.
        return jsonResponse(
          makeDetail({
            body_markdown: getCalls === 1 ? "Server body v5" : "Server body v7",
            version: getCalls === 1 ? 5 : 7,
          }),
        );
      }
      return jsonResponse(makeDetail());
    });
    const queryClient = renderPage("l-1");
    await waitFor(() => {
      expect(screen.getByText("Test learning")).toBeInTheDocument();
    });
    const editor = (await screen.findByLabelText(
      "Learning body markdown",
    )) as HTMLTextAreaElement;
    // Type unsaved edits.
    await userEvent.click(editor);
    await userEvent.clear(editor);
    await userEvent.keyboard("My unsaved draft.");
    expect(editor.value).toBe("My unsaved draft.");

    // Force a refetch (simulating focus/network reconnect).
    // Invalidate first so refetchQueries actually issues a fresh
    // GET; without invalidate the cache is fresh and refetchQueries
    // is a no-op.
    await queryClient.invalidateQueries({
      queryKey: ["admin", "knowledge", "detail", "l-1"],
    });
    await waitFor(() => expect(getCalls).toBeGreaterThan(1));
    // Give React a tick to process the post-refetch useEffect.
    // Pre-S16.D.2 the useEffect would `setBody(learning.body_markdown)`
    // here → editor.value would become "Server body" and stay
    // there. waitFor catches that even if the React state lands
    // after the network call returns.
    await new Promise((r) => setTimeout(r, 50));

    // CRITICAL: editor still shows the user's edits, NOT the
    // server's body. Pre-S16.D.2 this assertion failed because
    // the useEffect-on-`learning`-change clobbered `body` with
    // the new server body ("Server body v7").
    expect(editor.value).toBe("My unsaved draft.");
    expect(editor.value).not.toBe("Server body v7");
  });
});
