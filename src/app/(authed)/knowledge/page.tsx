/**
 * Sprint 12 / S12.2.4 — Knowledge list page.
 * Sprint 15 / S15.C — wired to real `/api/admin/knowledge`
 * + `/api/admin/knowledge/proposals` via TanStack Query (mock
 * imports removed; loading/error/empty branches via the shared
 * `useAdminQueryGuards` hook).
 */

"use client";

import { ArrowRightIcon } from "@heroicons/react/20/solid";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { LearningRow } from "@/components/knowledge/LearningRow";
import { Badge } from "@/components/ui/elements/Badge";
import { Card } from "@/components/ui/elements/Card";
import { Empty } from "@/components/ui/states/Empty";
import { EmptyIllustration } from "@/components/ui/states/EmptyIllustration";
import {
  fetchLearnings,
  fetchProposals,
  KNOWLEDGE_QUERY_KEYS,
} from "@/lib/api/knowledge";
import { useAdminQueryGuards } from "@/lib/api/use-admin-query-guards";
import { cn } from "@/lib/cn";
import { colors, motion, radius, type as t } from "@/lib/design-tokens";

export default function KnowledgePage() {
  const router = useRouter();
  const learningsQuery = useQuery({
    queryKey: KNOWLEDGE_QUERY_KEYS.list(),
    queryFn: fetchLearnings,
  });
  const proposalsQuery = useQuery({
    queryKey: KNOWLEDGE_QUERY_KEYS.proposals(),
    queryFn: fetchProposals,
  });
  const guard = useAdminQueryGuards(learningsQuery, "knowledge-list");
  if (guard.guardElement) {
    return <>{guard.guardElement}</>;
  }

  const learnings = learningsQuery.data ?? [];
  const pending = proposalsQuery.data ?? [];

  const open = (id: string) => router.push(`/knowledge/${id}`);

  return (
    <div className="space-y-8">
      <header>
        <h1 className={cn(t.display, colors.text.primary)}>Knowledge</h1>
        <p className={cn("mt-2 max-w-2xl", t.bodyLarge, colors.text.muted)}>
          Team learnings curated from reviewer-promoted findings. Approved
          learnings fire on future reviews against this team&apos;s repos.
        </p>
      </header>

      {pending.length > 0 ? (
        <Card padding="md">
          <div className="flex items-center justify-between gap-x-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-x-2">
                <Badge kind="degraded" pill>
                  <span className="tabular-nums font-semibold">
                    {pending.length}
                  </span>{" "}
                  pending
                </Badge>
                <span className={cn(t.bodyStrong, colors.text.primary)}>
                  Learning proposals awaiting review
                </span>
              </div>
              <p className={cn("mt-1", t.meta, colors.text.muted)}>
                Reviewers have promoted findings into proposals. Approve or
                reject from the queue.
              </p>
            </div>
            <Link
              href="/knowledge/proposals"
              className={cn(
                "inline-flex items-center gap-x-1.5 px-3 py-2",
                radius.md,
                t.bodyStrong,
                colors.accent.solid,
                colors.accent.onSolid,
                colors.accent.ring,
                motion.fast,
              )}
            >
              Open queue
              <ArrowRightIcon aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </Card>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-x-4">
          <h2 className={cn(t.h2, colors.text.primary)}>
            All learnings ({learnings.length})
          </h2>
          <FilterStub />
        </div>

        {learnings.length === 0 ? (
          <Empty
            illustration={<EmptyIllustration />}
            title="No learnings yet"
            body="Reviewers promote findings into learnings by adding a bookmark reaction on the PR comment. Approved learnings land here."
          />
        ) : (
          <Card>
            <RowGroup>
              {learnings.map((row) => (
                <LearningRow
                  key={row.learning_id}
                  row={row}
                  onOpen={open}
                />
              ))}
            </RowGroup>
          </Card>
        )}
      </section>
    </div>
  );
}

function FilterStub() {
  // Sprint 12 / Batch 1: layout-only filter chip group. The real
  // filter (state + scope + free-text + Postgres tsvector) wires
  // in Batch 5 once the backend exists.
  return (
    <div className="flex items-center gap-x-2">
      <Badge kind="neutral" pill showDot={false}>
        All states
      </Badge>
      <Badge kind="neutral" pill showDot={false}>
        All scopes
      </Badge>
    </div>
  );
}

function RowGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn("divide-y", colors.divider)}>{children}</div>
  );
}
