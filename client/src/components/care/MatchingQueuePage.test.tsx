import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SpaCase } from "../../hooks/useCases";
import type { SpaProvider } from "../../hooks/useProviders";
import { MatchingQueuePage } from "./MatchingQueuePage";

const mockUseCases = vi.fn();
const mockUseProviders = vi.fn();

vi.mock("../../hooks/useCases", () => ({
  useCases: (...args: unknown[]) => mockUseCases(...args),
}));

vi.mock("../../hooks/useProviders", () => ({
  useProviders: (...args: unknown[]) => mockUseProviders(...args),
}));

function makeCase(overrides: Partial<SpaCase>): SpaCase {
  return {
    id: "C-1",
    title: "Casus",
    regio: "Utrecht",
    zorgtype: "Ambulante zorg",
    wachttijd: 1,
    status: "matching",
    urgency: "normal",
    problems: [],
    systemInsight: "Casusoverzicht gereed",
    recommendedAction: "",
    urgencyValidated: true,
    urgencyDocumentPresent: true,
    urgencyGrantedDate: null,
    waitlistBucket: 1,
    intakeStartDate: null,
    arrangementTypeCode: "",
    arrangementProvider: "",
    arrangementEndDate: null,
    ...overrides,
  };
}

function makeProvider(): SpaProvider {
  return {
    id: "P-1",
    name: "Zorgaanbieder A",
    city: "Utrecht",
    status: "active",
    currentCapacity: 3,
    maxCapacity: 12,
    waitingListLength: 1,
    averageWaitDays: 5,
    offersOutpatient: true,
    offersDayTreatment: false,
    offersResidential: false,
    offersCrisis: false,
    serviceArea: "Utrecht",
    specialFacilities: "",
    availableSpots: 3,
    region: "Utrecht",
    type: "ambulant",
    specializations: ["Jeugd"],
    latitude: null,
    longitude: null,
    hasCoordinates: false,
    locationLabel: "Utrecht",
    regionLabel: "Utrecht",
    municipalityLabel: "Utrecht",
    secondaryRegionLabels: [],
    allRegionLabels: ["Utrecht"],
  };
}

describe("MatchingQueuePage", () => {
  it("shows the operational empty state when no matchable cases exist", () => {
    mockUseCases.mockReturnValue({
      cases: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseProviders.mockReturnValue({ providers: [] });

    const onNavigate = vi.fn();
    render(<MatchingQueuePage onCaseClick={vi.fn()} onNavigateToCasussen={onNavigate} />);

    expect(screen.getByRole("heading", { name: "Matching" })).toBeInTheDocument();
    expect(screen.getByText("Geen casussen klaar voor matching")).toBeInTheDocument();
    expect(screen.getByText("Er zijn op dit moment geen complete aanmeldingen die naar matching kunnen.")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Bekijk aanmeldingen" })[1]);
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("renders the canonical workflow strip and matchable worklist", () => {
    mockUseCases.mockReturnValue({
      cases: [
        makeCase({
          id: "C-M1",
          title: "Cliënt A",
          status: "matching",
          urgency: "critical",
        }),
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseProviders.mockReturnValue({ providers: [makeProvider()] });

    const onCaseClick = vi.fn();
    render(<MatchingQueuePage onCaseClick={onCaseClick} onNavigateToCasussen={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Matching" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Aanmelding (0)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Matching (1)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Aanbiederreactie (0)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Plaatsing (0)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Intake (0)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start matching" })).toBeInTheDocument();

    const row = screen.getByText("C-M1").closest("article");
    expect(row).not.toBeNull();
    const rowEl = row as HTMLElement;
    expect(within(rowEl).getByText("C-M1")).toBeInTheDocument();
    expect(within(rowEl).getByText("Utrecht")).toBeInTheDocument();
    expect(within(rowEl).getByText("Onderbouwing")).toBeInTheDocument();
    expect(within(rowEl).getByTitle("Onderbouwing nodig")).toBeInTheDocument();
    expect(within(rowEl).getByRole("button", { name: "Bekijk onderbouwing" })).toBeInTheDocument();

    fireEvent.click(within(rowEl).getByRole("button", { name: "Bekijk onderbouwing" }));
    expect(onCaseClick).toHaveBeenCalledWith("C-M1");
  });

  it("keeps the worklist visible when filters are cleared", () => {
    mockUseCases.mockReturnValue({
      cases: [
        makeCase({
          id: "C-M2",
          title: "Cliënt B",
          status: "matching",
          urgency: "warning",
        }),
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseProviders.mockReturnValue({ providers: [makeProvider()] });

    render(<MatchingQueuePage onCaseClick={vi.fn()} onNavigateToCasussen={vi.fn()} />);

    expect(screen.getByText("Werkvoorraad")).toBeInTheDocument();
    expect(screen.getByText("C-M2")).toBeInTheDocument();
  });
});
