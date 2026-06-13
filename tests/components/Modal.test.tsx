import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Modal } from "@/components/ui/overlays/Modal";

describe("Modal", () => {
  it("does not render content when open=false", () => {
    render(
      <Modal
        open={false}
        onClose={() => {}}
        title="Title"
        primaryAction={{ label: "OK", onClick: () => {} }}
      />,
    );
    expect(screen.queryByText("Title")).not.toBeInTheDocument();
  });

  it("renders title + description + body when open", () => {
    render(
      <Modal
        open={true}
        onClose={() => {}}
        title="Confirm action"
        description="This will fire on every review"
        primaryAction={{ label: "Confirm", onClick: () => {} }}
      >
        <p>Body content</p>
      </Modal>,
    );
    expect(screen.getByText("Confirm action")).toBeInTheDocument();
    expect(screen.getByText("This will fire on every review")).toBeInTheDocument();
    expect(screen.getByText("Body content")).toBeInTheDocument();
  });

  it("fires primaryAction.onClick when the primary button is clicked", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal
        open={true}
        onClose={() => {}}
        title="Title"
        primaryAction={{ label: "Approve", onClick }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(onClick).toHaveBeenCalled();
  });

  it("disables the primary button when primaryAction.disabled=true", () => {
    render(
      <Modal
        open={true}
        onClose={() => {}}
        title="Title"
        primaryAction={{
          label: "Approve",
          onClick: () => {},
          disabled: true,
        }}
      />,
    );
    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
  });

  it("renders the secondary action when provided", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal
        open={true}
        onClose={() => {}}
        title="Title"
        primaryAction={{ label: "OK", onClick: () => {} }}
        secondaryAction={{ label: "Cancel", onClick: onCancel }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
