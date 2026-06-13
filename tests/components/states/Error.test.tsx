import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ErrorState } from "@/components/ui/states/Error";

describe("ErrorState", () => {
  it("renders title with role=alert for screen readers", () => {
    render(<ErrorState title="Failed to load" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Failed to load")).toBeInTheDocument();
  });

  it("surfaces correlation id when provided", () => {
    render(
      <ErrorState
        title="Failed"
        correlationId="abc123"
      />,
    );
    expect(screen.getByText("abc123")).toBeInTheDocument();
  });

  it("hides correlation-id line when not provided", () => {
    render(<ErrorState title="Failed" />);
    expect(screen.queryByText(/Correlation ID/)).not.toBeInTheDocument();
  });

  it("fires onRetry when the retry button is clicked", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ErrorState title="Failed" onRetry={onRetry} />);
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalled();
  });
});
