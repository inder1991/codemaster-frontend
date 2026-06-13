/**
 * Sprint 13 / S13.1.2 — AuditEventRow unit tests.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { AuditEventRow } from "@/components/audit-log/AuditEventRow";
import type { AuditEventListItemV1 as AuditEvent } from "@/lib/api/admin";

const FLAG_PUT_EVENT: AuditEvent = {
  audit_event_id: "ae-1",
  actor_user_id: "alpha-uid",
  action: "flag.put",
  target_id: "bedrock_global_daily_cap_cents",
  occurred_at: new Date(Date.now() - 90 * 60_000).toISOString(),
  before_excerpt: '{"value": 240000}',
  after_excerpt: '{"value": 120000}',
};

const REVIEW_POSTED_EVENT: AuditEvent = {
  audit_event_id: "ae-2",
  actor_user_id: "beta-uid",
  action: "review.posted",
  target_id: "rev-9821",
  occurred_at: new Date(Date.now() - 5 * 60_000).toISOString(),
  before_excerpt: "",
  after_excerpt: '{"finding_count": 4}',
};

describe("AuditEventRow", () => {
  it("renders action chip + actor + target_id + relative time", () => {
    render(<AuditEventRow event={FLAG_PUT_EVENT} />);
    expect(screen.getByText("flag.put")).toBeInTheDocument();
    expect(
      screen.getByText("bedrock_global_daily_cap_cents"),
    ).toBeInTheDocument();
    expect(screen.getByText(/alpha-uid/)).toBeInTheDocument();
    expect(screen.getByText(/h ago/)).toBeInTheDocument();
  });

  it("renders before + after excerpts when present", () => {
    render(<AuditEventRow event={FLAG_PUT_EVENT} />);
    expect(screen.getByText('{"value": 240000}')).toBeInTheDocument();
    expect(screen.getByText('{"value": 120000}')).toBeInTheDocument();
  });

  it("renders placeholder for empty before excerpt", () => {
    render(<AuditEventRow event={REVIEW_POSTED_EVENT} />);
    // Two `(none)` blocks would be wrong; only the empty before
    // gets one. The after has content.
    const placeholders = screen.queryAllByText("(none)");
    expect(placeholders.length).toBe(1);
    expect(screen.getByText('{"finding_count": 4}')).toBeInTheDocument();
  });

  it("falls back to neutral kind when action is unknown", () => {
    const event: AuditEvent = {
      ...FLAG_PUT_EVENT,
      action: "novel.action.kind",
    };
    render(<AuditEventRow event={event} />);
    // Renders without crashing; just spot-check action visible.
    expect(screen.getByText("novel.action.kind")).toBeInTheDocument();
  });
});
