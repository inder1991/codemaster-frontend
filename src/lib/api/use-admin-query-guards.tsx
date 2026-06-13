/**
 * Sprint 14 / S14.B — fail-closed guards for admin-page useQuery hooks.
 *
 * Three observed failure modes from the S14.B spec map to the same
 * three branches every admin page needs to render:
 *
 *   • 401 → page is unauthenticated → redirect to /login (the
 *     useSession hook returns null on 401; the page-level effect
 *     here is what actually issues the redirect, so the server-
 *     rendered shell does not flash before navigation).
 *   • 403 → user is signed in but lacks the role → "Access denied"
 *     inline (no redirect, the user just sees what they can't do).
 *   • Other errors → generic ErrorState with a Retry button.
 *
 * Centralizing the branch-tree in a single hook keeps the three
 * page bodies small and prevents a 401/403 path from drifting
 * between pages.
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { UseQueryResult } from "@tanstack/react-query";

import { AdminApiError } from "@/lib/api/admin";
import { ErrorState } from "@/components/ui/states/Error";
import { Loading } from "@/components/ui/states/Loading";

export interface QueryGuardResult {
  /** When non-null, render this directly instead of the page body. */
  guardElement: React.ReactNode | null;
}

export function useAdminQueryGuards(
  query: UseQueryResult<unknown, Error>,
  testIdPrefix: string,
): QueryGuardResult {
  const router = useRouter();
  const status = errorStatus(query.error);
  const isUnauthenticated = query.isError && status === 401;

  useEffect(() => {
    if (isUnauthenticated) {
      router.push("/login");
    }
  }, [isUnauthenticated, router]);

  if (query.isLoading) {
    return {
      guardElement: (
        <div data-testid={`${testIdPrefix}-loading`}>
          <Loading label="Loading…" />
        </div>
      ),
    };
  }

  if (isUnauthenticated) {
    // The effect has scheduled the redirect; render nothing so we
    // do not flash the page body in the meantime.
    return { guardElement: null };
  }

  if (query.isError && status === 403) {
    return {
      guardElement: (
        <div data-testid={`${testIdPrefix}-forbidden`}>
          <ErrorState
            title="Access denied"
            body="Your role does not permit access to this page. Contact a platform owner if you believe this is wrong."
          />
        </div>
      ),
    };
  }

  if (query.isError) {
    return {
      guardElement: (
        <div data-testid={`${testIdPrefix}-error`}>
          <ErrorState
            title="Couldn't load page"
            body="Something went wrong fetching this data. Please retry."
            onRetry={() => query.refetch()}
          />
        </div>
      ),
    };
  }

  return { guardElement: null };
}

function errorStatus(err: unknown): number | undefined {
  if (err instanceof AdminApiError) return err.status;
  return undefined;
}
