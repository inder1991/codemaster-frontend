/**
 * Sub-spec C T11+T13 (2026-05-28) — admin host page for the
 * Quarantined-chunks sidebar. Closes the dangling nav href T11
 * created.
 *
 * Renders an integration picker (dropdown of Confluence integrations)
 * + a "View quarantined chunks" button that opens the sidebar with
 * the selected integration_id. Lazy: sidebar renders content only
 * after open=true.
 */

"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { QuarantinedChunksSidebar } from "@/components/confluence/QuarantinedChunksSidebar";
import { Button } from "@/components/ui/elements/Button";
import {
  fetchIntegrations,
  QUERY_KEYS,
  type IntegrationV1,
} from "@/lib/api/admin";
import { useAdminQueryGuards } from "@/lib/api/use-admin-query-guards";
import { cn } from "@/lib/cn";
import { colors, type as t } from "@/lib/design-tokens";

export default function QuarantinedChunksAdminPage() {
  const query = useQuery({
    queryKey: QUERY_KEYS.integrations(),
    queryFn: fetchIntegrations,
  });
  const { guardElement } = useAdminQueryGuards(query, "integrations");

  const [selected, setSelected] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const confluenceIntegrations = useMemo(
    () =>
      (query.data ?? []).filter((i) => i.kind === "confluence_space"),
    [query.data],
  );

  if (guardElement !== null) return guardElement;

  return (
    <div className="space-y-6">
      <header>
        <h1 className={cn(t.display, colors.text.primary)}>
          Quarantined chunks
        </h1>
        <p className={cn(t.body, colors.text.muted)}>
          Inspect Confluence chunks the sync pipeline refused to ingest.
          Triage by editing the source page; the next sync recomputes the
          quarantine state.
        </p>
      </header>

      <div className="flex items-end gap-x-3">
        <div className="flex-1 max-w-md">
          <label
            htmlFor="quarantined-chunks-integration"
            className={cn("block", t.meta, colors.text.primary)}
          >
            Integration
          </label>
          <select
            id="quarantined-chunks-integration"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="mt-1 block w-full rounded-md border-0 py-2 pl-3 pr-10 outline-1 -outline-offset-1 outline-[oklch(80%_0.01_80)] focus:outline-2 focus:-outline-offset-2 focus:outline-[oklch(72%_0.16_65)] sm:text-sm"
          >
            <option value="">Choose an integration…</option>
            {confluenceIntegrations.map((i) => (
              <option key={i.integration_id} value={i.integration_id}>
                {_spaceKeyFromConfig(i)} — {i.integration_id.slice(0, 8)}…
              </option>
            ))}
          </select>
        </div>
        <Button
          onClick={() => setSidebarOpen(true)}
          disabled={selected === ""}
        >
          View quarantined chunks
        </Button>
      </div>

      <QuarantinedChunksSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        integrationId={selected}
      />
    </div>
  );
}

function _spaceKeyFromConfig(i: IntegrationV1): string {
  try {
    const cfg = JSON.parse(i.config_json) as { space_key?: string };
    return cfg.space_key ?? "unknown";
  } catch {
    return "unknown";
  }
}
