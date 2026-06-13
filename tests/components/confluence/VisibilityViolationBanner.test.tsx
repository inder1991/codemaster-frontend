import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import { VisibilityViolationBanner } from "@/components/confluence/VisibilityViolationBanner";
import { DarkModeProvider } from "@/components/ui/dark-mode-provider";

function withProviders(node: ReactNode) {
  return <DarkModeProvider>{node}</DarkModeProvider>;
}

describe("VisibilityViolationBanner", () => {
  it("renders nothing when integrationsWithViolations = 0", () => {
    const { container } = render(
      withProviders(
        <VisibilityViolationBanner
          integrationsWithViolations={0}
          totalIntegrations={5}
        />,
      ),
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders a count summary when > 0", () => {
    render(
      withProviders(
        <VisibilityViolationBanner
          integrationsWithViolations={3}
          totalIntegrations={10}
        />,
      ),
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/3 of 10 integrations/i)).toBeInTheDocument();
  });

  it("provides a 'View details' link to the quarantined-chunks page", () => {
    render(
      withProviders(
        <VisibilityViolationBanner
          integrationsWithViolations={2}
          totalIntegrations={5}
        />,
      ),
    );
    const link = screen.getByRole("link", { name: /view details/i });
    expect(link).toHaveAttribute(
      "href",
      "/admin/confluence/quarantined-chunks",
    );
  });
});
