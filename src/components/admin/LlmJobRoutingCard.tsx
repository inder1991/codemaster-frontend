/**
 * ADR-0060 — JOB ROUTING section of /admin/llm (Inference tab).
 *
 * One row per LlmPurposeV1 value. Each row's dropdown lists only
 * assignable models — catalog models where `last_validation_status === "ok"`
 * AND `enabled` — plus an "— default —" option. Picking "default" calls
 * DELETE /api/admin/llm-purpose-routing/:purpose so the reset truly
 * persists (previously it only mutated local state).
 *
 * Assigning is a PUT. The backend re-checks the guardrail (catalog membership
 * + enabled + preflight-ok) and returns 422 with a {code, message} body if
 * it still rejects; we surface that message inline. The dropdown filter is a
 * client-side mirror of the same guardrail so non-assignable models never
 * appear as options in the happy path.
 *
 * PART 2: `models` is now lifted into the parent page — this card receives
 * it as a prop so a model validated in the catalog card immediately becomes
 * selectable here without a page reload or remount.
 *
 * Plain useState pattern (mirrors LlmProviderCard) — no react-query.
 */

"use client";

import { useEffect, useState } from "react";

import { Card } from "@/components/ui/elements/Card";
import { AdminApiError } from "@/lib/api/admin";
import {
  assignPurpose,
  deletePurposeRouting,
  listPurposeRouting,
  LlmModelDetailError,
  type LlmModelV1,
  type LlmPurpose,
} from "@/lib/api/llm-models";
import { cn } from "@/lib/cn";
import { colors, type as t } from "@/lib/design-tokens";

const DEFAULT_OPTION = "__default__";
const SUPER_ADMIN_REQUIRED = "super_admin required for this action.";

/**
 * The 4 executable purposes the runtime consumes, in display order + labels
 * (PART 4-FE §1). Removed: review_summary, chat_reply, redaction_check,
 * cost_estimate.
 */
const PURPOSES: ReadonlyArray<{ purpose: LlmPurpose; label: string }> = [
  { purpose: "review_finding", label: "Code review (chunks)" },
  { purpose: "walkthrough", label: "PR walkthrough" },
  { purpose: "analysis_curator", label: "Quick helper (Tier-1)" },
  { purpose: "fix_prompt", label: "Fix-prompt synthesis" },
];

function assignableModels(models: LlmModelV1[]): LlmModelV1[] {
  return models.filter((m) => m.enabled && m.last_validation_status === "ok");
}

function mutationErrorMessage(err: unknown): string {
  if (err instanceof LlmModelDetailError) return err.detail.message;
  if (err instanceof AdminApiError && err.status === 403) {
    return SUPER_ADMIN_REQUIRED;
  }
  if (err instanceof Error) return err.message;
  return "Request failed";
}

export interface LlmJobRoutingCardProps {
  /** Shared model list from the parent page (PART 2). */
  models: LlmModelV1[];
}

export function LlmJobRoutingCard({ models }: LlmJobRoutingCardProps) {
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [busyPurpose, setBusyPurpose] = useState<LlmPurpose | null>(null);
  const [rowError, setRowError] = useState<{ purpose: LlmPurpose; message: string } | null>(
    null,
  );
  const [rowSuccess, setRowSuccess] = useState<LlmPurpose | null>(null);

  async function refreshRouting() {
    setLoading(true);
    setLoadError(null);
    try {
      const routing = await listPurposeRouting();
      const map: Record<string, string> = {};
      for (const a of routing) {
        map[a.purpose] = a.model_id;
      }
      setAssignments(map);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Failed to load routing");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshRouting();
  }, []);

  async function handleAssign(purpose: LlmPurpose, modelId: string) {
    if (modelId === DEFAULT_OPTION) {
      // PART 4-FE §2: call DELETE so the reset is truly persisted.
      setBusyPurpose(purpose);
      setRowError(null);
      setRowSuccess(null);
      try {
        await deletePurposeRouting(purpose);
        // Re-fetch routing so the displayed state matches the server.
        await refreshRouting();
      } catch (err: unknown) {
        setRowError({ purpose, message: mutationErrorMessage(err) });
      } finally {
        setBusyPurpose(null);
      }
      return;
    }
    setBusyPurpose(purpose);
    setRowError(null);
    setRowSuccess(null);
    try {
      const result = await assignPurpose({
        schema_version: 1,
        purpose,
        model_id: modelId,
      });
      setAssignments((prev) => ({ ...prev, [purpose]: result.model_id }));
      setRowSuccess(purpose);
    } catch (err: unknown) {
      setRowError({ purpose, message: mutationErrorMessage(err) });
      // Re-sync from the server so the dropdown reflects persisted truth.
      await refreshRouting();
    } finally {
      setBusyPurpose(null);
    }
  }

  const options = assignableModels(models);

  return (
    <Card padding="lg" data-testid="llm-job-routing-card">
      {/* PART 3 §3: the h3 "Job routing" heading is removed — the
          SettingsSection rail now owns the section heading. */}

      {loadError && (
        <div
          className={cn(t.meta, colors.status.down, "p-3 rounded border", colors.statusBorder.down, "mb-4")}
          data-testid="job-routing-load-error"
        >
          {loadError}
        </div>
      )}

      <div className="space-y-3" data-testid="job-routing-rows">
        {loading && (
          <p className={cn(t.meta, colors.text.muted)}>Loading…</p>
        )}
        {!loading &&
          PURPOSES.map(({ purpose, label }) => {
            const current = assignments[purpose] ?? DEFAULT_OPTION;
            // If the persisted model is no longer assignable (e.g. it lost
            // its preflight), still show it as a selected option so the row
            // is honest about current state.
            const currentIsAssignable =
              current === DEFAULT_OPTION ||
              options.some((m) => m.model_id === current);
            return (
              <div
                key={purpose}
                className="flex flex-wrap items-center gap-3"
                data-testid={`job-routing-row-${purpose}`}
              >
                <label
                  htmlFor={`routing-${purpose}`}
                  className={cn(t.body, colors.text.primary, "min-w-48")}
                >
                  {label}
                </label>
                <select
                  id={`routing-${purpose}`}
                  value={current}
                  disabled={busyPurpose === purpose}
                  onChange={(e) => void handleAssign(purpose, e.target.value)}
                  className={cn(
                    "px-3 py-2 rounded border min-w-64",
                    colors.divider,
                    colors.bg.surface,
                    t.body,
                  )}
                  data-testid={`routing-select-${purpose}`}
                >
                  <option value={DEFAULT_OPTION}>— default —</option>
                  {!currentIsAssignable && (
                    <option value={current}>
                      {current} (no longer valid)
                    </option>
                  )}
                  {options.map((m) => (
                    <option key={m.model_id} value={m.model_id}>
                      {m.display_name ? `${m.display_name} (${m.model_id})` : m.model_id}
                    </option>
                  ))}
                </select>
                {busyPurpose === purpose && (
                  <span className={cn(t.caption, colors.text.muted)}>Saving…</span>
                )}
                {rowSuccess === purpose && busyPurpose !== purpose && (
                  <span
                    className={cn(t.caption, colors.status.healthy)}
                    data-testid={`routing-success-${purpose}`}
                  >
                    ✓ Saved
                  </span>
                )}
                {rowError?.purpose === purpose && (
                  <span
                    className={cn(t.caption, colors.status.down)}
                    data-testid={`routing-error-${purpose}`}
                  >
                    {rowError.message}
                  </span>
                )}
              </div>
            );
          })}
        {!loading && options.length === 0 && (
          <p
            className={cn(t.caption, colors.text.faint)}
            data-testid="job-routing-no-models"
          >
            No validated models available. Add and validate a model above
            before assigning jobs.
          </p>
        )}
      </div>
    </Card>
  );
}
