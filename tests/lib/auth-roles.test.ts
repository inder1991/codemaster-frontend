import { describe, expect, test } from "vitest";

import { hasRole, type Session } from "@/lib/auth/roles";

const session: Session = {
  user_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  email: "owner@acme.com",
  role: "platform_owner",
  auth_source: "core_local",
  ldap_groups: [],
  expires_at: 1_799_712_000,
  installation_id: null,
};

describe("hasRole", () => {
  test("uses exact allow-lists instead of precedence inheritance", () => {
    expect(hasRole(session, "platform_owner")).toBe(true);
    expect(hasRole(session, "platform_operator")).toBe(false);
    expect(hasRole(session, "super_admin")).toBe(false);
  });

  test("returns false without a session", () => {
    expect(hasRole(null, "platform_owner")).toBe(false);
  });
});
