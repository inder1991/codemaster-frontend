/**
 * Sprint 12 / S12.2.4 — locked split-preview markdown editor.
 *
 * Architecture:
 *   - Left pane: CodeMirror 6 via `@uiw/react-codemirror`, with
 *     `@codemirror/lang-markdown` syntax highlighting.
 *   - Right pane: `react-markdown` + `rehype-sanitize` with the
 *     locked schema (no script / iframe / style / object / embed /
 *     link rel=stylesheet).
 *   - Header carries a 3-way mode toggle: Edit · Split · Preview.
 *
 * Locked invariants (sprint-12.md AC #4 + #5):
 *   - Default mode on `lg+` is `split`. Below 768px the layout
 *     auto-collapses to `edit` (preview reachable via toggle).
 *   - Toggle button is a real ARIA `radiogroup` with three radios
 *     so keyboard navigation cycles modes.
 *   - The locked sanitizer schema is enforced by `rehype-sanitize`;
 *     XSS attempts (`<script>alert(1)</script>`) render as code.
 */

"use client";

import { markdown } from "@codemirror/lang-markdown";
import CodeMirror from "@uiw/react-codemirror";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";

import { cn } from "@/lib/cn";
import { LOCKED_SANITIZE_SCHEMA } from "@/lib/markdown";
import { colors, motion, radius, type as t } from "@/lib/design-tokens";

type EditorMode = "edit" | "split" | "preview";

const MODES: ReadonlyArray<{ value: EditorMode; label: string }> = [
  { value: "edit", label: "Edit" },
  { value: "split", label: "Split" },
  { value: "preview", label: "Preview" },
];

export interface MarkdownEditorProps {
  value: string;
  onChange: (next: string) => void;
  /** Fired when the editor loses focus — drives autosave. */
  onBlur?: () => void;
  /** Accessible label for the editor textarea. Required. */
  ariaLabel: string;
  /** Defaults to `split` (auto-collapses to `edit` below 768px). */
  initialMode?: EditorMode;
  /** Min height of each pane in pixels. */
  minHeight?: number;
}

export function MarkdownEditor({
  value,
  onChange,
  onBlur,
  ariaLabel,
  initialMode = "split",
  minHeight = 360,
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<EditorMode>(initialMode);
  const [isCompact, setIsCompact] = useState(false);

  // Auto-collapse to single-pane below 768px.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => {
      setIsCompact(mq.matches);
      if (mq.matches && mode === "split") setMode("edit");
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
    // We intentionally don't include `mode` as a dep: the mq listener
    // should only react to the viewport changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cmExtensions = useMemo(() => [markdown()], []);
  const showEdit = mode === "edit" || (!isCompact && mode === "split");
  const showPreview = mode === "preview" || (!isCompact && mode === "split");

  return (
    <div
      className={cn(
        "flex flex-col",
        radius.md,
        "border",
        colors.border.default,
        "overflow-hidden",
      )}
    >
      {/* Header with mode toggle */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2",
          "border-b",
          colors.border.default,
          colors.bg.muted,
        )}
      >
        <span className={cn(t.meta, colors.text.muted)}>
          Markdown body
        </span>
        <ModeToggle
          mode={mode}
          onChange={setMode}
          // In compact mode, "split" is unavailable.
          options={isCompact ? MODES.filter((m) => m.value !== "split") : MODES}
        />
      </div>

      {/* Body — split or single-pane */}
      <div
        className={cn(
          "grid",
          showEdit && showPreview
            ? "grid-cols-2 divide-x"
            : "grid-cols-1",
          showEdit && showPreview && colors.divider,
        )}
        style={{ minHeight }}
      >
        {showEdit ? (
          <div className={cn("flex flex-col", colors.bg.elevated)}>
            <CodeMirror
              value={value}
              height={`${minHeight}px`}
              extensions={cmExtensions}
              onChange={onChange}
              onBlur={onBlur}
              aria-label={ariaLabel}
              basicSetup={{
                lineNumbers: false,
                foldGutter: false,
                highlightActiveLine: false,
                highlightActiveLineGutter: false,
              }}
              theme="light"
              className="flex-1"
            />
          </div>
        ) : null}

        {showPreview ? (
          <div
            className={cn(
              "overflow-y-auto px-5 py-4",
              colors.bg.elevated,
            )}
            style={{ maxHeight: minHeight + 40 }}
          >
            <PreviewPane body={value} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ModeToggle({
  mode,
  onChange,
  options,
}: {
  mode: EditorMode;
  onChange: (next: EditorMode) => void;
  options: ReadonlyArray<{ value: EditorMode; label: string }>;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Editor mode"
      className={cn(
        "inline-flex p-0.5",
        radius.md,
        colors.bg.surface,
        "border",
        colors.border.default,
      )}
    >
      {options.map((opt) => {
        const active = mode === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-2.5 py-1",
              radius.sm,
              t.meta,
              motion.fast,
              active
                ? cn(
                    colors.bg.elevated,
                    colors.text.primary,
                    "shadow-[0_1px_2px_oklch(0%_0_0/0.06)]",
                  )
                : cn(colors.text.muted, colors.hover.text.primary),
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function PreviewPane({ body }: { body: string }) {
  return (
    <div
      className={cn(
        // Lightweight prose styles — Tailwind v4 doesn't ship a
        // typography plugin out of the box; these classes target
        // the rendered markdown elements.
        t.body,
        colors.text.primary,
        "leading-7",
        "[&_h1]:text-[22px] [&_h1]:font-semibold [&_h1]:mt-4 [&_h1]:mb-2",
        "[&_h2]:text-[17px] [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2",
        "[&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1.5",
        "[&_p]:my-2",
        "[&_ul]:my-2 [&_ul]:pl-5 [&_ul]:list-disc",
        "[&_ol]:my-2 [&_ol]:pl-5 [&_ol]:list-decimal",
        "[&_li]:my-0.5",
        "[&_a]:underline [&_a]:underline-offset-4",
        "[&_a]:text-[oklch(60%_0.18_65)] dark:[&_a]:text-[oklch(76%_0.14_65)]",
        "[&_code]:font-mono [&_code]:text-[13px]",
        "[&_code]:bg-[oklch(92%_0.028_80)] dark:[&_code]:bg-[oklch(26%_0.014_270)]",
        "[&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded",
        "[&_pre]:bg-[oklch(92%_0.028_80)] dark:[&_pre]:bg-[oklch(26%_0.014_270)]",
        "[&_pre]:rounded [&_pre]:p-3 [&_pre]:my-3 [&_pre]:overflow-x-auto",
        "[&_pre>code]:bg-transparent [&_pre>code]:px-0 [&_pre>code]:py-0",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-[oklch(78%_0.025_80)]",
        "[&_blockquote]:pl-3 [&_blockquote]:my-2 [&_blockquote]:italic",
      )}
    >
      <ReactMarkdown rehypePlugins={[[rehypeSanitize, LOCKED_SANITIZE_SCHEMA]]}>
        {body || "_Empty body. Start typing to see the preview._"}
      </ReactMarkdown>
    </div>
  );
}
