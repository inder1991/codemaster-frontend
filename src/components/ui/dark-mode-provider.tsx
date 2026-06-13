/**
 * Sprint 12 / S12.1.1b — dark-mode toggle.
 *
 * Locked v0 behaviour:
 *   - Defaults to "light".
 *   - User preference persists in localStorage under the key
 *     `codemaster-admin:theme`.
 *   - The class toggle (`dark`) lives on `<html>`; Tailwind
 *     dark variant uses the `class` strategy.
 *   - Initial render reads localStorage in a lazy initializer so
 *     the React state agrees with the DOM mutation done by the
 *     synchronous theme prelude in `app/layout.tsx`. Without this,
 *     the toggle icon flashes to the wrong glyph for one frame on
 *     navigation/reload when the user has chosen dark.
 */

"use client";

import { createContext, useContext, useEffect, useState, type JSX, type ReactNode } from "react";

export type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "codemaster-admin:theme";

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function DarkModeProvider({ children }: { children: ReactNode }): JSX.Element {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);

  // Reconcile DOM with provider state on mount. The prelude is the
  // primary path and is symmetric, but if anything (browser
  // extension, dev tools, prior buggy prelude version) has left a
  // stale class on <html>, this ensures the DOM matches the React
  // state on first paint after hydration. Re-runs on theme change
  // would duplicate the apply that setTheme already does.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    applyTheme(theme);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    applyTheme(t);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, t);
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggle: () => setTheme(theme === "light" ? "dark" : "light"),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside <DarkModeProvider/>");
  }
  return ctx;
}

function applyTheme(t: Theme): void {
  if (typeof document === "undefined") return;
  if (t === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}
