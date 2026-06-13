import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FixPromptHero } from "@/components/review-detail/FixPromptHero";
import type { FixPromptSummaryV1 } from "@/lib/api/admin";

vi.mock("@/lib/clipboard", () => ({ copyText: vi.fn().mockResolvedValue(true) }));
import { copyText } from "@/lib/clipboard";

function fp(overrides: Partial<FixPromptSummaryV1> = {}): FixPromptSummaryV1 {
  return {
    prompt: "FULL_PROMPT_BODY",
    generation_mode: "deterministic_fallback",
    finding_count: 23,
    truncated: false,
    generated_at: "2026-06-02T00:00:00Z",
    ...overrides,
  };
}

afterEach(() => vi.clearAllMocks());

describe("FixPromptHero", () => {
  it("renders nothing when fixPrompt is null", () => {
    const { container } = render(<FixPromptHero fixPrompt={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the heading, value copy, and a Copy button", () => {
    render(<FixPromptHero fixPrompt={fp()} />);
    expect(
      screen.getByText(/fix-it prompt for claude code/i),
    ).toBeInTheDocument();
    // Headline states what the prompt is without an absolute finding-count
    // claim that could contradict the (differently-scoped) findings list.
    expect(
      screen.getByText(/ready-to-paste fixes for claude code/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /copy prompt/i }),
    ).toBeInTheDocument();
  });

  it("surfaces a visible truncation note when truncated", () => {
    render(<FixPromptHero fixPrompt={fp({ truncated: true })} />);
    expect(screen.getByText(/re-run after fixing/i)).toBeInTheDocument();
  });

  it("copies the prompt and shows a Copied state", async () => {
    const user = userEvent.setup();
    render(<FixPromptHero fixPrompt={fp()} />);
    await user.click(screen.getByRole("button", { name: /copy prompt/i }));
    expect(copyText).toHaveBeenCalledWith("FULL_PROMPT_BODY");
    // assert the button label (not the sr-only status, which also contains "copied")
    expect(
      await screen.findByRole("button", { name: /copied/i }),
    ).toBeInTheDocument();
  });

  it("opens the drawer with the full prompt on View full prompt", async () => {
    const user = userEvent.setup();
    render(<FixPromptHero fixPrompt={fp()} />);
    await user.click(screen.getByRole("button", { name: /view full prompt/i }));
    expect(await screen.findByText("FULL_PROMPT_BODY")).toBeInTheDocument();
  });
});
