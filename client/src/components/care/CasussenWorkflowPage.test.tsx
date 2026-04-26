import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SpaCase } from "../../hooks/useCases";
import type { SpaProvider } from "../../hooks/useProviders";
import { CasussenWorkflowPage } from "./CasussenWorkflowPage";

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
    status: "intake",
    urgency: "normal",
    problems: [],
    systemInsight: "",
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
    specializations: [],
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

function mockData(cases: SpaCase[]) {
  mockUseCases.mockReturnValue({
    cases,
    loading: false,
    error: null,
    refetch: vi.fn(),
  });

  mockUseProviders.mockReturnValue({
    providers: [makeProvider()],
  });
}

describe("CasussenWorkflowPage", () => {
  it("renders list view default and hides top workflow step bar", () => {
    mockData([
      makeCase({ id: "C-101", title: "Casus Utrecht" }),
      makeCase({ id: "C-102", title: "Casus Matching", status: "matching", urgency: "warning" }),
    ]);

    render(<CasussenWorkflowPage onCaseClick={vi.fn()} role="gemeente" canCreateCase />);

    expect(screen.getByRole("heading", { name: "Casussen" })).toBeInTheDocument();
    expect(screen.queryByText("Casus → Samenvatting → Matching → Aanbieder Beoordeling → Plaatsing → Intake")).not.toBeInTheDocument();
    expect(screen.getAllByText("Waarom hier").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Volgende stap").length).toBeGreaterThan(0);
  });

  it("does not show provider accept/reject actions for gemeente", () => {
    mockData([
      makeCase({ id: "C-201", title: "Wacht op beoordeling", status: "provider_beoordeling", wachttijd: 5 }),
    ]);

    render(<CasussenWorkflowPage onCaseClick={vi.fn()} role="gemeente" />);

    expect(screen.queryByText("Accepteren")).not.toBeInTheDocument();
    expect(screen.queryByText("Afwijzen")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bekijk aanbiederreactie" })).toBeInTheDocument();
  });

  it("shows provider review actions for zorgaanbieder", () => {
    mockData([
      makeCase({ id: "C-301", title: "Provider review", status: "provider_beoordeling", wachttijd: 4 }),
    ]);

    render(<CasussenWorkflowPage onCaseClick={vi.fn()} role="zorgaanbieder" />);

    expect(screen.getByRole("button", { name: "Beoordeling uitvoeren" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accepteren" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Afwijzen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Meer informatie vragen" })).toBeInTheDocument();
  });

  it("filters list when attention item is clicked", () => {
    mockData([
      makeCase({ id: "C-401", title: "Lang wachtend", status: "provider_beoordeling", wachttijd: 5 }),
      makeCase({ id: "C-402", title: "Kort wachtend", status: "provider_beoordeling", wachttijd: 1 }),
      makeCase({ id: "C-403", title: "Niet in beoordeling", status: "matching", wachttijd: 7 }),
    ]);

    render(<CasussenWorkflowPage onCaseClick={vi.fn()} role="gemeente" />);

    fireEvent.click(screen.getByText("1 casussen wachten langer dan 3 dagen op beoordeling door aanbieder"));

    expect(screen.getByText("Lang wachtend")).toBeInTheDocument();
    expect(screen.queryByText("Kort wachtend")).not.toBeInTheDocument();
  });
});
