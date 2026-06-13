"use client";

import {
  CheckIcon,
  ClipboardDocumentIcon,
  CommandLineIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";

import { FixPromptDrawer } from "@/components/review-detail/FixPromptDrawer";
import { RailSectionHeading } from "@/components/review-detail/RailSectionHeading";
import { Button } from "@/components/ui/elements/Button";
import type { FixPromptSummaryV1 } from "@/lib/api/admin";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/cn";
import { colors, radius, type as t } from "@/lib/design-tokens";

const MODE_LABEL: Record<FixPromptSummaryV1["generation_mode"], string> = {
  llm: "AI-synthesized",
  deterministic_fallback: "Deterministic",
};

export function FixPromptHero({
  fixPrompt,
}: {
  fixPrompt: FixPromptSummaryV1 | null;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  if (!fixPrompt) return null;

  async function handleCopy(): Promise<boolean> {
    if (!fixPrompt) return false;
    const ok = await copyText(fixPrompt.prompt);
    if (ok) {
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1500);
    } else {
      setCopyState("failed");
      setDrawerOpen(true); // reveal so the user can select + copy manually
    }
    return ok;
  }

  const findingsLabel = `${fixPrompt.finding_count} ${
    fixPrompt.finding_count === 1 ? "finding" : "findings"
  }`;

  return (
    <section
      className={cn(
        colors.bg.elevated,
        "border",
        colors.border.default,
        radius.md,
        "flex flex-col gap-y-3 p-5 sm:flex-row sm:items-center sm:justify-between",
      )}
    >
      <div className="min-w-0 space-y-1">
        <RailSectionHeading
          icon={CommandLineIcon}
          iconClassName={colors.text.accent}
          as="h2"
        >
          Fix-it prompt for Claude Code
        </RailSectionHeading>
        <p className={cn(t.body, colors.text.muted)}>
          One prompt that turns this review&rsquo;s findings into ready-to-paste
          fixes for Claude Code.
        </p>
        <p className={cn(t.caption, colors.text.muted)}>
          {MODE_LABEL[fixPrompt.generation_mode]}{" "}
          <span className={colors.text.muted}>
            {fixPrompt.generation_mode === "llm"
              ? "(LLM grouped the findings into themes)"
              : "(built directly from the findings)"}
          </span>
        </p>
        {fixPrompt.truncated ? (
          <p
            className={cn(
              t.caption,
              "text-[oklch(52%_0.15_70)] dark:text-[oklch(80%_0.15_70)]",
            )}
          >
            Showing the top {findingsLabel}; re-run after fixing these.
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-x-3">
        <Button
          variant="primary"
          size="md"
          onClick={handleCopy}
          leadingIcon={
            copyState === "copied" ? (
              <CheckIcon className="size-4" />
            ) : (
              <ClipboardDocumentIcon className="size-4" />
            )
          }
        >
          {copyState === "copied"
            ? "Copied"
            : copyState === "failed"
              ? "Copy failed"
              : "Copy prompt"}
        </Button>
        <Button variant="ghost" size="md" onClick={() => setDrawerOpen(true)}>
          View full prompt
        </Button>
        <span role="status" aria-live="polite" className="sr-only">
          {copyState === "copied"
            ? "Prompt copied to clipboard."
            : copyState === "failed"
              ? "Copy failed; the full prompt opened so you can select it manually."
              : ""}
        </span>
      </div>

      <FixPromptDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        prompt={fixPrompt.prompt}
        onCopy={handleCopy}
      />
    </section>
  );
}
