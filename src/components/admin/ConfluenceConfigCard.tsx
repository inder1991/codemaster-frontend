/**
 * ConfluenceConfigCard — UI-editable Confluence credentials (go-live Step 4c). GET shows the non-secret
 * view (configured + base URL + auth email + enabled); the API token is write-only (never echoed, cleared
 * after save). Leave the auth email blank for a Server/DC Bearer PAT; set it for Atlassian Cloud (HTTP-Basic).
 * On save the runtime picks the new creds up (DB > env > Vault) without a redeploy. super_admin only.
 * Mirrors GitHubConfigCard.
 */

"use client";

import { useEffect, useState } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/elements/Button";
import { Card } from "@/components/ui/elements/Card";
import { CONFIG_STATUS_QUERY_KEYS } from "@/lib/api/config-status";
import {
  CONFLUENCE_CONFIG_QUERY_KEYS,
  fetchConfluenceConfig,
  putConfluenceConfig,
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

  // Prefill the non-secret fields from the GET; the token stays empty (write-only — re-enter to rotate).
  useEffect(() => {
    if (configQuery.data?.configured) {
      setBaseUrl(configQuery.data.baseUrl ?? "");
      setAuthEmail(configQuery.data.authEmail ?? "");
      setEnabled(configQuery.data.enabled ?? true);
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
        token,
        enabled,
      });
      setToken("");
      setSaveSuccess(true);
      await queryClient.invalidateQueries({ queryKey: CONFLUENCE_CONFIG_QUERY_KEYS.all });
      await queryClient.invalidateQueries({ queryKey: CONFIG_STATUS_QUERY_KEYS.all });
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  }

  const canSave = baseUrl.trim() !== "" && token.trim() !== "" && !isSaving;
  const configured = configQuery.data?.configured === true;

  return (
    <Card padding="md" data-testid="confluence-config-card">
      <h2 className={cn(t.h2, colors.text.primary)}>Confluence</h2>
      <p className={cn("mt-1", t.body, colors.text.muted)}>
        {configured
          ? `Configured (${configQuery.data?.baseUrl ?? "?"}). Re-enter the API token to rotate.`
          : "Not configured — add the Confluence base URL + API token to enable knowledge ingestion."}
      </p>

      <form onSubmit={handleSave} className="mt-4 space-y-3">
        <div>
          <FieldLabel htmlFor="cf-base-url">Base URL</FieldLabel>
          <input
            id="cf-base-url"
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
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
            onChange={(e) => setAuthEmail(e.target.value)}
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
            onChange={(e) => setToken(e.target.value)}
            required
            autoComplete="off"
            className={cn(INPUT_CLASS, colors.divider, colors.bg.surface, t.body)}
          />
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span className={cn(t.body, colors.text.primary)}>Enabled</span>
        </label>

        {saveError ? (
          <p className={cn(t.meta, colors.status.down)} data-testid="confluence-config-error">
            {saveError}
          </p>
        ) : null}
        {saveSuccess ? (
          <p className={cn(t.meta, colors.status.healthy)} data-testid="confluence-config-success">
            Saved — the runtime will pick up the new credentials.
          </p>
        ) : null}

        <Button type="submit" disabled={!canSave}>
          {isSaving ? "Saving…" : "Save Confluence config"}
        </Button>
      </form>
    </Card>
  );
}
