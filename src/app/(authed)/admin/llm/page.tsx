/**
 * S21.LLM-DUAL.1 task 13 — rebuilt /admin/llm page for dual-provider support.
 *
 * Phase 0 was a single-card layout targeting Bedrock only.
 * Phase 1 stacks a Primary and Secondary <LlmProviderCard> so super_admins
 * can configure both providers independently.
 *
 * Phase 0 single-card code is preserved (commented) in git history.
 * The page-level suite is LlmProviderConfigPage.test.tsx; per-card behavior
 * is covered by LlmProviderCard.test.tsx.
 *
 * T5.8 (Sprint 26 embedder lifecycle) — wraps the existing dual-card
 * Bedrock/Anthropic UI as the "Inference" tab and adds an "Embedding"
 * tab housing the Qwen platform credentials card + EmbedderLifecyclePanel.
 *
 * v1 note (spec §9): the <ModelNamePicker> rendered as `extraFields` on
 * the Qwen credentials card is operator-facing form input only — it lets
 * the operator visually confirm WHICH model THIS card's credentials
 * support. It is NOT plumbed into the PATCH payload (Vault stores only
 * {base_url, api_key}). The live active model lives in
 * `core.embedder_runtime_state.active_model_name` and is rotated via
 * POST /reembed/start (the embedder workflow updates it).
 */

"use client";

import {
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
} from "@headlessui/react";
import { useState, type JSX } from "react";

import { EmbedderLifecyclePanel } from "@/components/admin/EmbedderLifecyclePanel";
import { LlmJobRoutingCard } from "@/components/admin/LlmJobRoutingCard";
import { LlmModelCatalogCard } from "@/components/admin/LlmModelCatalogCard";
import { LlmProviderCard } from "@/components/admin/LlmProviderCard";
import { ModelNamePicker } from "@/components/admin/ModelNamePicker";
import { PlatformCredentialsCard } from "@/components/admin/PlatformCredentialsCard";
import { cn } from "@/lib/cn";
import { colors, type as t } from "@/lib/design-tokens";

const TABS = ["Inference", "Embedding"] as const;

export default function LlmProviderConfigPage(): JSX.Element {
  // Operator-form-entry only. NOT plumbed into PATCH payload (spec §9).
  // Default to the canonical Qwen 0.6b model; operator can pick from the
  // ModelNamePicker dropdown or type a custom value for visual confirmation.
  const [qwenModelName, setQwenModelName] = useState<string>("qwen3-embed-0.6b");

  return (
    <div className="space-y-8">
      <header>
        <h1 className={cn(t.display, colors.text.primary)}>
          LLM Provider Configuration
        </h1>
        <p className={cn("mt-2 max-w-2xl", t.bodyLarge, colors.text.muted)}>
          Configure inference (review LLM) and embedding (knowledge
          retrieval) providers. Each tab is independent; changes to one
          provider do not affect the other.
        </p>
      </header>

      <TabGroup>
        <TabList
          className={cn(
            "flex gap-x-2 border-b",
            colors.divider,
          )}
          data-testid="llm-config-tablist"
        >
          {TABS.map((tabName) => (
            <Tab
              key={tabName}
              className={({ selected }: { selected: boolean }) =>
                cn(
                  "px-4 py-2 -mb-px border-b-2 outline-none focus:outline-none",
                  t.bodyStrong,
                  selected
                    ? cn(colors.text.accent, "border-current")
                    : cn(
                        colors.text.muted,
                        "border-transparent hover:c-text-primary",
                      ),
                )
              }
              data-testid={`llm-config-tab-${tabName.toLowerCase()}`}
            >
              {tabName}
            </Tab>
          ))}
        </TabList>

        <TabPanels className="mt-6">
          {/* Inference tab — head-of-UX 2-column redesign (2026-05-30).
              LEFT: compact provider credentials cards (short by design).
              RIGHT: model catalog + job routing (where model selection
              actually lives per ADR-0060). Stacks to 1 column below lg. */}
          <TabPanel data-testid="llm-config-panel-inference">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* LEFT column — Providers (compact stacked pair). */}
              <section className="space-y-3" data-testid="inference-providers-col">
                <h2 className={cn(t.h2, colors.text.primary)}>Providers</h2>
                {/* eslint-disable-next-line jsx-a11y/aria-role -- role is a custom prop, not HTML ARIA */}
                <LlmProviderCard role="primary" />
                {/* eslint-disable-next-line jsx-a11y/aria-role -- role is a custom prop, not HTML ARIA */}
                <LlmProviderCard role="secondary" />
              </section>

              {/* RIGHT column — Models (catalog) + Job routing. */}
              <div className="space-y-8" data-testid="inference-models-col">
                {/* ADR-0060 — MODELS section. */}
                <section className="space-y-3">
                  <h2 className={cn(t.h2, colors.text.primary)}>Models</h2>
                  <LlmModelCatalogCard />
                </section>

                {/* ADR-0060 — JOB ROUTING section. */}
                <section className="space-y-3">
                  <h2 className={cn(t.h2, colors.text.primary)}>Job routing</h2>
                  <LlmJobRoutingCard />
                </section>
              </div>
            </div>
          </TabPanel>

          {/* Embedding tab (NEW, T5.8) — Qwen credentials + lifecycle panel. */}
          <TabPanel
            className="space-y-6"
            data-testid="llm-config-panel-embedding"
          >
            <section>
              <PlatformCredentialsCard
                provider="embedder.qwen"
                extraFields={
                  <div className="space-y-2">
                    <ModelNamePicker
                      value={qwenModelName}
                      onChange={setQwenModelName}
                    />
                    <p
                      className={cn(t.caption, colors.text.faint)}
                      data-testid="qwen-model-picker-note"
                    >
                      Operator reference only. Vault stores credentials
                      ({"{base_url, api_key}"}) — the active model is
                      rotated via Start re-embed (below), which updates{" "}
                      <code>embedder_runtime_state.active_model_name</code>.
                    </p>
                  </div>
                }
              />
            </section>
            <section>
              <EmbedderLifecyclePanel />
            </section>
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  );
}
