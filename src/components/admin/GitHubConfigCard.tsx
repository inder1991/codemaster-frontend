/**
 * GitHubConfigCard — UI-editable GitHub App credentials (go-live Step 7c). GET shows the non-secret view
 * (configured + App ID + enabled); the private key + webhook secret are write-only (never echoed). On save
 * the runtime picks the new creds up (DB > env > Vault) without a redeploy. super_admin only (PUT 403s
 * otherwise — surfaced as a save error). Mirrors LlmProviderCard's manual save-state pattern.
 */

"use client";

import { useEffect, useState } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/elements/Button";
import { Card } from "@/components/ui/elements/Card";
import { CONFIG_STATUS_QUERY_KEYS } from "@/lib/api/config-status";
import {
  GITHUB_CONFIG_QUERY_KEYS,
  fetchGitHubConfig,
  putGitHubConfig,
} from "@/lib/api/github-config";
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

export function GitHubConfigCard() {
  const queryClient = useQueryClient();
  const configQuery = useQuery({
    queryKey: GITHUB_CONFIG_QUERY_KEYS.current(),
    queryFn: fetchGitHubConfig,
  });

  const [appId, setAppId] = useState<string>("");
  const [privateKeyPem, setPrivateKeyPem] = useState<string>("");
  const [webhookSecret, setWebhookSecret] = useState<string>("");
  const [enabled, setEnabled] = useState<boolean>(true);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Prefill the non-secret fields from the GET; the key + webhook stay empty (write-only — re-enter to rotate).
  useEffect(() => {
    if (configQuery.data?.configured) {
      setAppId(configQuery.data.appId ?? "");
      setEnabled(configQuery.data.enabled ?? true);
    }
  }, [configQuery.data]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await putGitHubConfig({
        app_id: appId.trim(),
        private_key_pem: privateKeyPem,
        webhook_secret: webhookSecret,
        enabled,
      });
      setPrivateKeyPem("");
      setWebhookSecret("");
      setSaveSuccess(true);
      await queryClient.invalidateQueries({ queryKey: GITHUB_CONFIG_QUERY_KEYS.all });
      await queryClient.invalidateQueries({ queryKey: CONFIG_STATUS_QUERY_KEYS.all });
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  }

  const canSave =
    appId.trim() !== "" &&
    privateKeyPem.trim() !== "" &&
    webhookSecret.trim() !== "" &&
    !isSaving;

  const configured = configQuery.data?.configured === true;

  return (
    <Card padding="md" data-testid="github-config-card">
      <h2 className={cn(t.h2, colors.text.primary)}>GitHub App</h2>
      <p
        className={cn("mt-1", t.body, configQuery.isError ? colors.status.down : colors.text.muted)}
        data-testid="github-config-status"
      >
        {configQuery.isLoading
          ? "Loading the current GitHub configuration…"
          : configQuery.isError
            ? "Couldn't load the current GitHub configuration (it may still be set). You can (re)enter it below."
            : configured
              ? `Configured (App ID ${configQuery.data?.appId ?? "?"}). Re-enter the private key + webhook secret to rotate.`
              : "Not configured — paste the GitHub App credentials to enable PR reviews + webhooks."}
      </p>

      <form onSubmit={handleSave} className="mt-4 space-y-3">
        <div>
          <FieldLabel htmlFor="gh-app-id">App ID</FieldLabel>
          <input
            id="gh-app-id"
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            placeholder="123456"
            required
            className={cn(INPUT_CLASS, colors.divider, colors.bg.surface, t.body)}
          />
        </div>
        <div>
          <FieldLabel htmlFor="gh-pem">Private key (PEM)</FieldLabel>
          <textarea
            id="gh-pem"
            value={privateKeyPem}
            onChange={(e) => setPrivateKeyPem(e.target.value)}
            rows={5}
            required
            placeholder="-----BEGIN RSA PRIVATE KEY-----"
            className={cn(INPUT_CLASS, "font-mono", colors.divider, colors.bg.surface, t.meta)}
          />
        </div>
        <div>
          <FieldLabel htmlFor="gh-webhook">Webhook secret</FieldLabel>
          <input
            id="gh-webhook"
            type="password"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
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
          <p className={cn(t.meta, colors.status.down)} data-testid="github-config-error">
            {saveError}
          </p>
        ) : null}
        {saveSuccess ? (
          <p className={cn(t.meta, colors.status.healthy)} data-testid="github-config-success">
            Saved — the runtime will pick up the new credentials.
          </p>
        ) : null}

        <Button type="submit" disabled={!canSave}>
          {isSaving ? "Saving…" : "Save GitHub config"}
        </Button>
      </form>
    </Card>
  );
}
