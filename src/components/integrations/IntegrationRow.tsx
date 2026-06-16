/**
 * Sprint 13 / S13.1.3 — single-integration row.
 *
 * Layout: kind icon + space name + space-key chip + scope chip +
 * last-validated time on the right + Remove CTA (ghost danger).
 */

"use client";

import Link from "next/link";
import {
  ArrowTopRightOnSquareIcon,
  BookOpenIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";

import { Badge } from "@/components/ui/elements/Badge";
import { Button } from "@/components/ui/elements/Button";
import type { IntegrationV1 } from "@/lib/api/admin";
import { cn } from "@/lib/cn";
import { colors, type as t } from "@/lib/design-tokens";

export interface IntegrationRowProps {
  integration: IntegrationV1;
  onRemove: (integrationId: string) => void;
}

interface ConfluenceConfig {
  space_key: string;
  space_name: string;
  scope: "whole_space" | "page_tree";
  page_tree_root_id: string | null;
}

function parseConfluenceConfig(integration: IntegrationV1): ConfluenceConfig {
  return JSON.parse(integration.config_json) as ConfluenceConfig;
}

export function IntegrationRow({ integration, onRemove }: IntegrationRowProps) {
  const config = parseConfluenceConfig(integration);
  const validationOk =
    integration.last_validation_error === null &&
    integration.last_validated_at !== null;

  return (
    <div className="flex items-center gap-x-4 px-4 py-3">
      <div className="flex shrink-0 items-center justify-center size-9 rounded-md bg-[oklch(94%_0.06_235)] dark:bg-[oklch(26%_0.08_235)]">
        <BookOpenIcon
          aria-hidden="true"
          className="size-5 text-[oklch(50%_0.14_235)] dark:text-[oklch(74%_0.13_235)]"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
          <p className={cn(t.bodyStrong, colors.text.primary)}>
            {config.space_name}
          </p>
          <span className={cn(t.meta, colors.text.muted, "font-mono")}>
            {config.space_key}
          </span>
          <Badge
            kind={config.scope === "whole_space" ? "info" : "dim"}
            size="sm"
            pill
            showDot={false}
          >
            {config.scope === "whole_space" ? "whole space" : "page tree"}
          </Badge>
        </div>
        <p className={cn("mt-1", t.meta, colors.text.faint)}>
          {validationOk ? (
            <>
              Last validated{" "}
              <span className="tabular-nums">
                {formatRelative(integration.last_validated_at!)}
              </span>
            </>
          ) : integration.last_validation_error ? (
            <span className={colors.status.down}>
              Validation failed: {integration.last_validation_error}
            </span>
          ) : (
            "Not yet validated"
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-x-2">
        {/* The per-space Pages + Approve view is reachable only from here — it has no
            nav entry. Route is parameterized by integration_id (UUID), matching the
            backend path-param shape. Scoped to confluence_space (the only kind today). */}
        {integration.kind === "confluence_space" ? (
          <Link
            href={`/admin/confluence/spaces/${integration.integration_id}/pages`}
            className={cn(
              "inline-flex items-center gap-x-1.5 underline underline-offset-2",
              t.meta,
              colors.text.muted,
              colors.hover.text.primary,
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[oklch(72%_0.16_65)]",
            )}
          >
            <DocumentTextIcon aria-hidden="true" className="size-4" />
            Review pages
          </Link>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(integration.integration_id)}
          leadingIcon={<ArrowTopRightOnSquareIcon className="size-4" />}
        >
          Remove
        </Button>
      </div>
    </div>
  );
}

function formatRelative(iso: string): string {
  const elapsed = Date.now() - new Date(iso).getTime();
  const min = Math.round(elapsed / 60_000);
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}
