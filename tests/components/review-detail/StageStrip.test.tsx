import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { StageStrip } from "@/components/review-detail/StageStrip";
import type { ActivityEventV1 } from "@/lib/api/admin";

function act(
  seq: number,
  activity_name: string,
  state: ActivityEventV1["state"],
): ActivityEventV1 {
  return {
    seq,
    activity_name,
    state,
    started_at: "2026-05-30T11:00:00Z",
    completed_at: "2026-05-30T11:00:01Z",
    detail: "",
  };
}

describe("StageStrip", () => {
  it("renders nothing for an empty activity list", () => {
    const { container } = render(<StageStrip activities={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a per-stage duration when completed is after started (P4)", () => {
    render(
      <StageStrip
        activities={[
          {
            seq: 1,
            activity_name: "CHUNK",
            state: "completed",
            started_at: "2026-05-30T11:00:00Z",
            completed_at: "2026-05-30T11:00:02Z",
            detail: "",
          },
        ]}
      />,
    );
    expect(screen.getByText(/2\.0s/)).toBeInTheDocument();
  });

  it("renders no duration when timestamps are equal (P4)", () => {
    render(
      <StageStrip
        activities={[
          {
            seq: 1,
            activity_name: "WEBHOOK_RECEIVED",
            state: "started",
            started_at: "2026-05-30T11:00:00Z",
            completed_at: "2026-05-30T11:00:00Z",
            detail: "",
          },
        ]}
      />,
    );
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
  });

  it("renders activity names in sequence order", () => {
    render(
      <StageStrip
        activities={[
          act(1, "WEBHOOK_RECEIVED", "started"),
          act(2, "ANALYZED", "completed"),
        ]}
      />,
    );
    expect(screen.getByText("WEBHOOK_RECEIVED")).toBeInTheDocument();
    expect(screen.getByText("ANALYZED")).toBeInTheDocument();
  });
});
