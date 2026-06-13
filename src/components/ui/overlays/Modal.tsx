/**
 * @adopted-from vendor/application-ui-v4/react/overlays/modal-dialogs/01-centered-with-single-action.jsx
 *
 * Generic centered modal. Sprint 12 / S12.1.1. Adapted to:
 *   - take title, description, primary CTA, secondary CTA via props
 *   - take children for arbitrary body content (S12.2.4 collision-
 *     diff modal + approve-confirmation modal both use this)
 *   - focus-trap via @headlessui/react Dialog (a11y locked)
 *   - depend only on local utilities; no vendor runtime import
 */

"use client";

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import type { ComponentType, JSX, ReactNode, SVGProps } from "react";

import { cn } from "@/lib/cn";
import { colors, motion, radius, type as t } from "@/lib/design-tokens";

export interface ModalProps {
  open: boolean;
  onClose: (open: boolean) => void;
  title: string;
  description?: string;
  /** Body content rendered between description and the action row. */
  children?: ReactNode;
  primaryAction: {
    label: string;
    onClick: () => void;
    /** Whether the primary action is disabled (e.g., typed-confirm not entered). */
    disabled?: boolean;
    /** "danger" surfaces red; "default" surfaces indigo. */
    variant?: "default" | "danger";
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    /** Sprint Y.11: optionally disable the secondary (e.g., "Cancel"
     *  during an in-flight mutation so the user can't bail mid-write). */
    disabled?: boolean;
  };
  /** Icon component, defaults to a warning triangle. */
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  /** Tone of the icon background. */
  iconTone?: "info" | "warning" | "danger" | "success";
}

const ICON_TONE_BG = {
  info: "bg-[oklch(94%_0.05_235)] text-[oklch(70%_0.13_235)] dark:bg-[oklch(26%_0.08_235)] dark:text-[oklch(74%_0.13_235)]",
  warning:
    "bg-[oklch(94%_0.06_80)] text-[oklch(78%_0.16_80)] dark:bg-[oklch(26%_0.10_80)] dark:text-[oklch(82%_0.16_80)]",
  danger:
    "bg-[oklch(94%_0.06_25)] text-[oklch(60%_0.18_25)] dark:bg-[oklch(26%_0.10_25)] dark:text-[oklch(70%_0.18_25)]",
  success:
    "bg-[oklch(94%_0.05_165)] text-[oklch(72%_0.13_165)] dark:bg-[oklch(26%_0.08_165)] dark:text-[oklch(76%_0.13_165)]",
} as const;

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  primaryAction,
  secondaryAction,
  icon: Icon = ExclamationTriangleIcon,
  iconTone = "warning",
}: ModalProps): JSX.Element {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className={cn(
          "fixed inset-0",
          "bg-[oklch(20%_0.01_80)]/80",
          "transition-opacity duration-[160ms] ease-out data-closed:opacity-0",
        )}
      />

      <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <DialogPanel
            transition
            className={cn(
              "relative transform overflow-hidden px-4 pt-5 pb-4 text-left transition-all data-closed:translate-y-4 data-closed:opacity-0 data-closed:scale-95 sm:my-8 sm:w-full sm:max-w-lg sm:p-6",
              "rounded-[14px]",
              "bg-[oklch(96%_0.006_80)] dark:bg-[oklch(22%_0.012_270)]",
              "shadow-[0_8px_24px_oklch(0%_0_0/0.12),0_2px_6px_oklch(0%_0_0/0.08)] dark:shadow-[0_8px_24px_oklch(0%_0_0/0.6),0_2px_6px_oklch(0%_0_0/0.5)]",
            )}
          >
            <div className="sm:flex sm:items-start">
              <div
                className={cn(
                  "mx-auto flex size-12 shrink-0 items-center justify-center rounded-full sm:mx-0 sm:size-10",
                  ICON_TONE_BG[iconTone],
                )}
              >
                <Icon aria-hidden="true" className="size-6" />
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                <DialogTitle
                  as="h3"
                  className={cn(t.h3, colors.text.primary)}
                >
                  {title}
                </DialogTitle>
                {description ? (
                  <div className="mt-2">
                    <p className={cn(t.body, colors.text.muted)}>
                      {description}
                    </p>
                  </div>
                ) : null}
                {children ? <div className="mt-4">{children}</div> : null}
              </div>
            </div>
            <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
              <button
                type="button"
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled}
                className={cn(
                  "inline-flex w-full justify-center px-3 py-2 sm:ml-3 sm:w-auto",
                  radius.md,
                  t.bodyStrong,
                  colors.accent.onSolid,
                  primaryAction.variant === "danger"
                    ? cn(
                        "bg-[oklch(60%_0.18_25)] hover:bg-[oklch(54%_0.18_25)]",
                        "focus-visible:outline focus-visible:outline-2",
                        "focus-visible:outline-[oklch(60%_0.18_25)]",
                      )
                    : cn(colors.accent.solid, colors.accent.ring),
                  motion.fast,
                  primaryAction.disabled && "opacity-50 cursor-not-allowed",
                )}
              >
                {primaryAction.label}
              </button>
              {secondaryAction ? (
                <button
                  type="button"
                  onClick={secondaryAction.onClick}
                  disabled={secondaryAction.disabled}
                  className={cn(
                    "mt-3 inline-flex w-full justify-center px-3 py-2 sm:mt-0 sm:w-auto",
                    radius.md,
                    t.bodyStrong,
                    colors.bg.elevated,
                    colors.text.primary,
                    "ring-1 ring-inset",
                    "ring-[oklch(80%_0.01_80)] dark:ring-[oklch(40%_0.014_270)]",
                    colors.hover.bgElevated,
                    motion.fast,
                    secondaryAction.disabled && "opacity-50 cursor-not-allowed",
                  )}
                >
                  {secondaryAction.label}
                </button>
              ) : null}
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
