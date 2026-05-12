import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("renders nothing while loading then shows operational workflow surface after fetch", async () => {
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

    render(
      <ArrangementAlignmentPanel
        caseId="C-42"
        careContext={{
          zorgvorm: "Jeugdhulp",
          regio: "Utrecht",
          aanmelder: "Team Zorg",
          zorgintensiteit: "Standaard",
          startperiode: "12 mei 2026",
          korteSamenvatting: "Korte casuslijn voor test.",
        }}
      />,
    );

    expect(screen.queryByTestId("arrangement-alignment-panel")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("arrangement-alignment-panel")).toBeInTheDocument();
    });

    expect(mockFetchCaseArrangementAlignment).toHaveBeenCalledWith("C-42");
    expect(screen.getByText(/Arrangement-afstemming \(advies\)/)).toBeInTheDocument();
    expect(screen.getByText("Aangevraagde zorg")).toBeInTheDocument();
    expect(screen.getByText("Jeugdhulp")).toBeInTheDocument();
    expect(screen.getByText("Utrecht")).toBeInTheDocument();
    expect(screen.getByText("Team Zorg")).toBeInTheDocument();
    expect(screen.getByText("Handmatige beoordeling aanbevolen")).toBeInTheDocument();
    expect(screen.queryByText(/Semantiek:/)).not.toBeInTheDocument();
    expect(screen.getByText("58%")).toBeInTheDocument();
    expect(screen.getByText(/PGB-achtige jeugdondersteuning/)).toBeInTheDocument();
    const validationLink = screen.getByRole("link", { name: /Vraag gemeentelijke validatie aan/i });
    expect(validationLink).toHaveAttribute("href", expect.stringContaining("/care/matching"));
    expect(validationLink).toHaveAttribute("href", expect.stringContaining("openCase=C-42"));
    expect(screen.getByText(/Er is momenteel één automatische referentie/)).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getAllByRole("button", { name: /Bekijk details/i })[0]!);
    expect(screen.getByText("Test rationale voor arrangement-afstemming.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Financiële en technische context/i }));
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

  it("shows two-hint capacity note when exactly two hints are returned", async () => {
    mockFetchCaseArrangementAlignment.mockResolvedValue({
      case_id: "8",
      generated_at: "2026-05-11T10:00:00Z",
      equivalence_hints: [
        {
          source_label: "A",
          target_label: "Eerste doel",
          equivalence_confidence: 0.9,
          rationale: "R1.",
          uncertainty: "low",
        },
        {
          source_label: "B",
          target_label: "Tweede doel",
          equivalence_confidence: 0.7,
          rationale: "R2.",
          uncertainty: "medium",
        },
      ],
      tariff_alignment: null,
      requires_human_confirmation: true,
    });

    render(<ArrangementAlignmentPanel caseId="C-8" />);

    await waitFor(() => {
      expect(screen.getByTestId("arrangement-alignment-panel")).toBeInTheDocument();
    });

    expect(screen.getByText(/Twee referenties in dit advies; geen derde automatische suggestie/)).toBeInTheDocument();
  });

  it("shows truncation note when more than three hints are returned", async () => {
    mockFetchCaseArrangementAlignment.mockResolvedValue({
      case_id: "7",
      generated_at: "2026-05-11T10:00:00Z",
      equivalence_hints: [
        {
          source_label: "S1",
          target_label: "Target één",
          equivalence_confidence: 0.92,
          rationale: "Eerste.",
          uncertainty: "low",
        },
        {
          source_label: "S2",
          target_label: "Target twee",
          equivalence_confidence: 0.82,
          rationale: "Tweede.",
          uncertainty: "low",
        },
        {
          source_label: "S3",
          target_label: "Target drie",
          equivalence_confidence: 0.72,
          rationale: "Derde.",
          uncertainty: "medium",
        },
        {
          source_label: "S4",
          target_label: "Target vier (niet getoond)",
          equivalence_confidence: 0.5,
          rationale: "Vierde.",
          uncertainty: "high",
        },
      ],
      tariff_alignment: null,
      requires_human_confirmation: true,
    });

    render(<ArrangementAlignmentPanel caseId="C-7" />);

    await waitFor(() => {
      expect(screen.getByTestId("arrangement-alignment-panel")).toBeInTheDocument();
    });

    expect(screen.getByText(/Toont de eerste drie suggesties uit dit advies/)).toBeInTheDocument();
    expect(screen.getByText("Target één")).toBeInTheDocument();
    expect(screen.queryByText("Target vier (niet getoond)")).not.toBeInTheDocument();
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
