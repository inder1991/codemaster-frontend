/**
 * PART 3 §1 — Enterprise settings-page section layout component.
 *
 * Grid: `grid-cols-1 lg:grid-cols-3` with a top divider (suppressed on the
 * first section via the `first` prop).
 *
 * Left rail (col-span-1): `<h2>` title + muted `<p>` description.
 * Content (col-span-2): `{children}`.
 *
 * This replaces the old inline `<h2>` + 2-column grid pattern that put
 * provider cards and model/routing stacked side-by-side.
 */

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { colors, type as t } from "@/lib/design-tokens";

export interface SettingsSectionProps {
  title: string;
  description: string;
  children: ReactNode;
  /** Suppress the top divider on the first section in a stack. */
  first?: boolean;
}

export function SettingsSection({
  title,
  description,
  children,
  first = false,
}: SettingsSectionProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 lg:grid-cols-3 gap-x-8 gap-y-4 py-8",
        !first && cn("border-t", colors.divider),
      )}
    >
      {/* Left rail — title + description */}
      <div className="lg:col-span-1">
        <h2 className={cn(t.h2, colors.text.primary)}>{title}</h2>
        <p className={cn("mt-1", t.meta, colors.text.muted)}>{description}</p>
      </div>

      {/* Content area */}
      <div className="lg:col-span-2 space-y-4">{children}</div>
    </div>
  );
}
