import { describe, it, expect } from "vitest";
import { stripCodemasterSummary } from "@/lib/markdown";

describe("stripCodemasterSummary", () => {
  it("removes the codemaster summary block, keeping the author text", () => {
    const body = [
      "Verify confluence retrieval + SEP citation.",
      "",
      "<!-- codemaster-summary-start -->",
      "## 🤖 Summary by codemaster",
      "**22 finding(s) detected.**",
      "<!-- codemaster-summary-end -->",
    ].join("\n");
    expect(stripCodemasterSummary(body)).toBe(
      "Verify confluence retrieval + SEP citation.",
    );
  });
  it("returns trimmed input unchanged when no block present", () => {
    expect(stripCodemasterSummary("  hello  ")).toBe("hello");
  });
  it("returns empty string when the body is only the bot block", () => {
    expect(stripCodemasterSummary("<!-- codemaster-summary-start -->x<!-- codemaster-summary-end -->")).toBe("");
  });
  it("handles null", () => {
    expect(stripCodemasterSummary(null)).toBe("");
  });
});
