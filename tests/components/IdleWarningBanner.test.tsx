/**
 * Sprint X.9 (2026-05-11) — IdleWarningBanner UI tests.
 */

import { act, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { IdleWarningBanner } from "@/components/IdleWarningBanner";

describe("IdleWarningBanner (X.9)", () => {
  test("renders nothing when remainingMs is null", () => {
    const { container } = render(
      <IdleWarningBanner
        remainingMs={null}
        onDismiss={() => {}}
        onSignOut={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  test("shows the warning + minute count when active", () => {
    render(
      <IdleWarningBanner
        remainingMs={5 * 60 * 1000}
        onDismiss={() => {}}
        onSignOut={() => {}}
      />,
    );

    expect(
      screen.getByText(/about to be signed out/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/5 minutes/)).toBeInTheDocument();
  });

  test("renders singular 'minute' for exactly 1 minute remaining", () => {
    render(
      <IdleWarningBanner
        remainingMs={60_000}
        onDismiss={() => {}}
        onSignOut={() => {}}
      />,
    );
    // Text reads "... in about 1 minute of inactivity." — verify by
    // both the number and the singular noun appearing.
    const body = screen.getByTestId("idle-warning-banner");
    expect(body.textContent).toContain("about 1 minute");
    expect(body.textContent).not.toContain("about 1 minutes");
  });

  test("Stay signed in invokes onDismiss + hides the banner", () => {
    const onDismiss = vi.fn();
    render(
      <IdleWarningBanner
        remainingMs={5 * 60 * 1000}
        onDismiss={onDismiss}
        onSignOut={() => {}}
      />,
    );

    act(() => {
      screen.getByRole("button", { name: /stay signed in/i }).click();
    });

    expect(onDismiss).toHaveBeenCalledOnce();
    // After dismiss, local state hides the banner.
    expect(
      screen.queryByText(/about to be signed out/i),
    ).toBeNull();
  });

  test("Sign out now invokes onSignOut", () => {
    const onSignOut = vi.fn();
    render(
      <IdleWarningBanner
        remainingMs={5 * 60 * 1000}
        onDismiss={() => {}}
        onSignOut={onSignOut}
      />,
    );

    screen.getByRole("button", { name: /sign out now/i }).click();

    expect(onSignOut).toHaveBeenCalledOnce();
  });

  test("uses role=status + aria-live=polite for accessibility", () => {
    render(
      <IdleWarningBanner
        remainingMs={5 * 60 * 1000}
        onDismiss={() => {}}
        onSignOut={() => {}}
      />,
    );

    const banner = screen.getByTestId("idle-warning-banner");
    expect(banner).toHaveAttribute("role", "status");
    expect(banner).toHaveAttribute("aria-live", "polite");
  });
});
