/**
 * @adopted-from vendor/application-ui-v4/react/elements/avatars/01-circular-avatars.jsx
 *
 * Avatar primitive. Sprint 12 / S12.1.1 + impeccable adopt-by-copy
 * catch-up 2026-05-04.
 *
 * Locked invariant (DESIGN.md): user identity in this app is
 * represented by deterministic geometric avatars from
 * `boring-avatars`, NEVER by initials-on-tinted-circle. The same
 * user identifier always seeds the same pattern.
 *
 * The vendor circular-avatar variants are used as the size + ring
 * scaffold; the visual is provided by `boring-avatars`. The
 * AVATAR_PALETTE is locked to the DESIGN.md status + accent slots
 * so avatars feel native to the brand surface.
 */

"use client";

import BoringAvatar from "boring-avatars";
import { cn } from "@/lib/cn";

const AVATAR_PALETTE = [
  "oklch(72% 0.16 65)", // amber accent
  "oklch(72% 0.13 165)", // mint
  "oklch(70% 0.13 235)", // calm blue
  "oklch(70% 0.06 320)", // dusty pink
  "oklch(78% 0.16 80)", // warm yellow
] as const;

const SIZE: Record<NonNullable<AvatarProps["size"]>, number> = {
  xs: 20,
  sm: 24,
  md: 32,
  lg: 40,
  xl: 56,
};

export interface AvatarProps {
  /** Stable identifier (sub claim / username) seeding the pattern. */
  name: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** `marble` (default), `beam`, `pixel`, `sunset`, `ring`, `bauhaus`. */
  variant?: "marble" | "beam" | "pixel" | "sunset" | "ring" | "bauhaus";
  /** Optional sr-label override; defaults to "Avatar for <name>". */
  label?: string;
  className?: string;
}

export function Avatar({
  name,
  size = "md",
  variant = "marble",
  label,
  className,
}: AvatarProps) {
  const px = SIZE[size];
  return (
    <span
      role="img"
      aria-label={label ?? `Avatar for ${name}`}
      className={cn("inline-block shrink-0 overflow-hidden rounded-full", className)}
      style={{ width: px, height: px }}
    >
      <BoringAvatar
        size={px}
        name={name}
        variant={variant}
        colors={[...AVATAR_PALETTE]}
      />
    </span>
  );
}
