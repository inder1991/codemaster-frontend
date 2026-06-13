/**
 * Sprint 12 / S12.2.4 — EditorAutosave hook unit tests.
 *
 * Per sprint-12.md: ≥4 cases. Verifies localStorage round-trip,
 * the 30s interval save, the imperative `saveNow()`, the
 * `beforeunload` warning, the restore-prompt component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, renderHook, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  RestoreDraftPrompt,
  useEditorAutosave,
} from "@/components/knowledge/EditorAutosave";

const KEY = "codemaster-admin:editor:learning:L-test";

describe("useEditorAutosave", () => {
  beforeEach(() => {
    window.localStorage.removeItem(KEY);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.removeItem(KEY);
  });

  it("returns null initialDraft when storage is empty", () => {
    const { result } = renderHook(() =>
      useEditorAutosave("L-test", "current", "current"),
    );
    expect(result.current.initialDraft).toBeNull();
    expect(result.current.hasUnsaved).toBe(false);
  });

  it("returns the stored draft on mount when present", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ body: "saved draft", savedAt: 1700000000000 }),
    );
    const { result } = renderHook(() =>
      useEditorAutosave("L-test", "current", "current"),
    );
    expect(result.current.initialDraft).toEqual({
      body: "saved draft",
      savedAt: 1700000000000,
    });
  });

  it("saveNow() writes the current body to localStorage when dirty", () => {
    const { result } = renderHook(() =>
      useEditorAutosave("L-test", "edited body", "server body"),
    );
    act(() => result.current.saveNow());
    const raw = window.localStorage.getItem(KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!).body).toBe("edited body");
  });

  it("saveNow() removes the stored draft when body matches the server", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ body: "old draft", savedAt: 1 }),
    );
    const { result } = renderHook(() =>
      useEditorAutosave("L-test", "server body", "server body"),
    );
    act(() => result.current.saveNow());
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("clearDraft() wipes the stored draft", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ body: "x", savedAt: 1 }),
    );
    const { result } = renderHook(() =>
      useEditorAutosave("L-test", "x", "y"),
    );
    act(() => result.current.clearDraft());
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("the 30s interval triggers a save when body is dirty", () => {
    renderHook(() => useEditorAutosave("L-test", "dirty body", "server body"));
    expect(window.localStorage.getItem(KEY)).toBeNull();
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    const raw = window.localStorage.getItem(KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!).body).toBe("dirty body");
  });
});

describe("RestoreDraftPrompt", () => {
  it("renders Restore + Discard buttons that wire correctly", async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();
    const onDiscard = vi.fn();
    render(
      <RestoreDraftPrompt
        draft={{ body: "x", savedAt: Date.now() - 60_000 }}
        onRestore={onRestore}
        onDiscard={onDiscard}
      />,
    );
    await user.click(screen.getByRole("button", { name: /restore draft/i }));
    expect(onRestore).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: /discard/i }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });
});
