/**
 * Sprint 13 / S13.1.2 — Audit-log search page.
 * Sprint 14 / S14.C — wired to GET /api/admin/audit-events.
 *
 * Filter bar: free-text actor + action + target filters + 3-rung
 * time-window radio (24h / 7d / 30d). Filter state lives in URL
 * search params so a refresh restores the search.
 *
 * Results list is server-paginated via opaque cursor; this page
 * appends pages on "Load more" (state-accumulator UX rather than
 * page-replacement, matching the search-results convention).
 *
 * Visible to reader+. Cross-tenant search is gated server-side and
 * not exposed in the v0 UI; the security_auditor cross-tenant flow
 * uses a follow-up sprint surface (`?cross_tenant=true`).
 *
 * Vault degradation: when the backend returns `X-Vault-Degraded:
 * true`, the page surfaces a yellow banner above the results.
 * Vault decryption may fall back to ciphertext placeholders for
 * the before/after excerpts; the rest of the page still works.
 */

"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AuditEventRow } from "@/components/audit-log/AuditEventRow";
import { Button } from "@/components/ui/elements/Button";
import { Card } from "@/components/ui/elements/Card";
import { Empty } from "@/components/ui/states/Empty";
import { EmptyIllustration } from "@/components/ui/states/EmptyIllustration";
import {
  searchAuditEvents,
  QUERY_KEYS,
  type AuditEventListItemV1,
  type AuditSearchFilters,
} from "@/lib/api/admin";
import { useAdminQueryGuards } from "@/lib/api/use-admin-query-guards";
import { cn } from "@/lib/cn";
import { colors, motion, radius, type as t } from "@/lib/design-tokens";

type WindowDays = 1 | 7 | 30;

const WINDOW_OPTIONS: ReadonlyArray<{ value: WindowDays; label: string }> = [
  { value: 1, label: "Last 24h" },
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
];

interface FilterState {
  actor: string;
  action: string;
  target: string;
  windowDays: WindowDays;
  /** ISO-8601, only present when supplied via URL. Overrides
   *  windowDays-derived values; lets shared search URLs pin a
   *  precise range. */
  fromAt: string | null;
  toAt: string | null;
}

const DEFAULT_FILTER: FilterState = {
  actor: "",
  action: "",
  target: "",
  windowDays: 7,
  fromAt: null,
  toAt: null,
};

function readFiltersFromSearch(params: URLSearchParams): FilterState {
  const w = params.get("window");
  const windowDays: WindowDays = w === "1" ? 1 : w === "30" ? 30 : 7;
  return {
    actor: params.get("actor") ?? "",
    action: params.get("action") ?? "",
    target: params.get("target") ?? "",
    windowDays,
    fromAt: params.get("from_at"),
    toAt: params.get("to_at"),
  };
}

function filterStateToParams(state: FilterState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.actor.trim()) params.set("actor", state.actor.trim());
  if (state.action.trim()) params.set("action", state.action.trim());
  if (state.target.trim()) params.set("target", state.target.trim());
  if (state.windowDays !== DEFAULT_FILTER.windowDays) {
    params.set("window", String(state.windowDays));
  }
  if (state.fromAt) params.set("from_at", state.fromAt);
  if (state.toAt) params.set("to_at", state.toAt);
  return params;
}

/** Returns a human-readable error if the filter range is invalid;
 *  null otherwise. Today the only invalid configuration is a
 *  fromAt that is after a toAt — both must be supplied for the
 *  comparison to apply. */
function validateFilter(state: FilterState): string | null {
  if (state.fromAt && state.toAt) {
    const from = Date.parse(state.fromAt);
    const to = Date.parse(state.toAt);
    if (Number.isFinite(from) && Number.isFinite(to) && from > to) {
      return "From date must precede To date — adjust the URL or reset the filters.";
    }
  }
  return null;
}

function filterStateToQuery(
  state: FilterState,
  cursor: string | undefined,
  now: Date,
): AuditSearchFilters {
  // URL-pinned range wins over windowDays — lets a shared link
  // resolve to the exact same query the author saw.
  const toAt = state.toAt ?? now.toISOString();
  const fromAt =
    state.fromAt ??
    new Date(now.getTime() - state.windowDays * 24 * 60 * 60 * 1000).toISOString();
  const filters: AuditSearchFilters = {
    from_at: fromAt,
    to_at: toAt,
  };
  if (state.actor.trim()) filters.actor = state.actor.trim();
  if (state.action.trim()) filters.action = state.action.trim();
  if (state.target.trim()) filters.target_id = state.target.trim();
  if (cursor) filters.cursor = cursor;
  return filters;
}

export default function AuditLogPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Filter state derives from the URL on first render so a refresh
  // restores it. User edits push back into the URL via router.replace.
  const [filter, setFilter] = useState<FilterState>(() =>
    readFiltersFromSearch(searchParams),
  );

  // Cursor pagination state — page rows append to the result list.
  const [pages, setPages] = useState<AuditEventListItemV1[][]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  // Pin "now" to the first render so cursor pages share the same upper
  // bound as the initial fetch — otherwise wall-clock drift between
  // fetches creates duplicate rows on the boundary.
  const now = useMemo(() => new Date(), []);
  const queryFilters = useMemo(
    () => filterStateToQuery(filter, cursor, now),
    [filter, cursor, now],
  );

  // Client-side validation gate (sprint-14.md S14.C edge case 5).
  // Today the only invalid configuration is from_at > to_at (only
  // reachable via direct URL editing). Surfacing it here saves a
  // round-trip + gives the user actionable copy that the backend's
  // generic 422 would not.
  const filterValidationError = useMemo(
    () => validateFilter(filter),
    [filter],
  );

  // Reset accumulated pages whenever the active filter changes (a
  // filter edit invalidates the prior page set; a Load-more keeps it).
  // We track this via a JSON key over the filter so the effect runs
  // exactly once per filter mutation.
  const filterKey = useMemo(
    () =>
      JSON.stringify({
        a: filter.actor,
        c: filter.action,
        t: filter.target,
        w: filter.windowDays,
        f: filter.fromAt,
        u: filter.toAt,
      }),
    [filter],
  );

  useEffect(() => {
    setPages([]);
    setCursor(undefined);
  }, [filterKey]);

  // Push filter state into the URL (replace, not push, so the
  // back-button doesn't grow a history entry per keystroke).
  useEffect(() => {
    const params = filterStateToParams(filter);
    const target = params.toString()
      ? `${pathname}?${params.toString()}`
      : pathname;
    router.replace(target);
  }, [filter, pathname, router]);

  const query = useQuery({
    queryKey: QUERY_KEYS.auditEvents(queryFilters),
    queryFn: () => searchAuditEvents(queryFilters),
    // Keep the prior page visible during keystroke-driven refetches so
    // the filter inputs do not unmount mid-type and lose focus.
    placeholderData: keepPreviousData,
    // Hard-skip the network round-trip when client-side validation
    // says the request is malformed. The backend would (or should)
    // 422, but the user sees the inline error first.
    enabled: filterValidationError === null,
  });

  // When a fresh page arrives, append it to the accumulator so
  // "Load more" UX works without duplicating server work.
  useEffect(() => {
    if (query.data) {
      setPages((prior) => {
        // Avoid double-append on retry / refetch: the last entry
        // already corresponds to this cursor if it matches.
        const lastRows = prior.at(-1);
        if (lastRows && lastRows[0]?.audit_event_id === query.data.rows[0]?.audit_event_id) {
          return prior;
        }
        return [...prior, query.data.rows];
      });
    }
  }, [query.data]);

  const { guardElement } = useAdminQueryGuards(query, "audit-log");
  if (guardElement !== null) return guardElement;

  const rows = pages.flat();
  const nextCursor = query.data?.next_cursor ?? null;
  const vaultDegraded = query.data?.vault_degraded ?? false;

  const updateFilter = (patch: Partial<FilterState>): void => {
    setFilter((prev) => ({ ...prev, ...patch }));
  };

  const reset = (): void => setFilter(DEFAULT_FILTER);

  const loadMore = (): void => {
    if (nextCursor) setCursor(nextCursor);
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className={cn(t.display, colors.text.primary)}>Audit log</h1>
        <p className={cn("mt-2 max-w-2xl", t.bodyLarge, colors.text.muted)}>
          Searchable trail of every state-changing action in the
          tenant: kill-switch flips, integration changes, knowledge
          approvals, review posts. Filter by actor + action + window
          to investigate without writing SQL.
        </p>
      </header>

      <Card padding="md">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label
              htmlFor="audit-actor"
              className={cn("block", t.meta, colors.text.primary)}
            >
              Actor
            </label>
            <input
              id="audit-actor"
              type="text"
              value={filter.actor}
              onChange={(e) => updateFilter({ actor: e.target.value })}
              placeholder="alpha-uid"
              autoComplete="off"
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="audit-action"
              className={cn("block", t.meta, colors.text.primary)}
            >
              Action
            </label>
            <input
              id="audit-action"
              type="text"
              value={filter.action}
              onChange={(e) => updateFilter({ action: e.target.value })}
              placeholder="flag.put"
              autoComplete="off"
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="audit-target"
              className={cn("block", t.meta, colors.text.primary)}
            >
              Target
            </label>
            <input
              id="audit-target"
              type="text"
              value={filter.target}
              onChange={(e) => updateFilter({ target: e.target.value })}
              placeholder="rev-9821"
              autoComplete="off"
              className={inputClass}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <span
              className={cn("block", t.meta, colors.text.primary)}
            >
              Time window
            </span>
            <div
              role="radiogroup"
              aria-label="Time window"
              className={cn(
                "mt-1 inline-flex p-0.5",
                radius.md,
                colors.bg.muted,
              )}
            >
              {WINDOW_OPTIONS.map((opt) => {
                const active = opt.value === filter.windowDays;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => updateFilter({ windowDays: opt.value })}
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
                        : cn(
                            colors.text.muted,
                            colors.hover.text.primary,
                          ),
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={reset}>
            Reset filters
          </Button>
        </div>
      </Card>

      {filterValidationError !== null ? (
        <p
          data-testid="audit-filter-error"
          role="alert"
          className={cn(
            "px-3 py-2",
            radius.sm,
            t.body,
            "bg-[oklch(94%_0.06_25)] dark:bg-[oklch(26%_0.10_25)]",
            "text-[oklch(45%_0.14_25)] dark:text-[oklch(80%_0.12_25)]",
          )}
        >
          {filterValidationError}
        </p>
      ) : null}

      {vaultDegraded ? (
        <p
          data-testid="audit-vault-degraded"
          role="alert"
          className={cn(
            "px-3 py-2",
            radius.sm,
            t.body,
            "bg-[oklch(94%_0.06_80)] dark:bg-[oklch(26%_0.10_80)]",
            "text-[oklch(45%_0.14_80)] dark:text-[oklch(82%_0.16_80)]",
          )}
        >
          Vault decryption is degraded — before/after excerpts may
          appear as ciphertext placeholders. The rest of the audit
          trail is intact.
        </p>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-x-4">
          <h2 className={cn(t.h2, colors.text.primary)}>
            Results ({rows.length})
          </h2>
        </div>
        {rows.length === 0 ? (
          <Empty
            illustration={<EmptyIllustration />}
            title="No matching audit events"
            body="Try widening the time window or clearing the actor / action filters."
          />
        ) : (
          <>
            <Card>
              <ul className={cn("divide-y", colors.divider)}>
                {rows.map((e) => (
                  <li key={e.audit_event_id}>
                    <AuditEventRow event={e} />
                  </li>
                ))}
              </ul>
            </Card>
            {nextCursor ? (
              <div className="flex justify-center pt-2">
                <Button variant="secondary" size="md" onClick={loadMore}>
                  Load more
                </Button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

const inputClass = cn(
  "mt-1 block w-full px-3 py-2",
  radius.sm,
  t.body,
  colors.bg.surface,
  colors.text.primary,
  "outline-1 -outline-offset-1",
  "outline-[oklch(80%_0.01_80)] dark:outline-[oklch(40%_0.014_270)]",
  "focus:outline-2 focus:-outline-offset-2",
  "focus:outline-[oklch(72%_0.16_65)]",
  motion.fast,
);
