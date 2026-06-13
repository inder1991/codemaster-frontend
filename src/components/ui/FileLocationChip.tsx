/**
 * FileLocationChip — monospace middle-truncated file locator chip.
 *
 * Renders `dir/.../parent/file.py:L88` (or `:L88-92` for ranges).
 * Middle-truncates paths with more than 3 segments, preserving the
 * first segment, an ellipsis, and the last two segments.
 */

import { cn } from "@/lib/cn";
import { colors, type as t } from "@/lib/design-tokens";

export interface FileLocationChipProps {
  path: string;
  startLine: number;
  endLine: number;
}

function truncatePath(path: string): string {
  const parts = path.split("/");
  if (parts.length <= 3) {
    return path;
  }
  // Keep parts[0] + "..." + parts[-2] + parts[-1]
  const first = parts[0];
  const parent = parts[parts.length - 2];
  const file = parts[parts.length - 1];
  return `${first}/.../${parent}/${file}`;
}

function buildLineRange(startLine: number, endLine: number): string {
  if (startLine === endLine) {
    return `L${startLine}`;
  }
  return `L${startLine}-${endLine}`;
}

export function FileLocationChip({
  path,
  startLine,
  endLine,
}: FileLocationChipProps) {
  const displayPath = truncatePath(path);
  const lineRange = buildLineRange(startLine, endLine);

  return (
    <span
      title={path}
      className={cn(
        "inline-flex items-baseline gap-0 font-mono tabular-nums tracking-tight",
        t.caption,
        colors.text.faint,
      )}
    >
      <span className="truncate max-w-[14rem]">{displayPath}</span>
      <span className={colors.text.accent}>
        {":"}
        {lineRange}
      </span>
    </span>
  );
}
