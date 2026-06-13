/**
 * Sprint Y.12 (2026-05-11) — bulk-action dry-run preview.
 *
 * Renders a `BulkActionDryRunResultV1` envelope as a confirmation
 * card. Pairs with the Y.11 `<ConfirmDangerousActionModal>` for the
 * final typed-confirm step:
 *
 *   1. User selects a filter / picks N items
 *   2. Backend returns dry-run result
 *   3. <BulkActionDryRunPreview> renders the preview + count summary
 *   4. User clicks "Run for real" → parent opens
 *      <ConfirmDangerousActionModal> with the typed-confirm phrase
 *      derived from the action + count
 *   5. Parent calls backend with dry_run=false
 *
 * The preview is purposefully NOT a modal — it lives inline on the
 * page so the user can scroll the item list. Modals would clip
 * long lists awkwardly.
 *
 * Spec line 1688: "Bulk actions support `--dry-run`."
 */

"use client";

import type { JSX } from "react";

/** Mirror of `contracts.admin.bulk_action.v1.BulkActionItemPreviewV1`.
 *  Re-declared here (rather than imported from
 *  `lib/api/generated/contracts.ts`) so this component compiles
 *  before the corresponding admin route lands — same pattern as
 *  the X.3 dashboard / reviews components used pre-codegen. */
export interface BulkActionItemPreview {
  target_kind: string;
  target_id: string;
  target_label: string;
  current_state: string | null;
  proposed_state: string | null;
  note: string | null;
}

export interface BulkActionDryRunResult {
  schema_version: 1;
  action: string;
  target_kind: string;
  matched_count: number;
  would_change_count: number;
  no_op_count: number;
  preview_items: readonly BulkActionItemPreview[];
  preview_truncated_at: number | null;
}

export interface BulkActionDryRunPreviewProps {
  result: BulkActionDryRunResult;
  onCommit: () => void;
  onCancel: () => void;
  committing?: boolean;
}

function _pluralise(noun: string, count: number): string {
  // Tiny rule that covers the project's target_kinds (repository,
  // integration, token, rule, member). English nouns ending in
  // "y" → "ies"; otherwise add "s". The unit tests pin the
  // singular vs plural form so a future irregular noun would
  // surface a test failure.
  if (count === 1) return noun;
  if (noun.endsWith("y")) return `${noun.slice(0, -1)}ies`;
  return `${noun}s`;
}

function _verbIngLabel(_action: string): string {
  // We don't try to grammaticalise every verb (would mean lots of
  // irregular-form handling); the committing-state label is just
  // "Running…" universally. The primary button when NOT committing
  // reads "Run for real".
  return "Running…";
}

export function BulkActionDryRunPreview({
  result,
  onCommit,
  onCancel,
  committing = false,
}: BulkActionDryRunPreviewProps): JSX.Element {
  const isTruncated = result.preview_truncated_at !== null;
  const noOpsOnly = result.would_change_count === 0;
  const targetNoun = _pluralise(result.target_kind, result.would_change_count);
  // "Will disable 1 repository" / "Will disable 5 repositories"
  const headline = `Will ${result.action} ${result.would_change_count} ${targetNoun}`;

  return (
    <section
      aria-label="Bulk action preview"
      className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-6"
    >
      <header className="mb-4">
        <h3 className="text-lg font-semibold">{headline}</h3>
        <p className="mt-1 text-sm text-amber-900 dark:text-amber-200">
          {result.matched_count} matched
          {result.no_op_count > 0
            ? `; ${result.no_op_count} no-op${result.no_op_count === 1 ? "" : "s"}`
            : null}
          {isTruncated
            ? `. Showing first ${result.preview_items.length} of ${result.matched_count}.`
            : "."}
        </p>
      </header>

      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase opacity-70">
          <tr>
            <th className="py-2">Target</th>
            <th className="py-2">Current</th>
            <th className="py-2">Proposed</th>
            <th className="py-2">Note</th>
          </tr>
        </thead>
        <tbody>
          {result.preview_items.map((item) => (
            <tr
              key={item.target_id}
              className="border-t border-amber-200/60 dark:border-amber-800/60"
            >
              <td className="py-2 font-mono">{item.target_label}</td>
              <td className="py-2">{item.current_state ?? "—"}</td>
              <td className="py-2">{item.proposed_state ?? "—"}</td>
              <td className="py-2 text-amber-800 dark:text-amber-300">
                {item.note ?? ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onCommit}
          disabled={committing || noOpsOnly}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          {committing ? _verbIngLabel(result.action) : "Run for real"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={committing}
          className="rounded-md bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium ring-1 ring-inset ring-gray-300 dark:ring-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
          Cancel
        </button>
        {noOpsOnly ? (
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Nothing to commit — every matched item is already in the
            proposed state.
          </p>
        ) : null}
      </div>
    </section>
  );
}
