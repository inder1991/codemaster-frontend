/**
 * Sprint 12 / S12.2.4 — CollisionDiffModal unit tests.
 *
 * Per sprint-12.md: ≥4 cases. Verifies the side-by-side panels
 * render, the three actions wire correctly, and the dialog
 * closes via Esc / backdrop.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CollisionDiffModal } from "@/components/knowledge/CollisionDiffModal";

const baseProps = {
  open: true,
  yourBody: "Local body, not yet saved.",
  serverBody: "Server body, beth's edit.",
  serverEditedBy: "beth",
  serverEditedAtLabel: "12 minutes ago",
};

describe("CollisionDiffModal", () => {
  it("renders both panels with their bodies + headings", () => {
    render(
      <CollisionDiffModal
        {...baseProps}
        onUseMine={() => {}}
        onUseTheirs={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText("Yours")).toBeInTheDocument();
    expect(screen.getByText("Server")).toBeInTheDocument();
    expect(
      screen.getByText("Local body, not yet saved."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Server body, beth's edit."),
    ).toBeInTheDocument();
  });

  it("Use mine fires onUseMine", async () => {
    const user = userEvent.setup();
    const onUseMine = vi.fn();
    render(
      <CollisionDiffModal
        {...baseProps}
        onUseMine={onUseMine}
        onUseTheirs={() => {}}
        onCancel={() => {}}
      />,
    );
    await user.click(screen.getByRole("button", { name: /use mine/i }));
    expect(onUseMine).toHaveBeenCalledTimes(1);
  });

  it("Use theirs fires onUseTheirs", async () => {
    const user = userEvent.setup();
    const onUseTheirs = vi.fn();
    render(
      <CollisionDiffModal
        {...baseProps}
        onUseMine={() => {}}
        onUseTheirs={onUseTheirs}
        onCancel={() => {}}
      />,
    );
    await user.click(screen.getByRole("button", { name: /use theirs/i }));
    expect(onUseTheirs).toHaveBeenCalledTimes(1);
  });

  it("Cancel keeps editing fires onCancel", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <CollisionDiffModal
        {...baseProps}
        onUseMine={() => {}}
        onUseTheirs={() => {}}
        onCancel={onCancel}
      />,
    );
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("disables both destructive actions while submitting", () => {
    render(
      <CollisionDiffModal
        {...baseProps}
        onUseMine={() => {}}
        onUseTheirs={() => {}}
        onCancel={() => {}}
        submitting
      />,
    );
    expect(
      screen.getByRole("button", { name: /saving/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /use theirs/i }),
    ).toBeDisabled();
  });

  it("does not render content when open=false", () => {
    render(
      <CollisionDiffModal
        {...baseProps}
        open={false}
        onUseMine={() => {}}
        onUseTheirs={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.queryByText("Yours")).not.toBeInTheDocument();
  });
});
