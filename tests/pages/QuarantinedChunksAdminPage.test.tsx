import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import QuarantinedChunksAdminPage from "@/app/(authed)/admin/confluence/quarantined-chunks/page";
import * as adminApi from "@/lib/api/admin";
import { DarkModeProvider } from "@/components/ui/dark-mode-provider";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/confluence/quarantined-chunks",
}));

function withProviders(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <DarkModeProvider>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </DarkModeProvider>
  );
}

const INT_A = {
  integration_id: "11111111-1111-1111-1111-111111111111",
  kind: "confluence_space" as const,
  config_json: '{"space_key": "ACME"}',
  enabled: true,
  last_validated_at: "2026-05-15T10:00:00Z",
  last_validation_error: null,
  created_at: "2026-05-15T10:00:00Z",
  updated_at: "2026-05-15T10:00:00Z",
};
const INT_B = {
  ...INT_A,
  integration_id: "22222222-2222-2222-2222-222222222222",
  config_json: '{"space_key": "PLAT"}',
};

describe("QuarantinedChunksAdminPage", () => {
  beforeEach(() => {
    vi.spyOn(adminApi, "fetchIntegrations").mockResolvedValue([INT_A, INT_B]);
    vi.spyOn(adminApi, "fetchQuarantinedChunks").mockResolvedValue({
      schema_version: 1,
      rows: [],
      next_cursor: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the integration picker with all Confluence integrations", async () => {
    render(withProviders(<QuarantinedChunksAdminPage />));
    await waitFor(() => {
      expect(
        screen.getByRole("combobox", { name: /integration/i }),
      ).toBeInTheDocument();
    });
    const select = screen.getByRole("combobox", { name: /integration/i });
    expect(select).toContainHTML("ACME");
    expect(select).toContainHTML("PLAT");
  });

  it("disables the View button until an integration is selected", async () => {
    render(withProviders(<QuarantinedChunksAdminPage />));
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /view quarantined chunks/i }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: /view quarantined chunks/i }),
    ).toBeDisabled();
  });

  it("opens the sidebar with the selected integration_id", async () => {
    const user = userEvent.setup();
    render(withProviders(<QuarantinedChunksAdminPage />));
    await waitFor(() => {
      expect(
        screen.getByRole("combobox", { name: /integration/i }),
      ).toBeInTheDocument();
    });
    await user.selectOptions(
      screen.getByRole("combobox", { name: /integration/i }),
      INT_A.integration_id,
    );
    await user.click(
      screen.getByRole("button", { name: /view quarantined chunks/i }),
    );
    // Sidebar's Modal title appears
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /quarantined chunks/i }),
      ).toBeInTheDocument();
    });
  });
});
