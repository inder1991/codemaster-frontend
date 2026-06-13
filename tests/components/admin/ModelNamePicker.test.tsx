/**
 * Task 5.4 — unit tests for <ModelNamePicker>.
 *
 * Pins the component contracts:
 *   1. Renders curated dropdown options.
 *   2. value prop is reflected in the input.
 *   3. onChange fired with curated selection.
 *   4. onChange fired with free-text entry (operator override).
 *   5. label prop renders as accessible label.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, test, vi } from "vitest";

import {
  ModelNamePicker,
  QWEN_MODELS,
} from "@/components/admin/ModelNamePicker";

// ── jsdom shims ───────────────────────────────────────────────────

// Headless UI v2's Combobox internals use ResizeObserver to track
// dropdown element dimensions. jsdom does not ship it; provide a
// no-op shim so the component can mount and close without throwing.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

// ── Helpers ───────────────────────────────────────────────────────

function renderPicker(
  props: Partial<Parameters<typeof ModelNamePicker>[0]> & { value?: string } = {},
) {
  const value = props.value ?? "";
  const onChange = props.onChange ?? vi.fn();
  render(
    <ModelNamePicker
      value={value}
      onChange={onChange}
      {...props}
    />,
  );
}

/** Open the dropdown via the ComboboxButton toggle. */
function openDropdown(): void {
  fireEvent.click(screen.getByTestId("model-name-picker-button"));
}

// ── Tests ─────────────────────────────────────────────────────────

describe("ModelNamePicker", () => {
  test("renders curated dropdown options", async () => {
    renderPicker({ value: "" });

    openDropdown();

    // Both curated models should appear after open.
    for (const model of QWEN_MODELS) {
      expect(
        await screen.findByTestId(`model-option-${model}`),
      ).toBeInTheDocument();
    }
  });

  test("value prop reflected in input", () => {
    renderPicker({ value: "qwen3-embed-1.7b" });

    const input = screen.getByTestId(
      "model-name-picker-input",
    ) as HTMLInputElement;

    expect(input.value).toBe("qwen3-embed-1.7b");
  });

  test("onChange fired with curated selection", async () => {
    const onChange = vi.fn();
    renderPicker({ value: "", onChange });

    openDropdown();

    // Select the first curated model option.
    // Headless UI v2 ComboboxOption triggers selection on mousedown
    // (not click) with button=0 (primary/left). fireEvent.click is
    // not sufficient; use mouseDown to satisfy the internal handler.
    const option = await screen.findByTestId(
      `model-option-${QWEN_MODELS[0]}`,
    );
    fireEvent.mouseDown(option, { button: 0 });

    expect(onChange).toHaveBeenCalledWith(QWEN_MODELS[0]);
  });

  test("onChange fired with free-text entry", () => {
    const onChange = vi.fn();
    renderPicker({ value: "", onChange });

    const input = screen.getByTestId("model-name-picker-input");

    // Type a custom model name.
    fireEvent.change(input, { target: { value: "my-custom-model-v1" } });

    // Blur to accept the free-text value.
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith("my-custom-model-v1");
  });

  test("label prop renders as accessible label", () => {
    renderPicker({ value: "", label: "Embedding model name" });

    expect(screen.getByText("Embedding model name")).toBeInTheDocument();
  });
});
