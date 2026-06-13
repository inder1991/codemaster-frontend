/**
 * ReviewIdChip — top-right canonical-id affordance for the review-detail page.
 *
 * Operators copy the review id into Temporal / Grafana / Langfuse / logs, so
 * the page surfaces it as a quiet, monospace, click-to-copy chip rather than
 * burying it in the title. Shows a git-style short prefix; copies the full id.
 */

"use client";

import { CheckIcon, ClipboardDocumentIcon } from "@heroicons/react/20/solid";
import { useState } from "react";

import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/cn";
import { colors, motion, radius, type as t } from "@/lib/design-tokens";

export function ReviewIdChip({ reviewId }: { reviewId: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const ok = await copyText(reviewId);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  }

  const short = reviewId.length > 8 ? reviewId.slice(0, 8) : reviewId;

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Copy review id: ${reviewId}`}
      aria-label={`Copy review id ${reviewId}`}
      className={cn(
        "inline-flex shrink-0 items-center gap-x-1.5 px-2 py-1 font-mono",
        t.caption,
        colors.text.muted,
        colors.bg.muted,
        radius.sm,
        colors.hover.text.primary,
        motion.fast,
      )}
    >
      <span className={colors.text.faint}>rev</span>
      <span className="tabular-nums">{short}</span>
      {copied ? (
        <CheckIcon
          aria-hidden="true"
          className={cn("size-3.5 shrink-0", colors.status.healthy)}
        />
      ) : (
        <ClipboardDocumentIcon
          aria-hidden="true"
          className="size-3.5 shrink-0"
        />
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Review id copied to clipboard." : ""}
      </span>
    </button>
  );
}
