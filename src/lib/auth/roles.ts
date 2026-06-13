/**
 * Sprint 12 / S12.1.2 — frontend role helpers.
 * Sprint X.6 (2026-05-11) — expanded from 4 to 7 role values to match
 * the spec at docs/superpowers/specs/2026-05-01-codemaster-design.md
 * Section 9 (lines 1640-1651). The previous 4-role union narrowed
 * `security_auditor`-bearing sessions to never-render-anything;
 * `knowledge_curator` couldn't see the knowledge nav; `org_owner`
 * was structurally absent ahead of v1.
 *
 * Mirrors the backend's `Role` literals so client components can
 * hide buttons the user can't use anyway. Backend endpoint guards
 * use exact role allow-lists, not inherited precedence. The backend
 * remains the security boundary; the frontend just surfaces UX
 * consistent with what the API will accept.
 */

export type Role =
  | "super_admin"
  | "platform_owner"
  | "platform_operator"
  | "knowledge_curator"
  | "security_auditor"
  | "org_owner"
  | "reader";

export type AuthSource = "local" | "core_local" | "ldap";

export interface Session {
  user_id: string;
  email: string;
  role: Role;
  auth_source: AuthSource;
  ldap_groups: ReadonlyArray<string>;
  expires_at: number; // unix seconds
  /**
   * Per-tenant scope. None for super_admin / globally-scoped roles;
   * a UUID string for org_owner + per-installation grants.
   * Sprint X.6 added; pre-X.6 cookies deserialize with `null`.
   */
  installation_id: string | null;
}

/**
 * True iff the session's role is explicitly present in the supplied
 * allow-list. Mirrors backend endpoint guards, which use exact role
 * sets rather than precedence inheritance.
 */
export function hasRole(
  session: Session | null,
  ...roles: Role[]
): boolean {
  if (!session) return false;
  return roles.includes(session.role);
}
