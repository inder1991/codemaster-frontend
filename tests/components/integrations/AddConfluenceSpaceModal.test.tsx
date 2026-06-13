/**
 * Sprint 13 / S13.1.3 — AddConfluenceSpaceModal unit tests.
 *
 * Per sprint-13.md: ≥4 unit cases on the integrations modal +
 * row component combined.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AddConfluenceSpaceModal } from "@/components/integrations/AddConfluenceSpaceModal";

describe("AddConfluenceSpaceModal", () => {
  it("disables Add until space-key + space-name are valid", async () => {
    const user = userEvent.setup();
    render(
      <AddConfluenceSpaceModal
        open
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    const addBtn = screen.getByRole("button", { name: /^add$/i });
    expect(addBtn).toBeDisabled();

    await user.type(screen.getByLabelText(/space key/i), "ACME");
    expect(addBtn).toBeDisabled(); // name still empty

    await user.type(screen.getByLabelText(/display name/i), "Acme Wiki");
    expect(addBtn).not.toBeDisabled();
  });

  it("rejects malformed space key (lowercase / special chars)", async () => {
    const user = userEvent.setup();
    render(
      <AddConfluenceSpaceModal
        open
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    const input = screen.getByLabelText(/space key/i);
    // Component upper-cases on input; an apostrophe-style traversal
    // attempt should still be refused by the regex.
    await user.type(input, "../etc/passwd");
    // The name input ensures we can spot when the form would be
    // valid except for the key.
    await user.type(screen.getByLabelText(/display name/i), "Bad");
    const addBtn = screen.getByRole("button", { name: /^add$/i });
    expect(addBtn).toBeDisabled();
  });

  it("requires page-tree root id when scope is page_tree", async () => {
    const user = userEvent.setup();
    render(
      <AddConfluenceSpaceModal
        open
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    await user.type(screen.getByLabelText(/space key/i), "ACME");
    await user.type(screen.getByLabelText(/display name/i), "Acme");
    // Switch to page-tree scope.
    await user.click(screen.getByLabelText(/page tree/i));
    const addBtn = screen.getByRole("button", { name: /^add$/i });
    expect(addBtn).toBeDisabled(); // root id missing

    await user.type(screen.getByLabelText(/root page id/i), "12345");
    expect(addBtn).not.toBeDisabled();
  });

  it("calls onConfirm with normalised payload + defaults for Sub-spec C T12 fields", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <AddConfluenceSpaceModal
        open
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );
    await user.type(screen.getByLabelText(/space key/i), "ACME");
    await user.type(screen.getByLabelText(/display name/i), "  Acme Wiki  ");
    await user.click(screen.getByRole("button", { name: /^add$/i }));
    expect(onConfirm).toHaveBeenCalledWith({
      space_key: "ACME",
      space_name: "Acme Wiki",
      scope: "whole_space",
      page_tree_root_id: null,
      // Sub-spec C T12 — modal sends these on every submit so the
      // backend persists the operator's choice (explicit vs default)
      // rather than relying on contract defaults masking client age.
      trust_tier: "trusted",
      governance_ack: false,
      visibility: "platform",
      strict_label_mode: false,
    });
  });

  it("submits with trust_tier=semi when the operator picks Semi-trusted", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <AddConfluenceSpaceModal
        open
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );
    await user.type(screen.getByLabelText(/space key/i), "ACME");
    await user.type(screen.getByLabelText(/display name/i), "Acme");
    await user.click(screen.getByLabelText(/semi-trusted/i));
    await user.click(screen.getByRole("button", { name: /^add$/i }));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ trust_tier: "semi" }),
    );
  });

  it("composes visibility as org:<slug> when the org choice is selected", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <AddConfluenceSpaceModal
        open
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );
    await user.type(screen.getByLabelText(/space key/i), "ACME");
    await user.type(screen.getByLabelText(/display name/i), "Acme");
    await user.click(screen.getByLabelText(/scoped to org/i));
    const addBtn = screen.getByRole("button", { name: /^add$/i });
    expect(addBtn).toBeDisabled(); // org slug missing
    await user.type(screen.getByLabelText(/org slug/i), "acme-eng");
    expect(addBtn).not.toBeDisabled();
    await user.click(addBtn);
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ visibility: "org:acme-eng" }),
    );
  });

  it("rejects malformed org slug (leading digit)", async () => {
    const user = userEvent.setup();
    render(
      <AddConfluenceSpaceModal
        open
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    await user.type(screen.getByLabelText(/space key/i), "ACME");
    await user.type(screen.getByLabelText(/display name/i), "Acme");
    await user.click(screen.getByLabelText(/scoped to org/i));
    await user.type(screen.getByLabelText(/org slug/i), "1bad");
    const addBtn = screen.getByRole("button", { name: /^add$/i });
    expect(addBtn).toBeDisabled();
  });

  it("submits with strict_label_mode + governance_ack when both checked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <AddConfluenceSpaceModal
        open
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );
    await user.type(screen.getByLabelText(/space key/i), "ACME");
    await user.type(screen.getByLabelText(/display name/i), "Acme");
    await user.click(screen.getByLabelText(/strict label mode/i));
    await user.click(screen.getByLabelText(/governance acknowledgement/i));
    await user.click(screen.getByRole("button", { name: /^add$/i }));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        strict_label_mode: true,
        governance_ack: true,
      }),
    );
  });

  it("disables Add and shows label when submitting", () => {
    render(
      <AddConfluenceSpaceModal
        open
        onConfirm={() => {}}
        onCancel={() => {}}
        submitting
      />,
    );
    expect(
      screen.getByRole("button", { name: /validating/i }),
    ).toBeDisabled();
  });

  it("renders the error banner when errorMessage prop is set", () => {
    render(
      <AddConfluenceSpaceModal
        open
        onConfirm={() => {}}
        onCancel={() => {}}
        errorMessage="404 not found — check space key"
      />,
    );
    expect(
      screen.getByText(/404 not found/i),
    ).toBeInTheDocument();
  });
});
