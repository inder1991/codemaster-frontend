/**
 * @adopted-from vendor/application-ui-v4/react/application-shells/sidebar/03-sidebar-with-header.jsx
 *
 * Sidebar shell. Sprint 12 / S12.1.1, restructured 2026-05-04
 * (head-of-UI calibration):
 *   - Top bar dropped on `lg+`. The desktop chrome is sidebar-only;
 *     the top bar lives only on mobile (hosting the hamburger).
 *   - User-menu + theme toggle moved to the sidebar BOTTOM (per
 *     DESIGN.md "user-card pinned at bottom").
 *   - Org switcher chip pinned to the sidebar TOP.
 *   - Skip-to-content link is the first focusable element.
 *
 * Locked invariants (DESIGN.md):
 *   - Active nav item: `bg.muted` rounded pill, NO accent fill.
 *   - Avatar: `boring-avatars` `marble` variant deterministic from
 *     the user identifier; NEVER initials-on-tinted-circle.
 *   - Tokens: every color goes through design-tokens.ts. NEVER
 *     `bg-white`, `text-white`, `text-indigo-*`.
 */

"use client";

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  TransitionChild,
} from "@headlessui/react";
import {
  Bars3Icon,
  ChevronUpDownIcon,
  MoonIcon,
  SunIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import type { ComponentType, JSX, ReactNode, SVGProps } from "react";
import { useState } from "react";

import { Avatar } from "@/components/ui/elements/Avatar";
import { cn } from "@/lib/cn";
import { colors, motion, radius, type } from "@/lib/design-tokens";
import { useTheme } from "@/components/ui/dark-mode-provider";

export interface NavItem {
  name: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  current: boolean;
}

export interface UserMenuItem {
  name: string;
  href: string;
}

export interface SidebarShellProps {
  navigation: ReadonlyArray<NavItem>;
  userNavigation: ReadonlyArray<UserMenuItem>;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  brandName?: string;
  /** Org / tenant label shown in the top org-switcher chip. */
  orgName?: string;
  children: ReactNode;
}

export function SidebarShell({
  navigation,
  userNavigation,
  user,
  brandName = "codemaster",
  orgName = "acme",
  children,
}: SidebarShellProps): JSX.Element {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <a
        href="#main-content"
        className={cn(
          "sr-only focus:not-sr-only",
          "focus:fixed focus:top-2 focus:left-2 focus:z-[60]",
          "focus:px-3 focus:py-2",
          radius.md,
          colors.bg.elevated,
          colors.text.primary,
          colors.accent.ring,
          "focus:shadow-[0_8px_24px_oklch(0%_0_0/0.12)]",
          type.bodyStrong,
        )}
      >
        Skip to content
      </a>

      {/* Mobile sidebar (off-canvas) */}
      <Dialog
        open={sidebarOpen}
        onClose={setSidebarOpen}
        className="relative z-50 lg:hidden"
      >
        <DialogBackdrop
          className={cn("fixed inset-0", "bg-[oklch(20%_0.01_80)]/80")}
        />
        <div className="fixed inset-0 flex">
          <DialogPanel
            transition
            className="relative mr-16 flex w-full max-w-xs flex-1"
          >
            <TransitionChild>
              <div
                className={cn(
                  "absolute top-0 left-full flex w-16 justify-center pt-5",
                  motion.base,
                )}
              >
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="-m-2.5 p-2.5"
                  aria-label="Close sidebar"
                >
                  <XMarkIcon
                    className={cn("size-6", colors.text.inverse)}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </TransitionChild>
            <SidebarBody
              navigation={navigation}
              brandName={brandName}
              orgName={orgName}
              user={user}
              userNavigation={userNavigation}
            />
          </DialogPanel>
        </div>
      </Dialog>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <SidebarBody
          navigation={navigation}
          brandName={brandName}
          orgName={orgName}
          user={user}
          userNavigation={userNavigation}
        />
      </div>

      <div className="lg:pl-72">
        {/* Mobile-only top bar with the hamburger */}
        <div
          className={cn(
            "sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 px-4 sm:gap-x-6 sm:px-6 lg:hidden",
            "border-b",
            colors.border.default,
            colors.bg.surface,
          )}
        >
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className={cn(
              "-m-2.5 p-2.5",
              colors.text.muted,
              colors.hover.text.primary,
            )}
            aria-label="Open sidebar"
          >
            <Bars3Icon className="size-6" aria-hidden="true" />
          </button>
          <span className={cn(type.bodyStrong, colors.text.primary)}>
            {brandName}
          </span>
        </div>

        <main id="main-content" tabIndex={-1} className="pt-6 pb-10">
          <div className="px-4 sm:px-6 lg:px-10 max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </>
  );
}

interface SidebarBodyProps {
  navigation: ReadonlyArray<NavItem>;
  brandName: string;
  orgName: string;
  user: SidebarShellProps["user"];
  userNavigation: ReadonlyArray<UserMenuItem>;
}

function SidebarBody({
  navigation,
  brandName,
  orgName,
  user,
  userNavigation,
}: SidebarBodyProps): JSX.Element {
  return (
    <div
      className={cn(
        "flex grow flex-col overflow-y-auto",
        colors.bg.elevated,
        "border-r",
        colors.border.default,
      )}
    >
      {/* Brand + org switcher at the top */}
      <div
        className={cn(
          "px-4 pt-5 pb-4",
          "border-b",
          colors.border.default,
        )}
      >
        <div className="flex items-center gap-x-2.5">
          <BrandMark />
          <span className={cn(type.bodyStrong, colors.text.primary)}>
            {brandName}
          </span>
        </div>
        <OrgSwitcher orgName={orgName} />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4" aria-label="Primary">
        <ul className="space-y-1">
          {navigation.map((item) => (
            <li key={item.name}>
              <a
                href={item.href}
                aria-current={item.current ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-x-3 px-3 py-2",
                  type.meta,
                  radius.md,
                  item.current
                    ? cn(colors.bg.muted, colors.text.primary)
                    : cn(
                        colors.text.muted,
                        colors.hover.text.primary,
                        colors.hover.bg,
                      ),
                  motion.fast,
                )}
              >
                <item.icon
                  aria-hidden="true"
                  className={cn(
                    "size-5 shrink-0",
                    item.current ? colors.text.primary : colors.text.faint,
                  )}
                />
                {item.name}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* User card + theme toggle pinned to bottom */}
      <div
        className={cn(
          "p-3",
          "border-t",
          colors.border.default,
        )}
      >
        <div className="flex items-center gap-x-2">
          <UserMenu user={user} userNavigation={userNavigation} />
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

function BrandMark(): JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-7 items-center justify-center",
        radius.sm,
        "bg-[oklch(72%_0.16_65)] text-[oklch(98%_0.005_80)]",
        type.bodyStrong,
      )}
    >
      c
    </span>
  );
}

function OrgSwitcher({ orgName }: { orgName: string }): JSX.Element {
  // Sprint 12 stub: button shape only. S13 wires the org-switcher
  // popover (lists tenants the user can reach + Switch button).
  return (
    <button
      type="button"
      className={cn(
        "mt-3 flex w-full items-center gap-x-2 px-2.5 py-1.5",
        radius.md,
        "border",
        colors.border.default,
        colors.bg.surface,
        colors.hover.bg,
        motion.fast,
      )}
      aria-label={`Switch organisation. Current: ${orgName}`}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex size-5 items-center justify-center",
          radius.sm,
          colors.bg.muted,
          colors.text.muted,
          type.caption,
          "font-semibold uppercase",
        )}
      >
        {orgName.charAt(0)}
      </span>
      <span
        className={cn(
          "flex-1 truncate text-left",
          type.meta,
          colors.text.primary,
        )}
      >
        {orgName}
      </span>
      <ChevronUpDownIcon
        aria-hidden="true"
        className={cn("size-4 shrink-0", colors.text.faint)}
      />
    </button>
  );
}

function UserMenu({
  user,
  userNavigation,
}: {
  user: SidebarShellProps["user"];
  userNavigation: ReadonlyArray<UserMenuItem>;
}): JSX.Element {
  return (
    <Menu as="div" className="relative flex-1">
      <MenuButton
        className={cn(
          "flex w-full items-center gap-x-2.5 px-2 py-1.5",
          radius.md,
          colors.hover.bg,
          motion.fast,
        )}
      >
        <span className="sr-only">Open user menu</span>
        <Avatar size="sm" name={user.id} variant="marble" />
        <span className="min-w-0 flex-1 text-left">
          <span
            className={cn(
              "block truncate",
              type.meta,
              colors.text.primary,
            )}
          >
            {user.name}
          </span>
          <span
            className={cn(
              "block truncate",
              type.caption,
              colors.text.faint,
            )}
          >
            {user.role}
          </span>
        </span>
      </MenuButton>
      <MenuItems
        transition
        anchor="top start"
        className={cn(
          "z-50 mt-[-4px] w-56 origin-bottom-left py-2",
          radius.md,
          colors.bg.elevated,
          "border",
          colors.border.default,
          "shadow-[0_8px_24px_oklch(0%_0_0/0.12)]",
          "transition data-closed:scale-95 data-closed:opacity-0",
          motion.base,
        )}
      >
        <div
          className={cn(
            "px-3 pb-2 mb-1",
            "border-b",
            colors.border.default,
          )}
        >
          <p className={cn(type.caption, colors.text.muted)}>
            Signed in as
          </p>
          <p
            className={cn(
              "truncate",
              type.bodyStrong,
              colors.text.primary,
            )}
          >
            {user.email}
          </p>
        </div>
        {userNavigation.map((item) => (
          <MenuItem key={item.name}>
            <a
              href={item.href}
              className={cn(
                "block px-3 py-1.5",
                type.body,
                colors.text.primary,
                "data-focus:bg-[oklch(92%_0.028_80)] dark:data-focus:bg-[oklch(26%_0.014_270)]",
              )}
            >
              {item.name}
            </a>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
}

function ThemeToggle(): JSX.Element {
  const { theme, toggle } = useTheme();
  const Icon = theme === "dark" ? SunIcon : MoonIcon;
  const label =
    theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "shrink-0 p-2",
        radius.md,
        colors.text.muted,
        colors.hover.text.primary,
        colors.hover.bg,
        motion.fast,
      )}
      aria-label={label}
      title={label}
    >
      <Icon className="size-5" aria-hidden="true" />
    </button>
  );
}
