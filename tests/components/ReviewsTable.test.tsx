import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ReviewsTable } from "@/components/ui/lists/ReviewsTable";
import type { Column } from "@/components/ui/lists/ReviewsTable";

interface Row {
  id: string;
  pr: number;
  title: string;
}

const COLUMNS: ReadonlyArray<Column<Row>> = [
  { header: "PR", cell: (r) => r.pr },
  { header: "Title", cell: (r) => r.title },
];

const ROWS: ReadonlyArray<Row> = [
  { id: "a", pr: 42, title: "Add formatCurrency" },
  { id: "b", pr: 43, title: "Refactor cart" },
];

describe("ReviewsTable", () => {
  it("renders without crashing on empty rows", () => {
    render(
      <ReviewsTable
        rows={[]}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        caption="reviews"
      />,
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("renders one row per data item with cell content", () => {
    render(
      <ReviewsTable
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        caption="reviews"
      />,
    );
    expect(screen.getByText("Add formatCurrency")).toBeInTheDocument();
    expect(screen.getByText("Refactor cart")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("43")).toBeInTheDocument();
  });

  it("fires onRowClick when a row is clicked", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <ReviewsTable
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        caption="reviews"
        onRowClick={onRowClick}
      />,
    );
    await user.click(screen.getByText("Add formatCurrency"));
    expect(onRowClick).toHaveBeenCalledWith(ROWS[0]);
  });

  it("renders the locked caption for screen readers", () => {
    render(
      <ReviewsTable
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        caption="reviews list"
      />,
    );
    expect(screen.getByText("reviews list")).toBeInTheDocument();
  });
});
