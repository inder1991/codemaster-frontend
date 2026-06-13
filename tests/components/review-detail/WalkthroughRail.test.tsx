import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { WalkthroughRail } from "@/components/review-detail/WalkthroughRail";
import type { WalkthroughSummaryV1 } from "@/lib/api/admin";

function wt(overrides: Partial<WalkthroughSummaryV1> = {}): WalkthroughSummaryV1 {
  return {
    tldr: "Refactors auth",
    file_rows: [
      {
        path: "src/auth/session.ts",
        change_summary: "extracts session logic",
        severity_max: "issue",
        finding_count: 3,
      },
      {
        path: "src/auth/token.ts",
        change_summary: "adds token refresh",
        severity_max: "suggestion",
        finding_count: 1,
      },
    ],
    degradation_note: null,
    suggested_reviewers: ["alice", "bob"],
    linked_issues: [
      {
        issue_number: 99,
        linkage_kind: "closes",
        title: "Auth refactor",
        state: "open",
      },
    ],
    ...overrides,
  };
}

describe("WalkthroughRail", () => {
  it("renders nothing when walkthrough is null", () => {
    const { container } = render(<WalkthroughRail walkthrough={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders heading and tldr", () => {
    render(<WalkthroughRail walkthrough={wt()} />);
    expect(screen.getByText("Walkthrough")).toBeInTheDocument();
    expect(screen.getByText("Refactors auth")).toBeInTheDocument();
  });

  it("shows '2 files changed' summary disclosure", () => {
    render(<WalkthroughRail walkthrough={wt()} />);
    expect(screen.getByText("2 files changed")).toBeInTheDocument();
  });

  it("expanding files shows both paths", async () => {
    const user = userEvent.setup();
    render(<WalkthroughRail walkthrough={wt()} />);
    const summary = screen.getByText("2 files changed");
    await user.click(summary);
    expect(screen.getByText("src/auth/session.ts")).toBeInTheDocument();
    expect(screen.getByText("src/auth/token.ts")).toBeInTheDocument();
  });

  it("shows degradation note when present", () => {
    render(
      <WalkthroughRail
        walkthrough={wt({ degradation_note: "ran in fallback mode" })}
      />,
    );
    expect(screen.getByText(/ran in fallback mode/)).toBeInTheDocument();
  });

  it("renders linked issues as chips with issue_number", () => {
    render(<WalkthroughRail walkthrough={wt()} />);
    expect(screen.getByText(/#99/)).toBeInTheDocument();
  });

  it("renders suggested reviewers as @login chips", () => {
    render(<WalkthroughRail walkthrough={wt()} />);
    expect(screen.getByText("@alice")).toBeInTheDocument();
    expect(screen.getByText("@bob")).toBeInTheDocument();
  });

  it("omits file disclosure when file_rows is empty", () => {
    render(<WalkthroughRail walkthrough={wt({ file_rows: [] })} />);
    expect(screen.queryByText(/files changed/)).not.toBeInTheDocument();
  });
});
