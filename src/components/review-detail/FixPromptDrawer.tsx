"use client";

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import {
  CheckIcon,
  ClipboardDocumentIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";

import { Button } from "@/components/ui/elements/Button";
import { cn } from "@/lib/cn";
import { colors, type as t } from "@/lib/design-tokens";

export function FixPromptDrawer({
  open,
  onClose,
  prompt,
  onCopy,
}: {
  open: boolean;
  onClose: () => void;
  prompt: string;
  onCopy: () => void | Promise<boolean | void>;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const ok = await onCopy();
    if (ok !== false) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className={cn(
          "fixed inset-0 bg-[oklch(20%_0.01_80)]/70",
          "transition-opacity duration-[200ms] ease-out data-closed:opacity-0",
        )}
      />
      <div className="fixed inset-y-0 right-0 flex max-w-full">
        <DialogPanel
          transition
          className={cn(
            "flex h-full w-screen max-w-[40rem] transform flex-col",
            colors.bg.elevated,
            "shadow-[0_8px_24px_oklch(0%_0_0/0.16)] dark:shadow-[0_8px_24px_oklch(0%_0_0/0.6)]",
            "transition duration-300 ease-out data-closed:translate-x-full",
          )}
        >
          <div
            className={cn(
              "flex items-center justify-between gap-x-3 border-b px-4 py-3",
              colors.border.default,
            )}
          >
            <DialogTitle className={cn(t.bodyStrong, colors.text.primary)}>
              Fix-it prompt
            </DialogTitle>
            <div className="flex items-center gap-x-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleCopy}
                leadingIcon={
                  copied ? (
                    <CheckIcon className="size-4" />
                  ) : (
                    <ClipboardDocumentIcon className="size-4" />
                  )
                }
              >
                {copied ? "Copied" : "Copy prompt"}
              </Button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className={cn(
                  "rounded-md p-2.5",
                  colors.text.muted,
                  colors.hover.text.primary,
                )}
              >
                <XMarkIcon aria-hidden="true" className="size-5" />
              </button>
            </div>
          </div>
          <pre
            className={cn(
              "flex-1 overflow-auto whitespace-pre-wrap break-words p-4 font-mono",
              t.caption,
              colors.text.primary,
            )}
          >
            {prompt}
          </pre>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
