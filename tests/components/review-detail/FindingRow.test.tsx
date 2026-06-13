import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FindingRow } from "@/components/review-detail/FindingRow";
import type { ReviewFindingItemV1 } from "@/lib/api/admin";

function mkFinding(overrides?: Partial<ReviewFindingItemV1>): ReviewFindingItemV1 {
  return {
    finding_id: "find-001",
    file_path: "src/auth/login.ts",
    start_line: 42,
    end_line: 55,
    severity: "issue",
    title: "Improper null check",
    body: "The null check here will not catch undefined.",
    suggestion: null,
    tool_source: null,
    category: "bug",
    confidence: null,
    scope: null,
    citations: [],
    ...overrides,
  };
}

describe("FindingRow", () => {
  it("renders role=row with aria-selected=false when not selected", () => {
    render(
      <FindingRow
        finding={mkFinding()}
        selected={false}
        onSelect={vi.fn()}
      />,
    );
    const row = screen.getByRole("row");
    expect(row.getAttribute("aria-selected")).toBe("false");
  });

  it("calls onSelect with finding_id on click", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <FindingRow
        finding={mkFinding()}
        selected={false}
        onSelect={onSelect}
      />,
    );
    await user.click(screen.getByRole("row"));
    expect(onSelect).toHaveBeenCalledWith("find-001");
  });

  it("calls onSelect with finding_id on Enter keydown", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <FindingRow
        finding={mkFinding()}
        selected={false}
        onSelect={onSelect}
      />,
    );
    const row = screen.getByRole("row");
    row.focus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("find-001");
  });

  it("calls onSelect with finding_id on Space keydown", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <FindingRow
        finding={mkFinding()}
        selected={false}
        onSelect={onSelect}
      />,
    );
    const row = screen.getByRole("row");
    row.focus();
    await user.keyboard(" ");
    expect(onSelect).toHaveBeenCalledWith("find-001");
  });

  it("renders aria-selected=true when selected", () => {
    render(
      <FindingRow
        finding={mkFinding()}
        selected={true}
        onSelect={vi.fn()}
      />,
    );
    const row = screen.getByRole("row");
    expect(row.getAttribute("aria-selected")).toBe("true");
  });

  it("renders the finding title", () => {
    render(
      <FindingRow
        finding={mkFinding({ title: "Null deref in login" })}
        selected={false}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Null deref in login")).toBeDefined();
  });

  it("renders the severity badge label", () => {
    render(
      <FindingRow
        finding={mkFinding({ severity: "blocker" })}
        selected={false}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Blocker")).toBeDefined();
  });

  it("renders the file location chip", () => {
    render(
      <FindingRow
        finding={mkFinding({ file_path: "src/auth/login.ts", start_line: 42, end_line: 55 })}
        selected={false}
        onSelect={vi.fn()}
      />,
    );
    // FileLocationChip renders truncated path + line range
    expect(screen.getByText(/login\.ts/)).toBeDefined();
  });

  it("has three gridcell children", () => {
    render(
      <FindingRow
        finding={mkFinding()}
        selected={false}
        onSelect={vi.fn()}
      />,
    );
    const cells = screen.getAllByRole("gridcell");
    expect(cells).toHaveLength(3);
  });

  it("applies accent text class to title when selected", () => {
    render(
      <FindingRow
        finding={mkFinding({ title: "Accent title" })}
        selected={true}
        onSelect={vi.fn()}
      />,
    );
    const titleEl = screen.getByText("Accent title");
    // The selected title carries the accent token class
    expect(titleEl.className).toContain("c-text-accent");
  });

  it("respects tabIndex prop", () => {
    render(
      <FindingRow
        finding={mkFinding()}
        selected={false}
        onSelect={vi.fn()}
        tabIndex={-1}
      />,
    );
    expect(screen.getByRole("row").getAttribute("tabindex")).toBe("-1");
  });
});
