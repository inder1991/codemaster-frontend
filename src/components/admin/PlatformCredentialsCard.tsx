/**
 * Task 5.3 — Reusable platform-credentials card.
 *
 * Generic card supporting both Vault-backed credential providers
 * (`confluence` and `embedder.qwen`). Consumed by:
 *   - T5.7 `/integrations` page (provider="confluence")
 *   - T5.8 `/admin/llm` Embedding tab (provider="embedder.qwen" +
 *     extraFields=<ModelNamePicker>)
 *
 * UX contract (spec §9):
 *
 *   • Meta header surfaces last-rotated + last-validated timestamps
 *     and a Configured / Not configured badge derived from
 *     `meta.token_present`.
 *
 *   • Form fields:
 *       - base_url (text)
 *       - extraFields slot (optional — used for ModelNamePicker on Qwen)
 *       - token (password)
 *
 *   • Actions:
 *       - Save → PATCH /api/admin/platform-credentials/{provider}.
 *         Disabled when both base_url and token are empty.
 *         Empty token + non-empty base_url ⇒ rotate URL only.
 *         Non-empty token ⇒ rotate Vault.
 *
 *       - Test connection → POST .../test. Re-runs the upstream probe
 *         against the currently stored credentials. NEVER writes Vault.
 *         Always enabled when `meta.token_present === true`.
 *
 *   • Result banners:
 *       - Green: PATCH success or test-success-with-latency.
 *       - Red:   wire error_code mapped to human-friendly message via
 *               `_PATCH_ERROR_MESSAGES` / `_TEST_ERROR_MESSAGES`.
 */

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/elements/Button";
import { Card } from "@/components/ui/elements/Card";
import {
  fetchPlatformCredentialsMeta,
  patchPlatformCredentials,
  PLATFORM_CREDENTIALS_QUERY_KEYS,
  PlatformCredentialPatchError,
  testPlatformCredentials,
  type PatchPlatformCredentialsRequestV1,
  type PlatformCredentialProvider,
  type PlatformCredentialsMetaV1,
  type TestPlatformCredentialsResponseV1,
} from "@/lib/api/admin-platform-credentials";
import { cn } from "@/lib/cn";
import { colors, type as t } from "@/lib/design-tokens";

// ── Provider-specific copy ────────────────────────────────────────

const _PROVIDER_TITLE: Record<PlatformCredentialProvider, string> = {
  confluence: "Confluence credentials",
  "embedder.qwen": "Qwen embedder credentials",
};

const _PROVIDER_URL_PLACEHOLDER: Record<PlatformCredentialProvider, string> = {
  confluence: "https://example.atlassian.net/wiki",
  "embedder.qwen": "https://qwen.internal.platform.com/v1",
};

// ── Error-code → human-message mapping ────────────────────────────

const _PATCH_ERROR_MESSAGES: Record<string, string> = {
  https_required: "URL must use https://.",
  ssrf_blocked: "URL resolves to a private/reserved IP and is blocked.",
  userinfo_not_allowed: "URL must not contain user:password@.",
  dns_resolution_failed: "DNS resolution failed for the hostname.",
  malformed_url: "URL is malformed.",
  dimension_mismatch:
    "Embedding model returns an unexpected dimension; codemaster requires 1024.",
  auth_error: "Authentication failed against the upstream service.",
  rate_limited:
    "Upstream service rate-limited the test request; retry shortly.",
  connectivity_error: "Could not connect to the upstream service.",
  validation_failed: "Test failed; see operator runbook.",
  coverage_gap_present: "Cannot proceed: coverage gap present.",
};

const _TEST_ERROR_MESSAGES: Record<string, string> = {
  auth_error: "Authentication failed against the upstream service.",
  rate_limited:
    "Upstream service rate-limited the test request; retry shortly.",
  connectivity_error: "Could not connect to the upstream service.",
  unknown_model: "Upstream service does not recognise the configured model.",
  dimension_mismatch:
    "Embedding model returns an unexpected dimension; codemaster requires 1024.",
  ssrf_blocked: "URL resolves to a private/reserved IP and is blocked.",
  https_required: "URL must use https://.",
  validation_failed: "Test failed; see operator runbook.",
};

function _formatPatchError(err: unknown): string {
  if (err instanceof PlatformCredentialPatchError) {
    if (err.errorCode !== null) {
      const mapped = _PATCH_ERROR_MESSAGES[err.errorCode];
      if (mapped !== undefined) return mapped;
    }
    return err.errorDetail ?? "Update failed.";
  }
  return err instanceof Error ? err.message : "Update failed.";
}

function _formatTestError(
  response: TestPlatformCredentialsResponseV1,
): string {
  const code = response.error ?? null;
  if (code !== null) {
    const mapped = _TEST_ERROR_MESSAGES[code];
    if (mapped !== undefined) return mapped;
  }
  return response.error_detail ?? "Connection test failed.";
}

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

function TokenPresentBadge({ present }: { present: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded text-sm font-medium border",
        present
          ? cn(
              colors.statusBg.healthy,
              colors.status.healthy,
              "border-green-300",
            )
          : cn(colors.statusBg.dim, colors.status.dim, "border-gray-300"),
      )}
      data-testid="token-present-badge"
    >
      {present ? "Configured" : "Not configured"}
    </span>
  );
}

function MetaRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className={cn(t.meta, colors.text.muted)}>
      <span className="font-medium">{label}:</span>{" "}
      <span data-testid={`meta-${label.toLowerCase().replace(/\s+/g, "-")}`}>
        {value ?? "—"}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────

export interface PlatformCredentialsCardProps {
  /** Canonical credential key. */
  provider: PlatformCredentialProvider;
  /** Optional slot rendered between base_url and token inputs.
   *  Used by the Qwen tab to inject the ModelNamePicker. */
  extraFields?: React.ReactNode;
  /** Optional callback after a successful PATCH (e.g. for parent-level
   *  cache invalidation if the parent needs to react). */
  onPatchSuccess?: () => void;
}

export function PlatformCredentialsCard({
  provider,
  extraFields,
  onPatchSuccess,
}: PlatformCredentialsCardProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const [baseUrl, setBaseUrl] = useState<string>("");
  const [token, setToken] = useState<string>("");
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const metaQuery = useQuery({
    queryKey: PLATFORM_CREDENTIALS_QUERY_KEYS.byProvider(provider),
    queryFn: () => fetchPlatformCredentialsMeta(provider),
  });

  const patchMutation = useMutation({
    mutationFn: (body: PatchPlatformCredentialsRequestV1) =>
      patchPlatformCredentials(provider, body),
    onSuccess: async (data) => {
      setErrorBanner(null);
      setToken(""); // clear secret from memory after rotation/re-validate
      const validatedAt = data.last_validated_at
        ? new Date(data.last_validated_at).toLocaleString()
        : "now";
      setSuccessBanner(`Credentials updated. Last validated at ${validatedAt}.`);
      await queryClient.invalidateQueries({
        queryKey: PLATFORM_CREDENTIALS_QUERY_KEYS.byProvider(provider),
      });
      onPatchSuccess?.();
    },
    onError: (err: unknown) => {
      setSuccessBanner(null);
      setErrorBanner(_formatPatchError(err));
    },
  });

  const testMutation = useMutation({
    mutationFn: () => testPlatformCredentials(provider),
    onSuccess: (response) => {
      if (response.ok) {
        setErrorBanner(null);
        const latency =
          response.latency_ms !== null
            ? ` (${response.latency_ms}ms)`
            : "";
        setSuccessBanner(`Connection test succeeded${latency}.`);
      } else {
        setSuccessBanner(null);
        setErrorBanner(_formatTestError(response));
      }
    },
    onError: (err: unknown) => {
      setSuccessBanner(null);
      setErrorBanner(
        err instanceof Error ? err.message : "Connection test failed.",
      );
    },
  });

  const isLoading = metaQuery.isLoading;
  const meta: PlatformCredentialsMetaV1 | undefined = metaQuery.data;

  const saveDisabled =
    patchMutation.isPending ||
    (baseUrl.trim() === "" && token.trim() === "");
  const testDisabled =
    testMutation.isPending || !meta?.token_present;

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSuccessBanner(null);
    setErrorBanner(null);

    // Only include fields the operator actually filled. Empty token
    // means "re-validate without rotating".
    const body: PatchPlatformCredentialsRequestV1 = { schema_version: 1 };
    if (baseUrl.trim() !== "") body.base_url = baseUrl.trim();
    if (token !== "") body.token = token;
    patchMutation.mutate(body);
  }

  function handleTest() {
    setSuccessBanner(null);
    setErrorBanner(null);
    testMutation.mutate();
  }

  const cardTitle = _PROVIDER_TITLE[provider];
  const baseUrlPlaceholder = _PROVIDER_URL_PLACEHOLDER[provider];
  const cardTestId = `platform-credentials-card-${provider.replace(".", "-")}`;

  return (
    <Card padding="lg" data-testid={cardTestId}>
      <div className="mb-5">
        <h2 className={cn(t.h2, colors.text.primary)}>{cardTitle}</h2>
      </div>

      {/* Meta section */}
      <div className="mb-5 space-y-1">
        {isLoading ? (
          <p
            className={cn(t.meta, colors.text.muted)}
            data-testid="meta-loading"
          >
            Loading credential metadata…
          </p>
        ) : metaQuery.isError ? (
          <p
            className={cn(t.meta, colors.status.down)}
            data-testid="meta-error"
          >
            Could not load credential metadata.
          </p>
        ) : meta ? (
          <>
            <div className="flex items-center gap-x-3">
              <TokenPresentBadge present={meta.token_present} />
              <span className={cn(t.meta, colors.text.muted)}>
                Base URL: {meta.base_url ?? "—"}
              </span>
            </div>
            <MetaRow
              label="Last rotated"
              value={
                meta.last_rotated_at
                  ? `${new Date(meta.last_rotated_at).toLocaleString()}${
                      meta.last_rotated_by ? ` by ${meta.last_rotated_by}` : ""
                    }`
                  : null
              }
            />
            <MetaRow
              label="Last validated"
              value={
                meta.last_validated_at
                  ? new Date(meta.last_validated_at).toLocaleString()
                  : null
              }
            />
            {meta.last_validation_error && (
              <MetaRow
                label="Last validation error"
                value={meta.last_validation_error}
              />
            )}
          </>
        ) : null}
      </div>

      {/* Form */}
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <FieldLabel htmlFor={`${cardTestId}-base-url`}>Base URL</FieldLabel>
          <input
            id={`${cardTestId}-base-url`}
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={baseUrlPlaceholder}
            autoComplete="off"
            className={cn(
              "w-full px-3 py-2 rounded border",
              colors.divider,
              colors.bg.surface,
              t.body,
            )}
            data-testid={`${cardTestId}-base-url-input`}
          />
        </div>

        {extraFields !== undefined && (
          <div data-testid={`${cardTestId}-extra-fields`}>{extraFields}</div>
        )}

        <div>
          <FieldLabel htmlFor={`${cardTestId}-token`}>Token</FieldLabel>
          <input
            id={`${cardTestId}-token`}
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Leave blank to re-validate without rotating"
            autoComplete="off"
            className={cn(
              "w-full px-3 py-2 rounded border font-mono",
              colors.divider,
              colors.bg.surface,
              t.body,
            )}
            data-testid={`${cardTestId}-token-input`}
          />
        </div>

        {/* Banners */}
        {errorBanner && (
          <div
            className={cn(
              t.meta,
              colors.status.down,
              "p-3 rounded border border-red-400",
            )}
            data-testid={`${cardTestId}-error-banner`}
            role="alert"
          >
            {errorBanner}
          </div>
        )}
        {successBanner && (
          <div
            className={cn(
              t.meta,
              colors.status.healthy,
              "p-3 rounded border border-green-400",
            )}
            data-testid={`${cardTestId}-success-banner`}
            role="status"
          >
            {successBanner}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-x-3 flex-wrap gap-y-2">
          <Button
            variant="primary"
            size="md"
            type="submit"
            disabled={saveDisabled}
            data-testid={`${cardTestId}-save-btn`}
          >
            {patchMutation.isPending ? "Saving…" : "Save"}
          </Button>
          <Button
            variant="secondary"
            size="md"
            type="button"
            disabled={testDisabled}
            onClick={handleTest}
            data-testid={`${cardTestId}-test-btn`}
          >
            {testMutation.isPending ? "Testing…" : "Test connection"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
