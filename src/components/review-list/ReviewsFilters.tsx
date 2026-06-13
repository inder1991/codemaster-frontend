"use client";

import { cn } from "@/lib/cn";
import { colors, radius, type as t } from "@/lib/design-tokens";

export interface ReviewFilterValues {
  q: string;
  org: string;
  repo: string;
  state: string;
}

const STATE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All states" },
  { value: "queued", label: "Queued" },
  { value: "in_progress", label: "In progress" },
  { value: "complete", label: "Complete" },
  { value: "failed", label: "Failed" },
];

const inputCls = cn(
  t.meta,
  colors.bg.elevated,
  colors.text.primary,
  radius.sm,
  "px-2.5 py-1 border",
  colors.border.default,
);

export function ReviewsFilters({
  values,
  orgs,
  orgsLoading,
  orgsError,
  onChange,
}: {
  values: ReviewFilterValues;
  orgs: string[];
  orgsLoading: boolean;
  orgsError: boolean;
  onChange: (partial: Partial<ReviewFilterValues>) => void;
}) {
  const active = Boolean(values.q || values.org || values.repo || values.state);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="search"
        aria-label="Search PR titles"
        placeholder="Search PR titles…"
        value={values.q}
        onChange={(e) => onChange({ q: e.target.value })}
        className={inputCls}
      />

      {/* Scalability: a native select is fine to ~60 orgs; swap to a searchable
          combobox above ~100. See the reviews-list spec. */}
      {!orgsError ? (
        <select
          aria-label="Organisation"
          value={values.org}
          disabled={orgsLoading}
          onChange={(e) => onChange({ org: e.target.value })}
          className={cn(inputCls, "disabled:opacity-50")}
        >
          <option value="">{orgsLoading ? "Loading orgs…" : "All orgs"}</option>
          {orgs.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : null}

      <input
        type="text"
        aria-label="Repository"
        placeholder="Repo…"
        value={values.repo}
        onChange={(e) => onChange({ repo: e.target.value })}
        className={inputCls}
      />

      <select
        aria-label="State"
        value={values.state}
        onChange={(e) => onChange({ state: e.target.value })}
        className={inputCls}
      >
        {STATE_OPTIONS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      {active ? (
        <button
          type="button"
          onClick={() => onChange({ q: "", org: "", repo: "", state: "" })}
          className={cn(
            t.meta,
            colors.text.muted,
            colors.hover.text.primary,
            "underline underline-offset-4",
          )}
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
