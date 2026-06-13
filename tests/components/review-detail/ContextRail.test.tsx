import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { ContextRail } from "@/components/review-detail/ContextRail";
import type { ReviewDetailV1 } from "@/lib/api/admin";

// Mock use-session so we can control the role in each test.
const mockUseSession = vi.fn();
vi.mock("@/lib/auth/use-session", () => ({
  useSession: () => mockUseSession(),
}));

function buildDetail(overrides: Partial<ReviewDetailV1> = {}): ReviewDetailV1 {
  return {
    schema_version: 1,
    review_id: "rev-1",
    repo: "org/repo",
    pr_number: 7,
    pr_title: "Fix N+1 queries",
    state: "complete",
    findings: [],
    activities: [
      {
        seq: 1,
        activity_name: "CLONE",
        state: "completed",
        started_at: "2026-05-30T10:00:00Z",
        completed_at: "2026-05-30T10:00:01Z",
        detail: "",
      },
    ],
    langfuse_url: null,
    temporal_url: "https://temporal.example/workflows/run-1",
    posted_at: null,
    pr_author: "alice",
    base_ref: "main",
    head_ref: "fix/n-plus-one",
    draft: false,
    pr_description: "This PR fixes N+1 query issues in the DB layer.",
    publication_outcome: "inline_posted",
    governance: {
      policy_rules: [
        {
          rule_id: "SEC-001",
          title: "No raw SQL",
          source_file: ".codemaster/policy.yaml",
          category: "security",
          intent: "forbid",
          status: "satisfied",
        },
      ],
      applied_count: 1,
      violated_count: 0,
      satisfied_count: 1,
    },
    walkthrough: {
      tldr: "Batch queries to avoid N+1.",
      file_rows: [],
      degradation_note: null,
      suggested_reviewers: [],
      linked_issues: [],
    },
    retrieval_trace_id: null,
    fix_prompt: null,
    ...overrides,
  };
}

describe("ContextRail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("reader role", () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({ data: { role: "reader" } });
    });

    it("does NOT render the PR description (moved to PrIdentityPanel)", () => {
      render(<ContextRail detail={buildDetail()} />);
      expect(
        screen.queryByText(/This PR fixes N\+1 query issues/i),
      ).not.toBeInTheDocument();
    });

    it("renders WalkthroughRail content", () => {
      render(<ContextRail detail={buildDetail()} />);
      expect(screen.getByText("Batch queries to avoid N+1.")).toBeInTheDocument();
    });

    it("renders ComplianceCard content", () => {
      render(<ContextRail detail={buildDetail()} />);
      // governance counts show up in the ComplianceCard
      expect(screen.getByText(/1 applied/i)).toBeInTheDocument();
    });

    it("does NOT render DebugLinks even with temporal_url and activities present", () => {
      render(<ContextRail detail={buildDetail()} />);
      // DebugLinks renders "Pipeline & debug" heading
      expect(screen.queryByText(/Pipeline & debug/i)).not.toBeInTheDocument();
      // No Temporal workflow link
      expect(
        screen.queryByRole("link", { name: /Temporal workflow/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("platform_owner role", () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({ data: { role: "platform_owner" } });
    });

    it("renders DebugLinks with temporal link", () => {
      render(<ContextRail detail={buildDetail()} />);
      expect(screen.getByText(/Pipeline & debug/i)).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /Temporal workflow/i }),
      ).toBeInTheDocument();
    });

    it("still renders Walkthrough and ComplianceCard", () => {
      render(<ContextRail detail={buildDetail()} />);
      expect(
        screen.getByText("Batch queries to avoid N+1."),
      ).toBeInTheDocument();
      expect(screen.getByText(/1 applied/i)).toBeInTheDocument();
    });
  });
});
