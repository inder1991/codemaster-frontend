/**
 * Task 5.6 — EmbedderLifecyclePanel (spec §9 + v4).
 *
 * Comprehensive admin panel for the embedder lifecycle surface.
 * Consumed by T5.8 /admin/llm Embedding tab.
 *
 * Layout:
 *   1. Active + Pending header (updated_at + updated_by_email).
 *   2. Retrieval-mode flip control gated on coverage (T4.2B).
 *   3. Coverage gauge (confluence_missing + knowledge_missing).
 *   4. Generation history table — per-row state-machine actions:
 *        - backfilling: Cancel
 *        - ready:       Activate (gated on validation_passed=true) | Validate | Manual retire
 *        - active:      View report (if validation present); no mutations
 *        - retired AND not gc'd: Rollback | GC (gated on retention window)
 *        - retired AND gc'd: no actions
 *   5. Validation report modal (wraps T5.5 ValidationReportViewer).
 *        The wire EmbeddingGenerationV1 carries `validation_report` as a
 *        parsed ValidationReportV1 (server-side parse of the JSONB
 *        column). The modal renders the full report when present; when
 *        the field is null (validation not yet run / parse failure /
 *        missing) the modal shows an informative placeholder.
 *   6. Throttling controls (collapsed-by-default disclosure) — v1
 *      displays defaults read-only; wiring to POST /reembed/start body
 *      is FOLLOW-UP-embedder-throttling-controls-wire-to-start.
 *
 * Error mapping:
 *   - 409 invalid_state_transition / pending_generation_in_flight /
 *     generation_data_collected / gc_retention_not_elapsed
 *   - 422 validation_not_passed / coverage_gap_present
 */

"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/elements/Button";
import { Card } from "@/components/ui/elements/Card";
import { Modal } from "@/components/ui/overlays/Modal";
import { ValidationReportViewer } from "@/components/admin/ValidationReportViewer";
import {
  EMBEDDER_QUERY_KEYS,
  EmbedderActionError,
  activateGeneration,
  cancelReembed,
  fetchEmbedderCoverage,
  fetchEmbedderState,
  gcGeneration,
  manualRetireGeneration,
  rollbackGeneration,
  setRetrievalMode,
  startReembed,
  validateReembed,
  type EmbedderCoverageV1,
  type EmbedderStateV1,
  type EmbeddingGenerationV1,
  type GenerationState,
  type RetrievalMode,
  type StartReembedRequestV1,
} from "@/lib/api/admin-embedder";
import { cn } from "@/lib/cn";
import { colors, type as t } from "@/lib/design-tokens";

// ── Constants ─────────────────────────────────────────────────────

const STATE_POLL_INTERVAL_MS = 30_000;
const COVERAGE_POLL_INTERVAL_MS = 60_000;
/** Operator-overrideable but v1 displays the default. */
const GC_RETENTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

// Throttling defaults — mirror codemaster/embedder/throttle.py + workflow.
const THROTTLING_DEFAULTS = {
  max_in_flight_batches: 4,
  max_qwen_rps: 50,
  db_pressure_pg_stat_activity_threshold: 50,
} as const;

// ── Error-code → human-message mapping ────────────────────────────

const _ACTION_ERROR_MESSAGES: Record<string, string> = {
  invalid_state_transition:
    "The generation is not in a state that permits this action.",
  pending_generation_in_flight:
    "Another generation is already pending. Cancel or finish it first.",
  generation_data_collected:
    "This generation has already been garbage-collected; chunk embeddings no longer exist.",
  gc_retention_not_elapsed:
    "Retention window has not elapsed. Wait 30 days after retirement before GC.",
  validation_not_passed:
    "Validation did not pass. Re-validate before activating, or wait for the override follow-up.",
  coverage_gap_present:
    "Coverage gap present: re-embed missing chunks before flipping to generation-only.",
};

function _formatActionError(err: unknown): string {
  if (err instanceof EmbedderActionError) {
    if (err.errorCode !== null) {
      const mapped = _ACTION_ERROR_MESSAGES[err.errorCode];
      if (mapped !== undefined) return mapped;
    }
    return err.errorDetail ?? err.message;
  }
  return err instanceof Error ? err.message : "Action failed.";
}

// ── Helpers ───────────────────────────────────────────────────────

function formatTs(ts: string | null | undefined): string {
  if (ts === null || ts === undefined) return "—";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function gcEligible(gen: EmbeddingGenerationV1): boolean {
  if (gen.state !== "retired") return false;
  if (gen.gc_completed_at !== null) return false;
  if (gen.retired_at === null) return false;
  const elapsed = Date.now() - new Date(gen.retired_at).getTime();
  return elapsed >= GC_RETENTION_WINDOW_MS;
}

function rollbackEligible(gen: EmbeddingGenerationV1): boolean {
  // Rollback is permitted while chunk_embeddings rows still exist
  // (state=retired AND gc not run). Backend re-validates.
  return gen.state === "retired" && gen.gc_completed_at === null;
}

const STATE_BADGE_TONE: Record<GenerationState, string> = {
  backfilling: cn(colors.statusBg.info, colors.status.info),
  ready: cn(colors.statusBg.degraded, colors.status.degraded),
  active: cn(colors.statusBg.healthy, colors.status.healthy),
  retired: cn(colors.statusBg.dim, colors.status.dim),
};

// ── Sub-components ────────────────────────────────────────────────

function StateBadge({ state }: { state: GenerationState }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
        STATE_BADGE_TONE[state],
      )}
      data-testid={`state-badge-${state}`}
    >
      {state}
    </span>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      className={cn(
        t.meta,
        colors.status.down,
        "p-3 rounded border border-red-400 mb-3",
      )}
      role="alert"
      data-testid="embedder-error-banner"
    >
      {message}
    </div>
  );
}

function SuccessBanner({ message }: { message: string }) {
  return (
    <div
      className={cn(
        t.meta,
        colors.status.healthy,
        "p-3 rounded border border-green-400 mb-3",
      )}
      role="status"
      data-testid="embedder-success-banner"
    >
      {message}
    </div>
  );
}

// ── Active + pending header ───────────────────────────────────────

function HeaderBlock({ state }: { state: EmbedderStateV1 }) {
  return (
    <div className="space-y-2" data-testid="embedder-header">
      <div>
        <span className={cn(t.meta, colors.text.muted)}>Active: </span>
        <span
          className={cn(t.bodyStrong, colors.text.primary)}
          data-testid="active-generation"
        >
          gen {state.active_generation} ({state.active_model_name})
        </span>
        <span className={cn(t.caption, colors.text.faint, "ml-2")}>
          updated {formatTs(state.updated_at)}
          {state.updated_by_email ? ` by ${state.updated_by_email}` : ""}
        </span>
      </div>
      <div>
        <span className={cn(t.meta, colors.text.muted)}>Pending: </span>
        {state.pending_generation === null ? (
          <span
            className={cn(t.meta, colors.text.faint)}
            data-testid="pending-empty"
          >
            none
          </span>
        ) : (
          <span
            className={cn(t.bodyStrong, colors.text.primary)}
            data-testid="pending-generation"
          >
            gen {state.pending_generation} ({state.pending_model_name})
          </span>
        )}
      </div>
    </div>
  );
}

// ── Coverage gauge + retrieval-mode flip ─────────────────────────

function CoverageBlock({
  coverage,
  retrievalMode,
  onFlip,
  flipPending,
}: {
  coverage: EmbedderCoverageV1 | undefined;
  retrievalMode: RetrievalMode;
  onFlip: (next: RetrievalMode) => void;
  flipPending: boolean;
}) {
  const total = coverage?.total_missing ?? 0;
  const noGaps = total === 0;
  const nextMode: RetrievalMode =
    retrievalMode === "fallback" ? "generation_only" : "fallback";

  return (
    <div
      className="flex items-center flex-wrap gap-x-4 gap-y-2"
      data-testid="coverage-block"
    >
      <div>
        <span className={cn(t.meta, colors.text.muted)}>Retrieval mode: </span>
        <span
          className={cn(t.bodyStrong, colors.text.primary)}
          data-testid="retrieval-mode"
        >
          {retrievalMode}
        </span>
      </div>
      <Button
        variant="secondary"
        size="sm"
        type="button"
        onClick={() => onFlip(nextMode)}
        disabled={
          flipPending ||
          (retrievalMode === "fallback" && !noGaps) ||
          coverage === undefined
        }
        data-testid="retrieval-mode-flip-btn"
      >
        {flipPending
          ? "Flipping…"
          : `Switch to ${nextMode.replace("_", " ")}`}
      </Button>
      <div className="flex items-center gap-x-3 ml-auto">
        <span
          className={cn(
            t.meta,
            noGaps ? colors.status.healthy : colors.status.down,
          )}
          data-testid="coverage-confluence"
        >
          Confluence: {coverage?.confluence_missing ?? "—"} missing
        </span>
        <span
          className={cn(
            t.meta,
            noGaps ? colors.status.healthy : colors.status.down,
          )}
          data-testid="coverage-knowledge"
        >
          Knowledge: {coverage?.knowledge_missing ?? "—"} missing
        </span>
      </div>
    </div>
  );
}

// ── Generation history row ────────────────────────────────────────

interface RowActionHandlers {
  onActivate: (gen: EmbeddingGenerationV1) => void;
  onCancel: (gen: EmbeddingGenerationV1) => void;
  onValidate: (gen: EmbeddingGenerationV1) => void;
  onRollback: (gen: EmbeddingGenerationV1) => void;
  onManualRetire: (gen: EmbeddingGenerationV1) => void;
  onGc: (gen: EmbeddingGenerationV1) => void;
  onViewReport: (gen: EmbeddingGenerationV1) => void;
  pendingActionGenId: number | null;
}

function GenerationRow({
  gen,
  handlers,
}: {
  gen: EmbeddingGenerationV1;
  handlers: RowActionHandlers;
}) {
  const isMutating = handlers.pendingActionGenId === gen.generation_id;
  const validationPresent =
    gen.validation_completed_at !== null && gen.validation_passed !== null;
  const validationBadge =
    gen.validation_passed === true
      ? { text: "passed", cls: colors.status.healthy }
      : gen.validation_passed === false
        ? { text: "failed", cls: colors.status.down }
        : { text: "—", cls: colors.text.faint };

  return (
    <tr
      className={cn("border-t", colors.divider)}
      data-testid={`gen-row-${gen.generation_id}`}
    >
      <td className={cn("py-2 pr-3", t.numericBody, colors.text.primary)}>
        {gen.generation_id}
      </td>
      <td className={cn("py-2 pr-3", t.meta, colors.text.primary)}>
        {gen.model_name}
      </td>
      <td className="py-2 pr-3">
        <StateBadge state={gen.state} />
      </td>
      <td className={cn("py-2 pr-3", t.caption, colors.text.muted)}>
        {formatTs(gen.created_at)}
      </td>
      <td className={cn("py-2 pr-3", t.caption, colors.text.muted)}>
        {gen.activated_at !== null ? formatTs(gen.activated_at) : "—"}
      </td>
      <td
        className={cn("py-2 pr-3", t.caption, validationBadge.cls)}
        data-testid={`gen-validation-${gen.generation_id}`}
      >
        {validationBadge.text}
      </td>
      <td className="py-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* backfilling → Cancel */}
          {gen.state === "backfilling" && (
            <Button
              variant="secondary"
              size="xs"
              type="button"
              onClick={() => handlers.onCancel(gen)}
              disabled={isMutating}
              data-testid={`btn-cancel-${gen.generation_id}`}
            >
              Cancel
            </Button>
          )}

          {/* ready → Validate, Activate (gated), Manual retire */}
          {gen.state === "ready" && (
            <>
              <Button
                variant="secondary"
                size="xs"
                type="button"
                onClick={() => handlers.onValidate(gen)}
                disabled={isMutating}
                data-testid={`btn-validate-${gen.generation_id}`}
              >
                Validate
              </Button>
              <Button
                variant="primary"
                size="xs"
                type="button"
                onClick={() => handlers.onActivate(gen)}
                disabled={isMutating || gen.validation_passed !== true}
                data-testid={`btn-activate-${gen.generation_id}`}
              >
                Activate
              </Button>
              <Button
                variant="secondary"
                size="xs"
                type="button"
                onClick={() => handlers.onManualRetire(gen)}
                disabled={isMutating}
                data-testid={`btn-manual-retire-${gen.generation_id}`}
              >
                Manual retire
              </Button>
            </>
          )}

          {/* retired AND not gc'd → Rollback + GC */}
          {rollbackEligible(gen) && (
            <Button
              variant="secondary"
              size="xs"
              type="button"
              onClick={() => handlers.onRollback(gen)}
              disabled={isMutating}
              data-testid={`btn-rollback-${gen.generation_id}`}
            >
              Rollback
            </Button>
          )}
          {gen.state === "retired" && gen.gc_completed_at === null && (
            <Button
              variant="secondary"
              size="xs"
              type="button"
              onClick={() => handlers.onGc(gen)}
              disabled={isMutating || !gcEligible(gen)}
              data-testid={`btn-gc-${gen.generation_id}`}
            >
              GC
            </Button>
          )}

          {/* Validation report viewer (any state with validation present). */}
          {validationPresent && (
            <Button
              variant="ghost"
              size="xs"
              type="button"
              onClick={() => handlers.onViewReport(gen)}
              data-testid={`btn-view-report-${gen.generation_id}`}
            >
              View report
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Throttling controls (collapsed-by-default) ────────────────────

function ThrottlingControls({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div data-testid="throttling-controls">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          t.meta,
          colors.text.muted,
          "flex items-center gap-x-2 hover:c-text-primary",
        )}
        data-testid="throttling-toggle"
        aria-expanded={expanded}
      >
        <span aria-hidden="true">{expanded ? "▼" : "▶"}</span>
        Throttling controls ({expanded ? "expanded" : "collapsed"})
      </button>
      {expanded && (
        <div
          className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3"
          data-testid="throttling-fields"
        >
          {Object.entries(THROTTLING_DEFAULTS).map(([key, value]) => (
            <div key={key}>
              <label
                htmlFor={`throttle-${key}`}
                className={cn(t.caption, colors.text.muted, "block mb-1")}
              >
                {key}
              </label>
              <input
                id={`throttle-${key}`}
                type="number"
                defaultValue={value}
                readOnly
                disabled
                className={cn(
                  "w-full px-2 py-1 rounded border font-mono",
                  colors.divider,
                  colors.bg.surface,
                  t.body,
                  "opacity-70 cursor-not-allowed",
                )}
                data-testid={`throttle-input-${key}`}
              />
            </div>
          ))}
          <p
            className={cn(
              t.caption,
              colors.text.faint,
              "sm:col-span-3",
            )}
            data-testid="throttling-followup-note"
          >
            v1: read-only. Apply for next re-embed is{" "}
            FOLLOW-UP-embedder-throttling-controls-wire-to-start.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Confirm-modal helper state ────────────────────────────────────

type ConfirmActionKind =
  | "activate"
  | "cancel"
  | "validate"
  | "rollback"
  | "manual_retire"
  | "gc";

interface ConfirmModalState {
  kind: ConfirmActionKind;
  gen: EmbeddingGenerationV1;
}

const CONFIRM_COPY: Record<
  ConfirmActionKind,
  { title: string; description: string; label: string; variant?: "danger" }
> = {
  activate: {
    title: "Activate generation",
    description:
      "Promote this generation to active. Retires the current active generation.",
    label: "Activate",
  },
  cancel: {
    title: "Cancel re-embed",
    description: "Cancel the in-flight backfill. Partial chunks will remain.",
    label: "Cancel re-embed",
    variant: "danger",
  },
  validate: {
    title: "Re-run validation",
    description:
      "Dispatch the validation workflow against this generation. May take several minutes.",
    label: "Validate",
  },
  rollback: {
    title: "Roll back to this generation",
    description:
      "Re-activate this prior generation. Its chunk_embeddings rows must still exist.",
    label: "Rollback",
    variant: "danger",
  },
  manual_retire: {
    title: "Manually retire this generation",
    description:
      "Mark this 'ready' generation as retired. Chunk embeddings remain until GC.",
    label: "Retire",
    variant: "danger",
  },
  gc: {
    title: "Garbage-collect generation",
    description:
      "Permanently delete chunk_embeddings rows. Rollback to this generation will no longer be possible.",
    label: "GC",
    variant: "danger",
  },
};

// ── Start-reembed modal state ─────────────────────────────────────

interface StartModalFields {
  target_model_name: string;
  generation_label: string;
  generation_reason: string;
}

// ── Main component ────────────────────────────────────────────────

export function EmbedderLifecyclePanel(): React.JSX.Element {
  const queryClient = useQueryClient();
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(
    null,
  );
  const [reportModalFor, setReportModalFor] =
    useState<EmbeddingGenerationV1 | null>(null);
  const [showStartModal, setShowStartModal] = useState(false);
  const [startFields, setStartFields] = useState<StartModalFields>({
    target_model_name: "qwen3-embed-0.6b",
    generation_label: "",
    generation_reason: "",
  });
  const [showThrottlingControls, setShowThrottlingControls] = useState(false);

  const stateQuery = useQuery({
    queryKey: EMBEDDER_QUERY_KEYS.state(),
    queryFn: fetchEmbedderState,
    refetchInterval: STATE_POLL_INTERVAL_MS,
  });

  const coverageQuery = useQuery({
    queryKey: EMBEDDER_QUERY_KEYS.coverage(),
    queryFn: fetchEmbedderCoverage,
    refetchInterval: COVERAGE_POLL_INTERVAL_MS,
  });

  function _clearBanners() {
    setErrorBanner(null);
    setSuccessBanner(null);
  }

  async function _refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: EMBEDDER_QUERY_KEYS.state() }),
      queryClient.invalidateQueries({
        queryKey: EMBEDDER_QUERY_KEYS.coverage(),
      }),
    ]);
  }

  function _onMutationSuccess(message: string) {
    return async () => {
      setErrorBanner(null);
      setSuccessBanner(message);
      await _refresh();
    };
  }

  function _onMutationError(err: unknown) {
    setSuccessBanner(null);
    setErrorBanner(_formatActionError(err));
  }

  // ── Mutations ───────────────────────────────────────────────────

  const startMutation = useMutation({
    mutationFn: startReembed,
    onSuccess: async (gen) => {
      setShowStartModal(false);
      await _onMutationSuccess(
        `Re-embed started: generation ${gen.generation_id}.`,
      )();
    },
    onError: _onMutationError,
  });

  const cancelMutation = useMutation({
    mutationFn: cancelReembed,
    onSuccess: _onMutationSuccess("Re-embed cancelled."),
    onError: _onMutationError,
  });

  const validateMutation = useMutation({
    mutationFn: validateReembed,
    onSuccess: _onMutationSuccess("Validation workflow dispatched."),
    onError: _onMutationError,
  });

  const activateMutation = useMutation({
    mutationFn: activateGeneration,
    onSuccess: _onMutationSuccess("Generation activated."),
    onError: _onMutationError,
  });

  const rollbackMutation = useMutation({
    mutationFn: rollbackGeneration,
    onSuccess: _onMutationSuccess("Rollback complete."),
    onError: _onMutationError,
  });

  const manualRetireMutation = useMutation({
    mutationFn: manualRetireGeneration,
    onSuccess: _onMutationSuccess("Generation retired."),
    onError: _onMutationError,
  });

  const gcMutation = useMutation({
    mutationFn: gcGeneration,
    onSuccess: _onMutationSuccess("Garbage collection started."),
    onError: _onMutationError,
  });

  const retrievalModeMutation = useMutation({
    mutationFn: setRetrievalMode,
    onSuccess: _onMutationSuccess("Retrieval mode updated."),
    onError: _onMutationError,
  });

  // ── Confirm-handler ───────────────────────────────────────────

  function _executeConfirmedAction() {
    if (confirmModal === null) return;
    const { kind, gen } = confirmModal;
    setConfirmModal(null);
    _clearBanners();
    switch (kind) {
      case "activate":
        activateMutation.mutate({
          schema_version: 1,
          generation_id: gen.generation_id,
        });
        return;
      case "cancel":
        cancelMutation.mutate({ generation_id: gen.generation_id });
        return;
      case "validate":
        validateMutation.mutate({ generation_id: gen.generation_id });
        return;
      case "rollback":
        rollbackMutation.mutate({
          schema_version: 1,
          target_generation_id: gen.generation_id,
        });
        return;
      case "manual_retire":
        manualRetireMutation.mutate({ generation_id: gen.generation_id });
        return;
      case "gc":
        gcMutation.mutate({ generation_id: gen.generation_id });
        return;
    }
  }

  // ── Pending-action gen-id (UI disables other row actions) ─────

  function _activeMutationGenId(): number | null {
    if (cancelMutation.isPending && cancelMutation.variables)
      return cancelMutation.variables.generation_id;
    if (validateMutation.isPending && validateMutation.variables)
      return validateMutation.variables.generation_id;
    if (activateMutation.isPending && activateMutation.variables)
      return activateMutation.variables.generation_id;
    if (rollbackMutation.isPending && rollbackMutation.variables)
      return rollbackMutation.variables.target_generation_id;
    if (manualRetireMutation.isPending && manualRetireMutation.variables)
      return manualRetireMutation.variables.generation_id;
    if (gcMutation.isPending && gcMutation.variables)
      return gcMutation.variables.generation_id;
    return null;
  }
  const pendingActionGenId: number | null = _activeMutationGenId();

  // ── Retrieval-mode flip ───────────────────────────────────────

  function _onFlipRetrievalMode(next: RetrievalMode) {
    _clearBanners();
    retrievalModeMutation.mutate({ schema_version: 1, mode: next });
  }

  // ── Start-reembed submission ──────────────────────────────────

  function _onSubmitStart() {
    _clearBanners();
    const body: StartReembedRequestV1 = {
      schema_version: 1,
      target_model_name: startFields.target_model_name.trim(),
    };
    if (startFields.generation_label.trim() !== "")
      body.generation_label = startFields.generation_label.trim();
    if (startFields.generation_reason.trim() !== "")
      body.generation_reason = startFields.generation_reason.trim();
    startMutation.mutate(body);
  }

  // ── Row handlers ──────────────────────────────────────────────

  const rowHandlers: RowActionHandlers = {
    onActivate: (gen) => setConfirmModal({ kind: "activate", gen }),
    onCancel: (gen) => setConfirmModal({ kind: "cancel", gen }),
    onValidate: (gen) => setConfirmModal({ kind: "validate", gen }),
    onRollback: (gen) => setConfirmModal({ kind: "rollback", gen }),
    onManualRetire: (gen) => setConfirmModal({ kind: "manual_retire", gen }),
    onGc: (gen) => setConfirmModal({ kind: "gc", gen }),
    onViewReport: (gen) => setReportModalFor(gen),
    pendingActionGenId,
  };

  // ── Validation-report modal body ─────────────────────────────

  function _renderReportModalBody(
    gen: EmbeddingGenerationV1,
  ): React.ReactNode {
    return (
      <div className="space-y-3" data-testid="report-modal-body">
        <p className={cn(t.caption, colors.text.muted)}>
          Generation {gen.generation_id} ({gen.model_name})
        </p>
        <p className={cn(t.caption, colors.text.muted)}>
          Validation completed:{" "}
          <span data-testid="report-completed-at">
            {formatTs(gen.validation_completed_at)}
          </span>
        </p>
        {gen.validation_report ? (
          <ValidationReportViewer report={gen.validation_report} />
        ) : (
          <p
            className={cn(t.meta, colors.text.faint)}
            data-testid="report-not-available"
          >
            No validation report available for this generation yet.
          </p>
        )}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div data-testid="embedder-lifecycle-panel" className="space-y-4">
      <Card padding="lg">
        {/* Header */}
        {stateQuery.isLoading ? (
          <p
            className={cn(t.meta, colors.text.muted)}
            data-testid="state-loading"
          >
            Loading embedder state…
          </p>
        ) : stateQuery.isError ? (
          <p
            className={cn(t.meta, colors.status.down)}
            data-testid="state-error"
          >
            Could not load embedder state.
          </p>
        ) : stateQuery.data ? (
          <HeaderBlock state={stateQuery.data} />
        ) : null}

        {/* Coverage + retrieval-mode flip */}
        {stateQuery.data && (
          <div className={cn("mt-4 pt-4 border-t", colors.divider)}>
            <CoverageBlock
              coverage={coverageQuery.data}
              retrievalMode={stateQuery.data.retrieval_mode}
              onFlip={_onFlipRetrievalMode}
              flipPending={retrievalModeMutation.isPending}
            />
          </div>
        )}
      </Card>

      {/* Banners */}
      {errorBanner && <ErrorBanner message={errorBanner} />}
      {successBanner && <SuccessBanner message={successBanner} />}

      {/* Generation history table */}
      <Card padding="lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className={cn(t.h2, colors.text.primary)}>
            Generation history
          </h2>
          <Button
            variant="primary"
            size="sm"
            type="button"
            onClick={() => {
              _clearBanners();
              setShowStartModal(true);
            }}
            data-testid="btn-start-reembed"
          >
            + Start re-embed
          </Button>
        </div>

        {stateQuery.data && stateQuery.data.generations.length > 0 ? (
          <div className="overflow-x-auto">
            <table
              className="w-full"
              data-testid="generation-history-table"
            >
              <thead>
                <tr
                  className={cn(
                    t.caption,
                    colors.text.muted,
                    "text-left border-b",
                    colors.divider,
                  )}
                >
                  <th className="py-2 pr-3 font-medium">ID</th>
                  <th className="py-2 pr-3 font-medium">Model</th>
                  <th className="py-2 pr-3 font-medium">State</th>
                  <th className="py-2 pr-3 font-medium">Created</th>
                  <th className="py-2 pr-3 font-medium">Activated</th>
                  <th className="py-2 pr-3 font-medium">Validation</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {stateQuery.data.generations.map((gen) => (
                  <GenerationRow
                    key={gen.generation_id}
                    gen={gen}
                    handlers={rowHandlers}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : stateQuery.data ? (
          <p
            className={cn(t.meta, colors.text.faint)}
            data-testid="generations-empty"
          >
            No generations recorded.
          </p>
        ) : null}
      </Card>

      {/* Throttling controls */}
      <Card padding="lg">
        <ThrottlingControls
          expanded={showThrottlingControls}
          onToggle={() => setShowThrottlingControls((v) => !v)}
        />
      </Card>

      {/* Confirm modal */}
      {confirmModal &&
        (() => {
          const copy = CONFIRM_COPY[confirmModal.kind];
          // exactOptionalPropertyTypes: omit `variant` entirely when undefined
          // rather than passing `variant: undefined`.
          const primaryAction: {
            label: string;
            onClick: () => void;
            variant?: "danger";
          } = {
            label: copy.label,
            onClick: _executeConfirmedAction,
          };
          if (copy.variant) primaryAction.variant = copy.variant;
          return (
            <Modal
              open={true}
              onClose={() => setConfirmModal(null)}
              title={copy.title}
              description={`${copy.description} (gen ${confirmModal.gen.generation_id})`}
              primaryAction={primaryAction}
              secondaryAction={{
                label: "Cancel",
                onClick: () => setConfirmModal(null),
              }}
            />
          );
        })()}

      {/* Start-reembed modal */}
      {showStartModal && (
        <Modal
          open={true}
          onClose={() => setShowStartModal(false)}
          title="Start re-embed"
          description="Dispatch ReembedGenerationWorkflow with a new target model."
          primaryAction={{
            label: startMutation.isPending ? "Starting…" : "Start",
            onClick: _onSubmitStart,
            disabled:
              startMutation.isPending ||
              startFields.target_model_name.trim() === "",
          }}
          secondaryAction={{
            label: "Cancel",
            onClick: () => setShowStartModal(false),
            disabled: startMutation.isPending,
          }}
        >
          <div
            className="space-y-3 text-left"
            data-testid="start-modal-fields"
          >
            <div>
              <label
                htmlFor="start-target-model"
                className={cn(t.caption, colors.text.muted, "block mb-1")}
              >
                Target model name
              </label>
              <input
                id="start-target-model"
                type="text"
                value={startFields.target_model_name}
                onChange={(e) =>
                  setStartFields((f) => ({
                    ...f,
                    target_model_name: e.target.value,
                  }))
                }
                className={cn(
                  "w-full px-2 py-1 rounded border font-mono",
                  colors.divider,
                  colors.bg.surface,
                  t.body,
                )}
                data-testid="start-target-model-input"
              />
            </div>
            <div>
              <label
                htmlFor="start-label"
                className={cn(t.caption, colors.text.muted, "block mb-1")}
              >
                Label (optional)
              </label>
              <input
                id="start-label"
                type="text"
                value={startFields.generation_label}
                onChange={(e) =>
                  setStartFields((f) => ({
                    ...f,
                    generation_label: e.target.value,
                  }))
                }
                className={cn(
                  "w-full px-2 py-1 rounded border",
                  colors.divider,
                  colors.bg.surface,
                  t.body,
                )}
                data-testid="start-label-input"
              />
            </div>
            <div>
              <label
                htmlFor="start-reason"
                className={cn(t.caption, colors.text.muted, "block mb-1")}
              >
                Reason (optional)
              </label>
              <input
                id="start-reason"
                type="text"
                value={startFields.generation_reason}
                onChange={(e) =>
                  setStartFields((f) => ({
                    ...f,
                    generation_reason: e.target.value,
                  }))
                }
                className={cn(
                  "w-full px-2 py-1 rounded border",
                  colors.divider,
                  colors.bg.surface,
                  t.body,
                )}
                data-testid="start-reason-input"
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Validation-report modal */}
      {reportModalFor && (
        <Modal
          open={true}
          onClose={() => setReportModalFor(null)}
          title={`Validation report — generation ${reportModalFor.generation_id}`}
          primaryAction={{
            label: "Close",
            onClick: () => setReportModalFor(null),
          }}
          iconTone={
            reportModalFor.validation_passed === true ? "success" : "danger"
          }
        >
          {_renderReportModalBody(reportModalFor)}
        </Modal>
      )}
    </div>
  );
}
