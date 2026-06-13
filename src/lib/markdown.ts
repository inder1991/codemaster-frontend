import { defaultSchema } from "rehype-sanitize";

/**
 * Locked rehype-sanitize schema (extracted from MarkdownEditor so the
 * PR-summary renderer and the knowledge editor share one source of truth).
 * Strips executable/stylistic tags + the style attribute; restricts <a>.
 */
export const LOCKED_SANITIZE_SCHEMA = {
  ...defaultSchema,
  tagNames: (defaultSchema.tagNames ?? []).filter(
    (tag) => !["script", "iframe", "style", "object", "embed"].includes(tag),
  ),
  attributes: {
    ...(defaultSchema.attributes ?? {}),
    "*": (defaultSchema.attributes?.["*"] ?? []).filter((a) => a !== "style"),
    a: ["href", "title"],
  },
};

const SUMMARY_BLOCK_RE =
  /<!--\s*codemaster-summary-start\s*-->[\s\S]*?<!--\s*codemaster-summary-end\s*-->/g;

/** Remove codemaster's injected summary block from a raw PR body. */
export function stripCodemasterSummary(body: string | null): string {
  if (!body) return "";
  return body.replace(SUMMARY_BLOCK_RE, "").trim();
}
