/**
 * Sprint Y.12 (2026-05-11) — BulkActionDryRunPreview component
 * unit tests.
 *
 * The component renders a `BulkActionDryRunResultV1` envelope as
 * a preview card: title, count summary ("Will affect N items"),
 * a small table of preview items, a truncation notice if the
 * preview was capped, and a two-button action row
 * ("Cancel" + "Run for real").
 *
 * Composes with the Y.11 `ConfirmDangerousActionModal` for the
 * final typed-confirm step — this component is the preview, not
 * the confirm gate.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { BulkActionDryRunPreview } from "@/components/ui/BulkActionDryRunPreview";

interface PreviewItem {
  target_kind: string;
  target_id: string;
  target_label: string;
  current_state: string | null;
  proposed_state: string | null;
  note: string | null;
}

const _ITEM_A: PreviewItem = {
  target_kind: "repository",
  target_id: "00000000-0000-0000-0000-000000000001",
  target_label: "acme/web",
  current_state: "enabled",
  proposed_state: "disabled",
  note: null,
};

const _ITEM_B: PreviewItem = {
  target_kind: "repository",
  target_id: "00000000-0000-0000-0000-000000000002",
  target_label: "acme/billing",
  current_state: "disabled",
  proposed_state: "disabled",
  note: "already disabled; no-op",
};

const _RESULT_FULL = {
  schema_version: 1 as const,
  action: "disable",
  target_kind: "repository",
  matched_count: 2,
  would_change_count: 1,
  no_op_count: 1,
  preview_items: [_ITEM_A, _ITEM_B],
  preview_truncated_at: null,
};

const _RESULT_TRUNCATED = {
  ..._RESULT_FULL,
  matched_count: 200,
  would_change_count: 150,
  no_op_count: 50,
  preview_truncated_at: 50,
  preview_items: Array.from({ length: 50 }, (_, i) => ({
    ..._ITEM_A,
    target_id: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
    target_label: `acme/repo-${i}`,
  })),
};

describe("BulkActionDryRunPreview (Y.12)", () => {
  test("renders the headline count + action label", () => {
    render(
      <BulkActionDryRunPreview
        result={_RESULT_FULL}
        onCommit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/will disable 1 repository/i),
    ).toBeInTheDocument();
    // No-ops surfaced separately.
    expect(screen.getByText(/1 no-op/i)).toBeInTheDocument();
  });

  test("renders each preview item with current → proposed state", () => {
    render(
      <BulkActionDryRunPreview
        result={_RESULT_FULL}
        onCommit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("acme/web")).toBeInTheDocument();
    expect(screen.getByText("acme/billing")).toBeInTheDocument();
    // Note text surfaces for no-ops so the user knows why nothing
    // will happen for those items.
    expect(screen.getByText(/already disabled; no-op/i)).toBeInTheDocument();
  });

  test("shows a truncation notice when preview is capped", () => {
    render(
      <BulkActionDryRunPreview
        result={_RESULT_TRUNCATED}
        onCommit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/showing first 50 of 200/i),
    ).toBeInTheDocument();
  });

  test("commit button fires onCommit", () => {
    const onCommit = vi.fn();
    render(
      <BulkActionDryRunPreview
        result={_RESULT_FULL}
        onCommit={onCommit}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /run for real/i }));
    expect(onCommit).toHaveBeenCalledOnce();
  });

  test("cancel button fires onCancel", () => {
    const onCancel = vi.fn();
    render(
      <BulkActionDryRunPreview
        result={_RESULT_FULL}
        onCommit={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  test("commit button is disabled when would_change_count is 0", () => {
    /** Edge case: every matched item is a no-op. Running for real
     * would do nothing — render the button disabled with a hint
     * so the user understands their bulk action is a no-op. */
    const allNoOp = {
      ..._RESULT_FULL,
      matched_count: 2,
      would_change_count: 0,
      no_op_count: 2,
      preview_items: [_ITEM_B, { ..._ITEM_B, target_label: "acme/other" }],
    };
    render(
      <BulkActionDryRunPreview
        result={allNoOp}
        onCommit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /run for real/i }),
    ).toBeDisabled();
    expect(screen.getByText(/nothing to commit/i)).toBeInTheDocument();
  });

  test("committing prop disables both buttons", () => {
    render(
      <BulkActionDryRunPreview
        result={_RESULT_FULL}
        onCommit={vi.fn()}
        onCancel={vi.fn()}
        committing
      />,
    );
    expect(
      screen.getByRole("button", { name: /running…/i }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
  });

  test("singular vs plural in the headline", () => {
    const single = {
      ..._RESULT_FULL,
      matched_count: 1,
      would_change_count: 1,
      no_op_count: 0,
      preview_items: [_ITEM_A],
    };
    render(
      <BulkActionDryRunPreview
        result={single}
        onCommit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    // "1 repository" not "1 repositories"
    expect(screen.getByText(/will disable 1 repository\b/i)).toBeInTheDocument();
  });
});
