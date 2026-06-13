import type { Meta, StoryObj } from "@storybook/react";
import { HomeIcon, UsersIcon, FolderIcon } from "@heroicons/react/24/outline";

import { SidebarShell } from "./SidebarShell";

const meta = {
  title: "UI/ApplicationShells/SidebarShell",
  component: SidebarShell,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SidebarShell>;

export default meta;
type Story = StoryObj<typeof meta>;

const NAV = [
  { name: "Dashboard", href: "/dashboard", icon: HomeIcon, current: true },
  { name: "Reviews", href: "/reviews", icon: UsersIcon, current: false },
  { name: "Knowledge", href: "/knowledge", icon: FolderIcon, current: false },
];

const USER = {
  id: "user_alpha",
  name: "Alpha Admin",
  email: "alpha@acme.com",
  role: "platform_owner",
};

export const Default: Story = {
  args: {
    navigation: NAV,
    userNavigation: [{ name: "Sign out", href: "/api/auth/logout" }],
    user: USER,
    children: <div className="text-gray-500">Page content</div>,
  },
};

export const ReviewsActive: Story = {
  args: {
    navigation: NAV.map((n) => ({ ...n, current: n.name === "Reviews" })),
    userNavigation: [{ name: "Sign out", href: "/api/auth/logout" }],
    user: USER,
    children: <div className="text-gray-500">Reviews list goes here</div>,
  },
};
