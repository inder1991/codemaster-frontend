/**
 * Sprint 12 / S12.2.x — engineer-home time-window selector.
 *
 * Three rungs: 7 / 30 / 90 days. Default is 7d (fits the locked
 * "11am between-meeting glance" calibration scene; engineers come
 * back for the recent state, not historical aggregates).
 *
 * Persists in localStorage under `codemaster-admin:home-window` so
 * the user's preferred window survives reloads. Hydrates lazily
 * (matches the dark-mode pattern; see dark-mode-provider.tsx).
 */

"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";
import { colors, motion, radius, type as t } from "@/lib/design-tokens";

export type WindowDays = 7 | 30 | 90;

const STORAGE_KEY = "codemaster-admin:home-window";
const OPTIONS: ReadonlyArray<{ value: WindowDays; label: string }> = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];

function readStoredWindow(): WindowDays {
  if (typeof window === "undefined") return 7;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const n = Number(raw);
    return n === 30 || n === 90 ? n : 7;
  } catch {
    return 7;
  }
}

export function TimeWindowToggle({
  value,
  onChange,
}: {
  value: WindowDays;
  onChange: (next: WindowDays) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Time window"
      className={cn(
        "inline-flex p-0.5",
        radius.md,
        colors.bg.muted,
      )}
    >
      {OPTIONS.map((opt) => {
        const active = opt.value === value;
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

/**
 * Hook owning the persisted selection. Components that don't care
 * about persistence can ignore this and pass their own state.
 */
export function useTimeWindow() {
  const [windowDays, setWindowDays] = useState<WindowDays>(readStoredWindow);
  const update = (next: WindowDays) => {
    setWindowDays(next);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // localStorage may be unavailable (private browsing); silent.
      }
    }
  };
  return [windowDays, update] as const;
}
