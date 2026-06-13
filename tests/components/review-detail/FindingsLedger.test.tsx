import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FindingsLedger } from "@/components/review-detail/FindingsLedger";
import type { FindingCategory, ReviewFindingItemV1 } from "@/lib/api/admin";

function mkFinding(overrides?: Partial<ReviewFindingItemV1>): ReviewFindingItemV1 {
  return {
    finding_id: "find-001",
    file_path: "src/auth/login.ts",
    start_line: 1,
    end_line: 5,
    severity: "issue",
    title: "Default finding title",
    body: "body text",
    suggestion: null,
    tool_source: null,
    category: "bug" as FindingCategory,
    confidence: null,
    scope: null,
    citations: [],
    ...overrides,
  };
}

const THREE_FINDINGS: ReviewFindingItemV1[] = [
  mkFinding({
    finding_id: "f-blocker-sec",
    severity: "blocker",
    category: "security",
    title: "SQL injection vulnerability",
    file_path: "src/db/query.ts",
  }),
  mkFinding({
    finding_id: "f-issue-sec",
    severity: "issue",
    category: "security",
    title: "Missing input validation",
    file_path: "src/api/handler.ts",
  }),
  mkFinding({
    finding_id: "f-nit-bug",
    severity: "nit",
    category: "bug",
    title: "Unused variable bug",
    file_path: "src/utils/helper.ts",
  }),
];

describe("FindingsLedger", () => {
  it("renders all 3 finding rows plus 1 header row", () => {
    render(
      <FindingsLedger
        findings={THREE_FINDINGS}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    // getAllByRole("row") includes the header row AND the 3 FindingRow rows
    const rows = screen.getAllByRole("row");
    // Subtract 1 for the header row -> 3 data rows
    expect(rows.length - 1).toBe(3);
  });

  it("clicking the Blockers chip narrows to the blocker row only", async () => {
    const user = userEvent.setup();
    render(
      <FindingsLedger
        findings={THREE_FINDINGS}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );

    const blockerBtn = screen.getByText(/1 Blocker/);
    await user.click(blockerBtn);

    // After filtering, only 1 data row (+ 1 header)
    const rows = screen.getAllByRole("row");
    expect(rows.length - 1).toBe(1);
    expect(screen.getByText("SQL injection vulnerability")).toBeDefined();
  });

  it("clicking the Security category pill narrows to 2 rows", async () => {
    const user = userEvent.setup();
    render(
      <FindingsLedger
        findings={THREE_FINDINGS}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );

    const secBtn = screen.getByRole("button", { name: /Security 2/ });
    await user.click(secBtn);

    const rows = screen.getAllByRole("row");
    expect(rows.length - 1).toBe(2);
  });

  it("typing a search substring narrows to the matching row", async () => {
    render(
      <FindingsLedger
        findings={THREE_FINDINGS}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );

    const searchInput = screen.getByRole("searchbox", { name: "Search findings" });
    // Use fireEvent to avoid timing issues with useDeferredValue
    fireEvent.change(searchInput, { target: { value: "SQL injection" } });

    await waitFor(() => {
      const rows = screen.getAllByRole("row");
      expect(rows.length - 1).toBe(1);
    });
    expect(screen.getByText("SQL injection vulnerability")).toBeDefined();
  });

  it("pressing ArrowDown with nothing selected calls onSelect with the first finding id", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <FindingsLedger
        findings={THREE_FINDINGS}
        selectedId={null}
        onSelect={onSelect}
      />,
    );

    const grid = screen.getByRole("grid", { name: "Findings" });
    grid.focus();
    await user.keyboard("{ArrowDown}");

    expect(onSelect).toHaveBeenCalledWith("f-blocker-sec");
  });

  it("renders Clean review empty state with no grid when findings is empty", () => {
    render(
      <FindingsLedger
        findings={[]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("Clean review")).toBeDefined();
    expect(screen.queryByRole("grid")).toBeNull();
  });

  it("shows inline empty message when filters produce no matches", async () => {
    render(
      <FindingsLedger
        findings={THREE_FINDINGS}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );

    const searchInput = screen.getByRole("searchbox", { name: "Search findings" });
    fireEvent.change(searchInput, { target: { value: "xyzzy-no-match" } });

    await waitFor(() => {
      expect(screen.getByText("No findings match these filters.")).toBeDefined();
    });
    // Grid still present but no FindingRows
    expect(screen.getByRole("grid")).toBeDefined();
  });

  it("Clear filters resets all filters and restores every row", async () => {
    const user = userEvent.setup();
    render(
      <FindingsLedger
        findings={THREE_FINDINGS}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );

    const searchInput = screen.getByRole("searchbox", {
      name: "Search findings",
    });
    fireEvent.change(searchInput, { target: { value: "xyzzy-no-match" } });

    await waitFor(() => {
      expect(
        screen.getByText("No findings match these filters."),
      ).toBeDefined();
    });

    // Clear-filters affordance appears (controls row + empty state); clicking
    // it restores every row.
    await user.click(
      screen.getAllByRole("button", { name: /clear filters/i })[0]!,
    );

    await waitFor(() => {
      expect(screen.getAllByRole("row").length - 1).toBe(3);
    });
  });
});
