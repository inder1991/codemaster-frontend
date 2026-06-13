/**
 * Sprint 12 / S12.1.1 — no-op i18n shim.
 *
 * Locks the API surface so a v2 swap to `next-intl` (or
 * equivalent) is a back-end-only change. v0 ships English-only
 * by construction; the identity-function `useTranslations`
 * + `t(...)` lets pages use the same API today.
 *
 * Decision recorded in S12.1.1 ACs (head-of-UI 2026-05-04):
 *   "Lock a no-op i18n wrapper now (`useTranslations(...)` →
 *    identity function in v0). Cheap; removes a migration cost
 *    later."
 */

export type TranslationKey = string;

export type TranslationFn = (key: TranslationKey, vars?: Record<string, string | number>) => string;

/**
 * Returns a translator scoped to `_namespace`. Currently the
 * namespace is unused — calls return the key verbatim with
 * any `{var}` placeholders interpolated from `vars`.
 *
 * Usage:
 *   const t = useTranslations("your-reviews");
 *   <h1>{t("title")}</h1>
 *   <p>{t("greeting", { name: "Alice" })}</p>   // "greeting" → "greeting"
 *                                                 // (real impl: "Hello {name}" → "Hello Alice")
 */
export function useTranslations(_namespace: string): TranslationFn {
  return (key, vars) => {
    if (!vars) return key;
    return Object.entries(vars).reduce(
      (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)),
      key,
    );
  };
}
