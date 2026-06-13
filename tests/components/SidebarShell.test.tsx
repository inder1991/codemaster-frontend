import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomeIcon } from "@heroicons/react/24/outline";
import type { ReactNode } from "react";

import { SidebarShell } from "@/components/ui/application-shells/SidebarShell";
import type { NavItem, UserMenuItem } from "@/components/ui/application-shells/SidebarShell";
import { DarkModeProvider } from "@/components/ui/dark-mode-provider";

const NAV: ReadonlyArray<NavItem> = [
  { name: "Dashboard", href: "/dashboard", icon: HomeIcon, current: true },
  { name: "Reviews", href: "/reviews", icon: HomeIcon, current: false },
];

const USER_NAV: ReadonlyArray<UserMenuItem> = [
  { name: "Sign out", href: "/api/auth/logout" },
];

const USER = {
  id: "u-test-1",
  name: "Alpha Admin",
  email: "alpha@acme.com",
  role: "platform_owner",
};

// SidebarShell uses `useTheme()` for the dark-mode toggle, which
// throws when the component renders outside `<DarkModeProvider/>`.
// Every test wraps the shell in this helper so the toggle can read
// the context. Source: src/components/ui/dark-mode-provider.tsx.
function withProviders(node: ReactNode) {
  return <DarkModeProvider>{node}</DarkModeProvider>;
}

describe("SidebarShell", () => {
  it("renders without crashing", () => {
    render(
      withProviders(
        <SidebarShell navigation={NAV} userNavigation={USER_NAV} user={USER}>
          <div>child</div>
        </SidebarShell>,
      ),
    );
    expect(screen.getByText("child")).toBeInTheDocument();
  });

  it("renders every nav item with the locked aria-current marker", () => {
    render(
      withProviders(
        <SidebarShell navigation={NAV} userNavigation={USER_NAV} user={USER}>
          <div />
        </SidebarShell>,
      ),
    );
    const dashboards = screen.getAllByText("Dashboard");
    const reviews = screen.getAllByText("Reviews");
    expect(dashboards.length).toBeGreaterThan(0);
    expect(reviews.length).toBeGreaterThan(0);
    // The first matching anchor should carry aria-current="page"
    // for the active item.
    const dashboardLink = dashboards[0]?.closest("a");
    const reviewsLink = reviews[0]?.closest("a");
    expect(dashboardLink).toHaveAttribute("aria-current", "page");
    expect(reviewsLink).not.toHaveAttribute("aria-current");
  });

  it("renders the brand name", () => {
    render(
      withProviders(
        <SidebarShell
          navigation={NAV}
          userNavigation={USER_NAV}
          user={USER}
          brandName="codemaster"
        >
          <div />
        </SidebarShell>,
      ),
    );
    expect(screen.getAllByText("codemaster").length).toBeGreaterThan(0);
  });

  it("opens the user menu and reveals the user-nav items", async () => {
    const user = userEvent.setup();
    render(
      withProviders(
        <SidebarShell navigation={NAV} userNavigation={USER_NAV} user={USER}>
          <div />
        </SidebarShell>,
      ),
    );
    const trigger = screen.getByRole("button", { name: /open user menu/i });
    await user.click(trigger);
    expect(await screen.findByText("Sign out")).toBeInTheDocument();
    expect(screen.getByText("alpha@acme.com")).toBeInTheDocument();
    expect(screen.getByText("platform_owner")).toBeInTheDocument();
  });

  it("opens the mobile sidebar when the menu icon is clicked", async () => {
    const user = userEvent.setup();
    render(
      withProviders(
        <SidebarShell navigation={NAV} userNavigation={USER_NAV} user={USER}>
          <div />
        </SidebarShell>,
      ),
    );
    const open = screen.getByRole("button", { name: /open sidebar/i });
    await user.click(open);
    expect(
      await screen.findByRole("button", { name: /close sidebar/i }),
    ).toBeInTheDocument();
  });
});
