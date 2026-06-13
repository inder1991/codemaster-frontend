import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { ErrorBoundary } from "@/components/common/ErrorBoundary";

function Bomb(): never {
  throw new Error("boom");
}

describe("ErrorBoundary", () => {
  it("renders children normally when no throw", () => {
    render(
      <ErrorBoundary fallback={<span>failed</span>}>
        <span>ok</span>
      </ErrorBoundary>,
    );
    expect(screen.getByText("ok")).toBeInTheDocument();
    expect(screen.queryByText("failed")).not.toBeInTheDocument();
  });

  it("renders fallback when a child throws, throw does not propagate", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={<span>boundary caught it</span>}>
        <Bomb />
      </ErrorBoundary>,
    );

    expect(screen.getByText("boundary caught it")).toBeInTheDocument();
    expect(screen.queryByText("ok")).not.toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });
});
