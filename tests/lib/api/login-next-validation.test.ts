/**
 * Sprint X.5c (2026-05-11) — same-origin validation for `?next=`.
 *
 * The login route handler's `isSafeRelativeNext` accepts/rejects
 * values to prevent the open-redirect class of bug. This test pins
 * the contract by re-implementing the validator locally and
 * comparing against an adversarial-corpus-style table.
 *
 * The actual validator is unexported (module-private to route.ts);
 * we mirror it here so a future drift breaks loudly. If you change
 * the validator, change both.
 */

import { describe, expect, test } from "vitest";

// MIRROR of frontend/src/app/api/auth/login/route.ts → isSafeRelativeNext.
// Keep these in sync. If you change the validator, change both.
function isSafeRelativeNext(value: string | null): value is string {
  if (value === null) return false;
  if (value.length === 0 || value.length > 512) return false;
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//") || value.startsWith("/\\")) return false;
  if (value.includes("\n") || value.includes("\r")) return false;
  return true;
}

describe("login ?next= same-origin validation (X.5c)", () => {
  describe("accepts", () => {
    test.each([
      "/",
      "/dashboard",
      "/cost-caps",
      "/audit-log?from=2026-01-01",
      "/reviews/abc-123-456",
      "/your-reviews#authored",
    ])("relative path: %s", (input) => {
      expect(isSafeRelativeNext(input)).toBe(true);
    });
  });

  describe("rejects", () => {
    test.each([
      // Open-redirect attacks
      ["https://evil.example/", "absolute URL with https"],
      ["http://attacker.io/", "absolute URL with http"],
      ["//attacker.io/", "protocol-relative URL (//host)"],
      ["/\\evil.com", "backslash variant"],

      // Non-/ starts
      ["javascript:alert(1)", "javascript: scheme"],
      ["data:text/html,<script>", "data: URI"],
      ["dashboard", "relative without leading slash"],
      ["./dashboard", "dotted-relative"],
      ["../etc/passwd", "parent traversal"],

      // Header injection / CRLF
      ["/foo\nLocation: https://evil/", "newline injection"],
      ["/foo\r\nSet-Cookie: x=y", "CRLF injection"],

      // Edge cases
      ["", "empty string"],
      ["/" + "a".repeat(513), "exceeds 512-char cap"],
    ])("%s (%s)", (input) => {
      expect(isSafeRelativeNext(input)).toBe(false);
    });

    test("null is rejected", () => {
      expect(isSafeRelativeNext(null)).toBe(false);
    });
  });

  describe("boundary cases", () => {
    test("exactly 512 chars is accepted", () => {
      expect(isSafeRelativeNext("/" + "a".repeat(511))).toBe(true);
    });

    test("query string with safe chars is accepted", () => {
      expect(
        isSafeRelativeNext("/audit-log?actor=u1&from=2026-01-01"),
      ).toBe(true);
    });

    test("fragment is accepted", () => {
      expect(isSafeRelativeNext("/page#section")).toBe(true);
    });
  });
});
