import type { Meta, StoryObj } from "@storybook/react";

import { Loading } from "./Loading";
import { Empty } from "./Empty";
import { ErrorState } from "./Error";

const meta = {
  title: "UI/States",
  parameters: { layout: "centered" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const LoadingSkeleton: Story = {
  render: () => <Loading rows={4} />,
};

export const LoadingSpinner: Story = {
  render: () => <Loading variant="spinner" />,
};

export const EmptyState: Story = {
  render: () => (
    <Empty
      title="No reviews yet"
      body="Open a PR on a repo with codemaster enabled to see findings."
      cta={{ label: "View repos", onClick: () => {} }}
    />
  ),
};

export const ErrorWithRetry: Story = {
  render: () => (
    <ErrorState
      title="Failed to load reviews"
      body="The API returned 503. Retry, or check the platform status page."
      correlationId="req-abc-123"
      onRetry={() => {}}
    />
  ),
};
