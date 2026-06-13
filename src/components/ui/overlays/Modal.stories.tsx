import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { Modal } from "./Modal";

const meta = {
  title: "UI/Overlays/Modal",
  component: Modal,
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

function ConfirmStory() {
  const [open, setOpen] = useState(true);
  return (
    <Modal
      open={open}
      onClose={setOpen}
      title="Approve learning?"
      description="This learning will fire on every subsequent review."
      primaryAction={{ label: "Approve", onClick: () => setOpen(false) }}
      secondaryAction={{ label: "Cancel", onClick: () => setOpen(false) }}
    />
  );
}

function DangerStory() {
  const [open, setOpen] = useState(true);
  return (
    <Modal
      open={open}
      onClose={setOpen}
      title="Disable super-admin?"
      description="The account will be marked disabled. You cannot disable the last active super-admin."
      iconTone="danger"
      primaryAction={{
        label: "Disable",
        onClick: () => setOpen(false),
        variant: "danger",
      }}
      secondaryAction={{ label: "Cancel", onClick: () => setOpen(false) }}
    />
  );
}

// `render` drives the story; the wrapper components own all props.
// Storybook still needs `args` to satisfy the component's required-prop
// type, but the values are unused.
const RENDER_ARGS = {
  open: true,
  onClose: () => {},
  title: "",
  primaryAction: { label: "", onClick: () => {} },
} as const;

export const Confirm: Story = {
  args: RENDER_ARGS,
  render: () => <ConfirmStory />,
};
export const Danger: Story = {
  args: RENDER_ARGS,
  render: () => <DangerStory />,
};
