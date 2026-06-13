/**
 * Sprint 12 / S12.2.4 — autosave hook for the markdown editor.
 *
 * Locked behaviour (sprint-12.md AC #5):
 *   - Saves the in-flight body to localStorage every 30 seconds.
 *   - Saves on blur via the imperative `saveNow()` callback.
 *   - Sets up a `beforeunload` listener that warns the user when
 *     `hasUnsaved` is true, so closing a tab mid-edit prompts.
 *   - On mount, returns the previously stored draft (if any) so
 *     the parent can show a "Restore your unsaved changes from
 *     <when>?" prompt.
 *
 * Storage key per learning: `codemaster-admin:editor:learning:<id>`.
 * Stored shape: `{ body: string, savedAt: number }` (epoch ms).
 *
 * This is the hook + a tiny prompt component the editor page can
 * render directly (`<RestoreDraftPrompt>`). Batch 3 wires both
 * into the CodeMirror MarkdownEditor.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/elements/Button";
import { cn } from "@/lib/cn";
import { radius, type as t } from "@/lib/design-tokens";

const STORAGE_PREFIX = "codemaster-admin:editor:learning:";
const SAVE_INTERVAL_MS = 30_000;

interface StoredDraft {
  body: string;
  savedAt: number;
}

export interface EditorAutosaveResult {
  /** Draft snapshot found at mount; null when none. Stable. */
  initialDraft: StoredDraft | null;
  /**
   * Force a save right now (e.g., on blur). Idempotent — only
   * writes if the current `body` differs from what's already
   * stored.
   */
  saveNow: () => void;
  /** Wipe the stored draft (call after a successful PUT). */
  clearDraft: () => void;
  /**
   * `true` when the current `body` differs from the canonical
   * server body originally passed to the hook. Drives the
   * `beforeunload` warning + the unsaved-changes indicator.
   */
  hasUnsaved: boolean;
}

/**
 * @param learningId  The id under which the draft is stored.
 * @param body        The current in-flight body.
 * @param savedBody   The canonical server-side body. `hasUnsaved`
 *                    fires when `body !== savedBody`.
 */
export function useEditorAutosave(
  learningId: string,
  body: string,
  savedBody: string,
): EditorAutosaveResult {
  const storageKey = `${STORAGE_PREFIX}${learningId}`;
  const bodyRef = useRef(body);
  bodyRef.current = body;

  const [initialDraft] = useState<StoredDraft | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<StoredDraft>;
      if (typeof parsed.body !== "string" || typeof parsed.savedAt !== "number") {
        return null;
      }
      return { body: parsed.body, savedAt: parsed.savedAt };
    } catch {
      return null;
    }
  });

  const hasUnsaved = body !== savedBody;

  const saveNow = useCallback(() => {
    if (typeof window === "undefined") return;
    const current = bodyRef.current;
    if (current === savedBody) {
      // No actual diff — drop any stale draft so we don't keep
      // prompting on next reload.
      window.localStorage.removeItem(storageKey);
      return;
    }
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ body: current, savedAt: Date.now() }),
      );
    } catch {
      // localStorage may be unavailable (private mode); silent.
    }
  }, [storageKey, savedBody]);

  const clearDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // silent
    }
  }, [storageKey]);

  // Periodic save every 30s while the body is dirty.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const interval = window.setInterval(() => {
      saveNow();
    }, SAVE_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [saveNow]);

  // beforeunload warning when the body is dirty.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasUnsaved) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore the message; setting returnValue
      // is the cross-browser idiom for "show the prompt".
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsaved]);

  return { initialDraft, saveNow, clearDraft, hasUnsaved };
}

/**
 * UI prompt rendered ABOVE the editor when `initialDraft` is
 * non-null. Two actions: Restore (parent replaces body with the
 * draft) or Discard (parent calls `clearDraft`).
 */
export function RestoreDraftPrompt({
  draft,
  onRestore,
  onDiscard,
}: {
  draft: StoredDraft;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  const ageLabel = formatRelative(draft.savedAt);
  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 px-4 py-3",
        radius.md,
        "bg-[oklch(94%_0.05_235)] dark:bg-[oklch(26%_0.08_235)]",
      )}
    >
      <p className={cn(t.body, "text-[oklch(35%_0.10_235)] dark:text-[oklch(85%_0.10_235)]")}>
        You have an unsaved draft from{" "}
        <span className="font-medium">{ageLabel}</span>. Restore?
      </p>
      <div className="flex gap-x-2">
        <Button variant="ghost" size="sm" onClick={onDiscard}>
          Discard
        </Button>
        <Button variant="primary" size="sm" onClick={onRestore}>
          Restore draft
        </Button>
      </div>
    </div>
  );
}

function formatRelative(epochMs: number): string {
  const elapsedSec = Math.max(0, Math.round((Date.now() - epochMs) / 1000));
  if (elapsedSec < 60) return `${elapsedSec}s ago`;
  const elapsedMin = Math.round(elapsedSec / 60);
  if (elapsedMin < 60) return `${elapsedMin}m ago`;
  const elapsedH = Math.round(elapsedMin / 60);
  if (elapsedH < 24) return `${elapsedH}h ago`;
  const elapsedD = Math.round(elapsedH / 24);
  return `${elapsedD}d ago`;
}
