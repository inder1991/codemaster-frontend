/**
 * Task 5.5 — unit tests for <ValidationReportViewer>.
 *
 * Pins the per-spec component contracts:
 *   1. renders passed=true with green "Passed" badge
 *   2. renders passed=false with red "Failed" badge
 *   3. displays retrieval_overlap at_5 and at_10 with threshold context
 *   4. displays norm distribution mean/stddev/p50/p99 for both generations
 *   5. displays truncation_count; red highlight if > 1% of sample
 *   6. renders warnings list when warnings are present
 *   7. displays "no warnings" placeholder when warnings empty
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ValidationReportViewer } from "@/components/admin/ValidationReportViewer";
import type { ValidationReportV1 } from "@/components/admin/ValidationReportViewer";

// ── Fixture ───────────────────────────────────────────────────────

const mockReport: ValidationReportV1 = {
  schema_version: 1,
  sample_size: 500,
  passed: true,
  retrieval_overlap: {
    at_5: 0.92,
    at_10: 0.88,
    fixture_size: 20,
  },
  tokenization_drift: {
    mean_pct_diff: 1.23,
    max_pct_diff: 4.56,
  },
  norm_distribution_old: {
    mean: 0.9810,
    stddev: 0.0142,
    p50: 0.9825,
    p99: 0.9971,
  },
  norm_distribution_new: {
    mean: 0.9790,
    stddev: 0.0155,
    p50: 0.9805,
    p99: 0.9960,
  },
  truncation_count: 3,
  warnings: [],
};

// ── Tests ─────────────────────────────────────────────────────────

describe("ValidationReportViewer", () => {
  test("renders passed=true with green 'Passed' badge", () => {
    render(<ValidationReportViewer report={{ ...mockReport, passed: true }} />);
    const badge = screen.getByTestId("passed-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("Passed");
    // Should carry the green status class
    expect(badge.className).toMatch(/c-status-healthy|c-statusbg-healthy/);
  });

  test("renders passed=false with red 'Failed' badge", () => {
    render(<ValidationReportViewer report={{ ...mockReport, passed: false }} />);
    const badge = screen.getByTestId("passed-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("Failed");
    // Should carry the red status class
    expect(badge.className).toMatch(/c-status-down|c-statusbg-down/);
  });

  test("displays sample_size in the header", () => {
    render(<ValidationReportViewer report={mockReport} />);
    expect(screen.getByTestId("sample-size")).toHaveTextContent("500");
  });

  test("displays retrieval_overlap at_5 and at_10 with threshold context", () => {
    render(<ValidationReportViewer report={mockReport} />);

    // at_5 row
    const at5Row = screen.getByTestId("overlap-row-Overlapat5");
    expect(at5Row).toBeInTheDocument();
    expect(at5Row).toHaveTextContent("0.920");
    expect(at5Row).toHaveTextContent("0.80");

    // at_10 row
    const at10Row = screen.getByTestId("overlap-row-Overlapat10");
    expect(at10Row).toBeInTheDocument();
    expect(at10Row).toHaveTextContent("0.880");
    expect(at10Row).toHaveTextContent("0.70");

    // Fixture size
    expect(screen.getByText(/20 queries/)).toBeInTheDocument();
  });

  test("overlap rows render Pass badge when value meets threshold", () => {
    render(
      <ValidationReportViewer
        report={{
          ...mockReport,
          retrieval_overlap: { at_5: 0.92, at_10: 0.88, fixture_size: 20 },
        }}
      />,
    );
    expect(screen.getByTestId("overlap-pass-badge-Overlapat5")).toHaveTextContent("Pass");
    expect(screen.getByTestId("overlap-pass-badge-Overlapat10")).toHaveTextContent("Pass");
  });

  test("overlap rows render Fail badge when value is below threshold", () => {
    render(
      <ValidationReportViewer
        report={{
          ...mockReport,
          passed: false,
          retrieval_overlap: { at_5: 0.75, at_10: 0.60, fixture_size: 20 },
        }}
      />,
    );
    expect(screen.getByTestId("overlap-pass-badge-Overlapat5")).toHaveTextContent("Fail");
    expect(screen.getByTestId("overlap-pass-badge-Overlapat10")).toHaveTextContent("Fail");
  });

  test("displays norm distribution mean/stddev/p50/p99 for both generations", () => {
    render(<ValidationReportViewer report={mockReport} />);

    // Active generation (old)
    expect(screen.getByTestId("norm-old-label")).toHaveTextContent("Active generation");
    expect(screen.getByTestId("norm-old-mean")).toHaveTextContent("0.9810");
    expect(screen.getByTestId("norm-old-stddev")).toHaveTextContent("0.0142");
    expect(screen.getByTestId("norm-old-p50")).toHaveTextContent("0.9825");
    expect(screen.getByTestId("norm-old-p99")).toHaveTextContent("0.9971");

    // Candidate generation (new)
    expect(screen.getByTestId("norm-new-label")).toHaveTextContent("Candidate generation");
    expect(screen.getByTestId("norm-new-mean")).toHaveTextContent("0.9790");
    expect(screen.getByTestId("norm-new-stddev")).toHaveTextContent("0.0155");
    expect(screen.getByTestId("norm-new-p50")).toHaveTextContent("0.9805");
    expect(screen.getByTestId("norm-new-p99")).toHaveTextContent("0.9960");
  });

  test("displays truncation_count in the truncation section", () => {
    render(<ValidationReportViewer report={mockReport} />);
    const countEl = screen.getByTestId("truncation-count");
    expect(countEl).toHaveTextContent("3");
    // 3 / 500 = 0.6% — not > 1%, so no red warning
    expect(screen.queryByTestId("truncation-warn")).not.toBeInTheDocument();
  });

  test("highlights truncation in red when > 1% of sample", () => {
    render(
      <ValidationReportViewer
        report={{ ...mockReport, sample_size: 100, truncation_count: 5 }}
      />,
    );
    // 5 / 100 = 5% > 1%
    expect(screen.getByTestId("truncation-warn")).toBeInTheDocument();
    const countEl = screen.getByTestId("truncation-count");
    expect(countEl.className).toMatch(/c-status-down/);
  });

  test("renders warnings list when warnings are present", () => {
    render(
      <ValidationReportViewer
        report={{
          ...mockReport,
          warnings: ["Dimension mismatch on 2 chunks", "High max_pct_diff detected"],
        }}
      />,
    );
    const list = screen.getByTestId("warnings-list");
    expect(list).toBeInTheDocument();
    const chips = screen.getAllByTestId("warning-chip");
    expect(chips).toHaveLength(2);
    expect(chips[0]).toHaveTextContent("Dimension mismatch on 2 chunks");
    expect(chips[1]).toHaveTextContent("High max_pct_diff detected");
    expect(screen.queryByTestId("no-warnings")).not.toBeInTheDocument();
  });

  test("displays 'no warnings' placeholder when warnings is empty", () => {
    render(
      <ValidationReportViewer report={{ ...mockReport, warnings: [] }} />,
    );
    expect(screen.getByTestId("no-warnings")).toBeInTheDocument();
    expect(screen.queryByTestId("warnings-list")).not.toBeInTheDocument();
  });
});
