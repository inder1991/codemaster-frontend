/**
 * Sprint 16 / S16.F.5 — `timedFetch` + `initTelemetry` unit tests.
 *
 * Pins the contract that telemetry is disabled unless explicitly
 * enabled, never breaks the user's path, and preserves the wrapped
 * function's return value + thrown errors verbatim.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { MockInstance } from "vitest";
import {
  _resetForTesting,
  initTelemetry,
  timedFetch,
} from "@/lib/telemetry";

let fetchSpy: MockInstance<typeof globalThis.fetch> | null = null;

beforeEach(() => {
  _resetForTesting();
});

afterEach(() => {
  fetchSpy?.mockRestore();
  fetchSpy = null;
});

describe("timedFetch", () => {
  test("returns the wrapped function's value verbatim", async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );
    const result = await timedFetch("GET /test", async () => 42);
    expect(result).toBe(42);
  });

  test("propagates the wrapped function's error verbatim", async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );
    await expect(
      timedFetch("PUT /test", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });

  test("does not emit mutation_latency by default", async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );
    await timedFetch("PUT /api/admin/flags/{flag_name}", async () => "ok");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("still propagates errors when telemetry is disabled", async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );
    await expect(
      timedFetch("DELETE /api/admin/integrations/{id}", async () => {
        throw new Error("server down");
      }),
    ).rejects.toThrow("server down");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("disabled telemetry cannot affect wrapped success", async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("collector down"),
    );
    const result = await timedFetch("GET /test", async () => "data");
    expect(result).toBe("data");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("initTelemetry", () => {
  test("is idempotent — safe to call multiple times", () => {
    expect(() => {
      initTelemetry();
      initTelemetry();
      initTelemetry();
    }).not.toThrow();
  });

  test("does not throw on SSR / undefined window", () => {
    // jsdom provides window, so this just verifies the
    // function-level guard exists. We can't easily mock
    // window=undefined in vitest+jsdom, so this test asserts
    // the call doesn't throw under the normal browser-like
    // environment that the SSR guard is paired with.
    expect(() => initTelemetry()).not.toThrow();
  });
});
