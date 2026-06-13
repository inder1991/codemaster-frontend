/**
 * Go-live Setup page — the operator's "what's left to configure" checklist, backed by
 * GET /api/admin/config-status. Non-blocking by design: the platform is already running (only DB + the
 * field-encryption key gate boot), so this surfaces which integrations (GitHub / Confluence / auth / LLM)
 * are configured and from which source (db = UI-saved, env, file), never any secret value.
 *
 * super_admin only (matches the /admin/llm precedent + the backend allow-list); the backend's own 403 is
 * the enforcement boundary, surfaced via useAdminQueryGuards.
 */

"use client";

import { CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { useQuery } from "@tanstack/react-query";

import { GitHubConfigCard } from "@/components/admin/GitHubConfigCard";
import { Card } from "@/components/ui/elements/Card";
import {
  CONFIG_STATUS_QUERY_KEYS,
  fetchConfigStatus,
  type ConfigStatusItem,
} from "@/lib/api/config-status";
import { useAdminQueryGuards } from "@/lib/api/use-admin-query-guards";
import { cn } from "@/lib/cn";
import { colors, type as t } from "@/lib/design-tokens";

// Friendly labels for the backend's stable keys (fall back to the raw key for anything new).
const LABELS: Record<string, string> = {
  "github_app.app_id": "GitHub App ID",
  "github_app.private_key_pem": "GitHub App private key",
  "github_app.webhook_secret": "GitHub webhook secret",
  "confluence.token": "Confluence API token",
  "api_auth.session_signing_key": "Session signing key",
  "api_auth.csrf_secret": "CSRF secret",
  "llm.provider": "LLM provider",
};

export default function SetupPage() {
  const query = useQuery({
    queryKey: CONFIG_STATUS_QUERY_KEYS.list(),
    queryFn: fetchConfigStatus,
    refetchInterval: 30_000,
  });
  const guard = useAdminQueryGuards(query, "config-status");

  if (guard.guardElement) {
    return <>{guard.guardElement}</>;
  }
  if (!query.data) {
    return <></>;
  }

  const items = query.data;
  const pending = items.filter((i) => i.state === "pending").length;

  return (
    <div className="space-y-8">
      <header>
        <h1 className={cn(t.display, colors.text.primary)}>Setup</h1>
        <p className={cn("mt-2 max-w-2xl", t.bodyLarge, colors.text.muted)}>
          Non-blocking feature configuration — the platform is already running regardless. These are the
          integrations you can configure (via this UI, environment, or Vault) to light up features.
          {pending === 0
            ? " Everything is configured."
            : ` ${pending} item${pending === 1 ? "" : "s"} still pending.`}
        </p>
      </header>

      <Card padding="lg">
        <h2 className={cn(t.h2, colors.text.primary)}>Configuration checklist</h2>
        <p className={cn("mt-1", t.body, colors.text.muted)}>
          A source of <code>db</code> means it was saved here in the UI; <code>env</code>/<code>file</code>{" "}
          means it was provisioned at deploy time. Secret values are never shown.
        </p>
        <ul className="mt-5 space-y-3" data-testid="config-status-list">
          {items.map((item) => (
            <ChecklistRow key={item.key} item={item} />
          ))}
        </ul>
      </Card>

      {/* Configure GitHub here (writes the platform singleton; the checklist above reflects it on save). */}
      <GitHubConfigCard />
    </div>
  );
}

function ChecklistRow({ item }: { item: ConfigStatusItem }) {
  const configured = item.state === "configured";
  const Icon = configured ? CheckCircleIcon : ExclamationTriangleIcon;
  return (
    <li
      className="flex items-start gap-x-3"
      data-testid={`config-status-row-${item.key}`}
    >
      <span
        className={cn(
          "inline-flex shrink-0 mt-0.5",
          configured ? colors.status.healthy : colors.status.degraded,
        )}
      >
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <div className="min-w-0">
        <span className={cn(t.body, colors.text.primary)}>{LABELS[item.key] ?? item.key}</span>
        {item.gates ? <p className={cn(t.meta, colors.text.muted)}>{item.gates}</p> : null}
      </div>
      <span
        className={cn(
          "ml-auto whitespace-nowrap",
          t.meta,
          configured ? colors.text.muted : colors.status.degraded,
        )}
      >
        {configured ? `configured · ${item.source}` : "pending"}
      </span>
    </li>
  );
}
