import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EvidenceDisclosure } from "@/components/review-detail/EvidenceDisclosure";
import type { ReviewFindingCitationV1 } from "@/lib/api/admin";

const CITATION: ReviewFindingCitationV1 = {
  kind: "policy_rule",
  locator: "SEC-use-bcrypt-3f9a",
  excerpt: "Hash with bcrypt, not md5.",
};

describe("EvidenceDisclosure", () => {
  it("renders nothing when there are no citations", () => {
    const { container } = render(<EvidenceDisclosure citations={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a count and expands to the citation on click", async () => {
    const user = userEvent.setup();
    render(<EvidenceDisclosure citations={[CITATION]} />);
    const toggle = screen.getByRole("button", { name: /evidence \(1\)/i });
    expect(screen.queryByText("SEC-use-bcrypt-3f9a")).not.toBeInTheDocument();
    await user.click(toggle);
    expect(screen.getByText("SEC-use-bcrypt-3f9a")).toBeInTheDocument();
    expect(screen.getByText(/Hash with bcrypt/)).toBeInTheDocument();
  });
});
