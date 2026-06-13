import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FixPromptDrawer } from "@/components/review-detail/FixPromptDrawer";

describe("FixPromptDrawer", () => {
  it("renders the prompt and a Copy button when open", () => {
    render(
      <FixPromptDrawer
        open
        onClose={vi.fn()}
        prompt="PROMPT_BODY"
        onCopy={vi.fn()}
      />,
    );
    expect(screen.getByText("PROMPT_BODY")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /copy prompt/i }),
    ).toBeInTheDocument();
  });

  it("does not render the prompt when closed", () => {
    render(
      <FixPromptDrawer
        open={false}
        onClose={vi.fn()}
        prompt="HIDDEN_BODY"
        onCopy={vi.fn()}
      />,
    );
    expect(screen.queryByText("HIDDEN_BODY")).not.toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <FixPromptDrawer open onClose={onClose} prompt="x" onCopy={vi.fn()} />,
    );
    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onCopy when Copy prompt is clicked", async () => {
    const onCopy = vi.fn();
    const user = userEvent.setup();
    render(<FixPromptDrawer open onClose={vi.fn()} prompt="x" onCopy={onCopy} />);
    await user.click(screen.getByRole("button", { name: /copy prompt/i }));
    expect(onCopy).toHaveBeenCalled();
  });
});
