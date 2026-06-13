/**
 * Sprint 13 / S13.1.1 — FlagEditModal unit tests.
 *
 * ≥6 cases covering: stage path validation, commit path label,
 * tenant-wide typed-confirm gate, reason min-length, JSON parse
 * gate, error banner.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FlagEditModal } from "@/components/kill-switches/FlagEditModal";
import type { FlagListItemV1 } from "@/lib/api/admin";

const TENANT_FLAG: FlagListItemV1 = {
  flag_name: "bedrock_global_daily_cap_cents",
  scope: "global",
  scope_id: null,
  value_json: '{"value": 240000}',
  last_changed_at: "2026-07-30T08:15:00Z",
  last_changed_by_user_id: "alpha-uid",
  pending_second_approver: false,
  pending_first_approver_user_id: null,
  pending_value_json: null,
  pending_set_at: null,
};

const REPO_FLAG: FlagListItemV1 = {
  flag_name: "repo_acme_web_paused",
  scope: "repository",
  scope_id: "acme-web-repo-id",
  value_json: '{"paused": false}',
  last_changed_at: "2026-08-01T09:30:00Z",
  last_changed_by_user_id: "alpha-uid",
  pending_second_approver: false,
  pending_first_approver_user_id: null,
  pending_value_json: null,
  pending_set_at: null,
};

const PENDING_REPO_FLAG: FlagListItemV1 = {
  ...REPO_FLAG,
  pending_second_approver: true,
  pending_first_approver_user_id: "alpha-uid",
  pending_value_json: '{"paused": true}',
  pending_set_at: "2026-08-01T11:00:00Z",
};

describe("FlagEditModal", () => {
  it("first-approval stage: requires reason ≥5 chars + valid JSON", async () => {
    const user = userEvent.setup();
    render(
      <FlagEditModal
        open
        flag={REPO_FLAG}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    const submit = screen.getByRole("button", { name: /^stage change$/i });
    expect(submit).toBeDisabled();

    const reason = screen.getByLabelText(/^reason$/i);
    await user.type(reason, "ok");
    expect(submit).toBeDisabled(); // reason still too short

    await user.type(reason, " enough");
    expect(submit).not.toBeDisabled();
  });

  it("tenant-wide flag requires typed-confirm phrase", async () => {
    const user = userEvent.setup();
    render(
      <FlagEditModal
        open
        flag={TENANT_FLAG}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    const reason = screen.getByLabelText(/^reason$/i);
    await user.type(reason, "Cost spike");
    const submit = screen.getByRole("button", { name: /^stage change$/i });
    expect(submit).toBeDisabled();

    const typed = screen.getByLabelText(/typed confirmation/i);
    await user.type(typed, "wrong phrase");
    expect(submit).toBeDisabled();

    await user.clear(typed);
    await user.type(typed, "flip bedrock_global_daily_cap_cents");
    expect(submit).not.toBeDisabled();
  });

  it("second-approval (commit) mode shows danger CTA", () => {
    render(
      <FlagEditModal
        open
        flag={PENDING_REPO_FLAG}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(
      screen.getByRole("button", { name: /approve & commit/i }),
    ).toBeInTheDocument();
  });

  it("calls onConfirm with normalised payload on stage", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <FlagEditModal
        open
        flag={REPO_FLAG}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );
    // Default draft is the pretty-JSON of the current value; flip it.
    const editor = screen.getByLabelText(/new value/i);
    await user.clear(editor);
    await user.type(editor, '{{"paused": true}');
    await user.type(screen.getByLabelText(/^reason$/i), "Manual pause");
    await user.click(screen.getByRole("button", { name: /^stage change$/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const payload = onConfirm.mock.calls[0]?.[0];
    expect(payload?.new_value_json).toBe('{"paused":true}');
    expect(payload?.reason).toBe("Manual pause");
    expect(payload?.typed_confirm_phrase).toBeNull();
  });

  it("invalid JSON value disables submit", async () => {
    const user = userEvent.setup();
    render(
      <FlagEditModal
        open
        flag={REPO_FLAG}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    const editor = screen.getByLabelText(/new value/i);
    await user.clear(editor);
    await user.type(editor, "not json");
    await user.type(screen.getByLabelText(/^reason$/i), "Manual pause");
    expect(
      screen.getByRole("button", { name: /^stage change$/i }),
    ).toBeDisabled();
  });

  it("renders the error banner when errorMessage prop is set", () => {
    render(
      <FlagEditModal
        open
        flag={REPO_FLAG}
        onConfirm={() => {}}
        onCancel={() => {}}
        errorMessage="409 stale write — refresh and retry"
      />,
    );
    expect(screen.getByText(/409 stale write/i)).toBeInTheDocument();
  });

  it("preset reason chips set the reason field", async () => {
    const user = userEvent.setup();
    render(
      <FlagEditModal
        open
        flag={REPO_FLAG}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    await user.click(screen.getByRole("button", { name: /cost spike/i }));
    const reason = screen.getByLabelText(/^reason$/i) as HTMLTextAreaElement;
    expect(reason.value).toBe("Cost spike");
  });
});
