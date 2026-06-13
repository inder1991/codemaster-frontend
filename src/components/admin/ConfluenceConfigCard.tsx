/**
 * ConfluenceConfigCard — UI-editable Confluence credentials (go-live Step 4c). GET shows the non-secret
 * view (configured + base URL + auth email + enabled); the API token is write-only (never echoed, cleared
 * after save). Leave the auth email blank for a Server/DC Bearer PAT; set it for Atlassian Cloud (HTTP-Basic).
 * On save the runtime picks the new creds up (DB > env > Vault) without a redeploy. super_admin only.
 * Mirrors GitHubConfigCard.
 */

"use client";

import { useEffect, useRef, useState } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/elements/Button";
import { Card } from "@/components/ui/elements/Card";
import { CONFIG_STATUS_QUERY_KEYS } from "@/lib/api/config-status";
import {
  CONFLUENCE_CONFIG_QUERY_KEYS,
  type ConfluenceTestResult,
  fetchConfluenceConfig,
  putConfluenceConfig,
  testConfluenceConfig,
} from "@/lib/api/confluence-config";
import { cn } from "@/lib/cn";
import { colors, type as t } from "@/lib/design-tokens";

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className={cn(t.meta, colors.text.muted, "block mb-1")}>
      {children}
    </label>
  );
}

const INPUT_CLASS = "w-full px-3 py-2 rounded border";

/** Map a thrown save error to an operator-friendly message — a fetch-timeout aborts with a DOMException
 *  whose message is misleading; surface a clear timeout instead. */
function toSaveErrorMessage(err: unknown): string {
  if (err instanceof DOMException && err.name === "AbortError") {
    return "Save timed out — check your connection and try again.";
  }
  return err instanceof Error ? err.message : "Save failed";
}

export function ConfluenceConfigCard() {
  const queryClient = useQueryClient();
  const configQuery = useQuery({
    queryKey: CONFLUENCE_CONFIG_QUERY_KEYS.current(),
    queryFn: fetchConfluenceConfig,
  });

  const [baseUrl, setBaseUrl] = useState<string>("");
  const [authEmail, setAuthEmail] = useState<string>("");
  const [token, setToken] = useState<string>("");
  const [enabled, setEnabled] = useState<boolean>(true);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<ConfluenceTestResult | null>(null);

  // Prefill the non-secret fields from the GET ONCE (the token stays empty — write-only, re-enter to rotate).
  // Hydrate-once via a ref: deps on [configQuery.data] would re-run on every refetch (post-save invalidation,
  // or a remount after staleTime) and CLOBBER the operator's in-progress edits to these fields.
  const hydrated = useRef(false);
  useEffect(() => {
    if (!hydrated.current && configQuery.data?.configured) {
      setBaseUrl(configQuery.data.baseUrl ?? "");
      setAuthEmail(configQuery.data.authEmail ?? "");
      setEnabled(configQuery.data.enabled ?? true);
      hydrated.current = true;
    }
  }, [configQuery.data]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const trimmedEmail = authEmail.trim();
      await putConfluenceConfig({
        base_url: baseUrl.trim(),
        // Omit (Bearer PAT) vs send (Cloud HTTP-Basic) — exactOptionalPropertyTypes-friendly.
        ...(trimmedEmail !== "" ? { auth_email: trimmedEmail } : {}),
        // Partial update: send the token only when (re)entered; omit to keep the stored one (the backend
        // keeps the existing ciphertext) while toggling enabled / editing the URL.
        ...(token.trim() !== "" ? { token } : {}),
        enabled,
      });
      setToken("");
      setSaveSuccess(true);
      await queryClient.invalidateQueries({ queryKey: CONFLUENCE_CONFIG_QUERY_KEYS.all });
      await queryClient.invalidateQueries({ queryKey: CONFIG_STATUS_QUERY_KEYS.all });
    } catch (err: unknown) {
      setSaveError(toSaveErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  // Clear a stale Saved/error banner + test result the moment the operator edits a field (review P2).
  function clearSaveStatus(): void {
    setSaveSuccess(false);
    setSaveError(null);
    setTestResult(null);
  }

  // Connectivity probe — tests the entered base_url + token WITHOUT persisting. Never throws (the client
  // surfaces {ok:false,message}, incl. a clear note when the probe is unwired in this deployment).
  async function handleTest(): Promise<void> {
    setIsTesting(true);
    setTestResult(null);
    try {
      setTestResult(await testConfluenceConfig({ base_url: baseUrl.trim(), token }));
    } finally {
      setIsTesting(false);
    }
  }

  const configured = configQuery.data?.configured === true;
  // When already configured the token is optional (omit to keep it); only base_url required. Initial config
  // requires the token.
  const canSave = baseUrl.trim() !== "" && (configured || token.trim() !== "") && !isSaving;
  // Test always needs both creds in-hand (it can't use the stored token).
  const canTest = baseUrl.trim() !== "" && token.trim() !== "" && !isTesting && !isSaving;

  return (
    <Card padding="md" data-testid="confluence-config-card">
      <h2 className={cn(t.h2, colors.text.primary)}>Confluence</h2>
      <p
        className={cn("mt-1", t.body, configQuery.isError ? colors.status.down : colors.text.muted)}
        data-testid="confluence-config-status"
      >
        {configQuery.isLoading
          ? "Loading the current Confluence configuration…"
          : configQuery.isError
            ? "Couldn't load the current Confluence configuration (it may still be set). You can (re)enter it below."
            : configured
              ? `Configured (${configQuery.data?.baseUrl ?? "?"}). Leave the token blank to keep it; re-enter to rotate.`
              : "Not configured — add the Confluence base URL + API token to enable knowledge ingestion."}
      </p>

      <form onSubmit={handleSave} className="mt-4 space-y-3">
        <div>
          <FieldLabel htmlFor="cf-base-url">Base URL</FieldLabel>
          <input
            id="cf-base-url"
            type="url"
            value={baseUrl}
            onChange={(e) => {
              setBaseUrl(e.target.value);
              clearSaveStatus();
            }}
            placeholder="https://acme.atlassian.net/wiki"
            required
            className={cn(INPUT_CLASS, colors.divider, colors.bg.surface, t.body)}
          />
        </div>
        <div>
          <FieldLabel htmlFor="cf-auth-email">
            Auth email <span className={colors.text.faint}>(Atlassian Cloud only — blank for Server/DC PAT)</span>
          </FieldLabel>
          <input
            id="cf-auth-email"
            type="email"
            value={authEmail}
            onChange={(e) => {
              setAuthEmail(e.target.value);
              clearSaveStatus();
            }}
            placeholder="bot@acme.com"
            autoComplete="off"
            className={cn(INPUT_CLASS, colors.divider, colors.bg.surface, t.body)}
          />
        </div>
        <div>
          <FieldLabel htmlFor="cf-token">API token</FieldLabel>
          <input
            id="cf-token"
            type="password"
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
              clearSaveStatus();
            }}
            required={!configured}
            autoComplete="off"
            placeholder={configured ? "•••••••• (leave blank to keep)" : undefined}
            className={cn(INPUT_CLASS, colors.divider, colors.bg.surface, t.body)}
          />
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked);
              clearSaveStatus();
            }}
          />
          <span className={cn(t.body, colors.text.primary)}>Enabled</span>
        </label>

        {saveError ? (
          <p className={cn(t.meta, colors.status.down)} data-testid="confluence-config-error">
            {saveError}
          </p>
        ) : null}
        {saveSuccess && !isSaving ? (
          <p className={cn(t.meta, colors.status.healthy)} data-testid="confluence-config-success">
            Saved — the runtime will pick up the new credentials.
          </p>
        ) : null}
        {testResult ? (
          <p
            className={cn(t.meta, testResult.ok ? colors.status.healthy : colors.status.down)}
            data-testid="confluence-config-test-result"
          >
            {testResult.ok ? "✓ " : "✗ "}
            {testResult.message}
          </p>
        ) : null}

        <div className="flex gap-2">
          <Button type="submit" disabled={!canSave}>
            {isSaving ? "Saving…" : "Save Confluence config"}
          </Button>
          <Button type="button" variant="secondary" disabled={!canTest} onClick={() => void handleTest()}>
            {isTesting ? "Testing…" : "Test connection"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
