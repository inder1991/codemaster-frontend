/**
 * Local re-implementation of the `classNames(...)` helper used
 * by Tailwind UI components — kept here so adopted components
 * never need to import from `vendor/application-ui-v4/`
 * (eslint blocks that path; this is the locked alternative).
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
