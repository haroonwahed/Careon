import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ArrangementAlignmentPanel } from "./ArrangementAlignmentPanel";

const mockFetchCaseArrangementAlignment = vi.fn();

vi.mock("../../lib/decisionEvaluation", async () => {
  const actual = await vi.importActual<typeof import("../../lib/decisionEvaluation")>("../../lib/decisionEvaluation");
  return {
    ...actual,
    fetchCaseArrangementAlignment: (...args: unknown[]) => mockFetchCaseArrangementAlignment(...args),
  };
});

describe("ArrangementAlignmentPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing while loading then shows advisory hints after fetch", async () => {
    mockFetchCaseArrangementAlignment.mockResolvedValue({
      case_id: "42",
      generated_at: "2026-05-11T10:00:00Z",
      equivalence_hints: [
        {
          source_label: "PGB test",
          target_label: "PGB-achtige jeugdondersteuning (referentie)",
          equivalence_confidence: 0.58,
          rationale: "Test rationale voor arrangement-afstemming.",
          uncertainty: "medium",
        },
      ],
      tariff_alignment: {
        estimated_delta_pct: null,
        notes: "Tarief is niet geautomatiseerd.",
        uncertainty: "high",
      },
      requires_human_confirmation: true,
    });

    render(<ArrangementAlignmentPanel caseId="C-42" />);

    expect(screen.queryByTestId("arrangement-alignment-panel")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("arrangement-alignment-panel")).toBeInTheDocument();
    });

    expect(mockFetchCaseArrangementAlignment).toHaveBeenCalledWith("C-42");
    expect(screen.getByText(/Arrangement-afstemming \(advies\)/)).toBeInTheDocument();
    expect(screen.getByText("PGB test")).toBeInTheDocument();
    expect(screen.getByText(/PGB-achtige jeugdondersteuning/)).toBeInTheDocument();
    expect(screen.getByText("Test rationale voor arrangement-afstemming.")).toBeInTheDocument();
    expect(screen.getByText(/Semantiek:\s*58%/)).toBeInTheDocument();
    expect(screen.getByText("Middelmatige onzekerheid")).toBeInTheDocument();
    expect(screen.getByText("Menselijke bevestiging vereist")).toBeInTheDocument();
    expect(screen.getByText("Tarief is niet geautomatiseerd.")).toBeInTheDocument();
  });

  it("renders nothing when the fetch fails", async () => {
    mockFetchCaseArrangementAlignment.mockRejectedValue(new Error("network"));

    render(<ArrangementAlignmentPanel caseId="C-99" />);

    await waitFor(() => {
      expect(mockFetchCaseArrangementAlignment).toHaveBeenCalled();
    });

    expect(screen.queryByTestId("arrangement-alignment-panel")).not.toBeInTheDocument();
  });

  it("renders nothing when equivalence_hints is empty", async () => {
    mockFetchCaseArrangementAlignment.mockResolvedValue({
      case_id: "1",
      generated_at: "2026-05-11T10:00:00Z",
      equivalence_hints: [],
      tariff_alignment: null,
      requires_human_confirmation: true,
    });

    render(<ArrangementAlignmentPanel caseId="C-1" />);

    await waitFor(() => {
      expect(mockFetchCaseArrangementAlignment).toHaveBeenCalled();
    });

    expect(screen.queryByTestId("arrangement-alignment-panel")).not.toBeInTheDocument();
  });
});
