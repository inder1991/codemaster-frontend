/**
 * Sprint 13 / S13.1.1 — Kill-switches admin page.
 * Sprint 14 / S14.C — wired to GET/PUT /api/admin/flags.
 *
 * Lists every operational flag the platform team can toggle from
 * the UI. Stage / approve flow is two-person (S13.1.6); tenant-
 * wide flags additionally require a typed-confirmation phrase.
 *
 * Visible to platform_owner+. Reader/operator land here only via
 * a typed URL; backend authz gates the writes (also enforced via
 * the shared `useAdminQueryGuards` 403 branch).
 *
 * Mutation contract:
 *   • PUT /api/admin/flags/{name} sends `If-Match: <last_changed_at>`
 *     so the backend can refuse stale writes (S13.1.1 optimistic
 *     concurrency) AND `X-CSRF-Token: <csrf_token cookie>` so the
 *     S14.A CSRF middleware accepts the request.
 *   • 200 + path="committed" → live value updated; list refetches.
 *   • 200 + path="staged_first" → row enters pending state; list
 *     refetches so other tabs see the staged change.
 *   • 409 stale_write → CollisionDiffModal opens with the server's
 *     current value alongside the user's attempted value.
 *   • 409 self_second_approver → inline error in FlagEditModal
 *     (defence in depth — the row is also pre-disabled when the
 *     current user was the first approver).
 */

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { FlagEditModal } from "@/components/kill-switches/FlagEditModal";
import { FlagRow } from "@/components/kill-switches/FlagRow";
import { CollisionDiffModal } from "@/components/knowledge/CollisionDiffModal";
import { Card } from "@/components/ui/elements/Card";
import { Empty } from "@/components/ui/states/Empty";
import { EmptyIllustration } from "@/components/ui/states/EmptyIllustration";
import {
  AdminApiError,
  fetchFlags,
  putFlag,
  QUERY_KEYS,
  type FlagListItemV1,
  type FlagScope,
  type FlagStaleWriteConflictV1,
} from "@/lib/api/admin";
import { useAdminQueryGuards } from "@/lib/api/use-admin-query-guards";
import { useSession } from "@/lib/auth/use-session";
import { cn } from "@/lib/cn";
import { colors, type as t } from "@/lib/design-tokens";

const SCOPE_HEADING: Record<FlagScope, string> = {
  global: "Tenant-wide flags",
  installation: "Per-installation flags",
  repository: "Per-repository flags",
};

interface CollisionState {
  /** Flag the user was editing when the 409 fired. */
  flag: FlagListItemV1;
  /** Value the user attempted to PUT. */
  attemptedValueJson: string;
  /** Reason + typed-confirm captured on the original submit so
   *  "Use mine" can re-PUT with the new If-Match without prompting
   *  the user a second time. */
  reason: string;
  typedConfirmPhrase: string | null;
  /** 409 body the backend returned. */
  conflict: FlagStaleWriteConflictV1;
}

export default function KillSwitchesPage() {
  const queryClient = useQueryClient();
  const session = useSession();
  const currentUserId = session.data?.user_id ?? null;

  const query = useQuery({
    queryKey: QUERY_KEYS.flags(),
    queryFn: fetchFlags,
  });

  const [editing, setEditing] = useState<FlagListItemV1 | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [collision, setCollision] = useState<CollisionState | null>(null);

  const mutation = useMutation({
    mutationFn: async (args: {
      flag: FlagListItemV1;
      new_value_json: string;
      reason: string;
      typed_confirm_phrase: string | null;
    }) =>
      putFlag({
        flag_name: args.flag.flag_name,
        new_value_json: args.new_value_json,
        if_match: args.flag.last_changed_at,
        typed_confirm_phrase: args.typed_confirm_phrase,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.flags() });
      setEditing(null);
      setCollision(null);
      setErrorMessage(undefined);
    },
    onError: (err, vars) => {
      if (err instanceof AdminApiError && err.status === 409) {
        const body = err.body as
          | FlagStaleWriteConflictV1
          | { code: "self_second_approver" }
          | null;
        if (body?.code === "stale_write") {
          setCollision({
            flag: vars.flag,
            attemptedValueJson: vars.new_value_json,
            reason: vars.reason,
            typedConfirmPhrase: vars.typed_confirm_phrase,
            conflict: body,
          });
          setEditing(null);
          return;
        }
        if (body?.code === "self_second_approver") {
          setErrorMessage(
            "You staged this change — a different platform-owner must commit it.",
          );
          return;
        }
      }
      setErrorMessage("The flag change failed. Please try again.");
    },
  });

  const { guardElement } = useAdminQueryGuards(query, "kill-switches");
  if (guardElement !== null) return guardElement;

  const flags = query.data ?? [];

  const startEdit = (flagName: string) => {
    const flag = flags.find((f) => f.flag_name === flagName) ?? null;
    setEditing(flag);
    setErrorMessage(undefined);
  };

  const handleConfirm = (input: {
    new_value_json: string;
    reason: string;
    typed_confirm_phrase: string | null;
  }) => {
    if (editing === null) return;
    setErrorMessage(undefined);
    mutation.mutate({
      flag: editing,
      new_value_json: input.new_value_json,
      reason: input.reason,
      typed_confirm_phrase: input.typed_confirm_phrase,
    });
  };

  const grouped = groupByScope(flags);

  return (
    <div className="space-y-8">
      <header>
        <h1 className={cn(t.display, colors.text.primary)}>Kill switches</h1>
        <p className={cn("mt-2 max-w-2xl", t.bodyLarge, colors.text.muted)}>
          Operational flags the platform team toggles from this surface.
          Tenant-wide flags require typed confirmation AND a second
          platform-owner approval before they go live. Every change is
          audited.
        </p>
      </header>

      {flags.length === 0 ? (
        <Empty
          illustration={<EmptyIllustration />}
          title="No flags configured"
          body="Operational flags are seeded during deployment. If this list is empty, check the Helm values."
        />
      ) : (
        <div className="space-y-8">
          {(["global", "installation", "repository"] as FlagScope[]).map(
            (scope) => {
              const inScope = grouped[scope];
              if (inScope.length === 0) return null;
              return (
                <section key={scope} className="space-y-3">
                  <h2 className={cn(t.h2, colors.text.primary)}>
                    {SCOPE_HEADING[scope]} ({inScope.length})
                  </h2>
                  <Card>
                    <ul className={cn("divide-y", colors.divider)}>
                      {inScope.map((f) => (
                        <li key={f.flag_name}>
                          <FlagRow
                            flag={f}
                            currentUserId={currentUserId}
                            onEdit={startEdit}
                          />
                        </li>
                      ))}
                    </ul>
                  </Card>
                </section>
              );
            },
          )}
        </div>
      )}

      {editing !== null ? (
        <FlagEditModal
          open
          flag={editing}
          onConfirm={handleConfirm}
          onCancel={() => {
            setEditing(null);
            setErrorMessage(undefined);
          }}
          submitting={mutation.isPending}
          {...(errorMessage ? { errorMessage } : {})}
        />
      ) : null}

      {collision !== null ? (
        <CollisionDiffModal
          open
          yourBody={prettyJSON(collision.attemptedValueJson)}
          serverBody={prettyJSON(collision.conflict.current_value_json)}
          serverEditedBy={
            collision.flag.last_changed_by_user_id === currentUserId
              ? "you"
              : (collision.flag.last_changed_by_user_id ?? "another editor")
          }
          serverEditedAtLabel={formatRelative(
            collision.conflict.current_changed_at,
          )}
          onUseMine={() => {
            // Re-PUT with the server's NEW If-Match value. The user's
            // intent (overwrite) is preserved; the typed-confirm and
            // reason are reused so they don't have to retype.
            mutation.mutate({
              flag: {
                ...collision.flag,
                last_changed_at: collision.conflict.current_changed_at,
                value_json: collision.conflict.current_value_json,
              },
              new_value_json: collision.attemptedValueJson,
              reason: collision.reason,
              typed_confirm_phrase: collision.typedConfirmPhrase,
            });
          }}
          onUseTheirs={() => {
            setCollision(null);
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.flags() });
          }}
          onCancel={() => setCollision(null)}
          submitting={mutation.isPending}
        />
      ) : null}
    </div>
  );
}

function groupByScope(
  flags: ReadonlyArray<FlagListItemV1>,
): Record<FlagScope, ReadonlyArray<FlagListItemV1>> {
  return {
    global: flags.filter((f) => f.scope === "global"),
    installation: flags.filter((f) => f.scope === "installation"),
    repository: flags.filter((f) => f.scope === "repository"),
  };
}

function prettyJSON(json: string): string {
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}

function formatRelative(iso: string): string {
  const elapsed = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(elapsed)) return iso;
  const min = Math.round(elapsed / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}
