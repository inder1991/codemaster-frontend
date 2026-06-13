/**
 * Sprint 13 / S13.1.2 — single audit event row.
 *
 * Layout: action (mono) + relative time + actor + target_id chip +
 * before/after excerpt as <pre> blocks.
 */

"use client";

import { Badge, type BadgeKind } from "@/components/ui/elements/Badge";
import type { AuditEventListItemV1 } from "@/lib/api/admin";
import { cn } from "@/lib/cn";
import { colors, type as t } from "@/lib/design-tokens";

const ACTION_KIND: Record<string, BadgeKind> = {
  "flag.put": "down",
  "integration.added": "info",
  "integration.removed": "dim",
  "knowledge.approve": "healthy",
  "knowledge.reject": "degraded",
  "review.posted": "info",
};

export function AuditEventRow({ event }: { event: AuditEventListItemV1 }) {
  const kind = ACTION_KIND[event.action] ?? "neutral";
  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
        <Badge kind={kind} pill>
          {event.action}
        </Badge>
        {event.target_id ? (
          <code
            className={cn(
              "font-mono",
              t.meta,
              colors.text.muted,
            )}
          >
            {event.target_id}
          </code>
        ) : null}
        <span className={cn(t.meta, colors.text.faint)}>
          by{" "}
          <span className={cn(colors.text.primary, "font-medium")}>
            {event.actor_user_id}
          </span>{" "}
          · {formatRelative(event.occurred_at)}
        </span>
      </div>
      {event.before_excerpt || event.after_excerpt ? (
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {event.before_excerpt ? (
            <ExcerptPane label="before" body={event.before_excerpt} />
          ) : (
            <ExcerptPane label="before" body="(none)" placeholder />
          )}
          <ExcerptPane label="after" body={event.after_excerpt || "(none)"} placeholder={!event.after_excerpt} />
        </div>
      ) : null}
    </div>
  );
}

function ExcerptPane({
  label,
  body,
  placeholder,
}: {
  label: string;
  body: string;
  placeholder?: boolean;
}) {
  return (
    <div className={cn("px-3 py-2 rounded-md", colors.bg.muted)}>
      <p
        className={cn(
          t.caption,
          colors.text.faint,
          "uppercase tracking-wider",
        )}
      >
        {label}
      </p>
      <pre
        className={cn(
          "mt-1 max-h-24 overflow-auto whitespace-pre-wrap font-mono",
          t.meta,
          placeholder ? colors.text.faint : colors.text.primary,
        )}
      >
        {body}
      </pre>
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
