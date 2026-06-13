import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReviewIdChip } from "@/components/review-detail/ReviewIdChip";

vi.mock("@/lib/clipboard", () => ({
  copyText: vi.fn().mockResolvedValue(true),
}));
import { copyText } from "@/lib/clipboard";

afterEach(() => vi.clearAllMocks());

describe("ReviewIdChip", () => {
  const ID = "019e8858-934a-7b96-a484-4d962c428b6f";

  it("shows a short prefix and copies the full id", async () => {
    const user = userEvent.setup();
    render(<ReviewIdChip reviewId={ID} />);

    // Git-style short prefix is visible; the full id is the copy payload.
    expect(screen.getByText("019e8858")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /copy review id/i }));
    expect(copyText).toHaveBeenCalledWith(ID);
    expect(await screen.findByText(/review id copied/i)).toBeInTheDocument();
  });
});
