/**
 * Sprint X.7 (2026-05-11) — app-level boundary tests.
 *
 * Covers the three Next.js convention files at src/app/:
 *   - error.tsx     — renders on uncaught render errors with reload + ref
 *   - not-found.tsx — renders 404 pages with "Back to dashboard" CTA
 *   - loading.tsx   — renders the global Suspense fallback
 *
 * These files are mounted by Next.js framework convention; we test
 * them as plain components.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import AppError from "@/app/error";
import AppLoading from "@/app/loading";
import NotFound from "@/app/not-found";

describe("app/error.tsx (X.7)", () => {
  test("renders the unexpected-error heading", () => {
    const err = Object.assign(new Error("boom"), {
      digest: "abc12345",
    });
    render(<AppError error={err} reset={() => {}} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /something went wrong/i }),
    ).toBeInTheDocument();
  });

  test("surfaces the Next.js error digest as a reference ID", () => {
    const err = Object.assign(new Error("boom"), {
      digest: "abc12345",
    });
    render(<AppError error={err} reset={() => {}} />);

    const ref = screen.getByTestId("error-digest");
    expect(ref.textContent).toContain("abc12345");
  });

  test("omits the reference block when digest is absent", () => {
    const err = new Error("boom");
    render(<AppError error={err} reset={() => {}} />);

    expect(screen.queryByTestId("error-digest")).toBeNull();
  });

  test("Try-again button invokes the reset callback", async () => {
    const reset = vi.fn();
    const err = new Error("boom");
    render(<AppError error={err} reset={reset} />);

    const button = screen.getByRole("button", { name: /try again/i });
    button.click();

    expect(reset).toHaveBeenCalledOnce();
  });

  test("provides a 'Go home' affordance", () => {
    render(<AppError error={new Error("x")} reset={() => {}} />);
    expect(
      screen.getByRole("button", { name: /go home/i }),
    ).toBeInTheDocument();
  });
});

describe("app/not-found.tsx (X.7)", () => {
  test("renders the 404 marker + heading", () => {
    render(<NotFound />);

    expect(screen.getByText("404")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /page not found/i }),
    ).toBeInTheDocument();
  });

  test("offers a 'Back to dashboard' link to /", () => {
    render(<NotFound />);

    const link = screen.getByRole("link", { name: /back to dashboard/i });
    expect(link).toHaveAttribute("href", "/");
  });
});

describe("app/loading.tsx (X.7)", () => {
  test("renders the global loading state", () => {
    render(<AppLoading />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  test("uses role=status from the underlying Loading component", () => {
    render(<AppLoading />);

    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
