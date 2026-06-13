import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { Loading } from "@/components/ui/states/Loading";

describe("Loading", () => {
  it("renders skeleton variant by default with the requested rows", () => {
    const { container } = render(<Loading rows={5} />);
    expect(container.querySelectorAll(".animate-pulse").length).toBe(5);
    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
  });

  it("clamps rows < 1 to 1", () => {
    const { container } = render(<Loading rows={0} />);
    expect(container.querySelectorAll(".animate-pulse").length).toBe(1);
  });

  it("renders spinner variant on demand", () => {
    const { container } = render(<Loading variant="spinner" />);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
  });
});
