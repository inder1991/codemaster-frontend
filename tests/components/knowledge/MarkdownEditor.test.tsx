/**
 * Sprint 12 / S12.2.4 — MarkdownEditor unit tests.
 *
 * Per sprint-12.md: ≥5 cases — split-view toggle, sanitizer XSS,
 * basic syntax-highlight presence, etc.
 *
 * jsdom doesn't run CodeMirror's full layout pipeline so we
 * stub the @uiw/react-codemirror import to a thin textarea.
 * The sanitizer + preview pane are still real, which is what
 * the spec's XSS / syntax cases actually exercise.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";

vi.mock("@uiw/react-codemirror", () => ({
  default: (props: {
    value: string;
    onChange?: (next: string) => void;
    onBlur?: () => void;
    "aria-label"?: string;
  }) => (
    <textarea
      data-testid="cm-editor"
      aria-label={props["aria-label"] ?? "Markdown editor"}
      value={props.value}
      onChange={(e) => props.onChange?.(e.target.value)}
      onBlur={props.onBlur}
    />
  ),
}));

import { MarkdownEditor } from "@/components/knowledge/MarkdownEditor";

beforeEach(() => {
  // jsdom's matchMedia stub for the responsive collapse logic.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

const baseProps: ComponentProps<typeof MarkdownEditor> = {
  value: "# Heading\n\nBody paragraph.",
  onChange: () => {},
  ariaLabel: "Learning body markdown",
};

describe("MarkdownEditor", () => {
  it("renders the 3-way mode toggle (Edit · Split · Preview)", () => {
    render(<MarkdownEditor {...baseProps} />);
    expect(screen.getByRole("radio", { name: /^edit$/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^split$/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^preview$/i })).toBeInTheDocument();
  });

  it("renders the editor and the preview side-by-side in split mode", () => {
    render(<MarkdownEditor {...baseProps} />);
    expect(screen.getByTestId("cm-editor")).toBeInTheDocument();
    // The preview's <h1> is the most reliable signal that the
    // sanitised markdown was actually rendered.
    expect(
      screen.getByRole("heading", { level: 1, name: /heading/i }),
    ).toBeInTheDocument();
  });

  it("toggling to Edit hides the preview pane", async () => {
    const user = userEvent.setup();
    render(<MarkdownEditor {...baseProps} />);
    await user.click(screen.getByRole("radio", { name: /^edit$/i }));
    expect(screen.getByTestId("cm-editor")).toBeInTheDocument();
    // No <h1> rendered when the preview pane is hidden.
    expect(
      screen.queryByRole("heading", { level: 1, name: /heading/i }),
    ).not.toBeInTheDocument();
  });

  it("toggling to Preview hides the editor pane", async () => {
    const user = userEvent.setup();
    render(<MarkdownEditor {...baseProps} />);
    await user.click(screen.getByRole("radio", { name: /^preview$/i }));
    expect(screen.queryByTestId("cm-editor")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: /heading/i }),
    ).toBeInTheDocument();
  });

  it("strips <script> tags via rehype-sanitize — XSS payload is never executed", () => {
    const xss = "Before\n\n<script>window.__pwned__ = true</script>\n\nAfter";
    render(<MarkdownEditor {...baseProps} value={xss} />);
    // The script tag is dropped from the rendered DOM entirely.
    expect(document.querySelector("script")).toBeNull();
    // @ts-expect-error — runtime probe for the side-effect we forbid.
    expect(window.__pwned__).toBeUndefined();
  });

  it("propagates onChange when the underlying editor changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MarkdownEditor {...baseProps} onChange={onChange} value="" />);
    await user.type(screen.getByTestId("cm-editor"), "x");
    expect(onChange).toHaveBeenCalled();
  });

  it("calls onBlur when the editor loses focus", async () => {
    const user = userEvent.setup();
    const onBlur = vi.fn();
    render(<MarkdownEditor {...baseProps} onBlur={onBlur} />);
    const editor = screen.getByTestId("cm-editor");
    await user.click(editor);
    await user.tab();
    expect(onBlur).toHaveBeenCalled();
  });
});
