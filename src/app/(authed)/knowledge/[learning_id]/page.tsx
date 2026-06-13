/**
 * Sprint 12 / S12.2.4 — Knowledge detail page (editable).
 * Sprint 15 / S15.C — wired to real `GET/PUT /api/admin/knowledge/{id}`.
 *
 * Mutation contract:
 *   • PUT sends `If-Match: <integer-version>` from the most-recent
 *     server response. Backend returns 200 (saved), 409 (stale
 *     write — `current_body` + `current_version` returned), 428
 *     (If-Match missing).
 *   • 409 opens `CollisionDiffModal` with the server-current body
 *     alongside the user's attempted body.
 *   • 428 surfaces an inline error ("Precondition required —
 *     please reload"); user's local edits stay in component
 *     state so no work is lost.
 */

"use client";

import { ChevronLeftIcon } from "@heroicons/react/20/solid";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { use, useEffect, useState } from "react";

import { CollisionDiffModal } from "@/components/knowledge/CollisionDiffModal";
import {
  RestoreDraftPrompt,
  useEditorAutosave,
} from "@/components/knowledge/EditorAutosave";
import { EffectivenessPanel } from "@/components/knowledge/EffectivenessPanel";
import { MarkdownEditor } from "@/components/knowledge/MarkdownEditor";
import { Badge } from "@/components/ui/elements/Badge";
import { Button } from "@/components/ui/elements/Button";
import { Card } from "@/components/ui/elements/Card";
import { AdminApiError } from "@/lib/api/admin";
import {
  fetchLearning,
  KNOWLEDGE_QUERY_KEYS,
  KnowledgeStaleWriteError,
  type LearningDetailV1,
  updateLearningBody,
} from "@/lib/api/knowledge";
import { useAdminQueryGuards } from "@/lib/api/use-admin-query-guards";
import { cn } from "@/lib/cn";
import { colors, motion, type as t } from "@/lib/design-tokens";

interface PageProps {
  params: Promise<{ learning_id: string }>;
}

interface CollisionState {
  open: boolean;
  serverBody: string;
  serverVersion: number;
}

export default function LearningDetailPage({ params }: PageProps) {
  const { learning_id } = use(params);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: KNOWLEDGE_QUERY_KEYS.detail(learning_id),
    queryFn: () => fetchLearning(learning_id),
  });
  const guard = useAdminQueryGuards(query, "knowledge-detail");

  const [body, setBody] = useState("");
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [version, setVersion] = useState<number>(0);
  const [collision, setCollision] = useState<CollisionState>({
    open: false,
    serverBody: "",
    serverVersion: 0,
  });
  const [submitError, setSubmitError] = useState<string | null>(null);

  const learning: LearningDetailV1 | undefined = query.data;

  // Sprint 16 / S16.D.2 — hydrate `body` ONLY on the FIRST
  // successful fetch. Pre-S16.D.2 this effect ran on every
  // background refetch and clobbered the user's unsaved edits.
  // `savedSnapshot` + `version` continue to track server state
  // (so a refetch correctly updates the "what's on the server"
  // baseline for collision detection) but `body` (the editor
  // contents) is owned by the user after first hydration.
  const [hasHydratedBody, setHasHydratedBody] = useState(false);
  useEffect(() => {
    if (learning === undefined) return;
    setSavedSnapshot(learning.body_markdown);
    setVersion(learning.version);
    if (!hasHydratedBody) {
      setBody(learning.body_markdown);
      setHasHydratedBody(true);
    }
  }, [learning, hasHydratedBody]);

  const { initialDraft, saveNow, clearDraft, hasUnsaved } = useEditorAutosave(
    learning_id,
    body,
    savedSnapshot,
  );
  const [draftPromptOpen, setDraftPromptOpen] = useState(initialDraft !== null);

  const restoreDraft = () => {
    if (initialDraft) setBody(initialDraft.body);
    setDraftPromptOpen(false);
  };
  const dismissDraft = () => {
    clearDraft();
    setDraftPromptOpen(false);
  };

  // Sprint 16 / S16.D.2 — `useMutation` with explicit variables
  // (`{ overrideVersion?: number }`). Pre-S16.D.2 the "Use mine"
  // retry called `setVersion(serverVersion); setTimeout(() =>
  // mutate(), 0)` — relying on React's render cycle to flush
  // before the timeout. That's brittle; the mutation closes
  // over `version` from the render at mutation-creation time.
  // Now: callers pass the version explicitly via
  // `mutate({ overrideVersion })` and the mutationFn reads from
  // the variable, falling back to component state for the
  // normal Save path.
  const saveMutation = useMutation<
    LearningDetailV1,
    Error,
    { overrideVersion?: number } | undefined
  >({
    mutationFn: (vars) =>
      updateLearningBody({
        learning_id,
        body_markdown: body,
        if_match_version: vars?.overrideVersion ?? version,
      }),
    onSuccess: (saved) => {
      setSavedSnapshot(saved.body_markdown);
      setVersion(saved.version);
      setSubmitError(null);
      clearDraft();
      queryClient.setQueryData(KNOWLEDGE_QUERY_KEYS.detail(learning_id), saved);
    },
    onError: (err: Error) => {
      if (err instanceof KnowledgeStaleWriteError) {
        setCollision({
          open: true,
          serverBody: err.conflict.current_body,
          serverVersion: err.conflict.current_version,
        });
        setSubmitError(null);
        return;
      }
      if (err instanceof AdminApiError && err.status === 428) {
        setSubmitError(
          "Precondition required — please reload the page (your edits are preserved here for now).",
        );
        return;
      }
      setSubmitError(err.message);
    },
  });

  if (guard.guardElement) {
    return <>{guard.guardElement}</>;
  }
  if (!learning) {
    return <></>;
  }

  const discard = () => {
    setBody(savedSnapshot);
    clearDraft();
    setSubmitError(null);
  };

  const saveState: "idle" | "saving" | "saved" | "error" = saveMutation.isPending
    ? "saving"
    : saveMutation.isError
      ? "error"
      : saveMutation.isSuccess
        ? "saved"
        : "idle";

  return (
    <div className="space-y-8">
      <Link
        href="/knowledge"
        className={cn(
          "inline-flex items-center gap-x-1",
          t.meta,
          colors.text.muted,
          colors.hover.text.primary,
          motion.fast,
        )}
      >
        <ChevronLeftIcon
          aria-hidden="true"
          className={cn("size-4", colors.text.faint)}
        />
        Back to knowledge
      </Link>

      <header>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Badge kind={learning.state === "active" ? "healthy" : "dim"} pill>
            {learning.state}
          </Badge>
          {learning.repo === null ? (
            <Badge kind="info" pill showDot={false}>
              tenant-wide
            </Badge>
          ) : (
            <span className={cn(t.meta, colors.text.muted, "font-medium")}>
              {learning.repo}
            </span>
          )}
          <span
            className={cn(t.meta, colors.text.faint, "tabular-nums")}
            data-testid="version-label"
          >
            v{version}
          </span>
        </div>
        <h1 className={cn("mt-2", t.display, colors.text.primary)}>
          {learning.title}
        </h1>
      </header>

      <section className="space-y-3">
        <h2 className={cn(t.h2, colors.text.primary)}>Effectiveness</h2>
        <Card padding="lg">
          <EffectivenessPanel
            firedCount={learning.fired_count}
            acceptRate={learning.accept_rate}
            lastFiredAtLabel={
              learning.last_fired_at
                ? new Date(learning.last_fired_at).toLocaleString()
                : null
            }
            last30dFires={[]}
          />
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-x-4">
          <h2 className={cn(t.h2, colors.text.primary)}>Body</h2>
          <SaveStatusIndicator state={saveState} hasUnsaved={hasUnsaved} />
        </div>

        {draftPromptOpen && initialDraft ? (
          <RestoreDraftPrompt
            draft={initialDraft}
            onRestore={restoreDraft}
            onDiscard={dismissDraft}
          />
        ) : null}

        <MarkdownEditor
          value={body}
          onChange={setBody}
          onBlur={saveNow}
          ariaLabel="Learning body markdown"
        />

        {submitError && (
          <p
            className={cn(t.meta, colors.status.down)}
            data-testid="knowledge-detail-submit-error"
          >
            {submitError}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="md"
              onClick={() => saveMutation.mutate(undefined)}
              disabled={!hasUnsaved || saveMutation.isPending}
              data-testid="knowledge-save-btn"
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={discard}
              disabled={!hasUnsaved}
            >
              Discard changes
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className={cn(t.h2, colors.text.primary)}>
          Revisions ({learning.revisions.length})
        </h2>
        <Card>
          <ul className={cn("divide-y", colors.divider)}>
            {learning.revisions.map((r) => (
              <li
                key={r.revision_id}
                className="flex items-center gap-x-4 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className={cn(t.bodyStrong, colors.text.primary)}>
                    Version {r.version}
                  </p>
                  <p className={cn("mt-1", t.meta, colors.text.muted)}>
                    by{" "}
                    <span className={cn(colors.text.primary, "font-medium")}>
                      {r.edited_by_user_id.slice(0, 8)}
                    </span>{" "}
                    · {new Date(r.edited_at).toLocaleString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <CollisionDiffModal
        open={collision.open}
        yourBody={body}
        serverBody={collision.serverBody}
        serverEditedBy="another editor"
        serverEditedAtLabel="just now"
        onUseMine={() => {
          // Sprint 16 / S16.D.2 — pass the version EXPLICITLY via
          // mutation variables rather than relying on `setVersion`
          // having flushed before a `setTimeout(0)`. The mutationFn
          // uses `vars.overrideVersion` directly — no state-flush
          // race.
          setVersion(collision.serverVersion);
          setCollision({ ...collision, open: false });
          saveMutation.mutate({ overrideVersion: collision.serverVersion });
        }}
        onUseTheirs={() => {
          setBody(collision.serverBody);
          setSavedSnapshot(collision.serverBody);
          setVersion(collision.serverVersion);
          clearDraft();
          setCollision({ ...collision, open: false });
        }}
        onCancel={() => setCollision({ ...collision, open: false })}
      />
    </div>
  );
}

function SaveStatusIndicator({
  state,
  hasUnsaved,
}: {
  state: "idle" | "saving" | "saved" | "error";
  hasUnsaved: boolean;
}) {
  if (state === "saving") {
    return <span className={cn(t.meta, colors.text.muted)}>Saving…</span>;
  }
  if (state === "saved") {
    return <span className={cn(t.meta, colors.status.healthy)}>Saved</span>;
  }
  if (state === "error") {
    return <span className={cn(t.meta, colors.status.down)}>Save failed</span>;
  }
  if (hasUnsaved) {
    return <span className={cn(t.meta, colors.text.muted)}>Unsaved changes</span>;
  }
  return <span className={cn(t.meta, colors.text.faint)}>All saved</span>;
}
