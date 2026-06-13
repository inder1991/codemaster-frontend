import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { DebugLinks } from "@/components/review-detail/DebugLinks";
import type { ReviewDetailV1 } from "@/lib/api/admin";

function baseDetail(overrides: Partial<ReviewDetailV1> = {}): ReviewDetailV1 {
  return {
    schema_version: 1,
    review_id: "rev-abc",
    repo: "org/repo",
    pr_number: 1,
    pr_title: "Test PR",
    state: "complete",
    findings: [],
    activities: [],
    langfuse_url: null,
    temporal_url: null,
    posted_at: null,
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

describe("DebugLinks", () => {
  it("renders nothing when activities empty and no URLs", () => {
    const { container } = render(
      <DebugLinks detail={baseDetail()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders heading when temporal_url is present", () => {
    render(
      <DebugLinks
        detail={baseDetail({ temporal_url: "https://temporal.example/workflows/x" })}
      />,
    );
    expect(screen.getByText(/Pipeline & debug/i)).toBeInTheDocument();
  });

  it("renders Temporal workflow link with correct href", () => {
    render(
      <DebugLinks
        detail={baseDetail({ temporal_url: "https://temporal.example/workflows/x" })}
      />,
    );
    const link = screen.getByRole("link", { name: /Temporal workflow/i });
    expect(link).toHaveAttribute("href", "https://temporal.example/workflows/x");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders Langfuse trace link when langfuse_url is present", () => {
    render(
      <DebugLinks
        detail={baseDetail({ langfuse_url: "https://langfuse.example/trace/y" })}
      />,
    );
    const link = screen.getByRole("link", { name: /Langfuse trace/i });
    expect(link).toHaveAttribute("href", "https://langfuse.example/trace/y");
  });

  it("renders Retrieval trace link when retrieval_trace_id is present", () => {
    render(
      <DebugLinks
        detail={baseDetail({ retrieval_trace_id: "trace-abc123" })}
      />,
    );
    const link = screen.getByRole("link", { name: /Retrieval trace/i });
    expect(link).toHaveAttribute("href", "/admin/retrieval-traces/trace-abc123");
  });

  it("renders pipeline disclosure with activity count", () => {
    render(
      <DebugLinks
        detail={baseDetail({
          temporal_url: "https://t/x",
          activities: [
            {
              seq: 1,
              activity_name: "CLONE",
              state: "completed",
              started_at: "2026-05-30T11:00:00Z",
              completed_at: "2026-05-30T11:00:01Z",
              detail: "",
            },
            {
              seq: 2,
              activity_name: "REVIEW",
              state: "completed",
              started_at: "2026-05-30T11:00:01Z",
              completed_at: "2026-05-30T11:00:05Z",
              detail: "",
            },
          ],
        })}
      />,
    );
    expect(screen.getByText(/Pipeline \(2 stages\)/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Temporal workflow/i })).toHaveAttribute(
      "href",
      "https://t/x",
    );
  });
});
