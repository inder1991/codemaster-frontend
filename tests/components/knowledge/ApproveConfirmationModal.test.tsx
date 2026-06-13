/**
 * Sprint 12 / S12.2.4 — ApproveConfirmationModal unit tests.
 *
 * Per sprint-12.md: ≥4 cases. Verifies typed-confirmation gating
 * for tenant-wide proposals + standard confirm for repo-scoped +
 * cancel propagation + submitting state.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ApproveConfirmationModal } from "@/components/knowledge/ApproveConfirmationModal";
import type { ProposalV1 } from "@/lib/api/knowledge";

const TENANT_WIDE: ProposalV1 = {
  proposal_id: "prop-001",
  title: "Pass installation_id everywhere",
  body_markdown: "Tenancy isolation hazard guidance.",
  repo: null,
  proposed_by_user_id: "00000000-0000-0000-0000-000000000a01",
  created_at: "2026-08-01T10:00:00Z",
};

const REPO_SCOPED: ProposalV1 = {
  ...TENANT_WIDE,
  proposal_id: "prop-002",
  repo: "acme/web",
};

describe("ApproveConfirmationModal", () => {
  it("renders proposal title + body when open", () => {
    render(
      <ApproveConfirmationModal
        open
        proposal={TENANT_WIDE}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(
      screen.getByText("Pass installation_id everywhere"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Tenancy isolation hazard guidance."),
    ).toBeInTheDocument();
  });

  it("disables Approve until typed-confirmation matches for tenant-wide", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ApproveConfirmationModal
        open
        proposal={TENANT_WIDE}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );
    const approveBtn = screen.getByRole("button", { name: /^approve$/i });
    expect(approveBtn).toBeDisabled();

    const input = screen.getByLabelText(/type/i);
    await user.type(input, "wrong phrase");
    expect(approveBtn).toBeDisabled();

    await user.clear(input);
    await user.type(input, "approve tenant-wide");
    expect(approveBtn).not.toBeDisabled();

    await user.click(approveBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("enables Approve immediately for repo-scoped proposals (no typed gate)", () => {
    render(
      <ApproveConfirmationModal
        open
        proposal={REPO_SCOPED}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    const approveBtn = screen.getByRole("button", { name: /^approve$/i });
    expect(approveBtn).not.toBeDisabled();
    expect(screen.queryByLabelText(/type/i)).not.toBeInTheDocument();
  });

  it("calls onCancel when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ApproveConfirmationModal
        open
        proposal={REPO_SCOPED}
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    );
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("shows 'Approving…' label when submitting", () => {
    render(
      <ApproveConfirmationModal
        open
        proposal={REPO_SCOPED}
        onConfirm={() => {}}
        onCancel={() => {}}
        submitting
      />,
    );
    expect(screen.getByRole("button", { name: /approving/i })).toBeDisabled();
  });
});
