/**
 * Sprint 12 / DEMO ONLY — review-detail stub.
 *
 * Replaced at S12.2.5 wiring with `/api/v1/reviews/{id}` returning
 * the same shape. The trust-traceability story (PRODUCT.md design
 * principle 1) is built against this stub: every finding cites a
 * source the engineer can walk back to.
 */

import type { ReviewState } from "@/lib/mock/engineer-activity";

export type Severity = "blocker" | "issue" | "suggestion" | "nit";

export interface FindingCitation {
  /** "knowledge", "linter", "repo" or similar source kind. */
  kind: "knowledge" | "linter" | "repo";
  /** Human label rendered as the chip text. */
  label: string;
  /** Locator visible in the citation footnote chip. */
  locator: string;
  /** External link (knowledge chunk, repo blob, lint rule URL). */
  href: string;
}

export interface Finding {
  id: string;
  severity: Severity;
  title: string;
  body: string;
  /** "<repo>/<path>:<line>" — clickable to source. */
  location: string;
  location_href: string;
  /** Auto-citations the bot produced for this finding. */
  citations: ReadonlyArray<FindingCitation>;
}

export interface ReviewDetail {
  id: string;
  repo: string;
  pr_number: number;
  pr_title: string;
  pr_author: string;
  pr_html_url: string;
  state: ReviewState;
  posted_at_label: string;
  /** Deep-link slugs for trust-traceability launch-pad. */
  temporal_run_url: string;
  langfuse_trace_url: string;
  findings: ReadonlyArray<Finding>;
}

const SAMPLE: ReviewDetail = {
  id: "rev-9821",
  repo: "acme/web",
  pr_number: 142,
  pr_title: "Add formatCurrency helper for the cart subtotal row",
  pr_author: "alpha",
  pr_html_url: "https://github.example.internal/acme/web/pull/142",
  state: "complete",
  posted_at_label: "Posted 3h ago",
  temporal_run_url: "https://temporal.internal/namespace/codemaster/workflows/rev-9821",
  langfuse_trace_url: "https://langfuse.internal/trace/rev-9821",
  findings: [
    {
      id: "f-1",
      severity: "issue",
      title: "Missing locale fallback when Intl.NumberFormat throws",
      body:
        "formatCurrency calls new Intl.NumberFormat(locale, { style: 'currency', currency }) but does not catch the RangeError that fires when a malformed locale or unsupported currency code is passed. On the cart subtotal row this would surface as a blank cell. Wrap the constructor in a try/catch and fall back to en-US + USD when it throws.",
      location: "src/lib/format.ts:42",
      location_href:
        "https://github.example.internal/acme/web/blob/feat-formatcurrency/src/lib/format.ts#L42",
      citations: [
        {
          kind: "knowledge",
          label: "team learning #L-417",
          locator: "Always wrap Intl.* constructors in a fallback",
          href: "/knowledge/learnings/L-417",
        },
        {
          kind: "linter",
          label: "no-throwing-intl",
          locator: "eslint-plugin-acme rule",
          href: "https://lint.example.internal/no-throwing-intl",
        },
      ],
    },
    {
      id: "f-2",
      severity: "issue",
      title: "Cart total recalculated on every render",
      body:
        "The Cart component invokes formatCurrency for every line item AND the subtotal on every render, even when the underlying cart state hasn't changed. With 50+ items this is measurable on low-end devices. Memoize via useMemo keyed on the cart hash.",
      location: "src/components/cart/Cart.tsx:88",
      location_href:
        "https://github.example.internal/acme/web/blob/feat-formatcurrency/src/components/cart/Cart.tsx#L88",
      citations: [
        {
          kind: "knowledge",
          label: "team learning #L-203",
          locator: "Memoize per-item format calls in cart-flavored lists",
          href: "/knowledge/learnings/L-203",
        },
      ],
    },
    {
      id: "f-3",
      severity: "issue",
      title: "Currency code is read from a stale ref",
      body:
        "currencyRef.current is captured once at mount and never updated when the user switches currencies in the locale picker. Either subscribe to the locale store or pass currency as a prop.",
      location: "src/components/cart/CartTotal.tsx:24",
      location_href:
        "https://github.example.internal/acme/web/blob/feat-formatcurrency/src/components/cart/CartTotal.tsx#L24",
      citations: [
        {
          kind: "repo",
          label: "src/stores/locale.ts",
          locator: "useLocale() hook",
          href:
            "https://github.example.internal/acme/web/blob/main/src/stores/locale.ts",
        },
      ],
    },
    {
      id: "f-4",
      severity: "suggestion",
      title: "Consider currency symbol position for RTL locales",
      body:
        "Currency symbol placement varies in RTL locales (e.g., Arabic). Intl.NumberFormat handles this correctly when the locale is set, but the surrounding row layout assumes the symbol prefixes the digits. Verify with the ar-EG sample fixture.",
      location: "src/components/cart/CartTotal.tsx:51",
      location_href:
        "https://github.example.internal/acme/web/blob/feat-formatcurrency/src/components/cart/CartTotal.tsx#L51",
      citations: [],
    },
  ],
};

export function getReviewDetail(id: string): ReviewDetail {
  return { ...SAMPLE, id };
}
