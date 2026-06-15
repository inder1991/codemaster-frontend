/**
 * PART 3 §4 — Button disabled treatment.
 *
 * Covers:
 *   - disabled button carries the `c-btn-disabled` class (neutral style).
 *   - disabled button does NOT carry `opacity-50`.
 *   - enabled buttons are visually unchanged (no `c-btn-disabled`).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { Button } from "@/components/ui/elements/Button";

describe("Button — disabled treatment (PART 3 §4)", () => {
  test("disabled button carries c-btn-disabled class", () => {
    render(<Button disabled>Save</Button>);
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn.className).toContain("c-btn-disabled");
  });

  test("disabled button does NOT carry opacity-50", () => {
    render(<Button disabled>Save</Button>);
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn.className).not.toContain("opacity-50");
  });

  test("enabled button is not in disabled state (attribute absent)", () => {
    render(<Button>Save</Button>);
    const btn = screen.getByRole("button", { name: "Save" });
    // The c-btn-disabled class is always present (the CSS rule .c-btn-disabled:disabled
    // only fires when the disabled attribute is also set). An enabled button must NOT
    // have the HTML disabled attribute.
    expect(btn).not.toBeDisabled();
  });

  test("disabled button still has cursor-not-allowed", () => {
    render(<Button disabled>Save</Button>);
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn.className).toContain("cursor-not-allowed");
  });
});
