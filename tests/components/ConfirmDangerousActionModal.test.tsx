/**
 * Sprint Y.11 (2026-05-11) — confirm-dangerous-action modal primitive.
 *
 * Reusable typed-confirm + reason pattern. Mirrors the backend's
 * `typed_confirm_required` + `reason` contract enforced in
 * flags.py / knowledge.py / similar admin endpoints. Spec line
 * 1687: "Dangerous actions require confirmation + reason."
 *
 * Behaviour pinned here:
 *  - Confirm button disabled until both: (a) typed phrase matches
 *    `expectedPhrase` exactly, and (b) reason has ≥5 chars.
 *  - Cancel button always enabled.
 *  - Error message renders when supplied.
 *  - `submitting` disables both buttons.
 *  - `onConfirm` receives `{ reason, typed_confirm_phrase }`.
 *  - Reason + typed-confirm fields are labelled (a11y).
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { ConfirmDangerousActionModal } from "@/components/ui/ConfirmDangerousActionModal";

const _COMMON_PROPS = {
  open: true,
  title: "Delete repository",
  description:
    "This permanently removes the repository from the admin console. The action is recorded in audit_events.",
  expectedPhrase: "delete acme/web",
  onCancel: vi.fn(),
};

describe("ConfirmDangerousActionModal (Y.11)", () => {
  test("renders the title + description + phrase prompt", () => {
    render(
      <ConfirmDangerousActionModal {..._COMMON_PROPS} onConfirm={vi.fn()} />,
    );
    // Title renders as a heading (modal h3) AND as the primary
    // button label; assert the heading specifically.
    expect(
      screen.getByRole("heading", { name: "Delete repository" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/permanently removes/i)).toBeInTheDocument();
    expect(screen.getByText(/delete acme\/web/)).toBeInTheDocument();
  });

  test("confirm button is disabled when fields are empty", () => {
    render(
      <ConfirmDangerousActionModal {..._COMMON_PROPS} onConfirm={vi.fn()} />,
    );
    const confirm = screen.getByRole("button", { name: /^delete repository$/i });
    expect(confirm).toBeDisabled();
  });

  test("confirm button stays disabled when typed phrase doesn't match", () => {
    render(
      <ConfirmDangerousActionModal {..._COMMON_PROPS} onConfirm={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText(/reason/i), {
      target: { value: "Decommissioning legacy repo" },
    });
    fireEvent.change(screen.getByLabelText(/type to confirm/i), {
      target: { value: "delete acme" }, // partial — doesn't match
    });
    expect(
      screen.getByRole("button", { name: /^delete repository$/i }),
    ).toBeDisabled();
  });

  test("confirm button stays disabled when reason is too short", () => {
    render(
      <ConfirmDangerousActionModal {..._COMMON_PROPS} onConfirm={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText(/reason/i), {
      target: { value: "x" }, // <5 chars
    });
    fireEvent.change(screen.getByLabelText(/type to confirm/i), {
      target: { value: "delete acme/web" },
    });
    expect(
      screen.getByRole("button", { name: /^delete repository$/i }),
    ).toBeDisabled();
  });

  test("confirm button enables and fires when both gates clear", () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDangerousActionModal {..._COMMON_PROPS} onConfirm={onConfirm} />,
    );
    fireEvent.change(screen.getByLabelText(/reason/i), {
      target: { value: "Decommissioning legacy repo" },
    });
    fireEvent.change(screen.getByLabelText(/type to confirm/i), {
      target: { value: "delete acme/web" },
    });
    const confirm = screen.getByRole("button", { name: /^delete repository$/i });
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith({
      reason: "Decommissioning legacy repo",
      typed_confirm_phrase: "delete acme/web",
    });
  });

  test("cancel button always fires onCancel even with empty fields", () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDangerousActionModal
        {..._COMMON_PROPS}
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  test("error message renders with role=alert when supplied", () => {
    render(
      <ConfirmDangerousActionModal
        {..._COMMON_PROPS}
        onConfirm={vi.fn()}
        errorMessage="Server rejected: stale If-Match"
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Server rejected: stale If-Match");
  });

  test("submitting disables both buttons + shows pending label", () => {
    render(
      <ConfirmDangerousActionModal
        {..._COMMON_PROPS}
        onConfirm={vi.fn()}
        submitting
      />,
    );
    fireEvent.change(screen.getByLabelText(/reason/i), {
      target: { value: "valid reason" },
    });
    fireEvent.change(screen.getByLabelText(/type to confirm/i), {
      target: { value: "delete acme/web" },
    });
    // Confirm + cancel both disabled while submitting.
    expect(
      screen.getByRole("button", { name: /deleting/i }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
  });

  test("open=false renders nothing", () => {
    const { container } = render(
      <ConfirmDangerousActionModal
        {..._COMMON_PROPS}
        open={false}
        onConfirm={vi.fn()}
      />,
    );
    // No "Delete repository" title rendered.
    expect(screen.queryByText("Delete repository")).toBeNull();
    expect(container.textContent).toBe("");
  });

  test("typed phrase comparison is case-sensitive + whitespace-trim-aware", () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDangerousActionModal {..._COMMON_PROPS} onConfirm={onConfirm} />,
    );
    fireEvent.change(screen.getByLabelText(/reason/i), {
      target: { value: "valid reason" },
    });
    // Uppercase variant should NOT match (matches the backend's
    // exact-string compare in flags.py).
    fireEvent.change(screen.getByLabelText(/type to confirm/i), {
      target: { value: "DELETE ACME/WEB" },
    });
    expect(
      screen.getByRole("button", { name: /^delete repository$/i }),
    ).toBeDisabled();
    // Trailing whitespace IS trimmed (matches the existing
    // FlagEditModal pattern).
    fireEvent.change(screen.getByLabelText(/type to confirm/i), {
      target: { value: "  delete acme/web   " },
    });
    expect(
      screen.getByRole("button", { name: /^delete repository$/i }),
    ).not.toBeDisabled();
  });
});
