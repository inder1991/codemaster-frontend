import { afterEach, describe, expect, it, vi } from "vitest";

import { copyText } from "@/lib/clipboard";

// jsdom does not implement document.execCommand, so vi.spyOn(document,
// "execCommand") throws "execCommand does not exist". Define it as a
// controllable mock instead, and remove it again in afterEach.
function mockExecCommand(result: boolean) {
  const fn = vi.fn().mockReturnValue(result);
  Object.defineProperty(document, "execCommand", {
    value: fn,
    configurable: true,
    writable: true,
  });
  return fn;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, "execCommand");
});

describe("copyText", () => {
  it("uses the async Clipboard API in a secure context and returns true", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    vi.stubGlobal("window", { isSecureContext: true });

    await expect(copyText("hello")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("falls back to execCommand when the Clipboard API is unavailable", async () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("window", { isSecureContext: false });
    const exec = mockExecCommand(true);

    await expect(copyText("fallback")).resolves.toBe(true);
    expect(exec).toHaveBeenCalledWith("copy");
  });

  it("returns false when both paths fail", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    vi.stubGlobal("window", { isSecureContext: true });
    mockExecCommand(false);

    await expect(copyText("x")).resolves.toBe(false);
  });
});
