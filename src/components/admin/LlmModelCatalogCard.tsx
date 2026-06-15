/**
 * ADR-0060 — MODELS section of /admin/llm (Inference tab).
 *
 * Renders the model catalog: a table of `(model_id, provider, status,
 * actions)` rows + an "Add model" row. A model is usable only after a
 * green preflight, so "Save & test" PUTs the catalog row then runs the
 * per-model /test preflight.
 *
 * Reads work for reader+; mutations are super_admin-gated. On a 403 from
 * a mutation we surface a clear "super_admin required" message rather than
 * a raw error. A blocked delete (409) lists the dependent purposes; a bad
 * add (422) shows the engine's unsupported-model message. A 409 from the
 * PUT (llm_model_id_taken cross-provider collision) also surfaces the
 * backend detail message (PART 3 §6).
 *
 * PART 2: `models` + `refreshModels` are now owned by the parent page so
 * a model validated here immediately becomes selectable in LlmJobRoutingCard
 * without a page reload. This card calls `refreshModels()` after add/test/delete
 * instead of re-fetching its own list.
 *
 * PART 3 §5: add-result banner split into three outcomes:
 *   - added+validated  → green  (colors.status.healthy)
 *   - added+preflight-failed → amber WARNING (colors.status.degraded)
 *   - add failed       → red    (colors.status.down) via addError
 *
 * Plain useState pattern (mirrors LlmProviderCard) — no react-query.
 */

"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/elements/Button";
import { Card } from "@/components/ui/elements/Card";
import { AdminApiError } from "@/lib/api/admin";
import {
  deleteLlmModel,
  LlmModelDetailError,
  LlmModelInUseError,
  testLlmModel,
  upsertLlmModel,
  type LlmModelProvider,
  type LlmModelV1,
} from "@/lib/api/llm-models";
import { cn } from "@/lib/cn";
import { colors, type as t } from "@/lib/design-tokens";

const SUPER_ADMIN_REQUIRED = "super_admin required for this action.";

function providerLabel(provider: LlmModelProvider): string {
  return provider === "bedrock" ? "AWS Bedrock" : "Anthropic Direct";
}

function mutationErrorMessage(err: unknown): string {
  if (err instanceof AdminApiError && err.status === 403) {
    return SUPER_ADMIN_REQUIRED;
  }
  if (err instanceof Error) return err.message;
  return "Request failed";
}

// ── Status badge ──────────────────────────────────────────────────

function StatusBadge({ model }: { model: LlmModelV1 }) {
  const status = model.last_validation_status;
  if (status === "ok") {
    return (
      <span
        className={cn(
          "inline-flex items-center px-2 py-0.5 rounded text-sm font-medium",
          colors.statusBg.healthy,
          colors.status.healthy,
          "border",
          colors.statusBorder.healthy,
        )}
        data-testid={`model-status-${model.model_id}`}
      >
        ✓ Valid
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span
        className={cn(
          "inline-flex items-center px-2 py-0.5 rounded text-sm font-medium",
          colors.statusBg.down,
          colors.status.down,
          "border",
          colors.statusBorder.down,
        )}
        title={model.last_validation_error ?? undefined}
        data-testid={`model-status-${model.model_id}`}
      >
        ✗ Failed
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-sm font-medium",
        colors.statusBg.dim,
        colors.status.dim,
        "border",
        colors.divider,
      )}
      data-testid={`model-status-${model.model_id}`}
    >
      Untested
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────

export interface LlmModelCatalogCardProps {
  /**
   * Shared model list from the parent page (PART 2).
   * Used for the catalog table display.
   */
  models: LlmModelV1[];
  /** Callback to trigger a parent-level model list refresh (PART 2). */
  refreshModels: () => void | Promise<void>;
}

export function LlmModelCatalogCard({ models, refreshModels }: LlmModelCatalogCardProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Per-row transient state.
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ key: string; message: string } | null>(
    null,
  );
  const [inUse, setInUse] = useState<{ key: string; purposes: string[] } | null>(
    null,
  );

  // Add-model form state.
  const [newProvider, setNewProvider] = useState<LlmModelProvider>("anthropic_direct");
  const [newModelId, setNewModelId] = useState<string>("");
  const [newDisplayName, setNewDisplayName] = useState<string>("");
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [addError, setAddError] = useState<string | null>(null);

  /**
   * PART 3 §5 — split add-result into three typed outcomes:
   *   - "validated": added + green preflight → green banner
   *   - "preflight_failed": added but preflight failed → amber banner
   */
  const [addOutcome, setAddOutcome] = useState<{
    kind: "validated" | "preflight_failed";
    message: string;
  } | null>(null);

  function rowKey(m: LlmModelV1): string {
    return `${m.provider}/${m.model_id}`;
  }

  // Initial load: call refreshModels to populate the shared parent list,
  // then clear loading state. The table reads from the `models` prop.
  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    Promise.resolve(refreshModels())
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : "Failed to load models");
      })
      .finally(() => {
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleTest(m: LlmModelV1) {
    const key = rowKey(m);
    setBusyRow(key);
    setRowError(null);
    setInUse(null);
    try {
      const result = await testLlmModel(m.provider, m.model_id);
      if (!result.ok) {
        setRowError({ key, message: result.message });
      }
      await refreshModels();
    } catch (err: unknown) {
      setRowError({ key, message: mutationErrorMessage(err) });
    } finally {
      setBusyRow(null);
    }
  }

  async function handleDelete(m: LlmModelV1) {
    const key = rowKey(m);
    setBusyRow(key);
    setRowError(null);
    setInUse(null);
    try {
      await deleteLlmModel(m.provider, m.model_id);
      await refreshModels();
    } catch (err: unknown) {
      if (err instanceof LlmModelInUseError) {
        setInUse({ key, purposes: err.detail.purposes });
      } else {
        setRowError({ key, message: mutationErrorMessage(err) });
      }
    } finally {
      setBusyRow(null);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setIsAdding(true);
    setAddError(null);
    setAddOutcome(null);
    try {
      await upsertLlmModel({
        schema_version: 1,
        provider: newProvider,
        model_id: newModelId.trim(),
        display_name: newDisplayName.trim() || null,
        enabled: true,
      });
      // Run the preflight so the model becomes assignable.
      const result = await testLlmModel(newProvider, newModelId.trim());
      if (result.ok) {
        // PART 3 §5: added+validated → green outcome.
        setAddOutcome({ kind: "validated", message: `Added and validated ${newModelId.trim()}.` });
      } else {
        // PART 3 §5: added-but-preflight-failed → amber outcome.
        // Use the raw result.message — do NOT prepend "preflight failed:".
        setAddOutcome({ kind: "preflight_failed", message: result.message });
      }
      setNewModelId("");
      setNewDisplayName("");
      await refreshModels();
    } catch (err: unknown) {
      if (err instanceof LlmModelDetailError) {
        setAddError(err.detail.message);
      } else {
        setAddError(mutationErrorMessage(err));
      }
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <Card padding="lg" data-testid="llm-model-catalog-card">
      {/* PART 3 §3: the h3 "Model catalog" heading removed — the
          SettingsSection rail now owns it. The h3 "Add model" sub-heading
          is kept per spec (rail h2 → card h3; no heading skip). */}

      {loadError && (
        <div
          className={cn(t.meta, colors.status.down, "p-3 rounded border", colors.statusBorder.down, "mb-4")}
          data-testid="model-catalog-load-error"
        >
          {loadError}
        </div>
      )}

      {/* Catalog table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left" data-testid="model-catalog-table">
          <thead>
            <tr className={cn("border-b", colors.divider)}>
              <th className={cn(t.meta, colors.text.muted, "py-2 pr-4")}>Model ID</th>
              <th className={cn(t.meta, colors.text.muted, "py-2 pr-4")}>Provider</th>
              <th className={cn(t.meta, colors.text.muted, "py-2 pr-4")}>Status</th>
              <th className={cn(t.meta, colors.text.muted, "py-2")}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className={cn(t.meta, colors.text.muted, "py-3")}>
                  Loading…
                </td>
              </tr>
            )}
            {!loading && !loadError && models.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className={cn(t.meta, colors.text.muted, "py-3")}
                  data-testid="model-catalog-empty"
                >
                  No models in the catalog yet. Add one below.
                </td>
              </tr>
            )}
            {models.map((m) => {
              const key = rowKey(m);
              const busy = busyRow === key;
              return (
                <tr
                  key={key}
                  className={cn("border-b", colors.divider)}
                  data-testid={`model-row-${m.model_id}`}
                >
                  <td className={cn(t.body, colors.text.primary, "py-2 pr-4 font-mono")}>
                    {m.model_id}
                    {m.display_name && (
                      <span className={cn(t.caption, colors.text.faint, "block")}>
                        {m.display_name}
                      </span>
                    )}
                  </td>
                  <td className={cn(t.body, colors.text.muted, "py-2 pr-4")}>
                    {providerLabel(m.provider)}
                  </td>
                  <td className="py-2 pr-4">
                    <StatusBadge model={m} />
                  </td>
                  <td className="py-2">
                    <div className="flex items-center gap-x-2 flex-wrap gap-y-1">
                      <Button
                        variant="secondary"
                        size="xs"
                        type="button"
                        disabled={busy}
                        onClick={() => void handleTest(m)}
                        data-testid={`model-test-btn-${m.model_id}`}
                      >
                        {busy ? "…" : "Test"}
                      </Button>
                      <Button
                        variant="danger"
                        size="xs"
                        type="button"
                        disabled={busy}
                        onClick={() => void handleDelete(m)}
                        data-testid={`model-delete-btn-${m.model_id}`}
                      >
                        ✕
                      </Button>
                    </div>
                    {rowError?.key === key && (
                      <div
                        className={cn(t.caption, colors.status.down, "mt-1")}
                        data-testid={`model-row-error-${m.model_id}`}
                      >
                        {rowError.message}
                      </div>
                    )}
                    {inUse?.key === key && (
                      <div
                        className={cn(t.caption, colors.status.down, "mt-1")}
                        data-testid={`model-in-use-${m.model_id}`}
                      >
                        Cannot delete — in use by:{" "}
                        {inUse.purposes.join(", ") || "(unknown purposes)"}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add-model row */}
      <form
        onSubmit={handleAdd}
        className="mt-5 pt-4 border-t space-y-3"
        data-testid="model-add-form"
      >
        <h3 className={cn(t.h3, colors.text.primary)}>Add model</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label
              htmlFor="add-model-provider"
              className={cn(t.meta, colors.text.muted, "block mb-1")}
            >
              Provider
            </label>
            <select
              id="add-model-provider"
              value={newProvider}
              onChange={(e) => setNewProvider(e.target.value as LlmModelProvider)}
              className={cn(
                "px-3 py-2 rounded border",
                colors.divider,
                colors.bg.surface,
                t.body,
              )}
              data-testid="add-model-provider-select"
            >
              <option value="anthropic_direct">Anthropic Direct</option>
              <option value="bedrock">AWS Bedrock</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="add-model-id"
              className={cn(t.meta, colors.text.muted, "block mb-1")}
            >
              Model ID
            </label>
            <input
              id="add-model-id"
              type="text"
              value={newModelId}
              onChange={(e) => setNewModelId(e.target.value)}
              placeholder="claude-sonnet-4-6"
              required
              className={cn(
                "px-3 py-2 rounded border font-mono",
                colors.divider,
                colors.bg.surface,
                t.body,
              )}
              data-testid="add-model-id-input"
            />
          </div>
          <div>
            <label
              htmlFor="add-model-display-name"
              className={cn(t.meta, colors.text.muted, "block mb-1")}
            >
              Display name (optional)
            </label>
            <input
              id="add-model-display-name"
              type="text"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              placeholder="Sonnet 4.6"
              className={cn(
                "px-3 py-2 rounded border",
                colors.divider,
                colors.bg.surface,
                t.body,
              )}
              data-testid="add-model-display-name-input"
            />
          </div>
          <Button
            variant="primary"
            size="md"
            type="submit"
            disabled={isAdding || !newModelId.trim()}
            data-testid="add-model-save-btn"
          >
            {isAdding ? "Saving…" : "Save & test"}
          </Button>
        </div>

        {addError && (
          <div
            className={cn(t.meta, colors.status.down, "p-3 rounded border", colors.statusBorder.down)}
            data-testid="add-model-error"
          >
            {addError}
          </div>
        )}

        {/* PART 3 §5: three-outcome banner (green / amber / red). */}
        {addOutcome?.kind === "validated" && (
          <div
            className={cn(t.meta, colors.status.healthy, "p-3 rounded border", colors.statusBorder.healthy)}
            data-testid="add-model-success"
          >
            {addOutcome.message}
          </div>
        )}
        {addOutcome?.kind === "preflight_failed" && (
          <div
            className={cn(t.meta, colors.status.degraded, "p-3 rounded border", colors.statusBorder.degraded)}
            data-testid="add-model-success"
          >
            {addOutcome.message}
          </div>
        )}
      </form>
    </Card>
  );
}
