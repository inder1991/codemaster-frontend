/**
 * Sub-spec C T13 (2026-05-28) — slide-over presenting the quarantined
 * Confluence chunks for one integration. Read-only — operators triage
 * by editing the underlying Confluence page; the next sync recomputes
 * the quarantine state.
 *
 * The slide-over container reuses the locked Modal primitive; the
 * paginated list cursor lives in local component state (one cursor
 * stack since the API is forward-only).
 */

"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  fetchQuarantinedChunks,
  QUERY_KEYS,
  type QuarantinedChunkV1,
} from "@/lib/api/admin";
import { Button } from "@/components/ui/elements/Button";
import { Modal } from "@/components/ui/overlays/Modal";
import { cn } from "@/lib/cn";
import { colors, radius, type as t } from "@/lib/design-tokens";

export interface QuarantinedChunksSidebarProps {
  open: boolean;
  onClose: () => void;
  integrationId: string;
}

export function QuarantinedChunksSidebar({
  open,
  onClose,
  integrationId,
}: QuarantinedChunksSidebarProps) {
  const [accumulated, setAccumulated] = useState<QuarantinedChunkV1[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  const query = useQuery({
    queryKey: QUERY_KEYS.quarantinedChunks(integrationId, cursor),
    queryFn: async () => {
      const page = await fetchQuarantinedChunks({
        integration_id: integrationId,
        ...(cursor !== undefined ? { cursor } : {}),
      });
      setAccumulated((prev) =>
        cursor === undefined ? [...page.rows] : [...prev, ...page.rows],
      );
      return page;
    },
    enabled: open && integrationId !== "",
  });

  const handleClose = (next: boolean) => {
    if (!next) {
      setAccumulated([]);
      setCursor(undefined);
      onClose();
    }
  };

  const isEmpty =
    !query.isLoading && accumulated.length === 0 && !query.isError;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Quarantined chunks"
      description="Chunks the sync pipeline refused to ingest. Triage by editing the source page in Confluence — the next sync recomputes this list."
      iconTone="warning"
      primaryAction={{
        label: "Close",
        onClick: onClose,
      }}
    >
      <div className="space-y-3">
        {query.isLoading ? (
          <p className={cn(t.body, colors.text.muted)}>Loading…</p>
        ) : null}
        {query.isError ? (
          <p
            role="alert"
            className={cn(
              "px-3 py-2",
              radius.sm,
              t.body,
              colors.status.down,
            )}
          >
            Couldn&apos;t load quarantined chunks. The integration may have been
            removed.
          </p>
        ) : null}
        {isEmpty ? (
          <p className={cn(t.body, colors.text.muted)}>
            No quarantined chunks for this integration. Anything the sync
            refused appears here.
          </p>
        ) : null}
        {accumulated.map((row) => (
          <div
            key={row.chunk_id}
            className={cn(
              "px-3 py-2 space-y-1",
              radius.sm,
              colors.bg.muted,
            )}
          >
            <p className={cn(t.bodyStrong, colors.text.primary)}>
              {row.page_title}
            </p>
            <p className={cn(t.meta, colors.text.muted)}>
              Space {row.space_key} · page {row.page_id} · v{row.page_version}
            </p>
            <p className={cn(t.meta, colors.text.muted)}>
              Page last modified:{" "}
              {new Date(row.last_modified_at).toLocaleString()}
            </p>
            <div className="flex flex-wrap gap-1">
              {row.quarantine_reasons.map((reason) => (
                <span
                  key={reason}
                  className={cn(
                    "inline-block px-2 py-0.5",
                    radius.sm,
                    t.caption,
                    "bg-[oklch(94%_0.06_85)] dark:bg-[oklch(26%_0.10_85)]",
                    "text-[oklch(45%_0.14_85)] dark:text-[oklch(80%_0.12_85)]",
                  )}
                >
                  {reason}
                </span>
              ))}
            </div>
            {row.chunk_text_preview ? (
              <p className={cn(t.caption, colors.text.faint)}>
                &ldquo;{row.chunk_text_preview}&rdquo;
              </p>
            ) : null}
          </div>
        ))}
        {query.data?.next_cursor ? (
          <Button
            variant="secondary"
            onClick={() =>
              setCursor(query.data?.next_cursor ?? undefined)
            }
          >
            Load more
          </Button>
        ) : null}
      </div>
    </Modal>
  );
}
