import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ApprovePageModal } from "@/components/confluence/ApprovePageModal";

describe("ApprovePageModal", () => {
  it("disables Approve until all required fields are valid", async () => {
    const user = userEvent.setup();
    render(
      <ApprovePageModal
        open
        spaceKey="ACME"
        pageId="p-1"
        pageTitle="Onboarding"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    const btn = screen.getByRole("button", { name: /^approve$/i });
    expect(btn).toBeDisabled();
    await user.type(
      screen.getByLabelText(/artifact url/i),
      "https://board.example.com/minutes-42",
    );
    expect(btn).toBeDisabled();
    await user.type(
      screen.getByLabelText(/justification/i),
      "Approved by the IDP governance board on 2026-05-28 (board minutes link).",
    );
    expect(btn).not.toBeDisabled();
  });

  it("rejects justification under 20 chars", async () => {
    const user = userEvent.setup();
    render(
      <ApprovePageModal
        open
        spaceKey="ACME"
        pageId="p-1"
        pageTitle="Onboarding"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    await user.type(
      screen.getByLabelText(/artifact url/i),
      "https://board.example.com/m",
    );
    await user.type(screen.getByLabelText(/justification/i), "too short");
    expect(screen.getByRole("button", { name: /^approve$/i })).toBeDisabled();
  });

  it("rejects a malformed artifact URL", async () => {
    const user = userEvent.setup();
    render(
      <ApprovePageModal
        open
        spaceKey="ACME"
        pageId="p-1"
        pageTitle="Onboarding"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    await user.type(screen.getByLabelText(/artifact url/i), "not-a-url");
    await user.type(
      screen.getByLabelText(/justification/i),
      "A reasonably long justification string here.",
    );
    expect(screen.getByRole("button", { name: /^approve$/i })).toBeDisabled();
  });

  it("submits a complete CreatePageApprovalRequestV1 body", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ApprovePageModal
        open
        spaceKey="ACME"
        pageId="p-1"
        pageTitle="Onboarding"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );
    await user.type(
      screen.getByLabelText(/artifact url/i),
      "https://board.example.com/minutes-42",
    );
    await user.type(
      screen.getByLabelText(/justification/i),
      "Approved by the IDP governance board on 2026-05-28 (board minutes link).",
    );
    await user.click(screen.getByLabelText(/security only/i));
    await user.click(screen.getByRole("button", { name: /^approve$/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const body = onConfirm.mock.calls[0]![0];
    expect(body.space_key).toBe("ACME");
    expect(body.page_id).toBe("p-1");
    expect(body.approval_artifact_url).toBe(
      "https://board.example.com/minutes-42",
    );
    expect(body.scope_justification.length).toBeGreaterThanOrEqual(20);
    expect(body.default_scope).toBe("security_only");
    expect(body.schema_version).toBe(1);
    expect(typeof body.approved_at_utc).toBe("string");
    expect(body).not.toHaveProperty("approver_email");
  });
});
