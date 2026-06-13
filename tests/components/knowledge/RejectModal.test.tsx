/**
 * Sprint 12 / S12.2.4 — RejectModal unit tests.
 * (Bundled here alongside ApproveConfirmationModal — sprint spec
 * calls them out as paired modals, ≥4 cases each.)
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { RejectModal } from "@/components/knowledge/RejectModal";
import type { ProposalV1 } from "@/lib/api/knowledge";

const PROPOSAL: ProposalV1 = {
  proposal_id: "prop-001",
  title: "Test proposal",
  body_markdown: "Body",
  repo: "acme/web",
  proposed_by_user_id: "00000000-0000-0000-0000-000000000a01",
  created_at: "2026-08-01T10:00:00Z",
};

describe("RejectModal", () => {
  it("disables Reject until reason ≥10 characters", async () => {
    const user = userEvent.setup();
    render(
      <RejectModal
        open
        proposal={PROPOSAL}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    const rejectBtn = screen.getByRole("button", { name: /^reject$/i });
    expect(rejectBtn).toBeDisabled();

    const ta = screen.getByLabelText(/reason for rejection/i);
    await user.type(ta, "too short");
    expect(rejectBtn).toBeDisabled();

    await user.type(ta, " enough now");
    expect(rejectBtn).not.toBeDisabled();
  });

  it("calls onConfirm with the trimmed reason on submit", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <RejectModal
        open
        proposal={PROPOSAL}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );
    const ta = screen.getByLabelText(/reason for rejection/i);
    await user.type(ta, "  duplicate of L-203 leading whitespace  ");
    await user.click(screen.getByRole("button", { name: /^reject$/i }));
    expect(onConfirm).toHaveBeenCalledWith(
      "duplicate of L-203 leading whitespace",
    );
  });

  it("displays a live character counter below the textarea", async () => {
    const user = userEvent.setup();
    render(
      <RejectModal
        open
        proposal={PROPOSAL}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    // Initial state: counter shows "0 / 10 minimum characters".
    expect(screen.getByText(/minimum characters/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/reason/i), "hello");
    // After typing, the count should include "5" alongside "10".
    const counter = screen.getByText(/minimum characters/i);
    expect(counter.textContent).toMatch(/5/);
  });

  it("propagates Cancel via onCancel", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <RejectModal
        open
        proposal={PROPOSAL}
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    );
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
