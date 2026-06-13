/**
 * Review-detail P1-B — workflow stage strip.
 *
 * Renders the `activities[]` the API already returns (and the old page
 * never showed) as an ordered pipeline strip: each stage's event name +
 * a state glyph. Empty list renders nothing (caller hides the section).
 */

import {
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
} from "@heroicons/react/20/solid";

import type { ActivityEventV1 } from "@/lib/api/admin";
import { cn } from "@/lib/cn";
import { colors, type as t } from "@/lib/design-tokens";

function StateGlyph({ state }: { state: ActivityEventV1["state"] }) {
  if (state === "completed") {
    return (
      <CheckCircleIcon
        aria-label="completed"
        className={cn("size-4", colors.status.healthy)}
      />
    );
  }
  if (state === "failed") {
    return (
      <XCircleIcon
        aria-label="failed"
        className={cn("size-4", colors.status.down)}
      />
    );
  }
  return (
    <ClockIcon
      aria-label={state}
      className={cn("size-4", colors.text.faint)}
    />
  );
}

// P4 — per-stage duration label (e.g. "1.2s") when both timestamps are
// present and completed is strictly after started; null otherwise.
function durationLabel(startedAt: string, completedAt: string | null): string | null {
  if (!completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

export function StageStrip({ activities }: { activities: ActivityEventV1[] }) {
  if (activities.length === 0) return null;
  const ordered = [...activities].sort((a, b) => a.seq - b.seq);
  return (
    <ol className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {ordered.map((a) => {
        const dur = durationLabel(a.started_at, a.completed_at);
        return (
          <li
            key={a.seq}
            className={cn("inline-flex items-center gap-x-1.5", t.meta)}
          >
            <StateGlyph state={a.state} />
            <span className={cn("font-mono", colors.text.muted)}>
              {a.activity_name}
            </span>
            {dur ? (
              <span className={cn(colors.text.faint, "tabular-nums")}>
                · {dur}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
