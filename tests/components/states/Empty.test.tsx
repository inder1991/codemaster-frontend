import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Empty } from "@/components/ui/states/Empty";

describe("Empty", () => {
  it("renders title + body", () => {
    render(<Empty title="No reviews yet" body="Open a PR to see findings." />);
    expect(screen.getByText("No reviews yet")).toBeInTheDocument();
    expect(screen.getByText("Open a PR to see findings.")).toBeInTheDocument();
  });

  it("hides body when not provided", () => {
    render(<Empty title="Empty" />);
    expect(screen.queryByText(/^Open/)).not.toBeInTheDocument();
  });

  it("fires CTA onClick when provided", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Empty
        title="Empty"
        cta={{ label: "Open repo", onClick }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Open repo" }));
    expect(onClick).toHaveBeenCalled();
  });
});
