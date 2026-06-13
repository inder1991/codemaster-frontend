/**
 * TDD red suite for PrIdentityPanel.
 *
 * Verifies the labeled-grid PR identity card renders all six fields
 * correctly for the happy-path case and degrades gracefully when
 * pr_author, head_ref, base_ref, and publication_outcome are null.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { PrIdentityPanel } from "@/components/review-detail/PrIdentityPanel";
import type { ReviewDetailV1 } from "@/lib/api/admin";

function makeDetail(overrides: Partial<ReviewDetailV1> = {}): ReviewDetailV1 {
  return {
    schema_version: 1,
    review_id: "22222222-2222-2222-2222-222222222222",
    repo: "inder1991/inventory-service",
    pr_number: 111,
    pr_title: "Add inventory sync",
    state: "complete",
    findings: [],
    activities: [],
    langfuse_url: null,
    temporal_url: null,
    posted_at: null,
    pr_author: "inder1991",
    base_ref: "main",
    head_ref: "diag-rca-4",
    draft: false,
    pr_description: null,
    publication_outcome: "inline_posted",
    governance: null,
    walkthrough: null,
    retrieval_trace_id: null,
    fix_prompt: null,
    ...overrides,
  };
}

describe("PrIdentityPanel", () => {
  describe("happy path", () => {
    it("renders all six field labels", () => {
      render(<PrIdentityPanel detail={makeDetail()} />);
      expect(screen.getByText("Repository")).toBeInTheDocument();
      expect(screen.getByText("Pull request")).toBeInTheDocument();
      expect(screen.getByText("Author")).toBeInTheDocument();
      expect(screen.getByText("Branches")).toBeInTheDocument();
      expect(screen.getByText("Review state")).toBeInTheDocument();
      expect(screen.getByText("Publication")).toBeInTheDocument();
    });

    it("renders the repo name", () => {
      render(<PrIdentityPanel detail={makeDetail()} />);
      expect(
        screen.getByText("inder1991/inventory-service"),
      ).toBeInTheDocument();
    });

    it("renders the PR number with # prefix", () => {
      render(<PrIdentityPanel detail={makeDetail()} />);
      expect(screen.getByText("#111")).toBeInTheDocument();
    });

    it("renders the author with @ prefix", () => {
      render(<PrIdentityPanel detail={makeDetail()} />);
      expect(screen.getByText("@inder1991")).toBeInTheDocument();
    });

    it("renders head_ref and base_ref branch names", () => {
      render(<PrIdentityPanel detail={makeDetail()} />);
      expect(screen.getByText("diag-rca-4")).toBeInTheDocument();
      expect(screen.getByText("main")).toBeInTheDocument();
    });

    it("renders the state badge with label 'Complete'", () => {
      render(<PrIdentityPanel detail={makeDetail()} />);
      expect(screen.getByText("Complete")).toBeInTheDocument();
    });

    it("renders the publication outcome badge 'Posted inline'", () => {
      render(<PrIdentityPanel detail={makeDetail()} />);
      expect(screen.getByText("Posted inline")).toBeInTheDocument();
    });
  });

  describe("null / missing fields", () => {
    it("renders @unknown when pr_author is null", () => {
      render(<PrIdentityPanel detail={makeDetail({ pr_author: null })} />);
      expect(screen.getByText("@unknown")).toBeInTheDocument();
    });

    it("renders 'n/a' when head_ref and base_ref are null", () => {
      render(
        <PrIdentityPanel
          detail={makeDetail({ head_ref: null, base_ref: null })}
        />,
      );
      expect(screen.getByText("n/a")).toBeInTheDocument();
    });

    it("renders 'Pending' when publication_outcome is null", () => {
      render(
        <PrIdentityPanel detail={makeDetail({ publication_outcome: null })} />,
      );
      expect(screen.getByText("Pending")).toBeInTheDocument();
    });

    it("renders 'In progress' state badge", () => {
      render(<PrIdentityPanel detail={makeDetail({ state: "in_progress" })} />);
      expect(screen.getByText("In progress")).toBeInTheDocument();
    });

    it("renders without crashing when all nullable fields are null", () => {
      render(
        <PrIdentityPanel
          detail={makeDetail({
            pr_author: null,
            head_ref: null,
            base_ref: null,
            publication_outcome: null,
            state: "in_progress",
          })}
        />,
      );
      expect(screen.getByText("@unknown")).toBeInTheDocument();
      expect(screen.getByText("n/a")).toBeInTheDocument();
      expect(screen.getByText("Pending")).toBeInTheDocument();
      expect(screen.getByText("In progress")).toBeInTheDocument();
    });

    it("renders a Draft badge alongside the state badge when draft is true", () => {
      render(<PrIdentityPanel detail={makeDetail({ draft: true })} />);
      expect(screen.getByText("Draft")).toBeInTheDocument();
      // state badge still present
      expect(screen.getByText("Complete")).toBeInTheDocument();
    });
  });
});
