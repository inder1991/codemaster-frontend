/**
 * Task 5.4 — ModelNamePicker combobox (spec §9).
 *
 * Pure presentational combobox: curated dropdown of QWEN_MODELS
 * plus free-text input for operator override.
 *
 * Used as `extraFields` slot on PlatformCredentialsCard
 * (provider="embedder.qwen") in T5.8.
 *
 * UX contract:
 *   - Renders a labeled combobox whose input reflects `value`.
 *   - Dropdown shows the curated `options` list filtered by what the
 *     operator has typed.
 *   - When the operator selects a curated option, `onChange` fires
 *     with that option string.
 *   - When the operator types a value not in the curated list and
 *     blurs (or presses Enter on the input), `onChange` fires with
 *     the typed string; a small "Custom" badge appears next to
 *     non-curated options in the dropdown to hint the LLM that it is
 *     an operator override.
 *   - Controlled component: no internal value state. Parent owns it.
 *
 * Library choice: @headlessui/react v2 Combobox — already a project
 * dep and used in Modal / SidebarShell; consistent a11y pattern.
 */

"use client";

import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Label,
} from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/20/solid";
import { useState, type JSX } from "react";

import { cn } from "@/lib/cn";
import { colors, type as t } from "@/lib/design-tokens";

// ── Curated model list ────────────────────────────────────────────

/** Curated list of supported Qwen embedding model identifiers. */
export const QWEN_MODELS = ["qwen3-embed-0.6b", "qwen3-embed-1.7b"] as const;

// ── Props ─────────────────────────────────────────────────────────

export interface ModelNamePickerProps {
  /** Current selected model name (controlled). */
  value: string;
  /** Called when the operator selects a different model (from dropdown or free-text). */
  onChange: (next: string) => void;
  /** Optional: customize the curated list. Defaults to QWEN_MODELS. */
  options?: ReadonlyArray<string>;
  /** Optional: label text. Default "Embedding model". */
  label?: string;
}

// ── Component ─────────────────────────────────────────────────────

export function ModelNamePicker({
  value,
  onChange,
  options = QWEN_MODELS,
  label = "Embedding model",
}: ModelNamePickerProps): JSX.Element {
  // Local query state drives filtering; does NOT own the selected value.
  const [query, setQuery] = useState("");

  const filtered =
    query === ""
      ? options
      : options.filter((opt) =>
          opt.toLowerCase().includes(query.toLowerCase()),
        );

  // When the user types a value not in options, surface it as an
  // additional "custom" entry in the filtered list so they can select
  // their own text.
  const queryIsCurated =
    query === "" || options.some((opt) => opt === query);
  const displayList: ReadonlyArray<string> =
    !queryIsCurated && query.trim() !== ""
      ? [...filtered, query]
      : filtered;

  function isCustom(opt: string): boolean {
    return !options.includes(opt);
  }

  return (
    <Combobox
      value={value}
      onChange={(next: string | null) => {
        if (next !== null) onChange(next);
      }}
    >
      <Label className={cn(t.meta, colors.text.muted, "block mb-1")}>
        {label}
      </Label>

      <div className="relative">
        <ComboboxInput
          className={cn(
            "w-full px-3 py-2 pr-9 rounded border",
            colors.divider,
            colors.bg.surface,
            t.body,
          )}
          displayValue={(v: string) => v}
          onChange={(e) => setQuery(e.target.value)}
          onBlur={() => {
            // Accept free-text on blur: if the input text differs from
            // the current value, fire onChange so the parent updates.
            if (query.trim() !== "" && query !== value) {
              onChange(query);
            }
            setQuery("");
          }}
          placeholder="Select or type a model name…"
          autoComplete="off"
          data-testid="model-name-picker-input"
        />

        {/* Toggle button — opens/closes the dropdown list */}
        <ComboboxButton
          className="absolute inset-y-0 right-0 flex items-center pr-2"
          data-testid="model-name-picker-button"
        >
          <ChevronUpDownIcon
            className={cn("size-5", colors.text.muted)}
            aria-hidden="true"
          />
        </ComboboxButton>

        <ComboboxOptions
          className={cn(
            "absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded border py-1",
            colors.bg.elevated,
            colors.divider,
            "shadow-lg",
          )}
          data-testid="model-name-picker-options"
        >
          {displayList.length === 0 ? (
            <div
              className={cn("px-3 py-2 select-none", t.body, colors.text.muted)}
            >
              No models found.
            </div>
          ) : (
            displayList.map((opt) => (
              <ComboboxOption
                key={opt}
                value={opt}
                className={({ focus }: { focus: boolean }) =>
                  cn(
                    "cursor-pointer select-none px-3 py-2 flex items-center gap-x-2",
                    t.body,
                    focus
                      ? cn(colors.bg.accent, colors.text.accent)
                      : colors.text.primary,
                  )
                }
                data-testid={`model-option-${opt}`}
              >
                <span>{opt}</span>
                {isCustom(opt) && (
                  <span
                    className={cn(
                      "ml-auto inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium",
                      "ring-1 ring-inset",
                      colors.statusBg.info,
                      colors.status.info,
                    )}
                    data-testid="custom-badge"
                  >
                    Custom
                  </span>
                )}
              </ComboboxOption>
            ))
          )}
        </ComboboxOptions>
      </div>
    </Combobox>
  );
}
