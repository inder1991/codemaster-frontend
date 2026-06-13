/**
 * Sub-spec C T11 (2026-05-27) — extracted from layout.tsx so the
 * role-aware navigation matrix is unit-testable in isolation. Pure
 * declarative data; no React, no client-only APIs. Imported by
 * layout.tsx and by tests/app/AuthedLayoutNav.test.ts.
 *
 * The matrix mirrors the backend's exact endpoint allow-lists. Keep
 * both in sync — the unit test asserts shape invariants (uniqueness,
 * valid roles, anchor entries) so accidental edits surface at PR time.
 */

import {
  AdjustmentsHorizontalIcon,
  BookOpenIcon,
  ClipboardDocumentListIcon,
  CpuChipIcon,
  CurrencyDollarIcon,
  HomeIcon,
  ListBulletIcon,
  MagnifyingGlassIcon,
  PuzzlePieceIcon,
  ShieldExclamationIcon,
  SignalIcon,
  Squares2X2Icon,
  TagIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";

import type { NavItem } from "@/components/ui/application-shells/SidebarShell";
import type { Role } from "@/lib/auth/roles";

export interface NavSpec {
  name: string;
  href: string;
  icon: NavItem["icon"];
  /** Role tiers that can SEE this nav item. */
  visibleTo: ReadonlyArray<Role>;
}

export const NAV_SPEC: ReadonlyArray<NavSpec> = [
  // Mirrors backend route guards. visibleTo arrays are ordered by
  // ascending operational privilege where possible.
  //
  // Scope clarification (Sprint 15 / S15.H — supersedes the
  // 2026-05-04 rescope language): the portal is the customer's
  // interface. Customer-facing operational levers (kill-switches,
  // cost-caps, integrations) own dedicated pages because the
  // customer can't reach codemaster's internal Grafana / Slack /
  // Vault. Codemaster-internal SRE observability stays out.
  //
  // Backend guards are exact allow-lists, not precedence checks.
  // Do not add a role here unless the destination page's backend
  // calls accept that exact role for the operations exposed by the UI.
  {
    name: "Your reviews",
    href: "/your-reviews",
    icon: HomeIcon,
    visibleTo: [
      "reader",
      "security_auditor",
      "platform_operator",
      "platform_owner",
      "super_admin",
    ],
  },
  {
    name: "Reviews",
    href: "/reviews",
    icon: ListBulletIcon,
    visibleTo: [
      "platform_operator",
      "platform_owner",
      "super_admin",
    ],
  },
  {
    name: "Knowledge",
    href: "/knowledge",
    icon: BookOpenIcon,
    visibleTo: [
      "reader",
      "platform_operator",
      "platform_owner",
      "super_admin",
    ],
  },
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: Squares2X2Icon,
    visibleTo: ["platform_owner", "super_admin"],
  },
  {
    name: "Integrations",
    href: "/integrations",
    icon: PuzzlePieceIcon,
    visibleTo: ["platform_owner", "super_admin"],
  },
  {
    // Sprint Z.1 (2026-05-11) — members admin page (read-only v0).
    // Z.1b will add mutation flows (request / approve / reject).
    name: "Members",
    href: "/members",
    icon: UsersIcon,
    visibleTo: ["platform_owner", "super_admin"],
  },
  {
    // LLM configuration — Sprint 26 v4 spec 2026-05-28: tabbed page
    // hosting both Inference (Bedrock) credentials AND Embedding
    // (Qwen) credentials + EmbedderLifecyclePanel. The label changed
    // from "Bedrock" to "LLM" because the page now covers both LLM
    // sides; the route changed from /admin/bedrock to /admin/llm.
    // Bookmarks to /admin/bedrock 404 (intentional per spec §3).
    name: "LLM",
    href: "/admin/llm",
    icon: CpuChipIcon,
    visibleTo: ["super_admin"],
  },
  {
    // Go-live setup checklist — GET /api/admin/config-status. Surfaces which non-blocking integrations
    // (GitHub / Confluence / auth / LLM) are configured + from which source (db = saved here in the UI).
    name: "Setup",
    href: "/admin/setup",
    icon: ClipboardDocumentListIcon,
    visibleTo: ["super_admin"],
  },
  {
    name: "Kill switches",
    href: "/kill-switches",
    icon: AdjustmentsHorizontalIcon,
    visibleTo: ["platform_owner", "super_admin"],
  },
  {
    name: "Cost caps",
    href: "/cost-caps",
    icon: CurrencyDollarIcon,
    visibleTo: ["platform_owner", "super_admin"],
  },
  {
    name: "Audit log",
    href: "/audit-log",
    icon: ClipboardDocumentListIcon,
    visibleTo: [
      "reader",
      "security_auditor",
      "platform_operator",
      "platform_owner",
      "super_admin",
    ],
  },
  {
    name: "Status",
    href: "/status",
    icon: SignalIcon,
    visibleTo: [
      "reader",
      "platform_operator",
      "platform_owner",
      "super_admin",
    ],
  },
  {
    // Sub-spec C T11 (2026-05-27) — Confluence label-driven knowledge
    // routing admin surfaces. The page route is landed by T13
    // (QuarantinedChunksSidebar host) — until then this href returns
    // 404. Tracked in the T11 plan-doc "Deferred Hardening" section.
    name: "Quarantined chunks",
    href: "/admin/confluence/quarantined-chunks",
    icon: ShieldExclamationIcon,
    visibleTo: ["platform_owner", "super_admin"],
  },
  {
    // Sub-spec C T11 (2026-05-27) — destination page lands in T15
    // dashboard 1 (/admin/confluence/taxonomy-gaps/page.tsx).
    name: "Taxonomy gaps",
    href: "/admin/confluence/taxonomy-gaps",
    icon: TagIcon,
    visibleTo: ["platform_owner", "super_admin"],
  },
  {
    // Sub-spec C T11 (2026-05-27) — destination page lands in T15
    // dashboard 2 (/admin/retrieval-traces/page.tsx).
    name: "Retrieval traces",
    href: "/admin/retrieval-traces",
    icon: MagnifyingGlassIcon,
    visibleTo: ["platform_owner", "super_admin"],
  },
];
