/**
 * Sprint 13 / S13.1.1 — single flag row.
 * Sprint 14 / S14.C — wired to `FlagListItemV1` from lib/api; the
 * Approve CTA is disabled when the current user was the first
 * approver (self-second-approval is forbidden by the backend; we
 * pre-disable to make the constraint visible rather than letting
 * the click fail with a 409).
 *
 * Layout: flag name (mono) + scope badge + current value summary +
 * "pending second approver" indicator (when set) + last-changed
 * meta on the right + Edit / Approve CTA.
 */

"use client";

import { ClockIcon, PencilSquareIcon } from "@heroicons/react/24/outline";

import { Badge } from "@/components/ui/elements/Badge";
import { Button } from "@/components/ui/elements/Button";
import type { FlagListItemV1, FlagScope } from "@/lib/api/admin";
import { cn } from "@/lib/cn";
import { colors, type as t } from "@/lib/design-tokens";
import { formatRelativeTime } from "@/lib/format/relative-time";

const SCOPE_LABELS: Record<FlagScope, string> = {
  global: "tenant-wide",
  installation: "installation",
  repository: "repository",
};

export interface FlagRowProps {
  flag: FlagListItemV1;
  /** The current session user's id; null while session is loading.
   *  Drives the self-approval-disabled UX. */
  currentUserId: string | null;
  onEdit: (flagName: string) => void;
}

export function FlagRow({ flag, currentUserId, onEdit }: FlagRowProps) {
  const isPending = flag.pending_second_approver;
  const isOwnPending =
    isPending &&
    currentUserId !== null &&
    flag.pending_first_approver_user_id === currentUserId;

  return (
    <div className="flex items-start gap-x-4 px-4 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
          <code
            className={cn(
              "font-mono",
              t.bodyStrong,
              colors.text.primary,
            )}
          >
            {flag.flag_name}
          </code>
          <Badge
            kind={flag.scope === "global" ? "down" : "neutral"}
            size="sm"
            pill
            showDot={false}
          >
            {SCOPE_LABELS[flag.scope]}
          </Badge>
          {isPending ? (
            <Badge kind="degraded" size="sm" pill>
              <ClockIcon
                aria-hidden="true"
                className="size-3"
              />
              <span className="ml-1">pending second approver</span>
            </Badge>
          ) : null}
        </div>
        <pre
          className={cn(
            "mt-2 max-h-20 overflow-auto whitespace-pre-wrap font-mono",
            t.meta,
            colors.text.muted,
          )}
        >
          {prettyValue(flag.value_json)}
        </pre>
        {isPending && flag.pending_value_json ? (
          <div
            className={cn(
              "mt-2 px-3 py-2 rounded-md",
              "bg-[oklch(94%_0.06_80)] dark:bg-[oklch(26%_0.10_80)]",
            )}
          >
            <p
              className={cn(
                t.caption,
                "text-[oklch(50%_0.14_80)] dark:text-[oklch(82%_0.16_80)]",
                "uppercase tracking-wider",
              )}
            >
              Staged value (awaiting second approver)
            </p>
            <pre
              className={cn(
                "mt-1 max-h-16 overflow-auto whitespace-pre-wrap font-mono",
                t.meta,
                "text-[oklch(40%_0.14_80)] dark:text-[oklch(85%_0.14_80)]",
              )}
            >
              {prettyValue(flag.pending_value_json)}
            </pre>
          </div>
        ) : null}
        {isOwnPending ? (
          <p className={cn("mt-2", t.caption, colors.text.faint)}>
            You staged this change — you cannot approve your own flip.
            A different platform-owner must commit it.
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-y-2">
        <span className={cn(t.caption, colors.text.faint)}>
          changed {formatRelativeTime(flag.last_changed_at)}
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onEdit(flag.flag_name)}
          disabled={isOwnPending}
          leadingIcon={<PencilSquareIcon className="size-4" />}
        >
          {isPending ? "Approve" : "Edit"}
        </Button>
      </div>
    </div>
  );
}

function prettyValue(json: string): string {
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}

// Sprint 16 / S16.F.4 — local `formatRelative` deleted; use the
// shared `formatRelativeTime` helper imported from `lib/format/`.
