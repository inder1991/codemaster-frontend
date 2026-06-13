import "@testing-library/jest-dom/vitest";

/**
 * jsdom under this vitest setup leaves `window.localStorage` as
 * an empty plain object with no methods. Attach a working
 * in-memory Storage-like shim so tests that exercise
 * `localStorage` (notably the EditorAutosave hook) work.
 *
 * Idempotent: only swaps the shim in when the existing object
 * lacks `getItem`.
 */
if (typeof window !== "undefined") {
  const existing = (window as unknown as { localStorage?: unknown })
    .localStorage;
  const isFunctional =
    existing && typeof (existing as Storage).getItem === "function";
  if (!isFunctional) {
    const store = new Map<string, string>();
    const shim: Storage = {
      getItem(key) {
        return store.has(key) ? (store.get(key) as string) : null;
      },
      setItem(key, value) {
        store.set(key, String(value));
      },
      removeItem(key) {
        store.delete(key);
      },
      clear() {
        store.clear();
      },
      key(index) {
        return Array.from(store.keys())[index] ?? null;
      },
      get length() {
        return store.size;
      },
    };
    Object.defineProperty(window, "localStorage", {
      value: shim,
      writable: true,
      configurable: true,
    });
  }

  // jsdom doesn't ship `window.matchMedia`. Several components
  // (notably `MarkdownEditor` reading the prefers-color-scheme
  // media query) call it unconditionally on mount; without the
  // shim the test renders crash. Sprint 15 / S15.C added this when
  // the knowledge-detail page tests started exercising the editor.
  if (
    typeof (window as unknown as { matchMedia?: unknown }).matchMedia !==
    "function"
  ) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
}
