import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Pagination } from "@/components/review-list/Pagination";

describe("Pagination", () => {
  it("shows the range + page-of and fires onPageChange", async () => {
    const onPageChange = vi.fn();
    render(<Pagination total={592} page={3} size={50} onPageChange={onPageChange} />);
    expect(screen.getByText(/Showing 101–150 of 592/)).toBeInTheDocument();
    expect(screen.getByText(/Page 3 of 12/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it("disables Prev on page 1 and Next on the last page", () => {
    const { rerender } = render(<Pagination total={40} page={1} size={50} onPageChange={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
    rerender(<Pagination total={120} page={3} size={50} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });
});
