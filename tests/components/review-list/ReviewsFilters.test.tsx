import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReviewsFilters } from "@/components/review-list/ReviewsFilters";

const base = {
  values: { q: "", org: "", repo: "", state: "" },
  orgs: ["acme", "zeta"],
  orgsLoading: false,
  orgsError: false,
};

describe("ReviewsFilters", () => {
  it("emits onChange for the org select and the search box", async () => {
    const onChange = vi.fn();
    render(<ReviewsFilters {...base} onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText(/organisation/i), "acme");
    expect(onChange).toHaveBeenCalledWith({ org: "acme" });
    fireEvent.change(screen.getByLabelText(/search pr titles/i), { target: { value: "auth" } });
    expect(onChange).toHaveBeenCalledWith({ q: "auth" });
  });

  it("shows Clear only when a filter is active, and Clear resets all", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<ReviewsFilters {...base} onChange={onChange} />);
    expect(screen.queryByRole("button", { name: /clear/i })).not.toBeInTheDocument();
    rerender(<ReviewsFilters {...base} values={{ q: "", org: "acme", repo: "", state: "" }} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /clear/i }));
    expect(onChange).toHaveBeenCalledWith({ q: "", org: "", repo: "", state: "" });
  });

  it("hides the org select when orgsError is true", () => {
    render(<ReviewsFilters {...base} orgsError onChange={vi.fn()} />);
    expect(screen.queryByLabelText(/organisation/i)).not.toBeInTheDocument();
  });
});
