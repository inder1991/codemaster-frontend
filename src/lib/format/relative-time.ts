/**
 * Sprint 16 / S16.F.4 — shared `formatRelativeTime` helper.
 *
 * Replaces the bespoke `formatRelative` in
 * `components/kill-switches/FlagRow.tsx` and the bare
 * `toLocaleDateString()` in `components/knowledge/LearningRow.tsx`.
 * Single source of truth so a `platform_owner` skimming any admin
 * list sees consistent "3h ago" / "2d ago" formatting.
 *
 * Format ladder:
 *   null              → "never"
 *   < 60 seconds      → "just now"
 *   < 60 minutes      → "Nm ago"
 *   < 24 hours        → "Nh ago"
 *   < 30 days         → "Nd ago"
 *   ≥ 30 days         → absolute date via `toLocaleDateString()`
 */

export function formatRelativeTime(iso: string | null): string {
  if (iso === null) {
    return "never";
  }
  const elapsedMs = Date.now() - new Date(iso).getTime();

  // Future timestamps (clock skew between client + server) →
  // treat as "just now" rather than negative-time output.
  if (elapsedMs < 0) {
    return "just now";
  }

  const sec = Math.floor(elapsedMs / 1_000);
  if (sec < 60) {
    return "just now";
  }
  const min = Math.floor(elapsedMs / 60_000);
  if (min < 60) {
    return `${min}m ago`;
  }
  const h = Math.floor(min / 60);
  if (h < 24) {
    return `${h}h ago`;
  }
  const d = Math.floor(h / 24);
  if (d < 30) {
    return `${d}d ago`;
  }
  // ≥ 30 days — absolute date is more useful than "Nd ago" at
  // that resolution.
  return new Date(iso).toLocaleDateString();
}
