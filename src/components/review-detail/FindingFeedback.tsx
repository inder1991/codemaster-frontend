/**
 * Review-detail P5 — per-finding feedback verbs.
 *
 * helpful / not helpful / wrong → POST the admin feedback endpoint. The
 * daily write-path the trust loop depends on. Optimistic-ish: on success
 * the buttons are replaced by a thanks line; on error a retry line shows
 * and the buttons stay. Locked microcopy; no em dashes.
 */

"use client";

import { useMutation } from "@tanstack/react-query";

import {
  submitFindingFeedback,
  type FindingFeedbackVerb,
} from "@/lib/api/admin";
import { cn } from "@/lib/cn";
import { colors, motion, type as t } from "@/lib/design-tokens";

const VERBS: { verb: FindingFeedbackVerb; label: string }[] = [
  { verb: "helpful", label: "Helpful" },
  { verb: "not_helpful", label: "Not helpful" },
  { verb: "wrong", label: "Wrong" },
];

export function FindingFeedback({
  reviewId,
  findingId,
}: {
  reviewId: string;
  findingId: string;
}) {
  const mutation = useMutation({
    mutationFn: (verb: FindingFeedbackVerb) =>
      submitFindingFeedback({ reviewId, findingId, verb }),
  });

  if (mutation.isSuccess) {
    return (
      <p className={cn("mt-3", t.meta, colors.text.faint)}>
        Thanks, feedback recorded.
      </p>
    );
  }

  return (
    <div className={cn("mt-3 flex flex-wrap items-center gap-x-2", t.meta)}>
      <span className={colors.text.faint}>Was this useful?</span>
      {VERBS.map(({ verb, label }) => (
        <button
          key={verb}
          type="button"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(verb)}
          className={cn(
            "px-2 py-0.5 rounded-md",
            colors.bg.muted,
            colors.text.primary,
            colors.hover.bgElevated,
            motion.fast,
            mutation.isPending ? "opacity-50" : "",
          )}
        >
          {label}
        </button>
      ))}
      {mutation.isError ? (
        <span className={colors.status.down}>
          Couldn&apos;t record feedback, try again.
        </span>
      ) : null}
    </div>
  );
}
