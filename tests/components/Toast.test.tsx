/**
 * Sprint Y.5 (2026-05-11) — global toast primitive.
 *
 * Single source of transient feedback (errors / success / info)
 * across the admin shell. Components call `useToast()` and emit
 * `toast.error("...")` / `toast.success("...")`; the
 * `<ToastContainer>` rendered at the layout root displays them.
 *
 * Behaviour pinned here:
 *  - `error` toast has role="alert" (assistive tech announces it)
 *  - `success` / `info` toasts have role="status" + aria-live="polite"
 *  - toasts auto-dismiss after a configurable timeout
 *  - dismiss button removes the toast immediately
 *  - stacking: multiple concurrent toasts render in order
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import {
  ToastProvider,
  ToastContainer,
  useToast,
} from "@/components/ui/Toast";

function Harness() {
  const toast = useToast();
  return (
    <>
      <button onClick={() => toast.error("Save failed")}>fail</button>
      <button onClick={() => toast.success("Saved")}>ok</button>
      <button onClick={() => toast.info("Heads up")}>info</button>
      <ToastContainer />
    </>
  );
}

function renderHarness() {
  return render(
    <ToastProvider>
      <Harness />
    </ToastProvider>,
  );
}

describe("Toast (Y.5)", () => {
  test("error toast renders with role=alert", () => {
    renderHarness();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /fail/i }));
    });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Save failed");
  });

  test("success toast renders with role=status + aria-live=polite", () => {
    renderHarness();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /ok/i }));
    });
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Saved");
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  test("info toast renders with role=status", () => {
    renderHarness();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /info/i }));
    });
    expect(screen.getByRole("status")).toHaveTextContent("Heads up");
  });

  test("toast auto-dismisses after the default timeout", () => {
    vi.useFakeTimers();
    try {
      renderHarness();
      act(() => {
        fireEvent.click(screen.getByRole("button", { name: /ok/i }));
      });
      expect(screen.getByRole("status")).toHaveTextContent("Saved");
      // Default timeout is 4000ms; advance just past it.
      act(() => {
        vi.advanceTimersByTime(4100);
      });
      expect(screen.queryByRole("status")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  test("dismiss button removes the toast immediately", () => {
    renderHarness();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /fail/i }));
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("multiple concurrent toasts stack in emission order", () => {
    renderHarness();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /fail/i }));
      fireEvent.click(screen.getByRole("button", { name: /^ok$/i }));
      fireEvent.click(screen.getByRole("button", { name: /^info$/i }));
    });
    const messages = screen
      .getAllByTestId("toast-message")
      .map((el) => el.textContent);
    expect(messages).toEqual(["Save failed", "Saved", "Heads up"]);
  });

  test("useToast outside provider throws a clear error", () => {
    function Bare() {
      useToast();
      return null;
    }
    // Suppress React's console.error noise; the throw is the contract.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Bare />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});
