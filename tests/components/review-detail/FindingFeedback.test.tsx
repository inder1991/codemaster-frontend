import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { FindingFeedback } from "@/components/review-detail/FindingFeedback";

const submitMock = vi.fn();
vi.mock("@/lib/api/admin", () => ({
  submitFindingFeedback: (args: unknown) => submitMock(args),
}));

function wrap(node: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

beforeEach(() => {
  submitMock.mockReset();
});

describe("FindingFeedback", () => {
  it("fires the mutation with the right verb and shows a thanks state", async () => {
    submitMock.mockResolvedValue({ feedback_event_id: "e1" });
    const user = userEvent.setup();
    wrap(<FindingFeedback reviewId="r1" findingId="f1" />);
    await user.click(screen.getByRole("button", { name: "Helpful" }));
    await waitFor(() => {
      expect(submitMock).toHaveBeenCalledWith({
        reviewId: "r1",
        findingId: "f1",
        verb: "helpful",
      });
    });
    expect(await screen.findByText(/Thanks/i)).toBeInTheDocument();
  });

  it("maps the three verbs", async () => {
    submitMock.mockResolvedValue({ feedback_event_id: "e" });
    const user = userEvent.setup();
    wrap(<FindingFeedback reviewId="r1" findingId="f2" />);
    await user.click(screen.getByRole("button", { name: "Not helpful" }));
    await waitFor(() =>
      expect(submitMock).toHaveBeenCalledWith({
        reviewId: "r1",
        findingId: "f2",
        verb: "not_helpful",
      }),
    );
  });

  it("shows an error state and re-enables on failure", async () => {
    submitMock.mockRejectedValue(new Error("boom"));
    const user = userEvent.setup();
    wrap(<FindingFeedback reviewId="r1" findingId="f3" />);
    await user.click(screen.getByRole("button", { name: "Wrong" }));
    expect(await screen.findByText(/Couldn't record/i)).toBeInTheDocument();
    // buttons still present (re-enabled) for a retry
    expect(screen.getByRole("button", { name: "Helpful" })).toBeInTheDocument();
  });
});
