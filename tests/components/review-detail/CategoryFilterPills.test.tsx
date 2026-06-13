import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CategoryFilterPills } from "@/components/review-detail/CategoryFilterPills";
import type { ReviewFindingItemV1 } from "@/lib/api/admin";

function mkFinding(
  category: ReviewFindingItemV1["category"],
  id = category ?? "other-id",
): ReviewFindingItemV1 {
  return {
    finding_id: id,
    file_path: "src/foo.ts",
    start_line: 1,
    end_line: 5,
    severity: "issue",
    title: "A finding",
    body: "body text",
    suggestion: null,
    tool_source: null,
    category,
    confidence: null,
    scope: null,
    citations: [],
  };
}

describe("CategoryFilterPills", () => {
  it("renders All pill with total count", () => {
    const findings = [
      mkFinding("security", "s1"),
      mkFinding("security", "s2"),
      mkFinding("bug", "b1"),
    ];
    render(
      <CategoryFilterPills findings={findings} active={null} onChange={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "All 3" })).toBeDefined();
  });

  it("renders one pill per category present in triage order", () => {
    const findings = [
      mkFinding("security", "s1"),
      mkFinding("security", "s2"),
      mkFinding("bug", "b1"),
    ];
    render(
      <CategoryFilterPills findings={findings} active={null} onChange={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Security 2" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Logic 1" })).toBeDefined();
  });

  it("does not render a pill for absent categories", () => {
    const findings = [
      mkFinding("security", "s1"),
      mkFinding("security", "s2"),
      mkFinding("bug", "b1"),
    ];
    render(
      <CategoryFilterPills findings={findings} active={null} onChange={vi.fn()} />,
    );
    expect(screen.queryByRole("button", { name: /Performance/ })).toBeNull();
  });

  it("calls onChange(null) when All pill is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const findings = [mkFinding("security", "s1"), mkFinding("bug", "b1")];
    render(
      <CategoryFilterPills findings={findings} active={"security"} onChange={onChange} />,
    );
    await user.click(screen.getByRole("button", { name: "All 2" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("calls onChange(category) when a category pill is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const findings = [
      mkFinding("security", "s1"),
      mkFinding("security", "s2"),
      mkFinding("bug", "b1"),
    ];
    render(
      <CategoryFilterPills findings={findings} active={null} onChange={onChange} />,
    );
    await user.click(screen.getByRole("button", { name: "Security 2" }));
    expect(onChange).toHaveBeenCalledWith("security");
  });

  it("sets aria-pressed=true on the active category pill and false on All", () => {
    const findings = [
      mkFinding("security", "s1"),
      mkFinding("security", "s2"),
      mkFinding("bug", "b1"),
    ];
    render(
      <CategoryFilterPills findings={findings} active={"security"} onChange={vi.fn()} />,
    );
    const secBtn = screen.getByRole("button", { name: "Security 2" });
    const allBtn = screen.getByRole("button", { name: "All 3" });
    expect(secBtn.getAttribute("aria-pressed")).toBe("true");
    expect(allBtn.getAttribute("aria-pressed")).toBe("false");
  });

  it("counts null category under other", () => {
    const findings = [
      mkFinding(null, "n1"),
      mkFinding(null, "n2"),
    ];
    render(
      <CategoryFilterPills findings={findings} active={null} onChange={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "All 2" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Other 2" })).toBeDefined();
  });
});
