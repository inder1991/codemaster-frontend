import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SeveritySummaryStrip } from "@/components/review-detail/SeveritySummaryStrip";
import type { ReviewFindingItemV1 } from "@/lib/api/admin";

function makeFinding(
  severity: ReviewFindingItemV1["severity"],
  id: string,
): ReviewFindingItemV1 {
  return {
    finding_id: id,
    file_path: "a/b.py",
    start_line: 1,
    end_line: 1,
    severity,
    title: "t",
    body: "b",
    suggestion: null,
    tool_source: null,
    category: null,
    confidence: null,
    scope: null,
    citations: [],
  };
}

const findings: ReviewFindingItemV1[] = [
  makeFinding("blocker", "b1"),
  makeFinding("blocker", "b2"),
  makeFinding("issue", "i1"),
  makeFinding("issue", "i2"),
  makeFinding("issue", "i3"),
  makeFinding("nit", "n1"),
];

describe("SeveritySummaryStrip", () => {
  it("shows count chips for present severities only", () => {
    render(
      <SeveritySummaryStrip
        findings={findings}
        active={null}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText(/2 Blockers/)).toBeInTheDocument();
    expect(screen.getByText(/3 Issues/)).toBeInTheDocument();
    expect(screen.getByText(/1 Nit/)).toBeInTheDocument();
    expect(screen.queryByText(/Suggestion/)).not.toBeInTheDocument();
  });

  it("clicking a chip calls onSelect with that severity", async () => {
    const onSelect = vi.fn();
    render(
      <SeveritySummaryStrip
        findings={findings}
        active={null}
        onSelect={onSelect}
      />,
    );
    await userEvent.click(screen.getByText(/3 Issues/));
    expect(onSelect).toHaveBeenCalledWith("issue");
  });

  it("active chip has aria-pressed=true", () => {
    render(
      <SeveritySummaryStrip
        findings={findings}
        active="issue"
        onSelect={() => {}}
      />,
    );
    const issueBtn = screen.getByText(/3 Issues/).closest("button");
    expect(issueBtn).toHaveAttribute("aria-pressed", "true");

    const blockerBtn = screen.getByText(/2 Blockers/).closest("button");
    expect(blockerBtn).toHaveAttribute("aria-pressed", "false");
  });
});
