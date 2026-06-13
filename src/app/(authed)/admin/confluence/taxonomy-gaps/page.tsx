/**
 * Sub-spec C T15 dashboard 1 (2026-05-28) — taxonomy gaps. Surfaces
 * unrecognized:* labels engineers reach for that the platform taxonomy
 * doesn't yet curate. Sorted by chunks_carrying DESC. Operator can
 * suggest a curation per row; suggestion goes to the IDP team queue.
 */

"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { SuggestTaxonomyModal } from "@/components/confluence/SuggestTaxonomyModal";
import { Button } from "@/components/ui/elements/Button";
import {
  AdminApiError,
  fetchTaxonomyGaps,
  postTaxonomySuggestion,
  QUERY_KEYS,
  type TaxonomyGapEntryV1,
  type TaxonomySuggestionV1,
} from "@/lib/api/admin";
import { useAdminQueryGuards } from "@/lib/api/use-admin-query-guards";
import { cn } from "@/lib/cn";
import { colors, type as t } from "@/lib/design-tokens";

export default function TaxonomyGapsAdminPage() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: QUERY_KEYS.taxonomyGaps(),
    queryFn: () => fetchTaxonomyGaps(),
  });
  const { guardElement } = useAdminQueryGuards(query, "taxonomy-gaps");

  const [target, setTarget] = useState<TaxonomyGapEntryV1 | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const mutation = useMutation({
    mutationFn: (body: TaxonomySuggestionV1) => postTaxonomySuggestion(body),
    onSuccess: async () => {
      setTarget(null);
      setErrorMessage(undefined);
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.taxonomyGaps(),
      });
    },
    onError: (err) => {
      if (err instanceof AdminApiError) {
        setErrorMessage(`Couldn't submit (status ${err.status}).`);
      } else {
        setErrorMessage("Couldn't submit the suggestion.");
      }
    },
  });

  if (guardElement !== null) return guardElement;

  const rows = query.data?.rows ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className={cn(t.display, colors.text.primary)}>Taxonomy gaps</h1>
        <p className={cn(t.body, colors.text.muted)}>
          Labels engineers reach for that the platform taxonomy doesn&apos;t
          yet curate. Suggest a curation to route the label to the IDP team
          for review.
        </p>
      </header>

      {rows.length === 0 ? (
        <p className={cn(t.body, colors.text.muted)}>
          No unrecognized labels in the most recent window — good.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className={cn(t.meta, colors.text.muted, "text-left")}>
                <th className="px-3 py-2">Label</th>
                <th className="px-3 py-2 text-right">Chunks</th>
                <th className="px-3 py-2 text-right">Pages</th>
                <th className="px-3 py-2 text-right">Spaces</th>
                <th className="px-3 py-2">Most recent use</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.label}
                  className={cn("border-t", colors.border.default)}
                >
                  <td
                    className={cn(
                      "px-3 py-2 font-mono",
                      t.bodyStrong,
                      colors.text.primary,
                    )}
                  >
                    {row.label}
                  </td>
                  <td className={cn("px-3 py-2 text-right", t.meta)}>
                    {row.chunks_carrying.toLocaleString()}
                  </td>
                  <td className={cn("px-3 py-2 text-right", t.meta)}>
                    {row.pages_carrying.toLocaleString()}
                  </td>
                  <td className={cn("px-3 py-2 text-right", t.meta)}>
                    {row.spaces_carrying.toLocaleString()}
                  </td>
                  <td className={cn("px-3 py-2", t.meta, colors.text.muted)}>
                    {new Date(row.most_recent_use).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setTarget(row)}
                    >
                      Suggest curation
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {target ? (
        <SuggestTaxonomyModal
          open
          unrecognizedLabel={target.label}
          onConfirm={(body) => mutation.mutate(body)}
          onCancel={() => {
            setTarget(null);
            setErrorMessage(undefined);
          }}
          submitting={mutation.isPending}
          {...(errorMessage ? { errorMessage } : {})}
        />
      ) : null}
    </div>
  );
}
