/**
 * EmbedderConfigCard — UI-editable embedder provider config (DB-backed; replaces the old Vault
 * `embedder.qwen` platform-credentials card). Pick the embedding model, set the base URL + an optional API
 * key (leave Keyless on for a sidecar Ollama/vLLM that needs no auth), Save, then Test. The api key is
 * write-only (never echoed; cleared after save). super_admin only.
 *
 * Flow (matches the backend stage→test→promote): Save STAGES the config (resets validation). Test probes
 * the staged config and, on success, PROMOTES it — so the SELECTED model is what the worker actually embeds
 * with (and records as provenance), no redeploy. "Save & test" does both in one click. A model change on a
 * corpus that already has content is the day-2 re-embed path and is rejected (409) — set the model BEFORE
 * ingest.
 */

"use client";

import { useEffect, useRef, useState } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ModelNamePicker } from "@/components/admin/ModelNamePicker";
import { Button } from "@/components/ui/elements/Button";
import { Card } from "@/components/ui/elements/Card";
import { CONFIG_STATUS_QUERY_KEYS } from "@/lib/api/config-status";
import {
  EMBEDDER_CONFIG_QUERY_KEYS,
  type EmbedderConfigUpdateV1,
  type EmbedderTestResult,
  fetchEmbedderConfig,
  putEmbedderConfig,
  testEmbedderConfig,
} from "@/lib/api/embedder-config";
import { cn } from "@/lib/cn";
import { colors, type as t } from "@/lib/design-tokens";

/** Curated embedding models (openai-compat). Free-text/custom entry is also allowed by the picker, so an
 *  operator can type ANY model their endpoint serves (e.g. a self-hosted name). */
const EMBEDDING_MODELS = [
  "qwen3-embed-0.6b",
  "qwen3-embed-1.7b",
  "mxbai-embed-large",
  "nomic-embed-text",
  "bge-large-en-v1.5",
  "text-embedding-3-small",
  "text-embedding-3-large",
] as const;

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className={cn(t.meta, colors.text.muted, "block mb-1")}>
      {children}
    </label>
  );
}

const INPUT_CLASS = "w-full px-3 py-2 rounded border";

function toErrorMessage(err: unknown): string {
  if (err instanceof DOMException && err.name === "AbortError") {
    return "Timed out — check your connection and try again.";
  }
  return err instanceof Error ? err.message : "Request failed";
}

/** Turn a /test outcome into an operator-friendly line. */
function describeTestResult(r: EmbedderTestResult): string {
  if (r.ok) {
    const dim = r.detected_dimension !== null ? ` (${r.detected_dimension}-dim)` : "";
    return `Validated and activated — the embedder responded${dim}. This model is now used for embedding.`;
  }
  if (r.error === "dimension_mismatch" && r.detected_dimension !== null && r.corpus_dimension !== null) {
    return `Dimension mismatch — the model returns ${r.detected_dimension}-dim vectors but this deployment is sized for ${r.corpus_dimension}. Pick a model with a matching width.`;
  }
  const label =
    r.error === "auth_error"
      ? "Authentication failed — check the API key"
      : r.error === "rate_limited"
        ? "Rate-limited — try again shortly"
        : r.error === "connectivity_error"
          ? "Couldn't reach the embedder — check the base URL"
          : "Validation failed";
  return r.error_detail ? `${label}: ${r.error_detail}` : label;
}

export function EmbedderConfigCard() {
  const queryClient = useQueryClient();
  const configQuery = useQuery({
    queryKey: EMBEDDER_CONFIG_QUERY_KEYS.current(),
    queryFn: fetchEmbedderConfig,
  });

  const [baseUrl, setBaseUrl] = useState<string>("");
  const [modelName, setModelName] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");
  const [keyless, setKeyless] = useState<boolean>(false);
  const [enabled, setEnabled] = useState<boolean>(true);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<EmbedderTestResult | null>(null);

  // Hydrate the non-secret fields from the GET ONCE (the key stays empty — write-only). Hydrate-once via a
  // ref so a post-save refetch can't clobber in-progress edits.
  const hydrated = useRef(false);
  useEffect(() => {
    const cfg = configQuery.data;
    if (!hydrated.current && cfg && cfg.base_url !== null) {
      setBaseUrl(cfg.base_url);
      setModelName(cfg.model_name ?? "");
      setEnabled(cfg.enabled);
      // Configured with no stored key ⇒ a keyless embedder.
      setKeyless(!cfg.key_present);
      hydrated.current = true;
    }
  }, [configQuery.data]);

  function clearStatus(): void {
    setSaveSuccess(false);
    setSaveError(null);
    setTestResult(null);
  }

  /** Build the PUT body. api_key tri-state: keyless → null (clear); a typed key → set; blank → omit (keep). */
  function buildUpdate(): EmbedderConfigUpdateV1 {
    const base: EmbedderConfigUpdateV1 = { base_url: baseUrl.trim(), model_name: modelName.trim(), enabled };
    if (keyless) return { ...base, api_key: null };
    if (apiKey.trim() !== "") return { ...base, api_key: apiKey };
    return base; // keep the existing key
  }

  async function save(): Promise<boolean> {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await putEmbedderConfig(buildUpdate());
      setApiKey("");
      setSaveSuccess(true);
      await queryClient.invalidateQueries({ queryKey: EMBEDDER_CONFIG_QUERY_KEYS.all });
      await queryClient.invalidateQueries({ queryKey: CONFIG_STATUS_QUERY_KEYS.all });
      return true;
    } catch (err: unknown) {
      setSaveError(toErrorMessage(err));
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function test(): Promise<void> {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testEmbedderConfig();
      setTestResult(result);
      await queryClient.invalidateQueries({ queryKey: EMBEDDER_CONFIG_QUERY_KEYS.all });
      await queryClient.invalidateQueries({ queryKey: CONFIG_STATUS_QUERY_KEYS.all });
    } finally {
      setIsTesting(false);
    }
  }

  async function handleSave(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    await save();
  }

  // Save THEN test (stage → probe → promote) in one click — the common path.
  async function handleSaveAndTest(): Promise<void> {
    if (await save()) await test();
  }

  const cfg = configQuery.data;
  const configured = cfg !== undefined && cfg.base_url !== null;
  const validation = cfg?.last_validation_status ?? null;
  const canSave = baseUrl.trim() !== "" && modelName.trim() !== "" && !isSaving && !isTesting;

  return (
    <Card padding="md" data-testid="embedder-config-card">
      <h2 className={cn(t.h2, colors.text.primary)}>Embedding model</h2>
      <p
        className={cn("mt-1", t.body, configQuery.isError ? colors.status.down : colors.text.muted)}
        data-testid="embedder-config-status"
      >
        {configQuery.isLoading
          ? "Loading the current embedder configuration…"
          : configQuery.isError
            ? "Couldn't load the current embedder configuration (it may still be set). You can (re)enter it below."
            : configured
              ? validation === "ok"
                ? `Active — ${cfg?.model_name} at ${cfg?.base_url}. This model is used for embedding.`
                : validation === "failed"
                  ? `Saved but the last test FAILED${cfg?.last_validation_error ? ` (${cfg.last_validation_error})` : ""}. Fix and re-test.`
                  : `Saved but not yet tested — run Test to validate and activate ${cfg?.model_name}.`
              : "Not configured — set the base URL + model, then Test to activate semantic embedding."}
      </p>

      <form onSubmit={(e) => void handleSave(e)} className="mt-4 space-y-3">
        <div>
          <FieldLabel htmlFor="emb-base-url">Base URL</FieldLabel>
          <input
            id="emb-base-url"
            type="text"
            value={baseUrl}
            onChange={(e) => {
              setBaseUrl(e.target.value);
              clearStatus();
            }}
            placeholder="http://embedder.internal:8080/v1"
            required
            autoComplete="off"
            className={cn(INPUT_CLASS, colors.divider, colors.bg.surface, t.body)}
          />
        </div>

        <div>
          <ModelNamePicker value={modelName} onChange={(m) => { setModelName(m); clearStatus(); }} options={EMBEDDING_MODELS} />
          <p className={cn("mt-1", t.caption, colors.text.faint)} data-testid="embedder-model-note">
            Pick a curated model or type any model your endpoint serves. The model you save + Test is what
            gets used for embedding — change it BEFORE ingesting content.
          </p>
        </div>

        <div>
          <FieldLabel htmlFor="emb-api-key">API key</FieldLabel>
          <input
            id="emb-api-key"
            type="password"
            value={apiKey}
            disabled={keyless}
            onChange={(e) => {
              setApiKey(e.target.value);
              clearStatus();
            }}
            autoComplete="off"
            placeholder={
              keyless ? "Keyless — no API key sent" : configured && cfg?.key_present ? "•••••••• (leave blank to keep)" : undefined
            }
            className={cn(INPUT_CLASS, colors.divider, colors.bg.surface, t.body, keyless && "opacity-50")}
          />
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={keyless}
            onChange={(e) => {
              setKeyless(e.target.checked);
              clearStatus();
            }}
          />
          <span className={cn(t.body, colors.text.primary)}>
            Keyless <span className={colors.text.faint}>(in-cluster Ollama / vLLM — no API key)</span>
          </span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked);
              clearStatus();
            }}
          />
          <span className={cn(t.body, colors.text.primary)}>Enabled</span>
        </label>

        {saveError ? (
          <p className={cn(t.meta, colors.status.down)} data-testid="embedder-config-error">
            {saveError}
          </p>
        ) : null}
        {saveSuccess && !isSaving && testResult === null ? (
          <p className={cn(t.meta, colors.status.healthy)} data-testid="embedder-config-success">
            Saved — run Test to validate and activate this model.
          </p>
        ) : null}
        {testResult ? (
          <p
            className={cn(t.meta, testResult.ok ? colors.status.healthy : colors.status.down)}
            data-testid="embedder-config-test-result"
          >
            {testResult.ok ? "✓ " : "✗ "}
            {describeTestResult(testResult)}
          </p>
        ) : null}

        <div className="flex gap-2">
          <Button type="submit" variant="secondary" disabled={!canSave}>
            {isSaving ? "Saving…" : "Save"}
          </Button>
          <Button type="button" disabled={!canSave} onClick={() => void handleSaveAndTest()}>
            {isTesting ? "Testing…" : "Save & test"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
