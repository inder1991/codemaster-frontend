/**
 * Sprint 13 / S13.1.3 — Integrations page.
 * Sprint 14 / S14.C — wired to GET/POST/DELETE /api/admin/integrations.
 *
 * Currently surfaces Confluence allowlist management. Future kinds
 * (Notion, ADR archives) plug in by extending the backend
 * `IntegrationKind` literal + adding a per-kind Add modal here.
 *
 * Visible to platform_owner+ for write actions; reader/operator
 * see the list read-only (server-side authz enforces).
 *
 * Mutation contract:
 *   • DELETE applies an optimistic update — the row disappears
 *     immediately. On 5xx the cache snapshot is restored and a
 *     toast surfaces the failure (fail-closed: no data loss).
 *   • POST 201 invalidates the list query so the new row reflects
 *     server-canonical timestamps. POST 409 surfaces an inline
 *     "already configured" message inside the modal (modal stays
 *     open so the user can edit the space key).
 *   • Both mutations forward `X-CSRF-Token` from the csrf_token
 *     cookie (S14.A double-submit gate).
 */

"use client";

import { PlusIcon } from "@heroicons/react/20/solid";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";

import { AddConfluenceSpaceModal } from "@/components/integrations/AddConfluenceSpaceModal";
import { IntegrationRow } from "@/components/integrations/IntegrationRow";
import { VisibilityViolationBanner } from "@/components/confluence/VisibilityViolationBanner";
import { Button } from "@/components/ui/elements/Button";
import { Card } from "@/components/ui/elements/Card";
import { Modal } from "@/components/ui/overlays/Modal";
import { Empty } from "@/components/ui/states/Empty";
import { EmptyIllustration } from "@/components/ui/states/EmptyIllustration";
import {
  AdminApiError,
  deleteIntegration,
  fetchIntegrations,
  fetchQuarantinedChunks,
  postConfluenceSpace,
  QUERY_KEYS,
  type AddConfluenceSpaceInputV1,
  type IntegrationDuplicateConflictV1,
  type IntegrationV1,
} from "@/lib/api/admin";
import { useAdminQueryGuards } from "@/lib/api/use-admin-query-guards";
import { cn } from "@/lib/cn";
import { colors, radius, type as t } from "@/lib/design-tokens";

export default function IntegrationsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: QUERY_KEYS.integrations(),
    queryFn: fetchIntegrations,
  });

  const [addOpen, setAddOpen] = useState(false);
  const [addError, setAddError] = useState<string | undefined>();
  const [pendingRemoval, setPendingRemoval] = useState<IntegrationV1 | null>(
    null,
  );
  const [deleteError, setDeleteError] = useState<string | undefined>();

  const addMutation = useMutation({
    mutationFn: postConfluenceSpace,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.integrations(),
      });
      setAddOpen(false);
      setAddError(undefined);
    },
    onError: (err) => {
      if (err instanceof AdminApiError && err.status === 409) {
        const body = err.body as IntegrationDuplicateConflictV1 | null;
        const key = body?.space_key ?? "this space";
        setAddError(`This space is already configured (${key}).`);
        return;
      }
      if (err instanceof AdminApiError && err.status === 422) {
        setAddError(
          "Couldn't add the space — Confluence rejected the request. Check the space key and try again.",
        );
        return;
      }
      setAddError("Couldn't add the integration. Please try again.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteIntegration(id),
    // Optimistic update + rollback on error: snapshot the cache before
    // the mutation, write the optimistic state, restore on failure.
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({
        queryKey: QUERY_KEYS.integrations(),
      });
      const previous =
        queryClient.getQueryData<IntegrationV1[]>(
          QUERY_KEYS.integrations(),
        ) ?? [];
      queryClient.setQueryData<IntegrationV1[]>(
        QUERY_KEYS.integrations(),
        (current) => (current ?? []).filter((r) => r.integration_id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(
          QUERY_KEYS.integrations(),
          context.previous,
        );
      }
      setDeleteError(
        "Couldn't remove the integration. The change has been rolled back; please try again.",
      );
    },
    onSuccess: () => {
      setDeleteError(undefined);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.integrations(),
      });
      setPendingRemoval(null);
    },
  });

  const { guardElement } = useAdminQueryGuards(query, "integrations");

  // Sub-spec C T13 — banner rollup. Computed BEFORE the guard early
  // return so useQueries fires on every render (hooks rule). Fans out
  // one probe fetch per Confluence integration (page_size=1, cursor=
  // null — we just need to know if rows is non-empty). Fail-open: a
  // per-integration error excludes that integration from the count
  // rather than crashing the page.
  const integrations = query.data ?? [];
  const confluenceIntegrations = integrations.filter(
    (i) => i.kind === "confluence_space",
  );
  const violationProbes = useQueries({
    queries: confluenceIntegrations.map((i) => ({
      queryKey: QUERY_KEYS.quarantinedChunks(i.integration_id, "probe"),
      queryFn: () =>
        fetchQuarantinedChunks({
          integration_id: i.integration_id,
          page_size: 1,
        }),
      retry: false,
    })),
  });
  const violationCount = violationProbes.filter(
    (p) => (p.data?.rows.length ?? 0) > 0,
  ).length;

  if (guardElement !== null) return guardElement;

  const handleAdd = (input: AddConfluenceSpaceInputV1) => {
    setAddError(undefined);
    addMutation.mutate(input);
  };

  const handleRemove = (integrationId: string) => {
    const target =
      integrations.find((i) => i.integration_id === integrationId) ?? null;
    setPendingRemoval(target);
    setDeleteError(undefined);
  };

  return (
    <div className="space-y-8">
      <header>
        <div className="flex items-end justify-between gap-x-4">
          <div>
            <h1 className={cn(t.display, colors.text.primary)}>
              Integrations
            </h1>
            <p
              className={cn(
                "mt-2 max-w-2xl",
                t.bodyLarge,
                colors.text.muted,
              )}
            >
              Platform-shared content sources codemaster ingests for
              review context. One configuration serves every
              codemaster-installed organization. Today: Confluence spaces.
              Future kinds (Notion, ADR archives) will appear here as
              they ship.
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={() => setAddOpen(true)}
            leadingIcon={<PlusIcon className="size-4" />}
          >
            Add Confluence space
          </Button>
        </div>
      </header>

      <VisibilityViolationBanner
        integrationsWithViolations={violationCount}
        totalIntegrations={confluenceIntegrations.length}
      />

      {deleteError ? (
        <p
          role="alert"
          className={cn(
            "px-3 py-2",
            radius.sm,
            t.body,
            "bg-[oklch(94%_0.06_25)] dark:bg-[oklch(26%_0.10_25)]",
            "text-[oklch(45%_0.14_25)] dark:text-[oklch(80%_0.12_25)]",
          )}
        >
          {deleteError}
        </p>
      ) : null}

      {/* Confluence credentials moved to the canonical Setup page (/admin/setup → Confluence card → DB),
          the single write path. This page manages ingestion/spaces only. */}

      <section className="space-y-3">
        <h2 className={cn(t.h2, colors.text.primary)}>
          Active integrations ({integrations.length})
        </h2>
        {integrations.length === 0 ? (
          <Empty
            illustration={<EmptyIllustration />}
            title="No integrations yet"
            body="Add a Confluence space to enrich review context with team docs. Codemaster ingests pages once and serves every installed org. The 30-minute cycle indexes new content and supersedes stale pages."
            cta={{
              label: "Add Confluence space",
              onClick: () => setAddOpen(true),
            }}
          />
        ) : (
          <Card>
            <ul className={cn("divide-y", colors.divider)}>
              {integrations.map((i) => (
                <li key={i.integration_id}>
                  <IntegrationRow integration={i} onRemove={handleRemove} />
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <h2 className={cn(t.h2, colors.text.primary)}>
          Infrastructure integrations
        </h2>
        <Card padding="lg">
          <p className={cn(t.body, colors.text.muted, "leading-7")}>
            GitHub, Slack, Vault, Tempo, Grafana, Loki, Bedrock, LDAP,
            and Temporal are wired via Helm + Vault, not from this
            page. Adding or removing them is a deploy operation — see
            the runbooks under{" "}
            <code
              className={cn(
                "px-1 py-0.5",
                colors.bg.muted,
                "rounded font-mono",
                t.caption,
              )}
            >
              docs/runbooks/
            </code>
            . GitHub orgs onboard via the GitHub App install flow on
            github.com; per-repo opt-in lives in each repo&apos;s{" "}
            <code
              className={cn(
                "px-1 py-0.5",
                colors.bg.muted,
                "rounded font-mono",
                t.caption,
              )}
            >
              .codemaster.yaml
            </code>
            .
          </p>
        </Card>
      </section>

      <AddConfluenceSpaceModal
        open={addOpen}
        onConfirm={handleAdd}
        onCancel={() => {
          setAddOpen(false);
          setAddError(undefined);
        }}
        submitting={addMutation.isPending}
        {...(addError ? { errorMessage: addError } : {})}
      />

      {pendingRemoval !== null ? (
        <Modal
          open
          onClose={(next) => {
            if (!next) setPendingRemoval(null);
          }}
          title="Remove integration?"
          description="Codemaster will stop ingesting this space on the next cycle. The integration's index is retained so a re-add restores citations without re-validation."
          iconTone="danger"
          primaryAction={{
            label: deleteMutation.isPending
              ? "Removing…"
              : "Remove integration",
            onClick: () => deleteMutation.mutate(pendingRemoval.integration_id),
            disabled: deleteMutation.isPending,
            variant: "danger",
          }}
          secondaryAction={{
            label: "Cancel",
            onClick: () => setPendingRemoval(null),
          }}
        />
      ) : null}
    </div>
  );
}
