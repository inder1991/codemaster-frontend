/**
 * Review-detail inspector pane — per-finding detail panel.
 *
 * Renders full finding context: severity badge, title, file location,
 * confidence (when present), body (markdown), optional suggestion block
 * (markdown), evidence disclosure, and feedback verbs. Closes on button
 * click or Escape key.
 *
 * Trust-traceability invariant: body and suggestion are rendered via
 * rehype-sanitize (no raw HTML, no dangerouslySetInnerHTML). Title and
 * citations remain text nodes only.
 */

"use client";

import { useEffect } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import { XMarkIcon } from "@heroicons/react/20/solid";

import { EvidenceDisclosure } from "@/components/review-detail/EvidenceDisclosure";
import { FindingFeedback } from "@/components/review-detail/FindingFeedback";
import { FileLocationChip } from "@/components/ui/FileLocationChip";
import { Badge, type BadgeKind } from "@/components/ui/elements/Badge";
import type { FindingSeverity, ReviewFindingItemV1 } from "@/lib/api/admin";
import { cn } from "@/lib/cn";
import { colors, elevation, radius, type as t } from "@/lib/design-tokens";
import { LOCKED_SANITIZE_SCHEMA } from "@/lib/markdown";

const SEVERITY_KIND: Record<FindingSeverity, BadgeKind> = {
  blocker: "down",
  issue: "degraded",
  suggestion: "info",
  nit: "dim",
  none: "neutral",
};

const SEVERITY_LABEL: Record<FindingSeverity, string> = {
  blocker: "Blocker",
  issue: "Issue",
  suggestion: "Suggestion",
  nit: "Nit",
  none: "None",
};

export interface FindingInspectorProps {
  finding: ReviewFindingItemV1;
  reviewId: string;
  onClose: () => void;
}

export function FindingInspector({
  finding,
  reviewId,
  onClose,
}: FindingInspectorProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <section
      aria-labelledby="finding-inspector-h"
      className={cn(
        colors.bg.elevated,
        "border",
        colors.border.default,
        radius.md,
        elevation.raised,
        "space-y-3 p-5",
      )}
    >
      {/* Header row: severity badge + close button */}
      <div className="flex items-center justify-between gap-x-2">
        <Badge kind={SEVERITY_KIND[finding.severity]} size="xs">
          {SEVERITY_LABEL[finding.severity]}
        </Badge>
        <button
          type="button"
          aria-label="Close inspector"
          onClick={onClose}
          className={cn(
            "rounded-md p-0.5",
            colors.text.muted,
            colors.hover.bgElevated,
          )}
        >
          <XMarkIcon className="size-4" aria-hidden="true" />
        </button>
      </div>

      {/* Title */}
      <h2
        id="finding-inspector-h"
        className={cn(t.h3, colors.text.primary)}
      >
        {finding.title}
      </h2>

      {/* Meta line: file location + confidence */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <FileLocationChip
          path={finding.file_path}
          startLine={finding.start_line}
          endLine={finding.end_line}
        />
        {finding.confidence != null ? (
          <span
            className={cn(
              t.caption,
              colors.text.faint,
              "tabular-nums",
            )}
          >
            Confidence {Math.round(finding.confidence * 100)}%
          </span>
        ) : null}
      </div>

      {/* Detail section: body + optional suggestion, rendered as safe markdown */}
      <div className="space-y-3">
        <div className={cn("prose-codemaster", t.body, colors.text.primary)}>
          <ReactMarkdown
            rehypePlugins={[[rehypeSanitize, LOCKED_SANITIZE_SCHEMA]]}
          >
            {finding.body}
          </ReactMarkdown>
        </div>

        {finding.suggestion ? (
          <div className="space-y-1">
            <p className={cn(t.meta, colors.text.muted, "uppercase")}>
              Suggested fix
            </p>
            <div className={cn("prose-codemaster", t.body, colors.text.primary)}>
              <ReactMarkdown
                rehypePlugins={[[rehypeSanitize, LOCKED_SANITIZE_SCHEMA]]}
              >
                {finding.suggestion}
              </ReactMarkdown>
            </div>
          </div>
        ) : null}
      </div>

      {/* Divider between detail (body+suggestion) and evidence/feedback actions */}
      <div className={cn("border-t", colors.border.default)} />

      {/* Evidence citations */}
      <EvidenceDisclosure citations={finding.citations} />

      {/* Feedback verbs */}
      <FindingFeedback reviewId={reviewId} findingId={finding.finding_id} />
    </section>
  );
}
