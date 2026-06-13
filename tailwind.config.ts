import type { Config } from "tailwindcss";

/**
 * Sprint 12 / S12.1.1 — Tailwind v4 config.
 *
 * Inherits the visual baseline from `vendor/application-ui-v4/`
 * (Tailwind UI Application UI v4) but does NOT import any vendor
 * runtime — adopt-by-copy under `src/components/ui/<category>/`
 * is the only path. See `src/components/ui/README.md`.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      // Locked motion durations (S12.1.1b ships the design-tokens
      // module that re-exports these as TypeScript constants).
      transitionDuration: {
        fast: "120ms",
        base: "200ms",
        slow: "320ms",
      },
    },
  },
  plugins: [],
};

export default config;
