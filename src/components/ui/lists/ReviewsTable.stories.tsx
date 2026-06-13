import type { Meta, StoryObj } from "@storybook/react";

import { ReviewsTable } from "./ReviewsTable";

interface Row {
  id: string;
  pr: number;
  title: string;
  state: string;
}

const meta = {
  title: "UI/Lists/ReviewsTable",
  component: ReviewsTable<Row>,
} satisfies Meta<typeof ReviewsTable<Row>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    rows: [
      { id: "a", pr: 42, title: "Add formatCurrency", state: "complete" },
      { id: "b", pr: 43, title: "Refactor cart", state: "in_progress" },
    ],
    columns: [
      { header: "PR", cell: (r) => `#${r.pr}` },
      { header: "Title", cell: (r) => r.title },
      { header: "State", cell: (r) => r.state, hiddenOnMobile: true },
    ],
    rowKey: (r) => r.id,
    caption: "Reviews",
  },
};

export const Empty: Story = {
  args: {
    rows: [],
    columns: [
      { header: "PR", cell: (r: Row) => r.pr },
      { header: "Title", cell: (r: Row) => r.title },
    ],
    rowKey: (r: Row) => r.id,
    caption: "Reviews — empty",
  },
};
