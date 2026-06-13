import { describe, it, expect } from "vitest";

import { useTranslations } from "@/lib/i18n";

describe("useTranslations (no-op shim)", () => {
  it("returns the key verbatim when no vars given", () => {
    const t = useTranslations("dashboard");
    expect(t("system.health")).toBe("system.health");
  });

  it("interpolates {var} placeholders from the vars map", () => {
    const t = useTranslations("home");
    expect(t("Hello {name}", { name: "Alice" })).toBe("Hello Alice");
  });

  it("interpolates multiple placeholders", () => {
    const t = useTranslations("home");
    expect(
      t("{count} of {total} reviews", { count: 3, total: 10 }),
    ).toBe("3 of 10 reviews");
  });

  it("leaves unknown placeholders intact (forward-compat)", () => {
    const t = useTranslations("home");
    expect(t("Hello {name}", {})).toBe("Hello {name}");
  });
});
