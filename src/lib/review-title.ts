/**
 * Smoke / automation PRs prefix the PR title with a `[run:<uuid>]` tag.
 * That run id is machine noise in any human-facing title surface (it stays
 * available via the Branches field / the full title tooltip), so strip it for
 * display. Returns the original title when the result would be empty.
 */
export function stripRunPrefix(title: string): string {
  return title.replace(/^\s*\[run:[^\]]*\]\s*/i, "").trim() || title;
}
