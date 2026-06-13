/**
 * Sprint Y.5 (2026-05-11) — global toast primitive.
 *
 * Single source of transient UI feedback (errors, success, info)
 * across the admin shell. Replaces ad-hoc per-component error
 * banners. Components call `useToast()` and emit
 * `toast.error("...")` / `toast.success("...")` / `toast.info("...")`;
 * the `<ToastContainer>` rendered at the layout root displays them.
 *
 * Accessibility:
 *   - `error` toasts use role="alert" so AT announces them
 *     immediately (interrupts ongoing speech).
 *   - `success` / `info` toasts use role="status" + aria-live="polite"
 *     (queued, doesn't interrupt).
 *   - Each toast has a labelled "Dismiss" button so keyboard users
 *     can clear them without waiting for the auto-dismiss timer.
 *
 * Why not a third-party library?
 *   Toast UX is small enough that the local primitive costs less
 *   than the vendor risk + bundle weight + a11y audit overhead.
 *   `sonner` / `react-hot-toast` are good libraries but neither
 *   has the locked role+aria-live shape we need, and both add a
 *   dependency line that the spine-paths whitelist would have to
 *   absorb per CLAUDE.md "No new dependencies without justification".
 */

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from "react";

export type ToastVariant = "error" | "success" | "info";

interface ToastItem {
  id: number;
  variant: ToastVariant;
  message: string;
}

interface ToastContextValue {
  error: (message: string) => void;
  success: (message: string) => void;
  info: (message: string) => void;
  dismiss: (id: number) => void;
  items: ToastItem[];
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Default auto-dismiss timeout. Override per-call is intentionally
 * NOT exposed — keeping the API small means the UX stays consistent;
 * if a future story needs sticky toasts, add a `sticky` variant. */
const DEFAULT_TIMEOUT_MS = 4000;

export function ToastProvider({
  children,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  children: ReactNode;
  timeoutMs?: number;
}): JSX.Element {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const enqueue = useCallback(
    (variant: ToastVariant, message: string) => {
      const id = nextId.current++;
      setItems((prev) => [...prev, { id, variant, message }]);
      // Auto-dismiss after timeout. The setTimeout id is intentionally
      // not tracked — if the user dismisses earlier, the eventual
      // timer-fire is a harmless no-op (filter against a missing id
      // returns the same array reference).
      setTimeout(() => dismiss(id), timeoutMs);
    },
    [dismiss, timeoutMs],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      error: (message) => enqueue("error", message),
      success: (message) => enqueue("success", message),
      info: (message) => enqueue("info", message),
      dismiss,
      items,
    }),
    [enqueue, dismiss, items],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (ctx === null) {
    throw new Error("useToast must be used within a <ToastProvider>");
  }
  return ctx;
}

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  // Tailwind utility classes; design tokens live in `lib/design-tokens.ts`
  // but a toast's color palette is intentionally divergent so it stands
  // out from page content. Dark-mode safe.
  error: "bg-red-50 text-red-900 border-red-200 dark:bg-red-900/30 dark:text-red-100 dark:border-red-800",
  success:
    "bg-green-50 text-green-900 border-green-200 dark:bg-green-900/30 dark:text-green-100 dark:border-green-800",
  info: "bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-900/30 dark:text-blue-100 dark:border-blue-800",
};

function Toast({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: () => void;
}): JSX.Element {
  const isError = item.variant === "error";
  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      className={`pointer-events-auto flex items-start gap-3 rounded-md border px-4 py-3 shadow-md ${VARIANT_CLASSES[item.variant]}`}
    >
      <span data-testid="toast-message" className="flex-1 text-sm">
        {item.message}
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="rounded p-1 hover:bg-black/10 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-current"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className="h-4 w-4"
        >
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
}

export function ToastContainer(): JSX.Element | null {
  const { items, dismiss } = useToast();
  if (items.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-full max-w-sm flex-col gap-2"
    >
      {items.map((item) => (
        <Toast key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
      ))}
    </div>
  );
}
