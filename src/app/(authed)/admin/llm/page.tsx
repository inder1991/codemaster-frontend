/**
 * S21.LLM-DUAL.1 task 13 — rebuilt /admin/llm page for dual-provider support.
 *
 * Phase 0 was a single-card layout targeting Bedrock only.
 * Phase 1 stacks a Primary and Secondary <LlmProviderCard> so super_admins
 * can configure both providers independently.
 *
 * T5.8 (Sprint 26 embedder lifecycle) — wraps the existing dual-card
 * Bedrock/Anthropic UI as the "Inference" tab and adds an "Embedding"
 * tab housing the Qwen platform credentials card + EmbedderLifecyclePanel.
 *
 * PART 3 layout redesign — uses <SettingsSection> rail layout replacing the
 * old 2-column grid. Three sections in the Inference tab:
 *   - "Providers" → the two LlmProviderCards.
 *   - "Model catalog" → LlmModelCatalogCard.
 *   - "Job routing" → LlmJobRoutingCard.
 * Two sections in the Embedding tab:
 *   - "Platform credentials" → PlatformCredentialsCard.
 *   - "Re-embed lifecycle" → EmbedderLifecyclePanel.
 *
 * PART 2 — lifted model list: the page owns `models` + `refreshModels` and
 * passes them to both LlmModelCatalogCard and LlmJobRoutingCard so a model
 * validated in the catalog immediately becomes selectable in Job Routing.
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
import { useCallback, useEffect, useState, type JSX } from "react";

import { EmbedderLifecyclePanel } from "@/components/admin/EmbedderLifecyclePanel";
import { LlmJobRoutingCard } from "@/components/admin/LlmJobRoutingCard";
import { LlmModelCatalogCard } from "@/components/admin/LlmModelCatalogCard";
import { LlmProviderCard } from "@/components/admin/LlmProviderCard";
import { ModelNamePicker } from "@/components/admin/ModelNamePicker";
import { PlatformCredentialsCard } from "@/components/admin/PlatformCredentialsCard";
import { SettingsSection } from "@/components/ui/layout/SettingsSection";
import { listLlmModels, type LlmModelV1 } from "@/lib/api/llm-models";
import { cn } from "@/lib/cn";
import { colors, type as t } from "@/lib/design-tokens";

const TABS = ["Inference", "Embedding"] as const;

export default function LlmProviderConfigPage(): JSX.Element {
  // Operator-form-entry only. NOT plumbed into PATCH payload (spec §9).
  const [qwenModelName, setQwenModelName] = useState<string>("qwen3-embed-0.6b");

  // PART 2 — shared model list lifted from LlmModelCatalogCard +
  // LlmJobRoutingCard. Both cards now receive this list so a model
  // validated in the catalog immediately appears in routing options.
  const [models, setModels] = useState<LlmModelV1[]>([]);

  // refreshModels deliberately does NOT swallow errors — it re-throws so
  // the catalog card's .catch() can surface a load-error banner.
  // The page's own initial useEffect ignores the rejection (the card already
  // shows the error); per-mutation try/catch in the card also covers it.
  const refreshModels = useCallback(async () => {
    const catalog = await listLlmModels();
    setModels(catalog);
  }, []);

  useEffect(() => {
    // Ignore at page level — LlmModelCatalogCard surfaces it via its own
    // .catch() in its mount effect.
    void refreshModels().catch(() => {});
  }, [refreshModels]);

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

        <TabPanels>
          {/* Inference tab — SettingsSection rail layout (PART 3). */}
          <TabPanel data-testid="llm-config-panel-inference">
            {/* Providers section */}
            <SettingsSection
              first
              title="Providers"
              description="Primary and failover inference credentials; each is configured independently."
            >
              <section data-testid="inference-providers-col" className="space-y-3">
                {/* eslint-disable-next-line jsx-a11y/aria-role -- role is a custom prop, not HTML ARIA */}
                <LlmProviderCard role="primary" />
                {/* eslint-disable-next-line jsx-a11y/aria-role -- role is a custom prop, not HTML ARIA */}
                <LlmProviderCard role="secondary" />
              </section>
            </SettingsSection>

            {/* Model catalog section */}
            <SettingsSection
              title="Model catalog"
              description="Add and validate the models you'll route to. A model becomes assignable only after a green preflight."
            >
              <div data-testid="inference-models-col">
                <LlmModelCatalogCard models={models} refreshModels={refreshModels} />
              </div>
            </SettingsSection>

            {/* Job routing section */}
            <SettingsSection
              title="Job routing"
              description="Map each job to a validated model; unassigned jobs fall back to the platform default."
            >
              <LlmJobRoutingCard models={models} />
            </SettingsSection>
          </TabPanel>

          {/* Embedding tab (NEW, T5.8) — Qwen credentials + lifecycle panel. */}
          <TabPanel
            data-testid="llm-config-panel-embedding"
          >
            <SettingsSection
              first
              title="Platform credentials"
              description="Qwen embedding provider credentials — stored in Vault."
            >
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
            </SettingsSection>
            <SettingsSection
              title="Re-embed lifecycle"
              description="Start, monitor, and abort re-embedding runs."
            >
              <EmbedderLifecyclePanel />
            </SettingsSection>
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  );
}
