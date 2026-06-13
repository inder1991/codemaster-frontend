/**
 * Sprint 14 / S14.B — ReviewDetailPage unit tests.
 *
 * Tests:
 *  - Loading skeleton while useQuery is in flight
 *  - Error state on a 5xx response
 *  - Empty findings list renders the "Clean review" empty state
 *  - Findings render with severity, title; body shows in inspector after clicking row
 *  - Header renders repo/PR number/state badge
 *  - GET /api/admin/reviews/{id} called on mount
 *  - XSS adversarial corpus driver (5 entries) — see tests/corpora/xss/
 *
 * Key harness change (review-detail reship): the page now calls useSession()
 * via ContextRail. All tests mock "@/lib/auth/use-session" to return a
 * privileged role so DebugLinks (stage strip, retrieval-trace link, etc.)
 * are available to the test surface.
 */

import fs from "node:fs";
import path from "node:path";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import ReviewDetailPage from "@/app/(authed)/reviews/[id]/page";
import type {
  ReviewDetailV1,
  ReviewFindingItemV1,
} from "@/lib/api/admin";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// useSession: return platform_owner so ContextRail renders DebugLinks.
// Shape must match UseQueryResult<MeResponse | null, Error>.
vi.mock("@/lib/auth/use-session", () => ({
  useSession: () => ({
    data: {
      schema_version: 1,
      user_id: "u",
      role: "platform_owner",
      email: "e",
      installation_id: null,
    },
    isLoading: false,
    error: null,
  }),
}));

// react-markdown + rehype-sanitize: avoid full MDX pipeline in jsdom.
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => <div>{children}</div>,
}));
vi.mock("rehype-sanitize", () => ({ default: () => {} }));
vi.mock("@/lib/markdown", () => ({
  LOCKED_SANITIZE_SCHEMA: {},
  stripCodemasterSummary: (body: string | null) => {
    if (!body) return "";
    return body
      .replace(
        /<!--\s*codemaster-summary-start\s*-->[\s\S]*?<!--\s*codemaster-summary-end\s*-->/g,
        "",
      )
      .trim();
  },
}));

// Stub submitFindingFeedback so FindingFeedback renders without network calls.
vi.mock("@/lib/api/admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/admin")>();
  return {
    ...actual,
    submitFindingFeedback: vi.fn().mockResolvedValue({ feedback_event_id: "e1" }),
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fetchSpy: any;

function mockFetch(impl: typeof globalThis.fetch): void {
  fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(impl as never);
}

function makeFinding(
  overrides: Partial<ReviewFindingItemV1> = {},
): ReviewFindingItemV1 {
  return {
    finding_id: "11111111-1111-1111-1111-111111111111",
    file_path: "src/lib/format.ts",
    start_line: 42,
    end_line: 42,
    severity: "issue",
    title: "Missing locale fallback",
    body: "formatCurrency does not catch RangeError on bad locales.",
    suggestion: null,
    tool_source: null,
    category: null,
    confidence: null,
    scope: null,
    citations: [],
    ...overrides,
  };
}

function makeDetail(
  overrides: Partial<ReviewDetailV1> = {},
): ReviewDetailV1 {
  return {
    schema_version: 1,
    review_id: "22222222-2222-2222-2222-222222222222",
    repo: "acme/widget",
    pr_number: 142,
    pr_title: "Add formatCurrency helper",
    state: "complete",
    findings: [makeFinding()],
    activities: [],
    langfuse_url: "https://langfuse.internal/trace/abc",
    temporal_url:
      "https://temporal.internal/namespaces/codemaster/workflows/wf-1",
    posted_at: "2026-05-06T11:00:00Z",
    pr_author: null,
    base_ref: null,
    head_ref: null,
    draft: false,
    pr_description: null,
    publication_outcome: null,
    governance: null,
    walkthrough: null,
    retrieval_trace_id: null,
    fix_prompt: null,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// React 19's `use(promise)` only reads synchronously when the promise
// carries the internal `status`/`value` markers it stamps on first
// encounter. In tests we feed it a pre-marked thenable so the page
// does not suspend on Promise.resolve, which Vitest's jsdom render
// cannot await without an extra Suspense flush.
function resolvedParams(reviewId: string): Promise<{ id: string }> {
  const promise = Promise.resolve({ id: reviewId }) as Promise<{
    id: string;
  }> & {
    status?: string;
    value?: { id: string };
  };
  promise.status = "fulfilled";
  promise.value = { id: reviewId };
  return promise;
}

function renderPage(
  reviewId = "22222222-2222-2222-2222-222222222222",
): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrap({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  render(<ReviewDetailPage params={resolvedParams(reviewId)} />, {
    wrapper: Wrap,
  });
}

beforeEach(() => {
  // reset between tests; spy is reset in afterEach
});

afterEach(() => {
  fetchSpy?.mockRestore();
});

describe("ReviewDetailPage — wiring", () => {
  it("renders the loading skeleton while the request is in flight", () => {
    let resolve: (r: Response) => void = () => {};
    mockFetch(
      () =>
        new Promise<Response>((r) => {
          resolve = r;
        }),
    );
    renderPage();
    expect(screen.getByTestId("review-detail-loading")).toBeInTheDocument();
    resolve(jsonResponse(makeDetail()));
  });

  it("renders the error state on a 500 response", async () => {
    mockFetch(async () => jsonResponse({ detail: "boom" }, 500));
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("review-detail-error")).toBeInTheDocument();
    });
  });

  // Changed: empty findings now renders "Clean review" (not "No findings").
  it("renders the 'Clean review' empty state when findings is empty", async () => {
    mockFetch(async () => jsonResponse(makeDetail({ findings: [] })));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Clean review/i)).toBeInTheDocument();
    });
  });

  it("strips a [run:<uuid>] prefix from the page heading", async () => {
    mockFetch(async () =>
      jsonResponse(
        makeDetail({
          pr_title:
            "[run:019e8858-934a-7b96-a484-4d962c428b6f] smoke validation",
        }),
      ),
    );
    renderPage();
    const heading = await screen.findByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("smoke validation");
    expect(heading.textContent ?? "").not.toContain("run:");
  });

  // Changed: body is in the inspector — click the finding row first.
  it("renders findings with severity badge, title, and body", async () => {
    const user = userEvent.setup();
    mockFetch(async () =>
      jsonResponse(
        makeDetail({
          findings: [
            makeFinding({
              finding_id: "f-1",
              severity: "blocker",
              title: "DB password in cleartext",
              body: "config.json line 7",
            }),
            makeFinding({
              finding_id: "f-2",
              severity: "suggestion",
              title: "Consider memoization",
              body: "render path A",
            }),
          ],
        }),
      ),
    );
    renderPage();
    // Wait for ledger to render titles.
    await waitFor(() => {
      expect(screen.getByText("DB password in cleartext")).toBeInTheDocument();
    });
    expect(screen.getByText("Consider memoization")).toBeInTheDocument();
    // Severity badge labels are in the rows.
    expect(screen.getByText("Blocker")).toBeInTheDocument();
    expect(screen.getByText("Suggestion")).toBeInTheDocument();
    // Body is NOT visible until a row is clicked -- click the first finding.
    expect(screen.queryByText("config.json line 7")).not.toBeInTheDocument();
    await user.click(screen.getByText("DB password in cleartext"));
    // Inspector now shows the body.
    expect(screen.getByText("config.json line 7")).toBeInTheDocument();
  });

  it("renders the header with repo, PR number, and PR title", async () => {
    mockFetch(async () =>
      jsonResponse(
        makeDetail({
          repo: "acme/api",
          pr_number: 314,
          pr_title: "Wire CSRF middleware",
        }),
      ),
    );
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("acme/api")).toBeInTheDocument();
    });
    expect(screen.getByText(/#314/)).toBeInTheDocument();
    expect(screen.getByText("Wire CSRF middleware")).toBeInTheDocument();
  });

  it("calls GET /api/admin/reviews/{id} on mount", async () => {
    const calls: string[] = [];
    mockFetch(async (url: string | URL | Request) => {
      const u =
        typeof url === "string"
          ? url
          : url instanceof URL
            ? url.toString()
            : url.url;
      calls.push(u);
      return jsonResponse(makeDetail());
    });
    renderPage("rev-abc-001");
    await waitFor(() => {
      expect(
        calls.some((c) => c.includes("/api/admin/reviews/rev-abc-001")),
      ).toBe(true);
    });
  });

  it("renders 100+ findings without crashing (edge case 3)", async () => {
    const findings = Array.from({ length: 120 }, (_, i) =>
      makeFinding({
        finding_id: `f-${String(i).padStart(3, "0")}`,
        title: `Finding ${i}`,
      }),
    );
    mockFetch(async () => jsonResponse(makeDetail({ findings })));
    renderPage();
    // First and last finding are both rendered — the page does not
    // bail early or throw on a long list.
    await waitFor(() => {
      expect(screen.getByText("Finding 0")).toBeInTheDocument();
    });
    expect(screen.getByText("Finding 119")).toBeInTheDocument();
  });

  // Changed: truncation was REMOVED in the reship. The inspector renders the
  // full body without truncation. No "Expand" button exists.
  it("renders the full body of a 10,000-char finding in the inspector (adversarial case 5)", async () => {
    const user = userEvent.setup();
    const longBody = "A".repeat(10_000);
    mockFetch(async () =>
      jsonResponse(
        makeDetail({
          findings: [
            makeFinding({
              finding_id: "f-long",
              title: "Long body",
              body: longBody,
            }),
          ],
        }),
      ),
    );
    renderPage();
    // Click the finding row to open the inspector.
    await waitFor(() => {
      expect(screen.getByText("Long body")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Long body"));
    // The inspector renders the full body as a text node (no truncation).
    await waitFor(() => {
      const bodyParagraph = screen.getByText((content) =>
        content.startsWith("AAAAAAAAAA") && content.length === 10_000,
      );
      expect(bodyParagraph).toBeInTheDocument();
    });
    // No "Expand" control exists in the new model.
    expect(screen.queryByRole("button", { name: /expand/i })).toBeNull();
  });

  // ── XSS adversarial corpus driver ────────────────────────────────

  type XssEntry = {
    id: string;
    field: "title" | "body";
    input: string;
    expected_escaped_output: string;
  };

  function loadCorpus(): XssEntry[] {
    const dir = path.resolve(
      __dirname,
      "..",
      "corpora",
      "xss",
    );
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map(
        (f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as XssEntry,
      )
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  describe("XSS adversarial corpus", () => {
    const corpus = loadCorpus();

    it("loads exactly 5 corpus entries from tests/corpora/xss/", () => {
      expect(corpus.length).toBe(5);
    });

    for (const entry of corpus) {
      it(`escapes ${entry.id} when injected into the ${entry.field}`, async () => {
        const user = userEvent.setup();
        const finding = makeFinding({
          finding_id: `f-${entry.id}`,
          // Set a stable title when the payload is in the body so we
          // can locate the row by title to click it.
          title: entry.field === "body" ? "XSS target finding" : entry.input,
          [entry.field]: entry.input,
        });
        mockFetch(async () =>
          jsonResponse(makeDetail({ findings: [finding] })),
        );
        const { container } = (() => {
          const client = new QueryClient({
            defaultOptions: { queries: { retry: false } },
          });
          return render(
            <QueryClientProvider client={client}>
              <ReviewDetailPage params={resolvedParams("xss-driver")} />
            </QueryClientProvider>,
          );
        })();

        // Wait for the ledger to render (finding row is visible).
        await waitFor(() => {
          const rows = container.querySelectorAll('[role="row"][aria-selected]');
          expect(rows.length).toBeGreaterThan(0);
        });

        // Click the data row to open the inspector so both the title
        // (in the row) and the body (in the inspector) are mounted.
        const dataRows = container.querySelectorAll('[role="row"][aria-selected]');
        const firstRow = dataRows[0] as HTMLElement;
        await user.click(firstRow);

        if (entry.field === "title") {
          // Title is still a text node (in the ledger row + inspector heading).
          // Assert both the escaped-text output and all 4 safety assertions.
          await waitFor(() => {
            expect(container.textContent ?? "").toContain(
              entry.expected_escaped_output,
            );
          });
        } else {
          // Body is now rendered via rehype-sanitize (sanitizer-rendered, not
          // text-escaped). Safety = the dangerous element is stripped by the
          // sanitizer, not escaped to text. Drop the escaped-text assertion;
          // keep all 4 safety assertions and confirm the inspector rendered.
          await waitFor(() => {
            // Finding title is visible, confirming the inspector rendered.
            expect(container.textContent ?? "").toContain("XSS target finding");
          });
        }
        // Critically: no executable HTML is created from the payload.
        // These 4 assertions hold for EVERY corpus entry regardless of field.
        expect(container.querySelector("script")).toBeNull();
        expect(container.querySelector("img[src='x']")).toBeNull();
        expect(
          container.querySelector("svg[onload], svg[onLoad]"),
        ).toBeNull();
        // No anchor whose href starts with `javascript:` (pseudo-proto).
        const anchors = container.querySelectorAll("a[href]");
        for (const a of anchors) {
          expect(a.getAttribute("href")).not.toMatch(/^javascript:/i);
        }
      });
    }
  });

  // ── P1-B engineer-value surfaces ─────────────────────────────────

  describe("P1 engineer value", () => {
    it("renders the meta-row with author, branches, and the posted verdict", async () => {
      mockFetch(async () =>
        jsonResponse(
          makeDetail({
            pr_author: "alpha",
            base_ref: "main",
            head_ref: "feat/formatcurrency",
            publication_outcome: "inline_posted",
          }),
        ),
      );
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/@alpha/)).toBeInTheDocument();
      });
      expect(screen.getByText("main")).toBeInTheDocument();
      expect(screen.getByText("feat/formatcurrency")).toBeInTheDocument();
      expect(screen.getByText(/Posted inline/i)).toBeInTheDocument();
    });

    it("shows 'Not posted' for a degraded-unposted review", async () => {
      mockFetch(async () =>
        jsonResponse(makeDetail({ publication_outcome: "degraded_unposted" })),
      );
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/Not posted/i)).toBeInTheDocument();
      });
    });

    it("renders the author PR description", async () => {
      mockFetch(async () =>
        jsonResponse(
          makeDetail({ pr_description: "Adds a currency formatter for the cart." }),
        ),
      );
      renderPage();
      await waitFor(() => {
        expect(
          screen.getByText("Adds a currency formatter for the cart."),
        ).toBeInTheDocument();
      });
    });

    // Changed: no grouped sections anymore. Assert CategoryFilterPills show
    // "Security" and "Logic" (Logic = bug category) in triage order.
    it("groups findings by category with Security before Logic", async () => {
      const user = userEvent.setup();
      mockFetch(async () =>
        jsonResponse(
          makeDetail({
            findings: [
              makeFinding({
                finding_id: "f-perf",
                category: "performance",
                title: "N+1 query",
              }),
              makeFinding({
                finding_id: "f-logic",
                category: "bug",
                title: "Off-by-one",
              }),
              makeFinding({
                finding_id: "f-sec",
                category: "security",
                title: "md5 hashing",
              }),
            ],
          }),
        ),
      );
      renderPage();
      // Wait for the category pills to appear.
      await waitFor(() => {
        expect(screen.getByText(/Security/)).toBeInTheDocument();
      });
      // All three category pills are present.
      expect(screen.getByText(/Logic/)).toBeInTheDocument();
      expect(screen.getByText(/Performance/)).toBeInTheDocument();
      // Triage order in the DOM: Security pill appears before Logic pill.
      const body = document.body.textContent ?? "";
      const secIdx = body.indexOf("Security");
      const logicIdx = body.indexOf("Logic");
      const perfIdx = body.indexOf("Performance");
      expect(secIdx).toBeLessThan(logicIdx);
      expect(logicIdx).toBeLessThan(perfIdx);
      // Clicking the Security pill narrows the grid to only the security finding.
      // The pill text includes the count, e.g. "Security 1".
      const secPill = screen.getByRole("button", { name: /security/i });
      await user.click(secPill);
      await waitFor(() => {
        expect(screen.getByText("md5 hashing")).toBeInTheDocument();
        expect(screen.queryByText("Off-by-one")).not.toBeInTheDocument();
        expect(screen.queryByText("N+1 query")).not.toBeInTheDocument();
      });
    });

    // Changed: click the finding row first to open the inspector, then expand Evidence.
    it("expands a finding's Evidence to its citation", async () => {
      const user = userEvent.setup();
      mockFetch(async () =>
        jsonResponse(
          makeDetail({
            findings: [
              makeFinding({
                finding_id: "f-cite",
                category: "security",
                title: "md5 hashing",
                citations: [
                  {
                    kind: "policy_rule",
                    locator: "SEC-use-bcrypt-3f9a",
                    excerpt: "Hash with bcrypt, not md5.",
                  },
                ],
              }),
            ],
          }),
        ),
      );
      renderPage();
      // Wait for the row to appear and click it to open the inspector.
      await waitFor(() => {
        expect(screen.getByText("md5 hashing")).toBeInTheDocument();
      });
      await user.click(screen.getByText("md5 hashing"));
      // The Evidence button is now visible in the inspector.
      const toggle = await screen.findByRole("button", {
        name: /evidence \(1\)/i,
      });
      // Citation is not yet visible.
      expect(
        screen.queryByText("SEC-use-bcrypt-3f9a"),
      ).not.toBeInTheDocument();
      // Expand evidence.
      await user.click(toggle);
      expect(screen.getByText("SEC-use-bcrypt-3f9a")).toBeInTheDocument();
    });

    // Changed: DebugLinks is role-gated. The useSession mock returns
    // platform_owner so ContextRail renders DebugLinks. The stage strip is
    // behind a <details> "Pipeline (N stages)" disclosure -- open it first.
    it("renders the workflow stage strip from activities", async () => {
      const user = userEvent.setup();
      mockFetch(async () =>
        jsonResponse(
          makeDetail({
            activities: [
              {
                seq: 1,
                activity_name: "WEBHOOK_RECEIVED",
                state: "started",
                started_at: "2026-05-30T11:00:00Z",
                completed_at: "2026-05-30T11:00:00Z",
                detail: "",
              },
              {
                seq: 2,
                activity_name: "ANALYZED",
                state: "completed",
                started_at: "2026-05-30T11:00:01Z",
                completed_at: "2026-05-30T11:00:02Z",
                detail: "",
              },
            ],
          }),
        ),
      );
      renderPage();
      // Wait for the Pipeline disclosure to appear in DebugLinks.
      const pipelineSummary = await screen.findByText(/Pipeline \(2 stages\)/i);
      expect(pipelineSummary).toBeInTheDocument();
      // Open the disclosure to show the StageStrip.
      await user.click(pipelineSummary);
      // Stage names are now visible.
      await waitFor(() => {
        expect(screen.getByText("WEBHOOK_RECEIVED")).toBeInTheDocument();
      });
      expect(screen.getByText("ANALYZED")).toBeInTheDocument();
    });
  });

  describe("P2 governance scorecard", () => {
    // Changed: ComplianceCard shows rule TITLE + source_file (not rule_id).
    // The heading is "Compliance" (not "Governance").
    it("renders the governance panel with the violated policy rule", async () => {
      mockFetch(async () =>
        jsonResponse(
          makeDetail({
            governance: {
              policy_rules: [
                {
                  rule_id: "SEC-use-bcrypt-3f9a",
                  title: "Use bcrypt",
                  source_file: "docs/architecture/SECURITY.md",
                  category: "security",
                  intent: "require",
                  status: "violated",
                },
                {
                  rule_id: "ARCH-cache-hints",
                  title: "Webhooks are cache hints",
                  source_file: "CLAUDE.md",
                  category: "architecture",
                  intent: "forbid",
                  status: "satisfied",
                },
              ],
              applied_count: 2,
              violated_count: 1,
              satisfied_count: 1,
            },
            findings: [
              makeFinding({
                finding_id: "f-gov",
                category: "security",
                title: "md5 hashing",
                citations: [
                  {
                    kind: "policy_rule",
                    locator: "SEC-use-bcrypt-3f9a",
                    excerpt: null,
                  },
                ],
              }),
            ],
          }),
        ),
      );
      renderPage();
      // The ComplianceCard heading is "Compliance".
      await waitFor(() => {
        expect(screen.getByText("Compliance")).toBeInTheDocument();
      });
      // The violated rule is shown by its TITLE (not rule_id).
      expect(screen.getByText("Use bcrypt")).toBeInTheDocument();
      // The source file is shown below the title.
      expect(screen.getByText("docs/architecture/SECURITY.md")).toBeInTheDocument();
      // Stat counts are shown.
      expect(screen.getByText(/1 violated/)).toBeInTheDocument();
      expect(screen.getByText(/1 passed/)).toBeInTheDocument();
    });
  });

  describe("P5 feedback write-loop", () => {
    // Changed: feedback verbs are in the inspector (click finding row first).
    // The "Promote a learning" link is in the main column (always visible).
    it("renders feedback verbs per finding + a promote-learning link", async () => {
      const user = userEvent.setup();
      mockFetch(async () =>
        jsonResponse(
          makeDetail({
            findings: [makeFinding({ finding_id: "f-fb", title: "A finding" })],
          }),
        ),
      );
      renderPage();
      // Wait for the finding row and click it to open the inspector.
      await waitFor(() => {
        expect(screen.getByText("A finding")).toBeInTheDocument();
      });
      await user.click(screen.getByText("A finding"));
      // Feedback verbs are now visible in the inspector.
      await waitFor(() => {
        expect(screen.getByText(/Was this useful/i)).toBeInTheDocument();
      });
      expect(
        screen.getByRole("button", { name: "Helpful" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Not helpful" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Wrong" }),
      ).toBeInTheDocument();
      // The "Promote a learning" link is in the main column.
      const promote = screen.getByRole("link", { name: /Promote a learning/i });
      expect(promote).toHaveAttribute("href", "/knowledge/proposals");
    });
  });

  describe("P4 operator cockpit", () => {
    // Changed: retrieval-trace link is in DebugLinks (role-gated).
    // The useSession mock returns platform_owner so it renders.
    it("renders a retrieval-trace deep-link when present", async () => {
      mockFetch(async () =>
        jsonResponse(
          makeDetail({
            retrieval_trace_id: "3f2a1b00-0000-4000-8000-000000000001",
          }),
        ),
      );
      renderPage();
      const link = await screen.findByRole("link", { name: /Retrieval trace/i });
      expect(link).toHaveAttribute(
        "href",
        "/admin/retrieval-traces/3f2a1b00-0000-4000-8000-000000000001",
      );
    });

    it("omits the retrieval-trace link when absent", async () => {
      mockFetch(async () =>
        jsonResponse(makeDetail({ langfuse_url: null, temporal_url: null })),
      );
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/Findings/)).toBeInTheDocument();
      });
      expect(
        screen.queryByRole("link", { name: /Retrieval trace/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("P3 walkthrough", () => {
    // Changed: WalkthroughRail is in the ContextRail (no finding selected).
    // File rows are behind a <details> "N files changed" disclosure -- open it.
    it("renders the walkthrough block with TL;DR and a file row", async () => {
      const user = userEvent.setup();
      mockFetch(async () =>
        jsonResponse(
          makeDetail({
            walkthrough: {
              tldr: "Adds a currency formatter; 3 issues.",
              file_rows: [
                {
                  path: "src/format.ts",
                  change_summary: "adds formatCurrency",
                  severity_max: "issue",
                  finding_count: 2,
                },
              ],
              degradation_note: null,
              suggested_reviewers: ["alpha"],
              linked_issues: [],
            },
          }),
        ),
      );
      renderPage();
      // The WalkthroughRail heading "Walkthrough" and TL;DR are visible.
      await waitFor(() => {
        expect(screen.getByText("Walkthrough")).toBeInTheDocument();
      });
      expect(
        screen.getByText(/Adds a currency formatter/),
      ).toBeInTheDocument();
      // File rows are behind the "1 files changed" disclosure -- open it.
      const filesSummary = screen.getByText(/1 files changed/i);
      await user.click(filesSummary);
      await waitFor(() => {
        expect(screen.getByText("src/format.ts")).toBeInTheDocument();
      });
    });
  });
});
