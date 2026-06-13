/**
 * S21.LLM-DUAL.1 task 13 — per-role LLM provider configuration card.
 * Head-of-UX redesign (2026-05-30) — compacted to a short credentials
 * card; the operator-facing Model ID field is removed.
 *
 * Props:
 *   - role: 'primary' | 'secondary'
 *
 * UX shape (post-redesign):
 *   - Provider dropdown: 'bedrock' | 'anthropic_direct'
 *   - Region input: visible only when provider === 'bedrock'
 *   - API key input: password-style; never echoes existing value
 *   - Test button: hits /api/admin/llm-provider-config/test-credentials
 *     (model-less) with {provider, region?, api_key}; shows green/red badge
 *   - Save button: PUT /api/admin/llm-provider-config with full payload
 *     including role (and a back-compat default model_id, see below)
 *   - Enabled toggle
 *   - Secondary card: permanent notice "Configured but not yet routed;
 *     failover engages in a future milestone."
 *
 * Model selection note (ADR-0060): the operator no longer picks a model
 * here — model selection lives in the catalog / job-routing surface. The
 * PUT contract (`LlmProviderConfigUpdateV1`) STILL requires `model_id`,
 * so Save sends a per-provider back-compat default (DEFAULT_MODEL_ID).
 * This value is NOT operator-chosen and is not surfaced in the UI.
 */

"use client";

import { useState } from "react";

import { Button } from "@/components/ui/elements/Button";
import { Card } from "@/components/ui/elements/Card";
import {
  putLlmProviderConfig,
  testLlmCredentials,
  type LlmProvider,
  type LlmProviderPreflightResult,
  type LlmRole,
} from "@/lib/api/llm-provider-config";
import { cn } from "@/lib/cn";
import { colors, type as t } from "@/lib/design-tokens";

// ── Back-compat default model_id (NOT operator-facing) ────────────
// The PUT contract still requires a model_id satisfying its pattern, but
// model selection moved to the catalog / job-routing surface (ADR-0060).
// Send a valid per-provider default so the contract is satisfied; the
// operator never sees or chooses this value.
const DEFAULT_MODEL_ID: Record<LlmProvider, string> = {
  anthropic_direct: "claude-sonnet-4-6",
  bedrock: "claude-sonnet-4-6",
};
const MIN_API_KEY_LENGTH = 20;

// ── Sub-components ────────────────────────────────────────────────

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(t.meta, colors.text.muted, "block mb-1")}
    >
      {children}
    </label>
  );
}

function FieldInput({
  id,
  type = "text",
  value,
  onChange,
  placeholder,
  required,
  className,
  autoComplete,
}: {
  id: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  autoComplete?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      autoComplete={autoComplete}
      className={cn(
        "w-full px-3 py-2 rounded border",
        colors.divider,
        colors.bg.surface,
        t.body,
        className,
      )}
    />
  );
}

function TestResultBadge({ result }: { result: LlmProviderPreflightResult }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded text-sm font-medium",
        result.ok
          ? cn(colors.statusBg.healthy, colors.status.healthy, "border border-green-300")
          : cn(colors.statusBg.down, colors.status.down, "border border-red-300"),
      )}
      data-testid="llm-test-result-badge"
    >
      {result.ok ? "✓ " : "✗ "}
      {result.message}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────

export interface LlmProviderCardProps {
  role: LlmRole;
}

export function LlmProviderCard({ role }: LlmProviderCardProps) {
  const [provider, setProvider] = useState<LlmProvider>("bedrock");
  const [region, setRegion] = useState<string>("us-east-1");
  const [apiKey, setApiKey] = useState<string>("");
  const [enabled, setEnabled] = useState<boolean>(true);

  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<LlmProviderPreflightResult | null>(null);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const requiresRegion = provider === "bedrock";
  const trimmedApiKey = apiKey.trim();
  const apiKeyValid = trimmedApiKey.length >= MIN_API_KEY_LENGTH;
  const cardTitle =
    role === "primary" ? "Primary LLM Provider" : "Secondary LLM Provider";
  const roleTestId = role === "primary" ? "primary" : "secondary";

  // When provider changes: clear the test result (stale for the new
  // provider) and any prior save feedback.
  function handleProviderChange(newProvider: LlmProvider) {
    setProvider(newProvider);
    setTestResult(null);
    setSaveSuccess(false);
    setSaveError(null);
  }

  async function handleTest() {
    if (!apiKeyValid) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testLlmCredentials({
        schema_version: 1,
        provider,
        // Bedrock carries a region; anthropic_direct omits it entirely.
        ...(requiresRegion ? { region } : {}),
        api_key: trimmedApiKey,
      });
      setTestResult(result);
    } catch {
      setTestResult({ ok: false, message: "Test request failed unexpectedly" });
    } finally {
      setIsTesting(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKeyValid) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await putLlmProviderConfig({
        schema_version: 1,
        provider,
        role,
        // Back-compat default — model selection is not chosen here
        // (it lives in the catalog / job-routing per ADR-0060). The PUT
        // contract still requires a model_id, so send a valid default.
        model_id: DEFAULT_MODEL_ID[provider],
        region: requiresRegion ? region : null,
        api_key: trimmedApiKey,
        enabled,
      });
      setApiKey("");
      setSaveSuccess(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Save failed";
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card padding="md" data-testid={`llm-provider-card-${roleTestId}`}>
      {/* Card header */}
      <div className="mb-3">
        <h2 className={cn(t.h2, colors.text.primary)}>{cardTitle}</h2>
        {role === "secondary" && (
          <p
            className={cn(
              "mt-1 text-sm rounded px-3 py-2 border",
              colors.statusBg.info,
              colors.status.info,
              "border-blue-200",
            )}
            data-testid="secondary-card-notice"
          >
            Configured but not yet routed; failover engages in a future milestone.
          </p>
        )}
      </div>

      {/* Form */}
      <form onSubmit={handleSave} className="space-y-3">
        {/* Provider dropdown */}
        <div>
          <FieldLabel htmlFor={`${roleTestId}-provider`}>Provider</FieldLabel>
          <select
            id={`${roleTestId}-provider`}
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value as LlmProvider)}
            className={cn(
              "w-full px-3 py-2 rounded border",
              colors.divider,
              colors.bg.surface,
              t.body,
            )}
            data-testid={`${roleTestId}-provider-select`}
          >
            <option value="bedrock">AWS Bedrock</option>
            <option value="anthropic_direct">Anthropic Direct (api.anthropic.com)</option>
          </select>
        </div>

        {/* Model ID is no longer an operator field — model selection lives
            in the catalog / job-routing surface (ADR-0060). The Save PUT
            sends a back-compat DEFAULT_MODEL_ID for contract satisfaction. */}

        {/* Region input — bedrock only */}
        {requiresRegion && (
          <div data-testid={`${roleTestId}-region-field`}>
            <FieldLabel htmlFor={`${roleTestId}-region`}>AWS Region</FieldLabel>
            <FieldInput
              id={`${roleTestId}-region`}
              value={region}
              onChange={setRegion}
              placeholder="us-east-1"
              required
            />
          </div>
        )}

        {/* API key — password style, never echoes existing value */}
        <div>
          <FieldLabel htmlFor={`${roleTestId}-api-key`}>
            API Key
            {provider === "bedrock"
              ? " (AWS_BEARER_TOKEN_BEDROCK)"
              : " (Anthropic API key)"}
          </FieldLabel>
          <FieldInput
            id={`${roleTestId}-api-key`}
            type="password"
            value={apiKey}
            onChange={setApiKey}
            placeholder="sk-ant-... or bedrock-api-key-..."
            autoComplete="off"
            className="font-mono"
          />
        </div>

        {/* Enabled toggle */}
        <div className="flex items-center gap-x-2">
          <input
            id={`${roleTestId}-enabled`}
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="size-4"
            data-testid={`${roleTestId}-enabled-checkbox`}
          />
          <label
            htmlFor={`${roleTestId}-enabled`}
            className={cn(t.body, colors.text.primary)}
          >
            Enabled
          </label>
        </div>

        {/* Test button + result */}
        <div className="flex items-center gap-x-3 flex-wrap gap-y-2">
          <Button
            variant="secondary"
            size="sm"
            type="button"
            disabled={isTesting || !apiKeyValid}
            onClick={handleTest}
            data-testid={`${roleTestId}-test-btn`}
          >
            {isTesting ? "Testing…" : "Test connection"}
          </Button>
          {testResult !== null && <TestResultBadge result={testResult} />}
        </div>

        {/* Save feedback */}
        {saveError && (
          <div
            className={cn(t.meta, colors.status.down, "p-3 rounded border border-red-400")}
            data-testid={`${roleTestId}-save-error`}
          >
            {saveError}
          </div>
        )}
        {saveSuccess && !isSaving && (
          <div
            className={cn(
              t.meta,
              colors.status.healthy,
              "p-3 rounded border border-green-400",
            )}
            data-testid={`${roleTestId}-save-success`}
          >
            Saved. Worker will pick up new credentials within ~5 min.
          </div>
        )}

        {/* Save button */}
        <Button
          variant="primary"
          size="sm"
          type="submit"
          disabled={isSaving || !apiKeyValid}
          data-testid={`${roleTestId}-save-btn`}
        >
          {isSaving ? "Saving…" : "Save"}
        </Button>
      </form>
    </Card>
  );
}
