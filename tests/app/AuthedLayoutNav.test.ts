/**
 * Sub-spec C T11 — characterization tests for the role-aware
 * navigation matrix. Asserts NAV_SPEC structural invariants:
 *
 *   1. Every entry has a unique `href` (no duplicate links).
 *   2. Every `visibleTo` role is a valid `Role` literal.
 *   3. Spec-matrix anchor entries exist with their locked roles
 *      (regression guard against accidental edits).
 *
 * The matrix mirrors backend route guards, which use exact role
 * allow-lists instead of precedence inheritance.
 */
import { describe, it, expect } from "vitest";

import { NAV_SPEC } from "@/app/(authed)/nav-spec";
import type { Role } from "@/lib/auth/roles";

const VALID_ROLES: ReadonlyArray<Role> = [
  "super_admin",
  "platform_owner",
  "platform_operator",
  "knowledge_curator",
  "security_auditor",
  "org_owner",
  "reader",
];

describe("NAV_SPEC", () => {
  it("has unique href across all entries", () => {
    const hrefs = NAV_SPEC.map((n) => n.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("references only valid Role literals in visibleTo", () => {
    for (const entry of NAV_SPEC) {
      for (const role of entry.visibleTo) {
        expect(VALID_ROLES).toContain(role);
      }
    }
  });

  it.each([
    {
      href: "/your-reviews",
      name: "Your reviews",
      mustInclude: ["reader", "super_admin"] satisfies Role[],
    },
    {
      href: "/dashboard",
      name: "Dashboard",
      mustInclude: ["platform_owner", "super_admin"] satisfies Role[],
    },
    {
      href: "/admin/llm",
      name: "LLM",
      mustInclude: ["super_admin"] satisfies Role[],
    },
  ])(
    "anchor entry $href has name '$name' and includes $mustInclude",
    ({ href, name, mustInclude }) => {
      const entry = NAV_SPEC.find((n) => n.href === href);
      expect(entry, `entry for ${href} missing`).toBeDefined();
      expect(entry!.name).toBe(name);
      for (const role of mustInclude) {
        expect(entry!.visibleTo).toContain(role);
      }
    },
  );
});

describe("NAV_SPEC — Sub-spec C T11 admin entries", () => {
  it.each([
    {
      href: "/admin/confluence/quarantined-chunks",
      name: "Quarantined chunks",
      visibleTo: ["platform_owner", "super_admin"] satisfies Role[],
    },
    {
      href: "/admin/confluence/taxonomy-gaps",
      name: "Taxonomy gaps",
      visibleTo: ["platform_owner", "super_admin"] satisfies Role[],
    },
    {
      href: "/admin/retrieval-traces",
      name: "Retrieval traces",
      visibleTo: ["platform_owner", "super_admin"] satisfies Role[],
    },
  ])("includes admin entry $href ($name)", ({ href, name, visibleTo }) => {
    const entry = NAV_SPEC.find((n) => n.href === href);
    expect(entry, `entry for ${href} missing`).toBeDefined();
    expect(entry!.name).toBe(name);
    expect([...entry!.visibleTo].sort()).toEqual([...visibleTo].sort());
  });

  it("hides Sub-spec C admin entries from non-platform roles", () => {
    const subSpecCHrefs = [
      "/admin/confluence/quarantined-chunks",
      "/admin/confluence/taxonomy-gaps",
      "/admin/retrieval-traces",
    ];
    const lowPrivRoles: Role[] = [
      "reader",
      "security_auditor",
      "knowledge_curator",
      "org_owner",
      "platform_operator",
    ];
    for (const href of subSpecCHrefs) {
      const entry = NAV_SPEC.find((n) => n.href === href);
      expect(entry).toBeDefined();
      for (const role of lowPrivRoles) {
        expect(
          entry!.visibleTo,
          `${href} should be hidden from ${role}`,
        ).not.toContain(role);
      }
    }
  });
});
