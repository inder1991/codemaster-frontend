/**
 * Review-detail context rail -- the right pane when no finding is selected.
 *
 * Groups the lightweight PR context sections (WalkthroughRail,
 * ComplianceCard, and DebugLinks for privileged roles) into one cohesive
 * panel so they read as a unit instead of floating label fragments, with a
 * hint that the pane becomes a finding inspector on selection. DebugLinks
 * is gated to platform_owner / platform_operator / super_admin /
 * security_auditor per PRODUCT.md.
 */

"use client";

import { CursorArrowRaysIcon } from "@heroicons/react/24/outline";

import { ComplianceCard } from "@/components/review-detail/ComplianceCard";
import { DebugLinks } from "@/components/review-detail/DebugLinks";
import { WalkthroughRail } from "@/components/review-detail/WalkthroughRail";
import type { ReviewDetailV1 } from "@/lib/api/admin";
import { useSession } from "@/lib/auth/use-session";
import { cn } from "@/lib/cn";
import { colors, elevation, radius, type as t } from "@/lib/design-tokens";

const PRIVILEGED_ROLES = new Set([
  "platform_owner",
  "platform_operator",
  "super_admin",
  "security_auditor",
]);

export interface ContextRailProps {
  detail: ReviewDetailV1;
}

export function ContextRail({ detail }: ContextRailProps) {
  const session = useSession();
  const role = session.data?.role;
  const canDebug = role != null && PRIVILEGED_ROLES.has(role);

  return (
    <div className="space-y-3">
      <p
        className={cn(
          t.caption,
          colors.text.faint,
          "flex items-center gap-x-1.5",
        )}
      >
        <CursorArrowRaysIcon aria-hidden="true" className="size-4 shrink-0" />
        Select a finding to inspect it here.
      </p>

      <div
        className={cn(
          colors.bg.elevated,
          "border",
          colors.border.default,
          radius.md,
          elevation.raised,
          "divide-y p-5",
          colors.divider,
          "[&>*]:py-5 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0",
          "empty:hidden",
        )}
      >
        <WalkthroughRail walkthrough={detail.walkthrough} />
        <ComplianceCard
          governance={detail.governance}
          findings={detail.findings}
        />
        {canDebug ? <DebugLinks detail={detail} /> : null}
      </div>
    </div>
  );
}
