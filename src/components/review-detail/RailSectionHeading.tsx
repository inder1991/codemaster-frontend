import type { ComponentType, ReactNode, SVGProps } from "react";

import { cn } from "@/lib/cn";
import { colors, type as t } from "@/lib/design-tokens";

/**
 * The single heading treatment for context-rail sections and the fix-prompt
 * hero. A real heading rung (not the muted-uppercase eyebrow), so sections
 * establish hierarchy. The eyebrow style is reserved for sub-labels.
 */
export function RailSectionHeading({
  icon: Icon,
  iconClassName,
  as: Tag = "h3",
  children,
}: {
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  /** Optional override for the icon color/size (e.g. an accent tint on the hero). */
  iconClassName?: string;
  as?: "h2" | "h3";
  children: ReactNode;
}) {
  return (
    <Tag
      className={cn(
        t.bodyStrong,
        colors.text.primary,
        "flex items-center gap-x-1.5",
      )}
    >
      {Icon ? (
        <Icon
          aria-hidden="true"
          className={cn("size-4 shrink-0", iconClassName)}
        />
      ) : null}
      {children}
    </Tag>
  );
}
