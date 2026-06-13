import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SuggestTaxonomyModal } from "@/components/confluence/SuggestTaxonomyModal";

describe("SuggestTaxonomyModal", () => {
  it("disables Submit until canonical label + rationale are valid", async () => {
    const user = userEvent.setup();
    render(
      <SuggestTaxonomyModal
        open
        unrecognizedLabel="unrecognized:cobol"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    const btn = screen.getByRole("button", { name: /^submit$/i });
    expect(btn).toBeDisabled();
    await user.type(
      screen.getByLabelText(/proposed canonical label/i),
      "lang:cobol",
    );
    expect(btn).toBeDisabled();
    await user.type(
      screen.getByLabelText(/rationale/i),
      "We maintain a couple of COBOL services that would benefit from this scope.",
    );
    expect(btn).not.toBeDisabled();
  });

  it("rejects malformed proposed canonical label", async () => {
    const user = userEvent.setup();
    render(
      <SuggestTaxonomyModal
        open
        unrecognizedLabel="unrecognized:cobol"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    await user.type(
      screen.getByLabelText(/proposed canonical label/i),
      "not-a-valid-format",
    );
    await user.type(
      screen.getByLabelText(/rationale/i),
      "A long enough rationale to clear the 20-char minimum.",
    );
    expect(screen.getByRole("button", { name: /^submit$/i })).toBeDisabled();
  });

  it("submits a complete TaxonomySuggestionV1 body", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <SuggestTaxonomyModal
        open
        unrecognizedLabel="unrecognized:cobol"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );
    await user.type(
      screen.getByLabelText(/proposed canonical label/i),
      "lang:cobol",
    );
    await user.type(
      screen.getByLabelText(/rationale/i),
      "We have a few COBOL repos and reviews need that scope.",
    );
    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const body = onConfirm.mock.calls[0]![0];
    expect(body.label).toBe("unrecognized:cobol");
    expect(body.proposed_canonical_label).toBe("lang:cobol");
    expect(body.rationale.length).toBeGreaterThanOrEqual(20);
    expect(body.suggester_email).toBeNull();
    expect(body.schema_version).toBe(1);
  });
});
