/**
 * Sprint 16 / S16.F.4 — `formatRelativeTime` unit tests.
 *
 * Pins each rung of the format ladder so a future "make it
 * smarter" refactor can't silently drift the user-visible output.
 */

import { describe, expect, test, vi } from "vitest";
import { formatRelativeTime } from "@/lib/format/relative-time";

describe("formatRelativeTime", () => {
  test("null → 'never'", () => {
    expect(formatRelativeTime(null)).toBe("never");
  });

  test("< 60s → 'just now'", () => {
    const now = new Date("2026-06-01T12:00:00Z");
    vi.setSystemTime(now);
    const iso = new Date(now.getTime() - 30_000).toISOString();
    expect(formatRelativeTime(iso)).toBe("just now");
    vi.useRealTimers();
  });

  test("< 60m → 'Nm ago'", () => {
    const now = new Date("2026-06-01T12:00:00Z");
    vi.setSystemTime(now);
    const iso = new Date(now.getTime() - 30 * 60_000).toISOString();
    expect(formatRelativeTime(iso)).toBe("30m ago");
    vi.useRealTimers();
  });

  test("< 24h → 'Nh ago'", () => {
    const now = new Date("2026-06-01T12:00:00Z");
    vi.setSystemTime(now);
    const iso = new Date(now.getTime() - 5 * 3_600_000).toISOString();
    expect(formatRelativeTime(iso)).toBe("5h ago");
    vi.useRealTimers();
  });

  test("< 30d → 'Nd ago'", () => {
    const now = new Date("2026-06-01T12:00:00Z");
    vi.setSystemTime(now);
    const iso = new Date(now.getTime() - 7 * 86_400_000).toISOString();
    expect(formatRelativeTime(iso)).toBe("7d ago");
    vi.useRealTimers();
  });

  test("≥ 30d → absolute date", () => {
    const now = new Date("2026-06-01T12:00:00Z");
    vi.setSystemTime(now);
    const iso = "2026-01-01T12:00:00Z";
    const out = formatRelativeTime(iso);
    // Locale-dependent, so just assert it's NOT a relative format.
    expect(out).not.toMatch(/ago/);
    expect(out).not.toBe("just now");
    expect(out).not.toBe("never");
    vi.useRealTimers();
  });

  test("future timestamp (clock skew) → 'just now'", () => {
    const now = new Date("2026-06-01T12:00:00Z");
    vi.setSystemTime(now);
    // 5 seconds in the future (server clock ahead).
    const iso = new Date(now.getTime() + 5_000).toISOString();
    expect(formatRelativeTime(iso)).toBe("just now");
    vi.useRealTimers();
  });
});
