import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ComplianceCard } from "@/components/review-detail/ComplianceCard";
import type {
  GovernancePanelV1,
  ReviewFindingItemV1,
} from "@/lib/api/admin";

function gov(overrides: Partial<GovernancePanelV1> = {}): GovernancePanelV1 {
  return {
    policy_rules: [
      {
        rule_id: "SQL-001",
        title: "No raw SQL",
        source_file: "CLAUDE.md",
        category: "architecture",
        intent: "forbid",
        status: "violated",
      },
      {
        rule_id: "TEST-002",
        title: "Tests before code",
        source_file: "CLAUDE.md",
        category: "testing",
        intent: "require",
        status: "satisfied",
      },
      {
        rule_id: "SEC-003",
        title: "Vault only for secrets",
        source_file: "CLAUDE.md",
        category: "security",
        intent: "require",
        status: "satisfied",
      },
    ],
    applied_count: 3,
    violated_count: 1,
    satisfied_count: 2,
    ...overrides,
  };
}

function finding(
  citations: ReviewFindingItemV1["citations"],
): ReviewFindingItemV1 {
  return {
    finding_id: "f1",
    file_path: "a.ts",
    start_line: 1,
    end_line: 1,
    severity: "issue",
    title: "t",
    body: "b",
    suggestion: null,
    tool_source: null,
    category: null,
    confidence: null,
    scope: null,
    citations,
  };
}

describe("ComplianceCard", () => {
  it("renders nothing when governance is null and no citations", () => {
    const { container } = render(
      <ComplianceCard governance={null} findings={[finding([])]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the heading Compliance when governance is present", () => {
    render(<ComplianceCard governance={gov()} findings={[]} />);
    expect(screen.getByText("Compliance")).toBeInTheDocument();
  });

  it("shows the violated rule title and source_file", () => {
    render(<ComplianceCard governance={gov()} findings={[]} />);
    expect(screen.getByText("No raw SQL")).toBeInTheDocument();
    expect(screen.getAllByText("CLAUDE.md").length).toBeGreaterThan(0);
  });

  it("does not show rule_id in the document by default", () => {
    render(<ComplianceCard governance={gov()} findings={[]} />);
    // rule_id "SQL-001" must not appear in the rendered output
    expect(screen.queryByText("SQL-001")).not.toBeInTheDocument();
  });

  it("shows satisfied rules summary with count collapsed by default", () => {
    render(<ComplianceCard governance={gov()} findings={[]} />);
    expect(screen.getByText(/Show 2 satisfied/)).toBeInTheDocument();
  });

  it("expanding satisfied shows satisfied rule titles", async () => {
    const user = userEvent.setup();
    render(<ComplianceCard governance={gov()} findings={[]} />);
    const summary = screen.getByText(/Show 2 satisfied/);
    await user.click(summary);
    expect(screen.getByText("Tests before code")).toBeInTheDocument();
    expect(screen.getByText("Vault only for secrets")).toBeInTheDocument();
  });

  it("renders citation source groups for non-empty citation groups", () => {
    render(
      <ComplianceCard
        governance={null}
        findings={[
          finding([
            {
              kind: "knowledge_chunk",
              locator: "confluence:payments/intl#chunk=3",
              excerpt: null,
            },
            {
              kind: "linter_rule",
              locator: "eslint:no-throw",
              excerpt: null,
            },
          ]),
        ]}
      />,
    );
    expect(screen.getAllByText(/Confluence/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Linter/i).length).toBeGreaterThan(0);
  });
});
