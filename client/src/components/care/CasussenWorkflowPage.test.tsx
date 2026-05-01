import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SpaCase } from "../../hooks/useCases";
import type { SpaProvider } from "../../hooks/useProviders";
import { expectCasussenMode } from "../../test/utils/modeGuards";
import { WorkloadPage } from "./WorkloadPage";

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

describe("WorkloadPage", () => {
  it("renders workboard header and priority sections", () => {
    mockData([
      makeCase({ id: "C-101", title: "Casus Utrecht" }),
      makeCase({ id: "C-102", title: "Casus Matching", status: "matching", urgency: "warning" }),
    ]);

    const { container } = render(<WorkloadPage onCaseClick={vi.fn()} role="gemeente" canCreateCase />);

    expect(screen.getByRole("heading", { name: "Werkvoorraad" })).toBeInTheDocument();
    expect(screen.getByText("Beheer en stuur casussen")).toBeInTheDocument();
    expect(screen.getByText(/casussen — .* vragen aandacht/i)).toBeInTheDocument();
    expect(screen.getByText(/⚠ Vraagt aandacht/)).toBeInTheDocument();
    expect(screen.getByText(/⏳ Wacht op aanbieder/)).toBeInTheDocument();
    expect(screen.getByText(/✓ Stabiel/)).toBeInTheDocument();
    expect(container.innerHTML).not.toContain("#0F172A");
    expect(container.innerHTML).not.toContain("#111c31");
    expect(container.innerHTML).not.toContain("#E5E7EB");
  });

  it("enforces casussen screen responsibility boundaries", () => {
    mockData([
      makeCase({ id: "C-901", title: "Casus triage", status: "provider_beoordeling", wachttijd: 4, urgency: "warning" }),
      makeCase({ id: "C-902", title: "Casus stabiel", status: "matching", urgency: "normal" }),
    ]);

    const { container } = render(<WorkloadPage onCaseClick={vi.fn()} role="gemeente" />);

    expectCasussenMode();
    expect(screen.getByRole("heading", { name: "Werkvoorraad" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Zoek op client, casus, regio of zorgvraag")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Alles" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Mijn acties" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Wacht op aanbieder" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Geblokkeerd" })).toBeInTheDocument();
    expect(screen.getByText("Casus triage")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-care-work-row-cta]").length).toBeGreaterThan(0);

    expect(screen.queryByText(/^SLA$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Alerts$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Afwijzingen$/)).not.toBeInTheDocument();
    expect(screen.queryByText("Volgende stap")).not.toBeInTheDocument();
    expect(screen.queryByText(/Processtatus|Process status/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Genereer samenvatting" })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Context$/)).not.toBeInTheDocument();
  });

  it("shows primary tabs and keeps advanced filters collapsed by default", () => {
    mockData([
      makeCase({ id: "C-201", title: "Casus filter test", status: "provider_beoordeling", wachttijd: 5 }),
    ]);

    render(<WorkloadPage onCaseClick={vi.fn()} role="gemeente" />);

    expect(screen.getByRole("tab", { name: "Alles" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Mijn acties" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Wacht op aanbieder" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Geblokkeerd" })).toBeInTheDocument();
    expect(screen.queryByText("Verantwoordelijke")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Meer filters/i }));
    expect(screen.getByText("Verantwoordelijke")).toBeInTheDocument();
  });

  it("opens casus detail when card is clicked", () => {
    const onCaseClick = vi.fn();
    mockData([
      makeCase({ id: "C-301", title: "Provider review", status: "provider_beoordeling", wachttijd: 4, urgency: "warning" }),
    ]);

    render(<WorkloadPage onCaseClick={onCaseClick} role="zorgaanbieder" />);

    fireEvent.click(screen.getByText("Provider review"));
    expect(onCaseClick).toHaveBeenCalledWith("C-301");
  });

  it("filters list when waiting tab is selected", () => {
    mockData([
      makeCase({ id: "C-401", title: "Lang wachtend", status: "provider_beoordeling", wachttijd: 5 }),
      makeCase({ id: "C-402", title: "Geblokkeerde intake", status: "intake", urgencyValidated: false, urgencyDocumentPresent: false }),
      makeCase({ id: "C-403", title: "Stabiele casus", status: "intake", wachttijd: 1 }),
    ]);

    render(<WorkloadPage onCaseClick={vi.fn()} role="gemeente" />);

    fireEvent.click(screen.getByRole("tab", { name: "Wacht op aanbieder" }));

    expect(screen.getByText("Lang wachtend")).toBeInTheDocument();
    expect(screen.queryByText("Geblokkeerde intake")).not.toBeInTheDocument();
  });

  it("keeps summary count aligned with filtered visible results", () => {
    mockData([
      makeCase({ id: "C-501", title: "Wacht op provider", status: "provider_beoordeling", wachttijd: 5 }),
      makeCase({ id: "C-502", title: "Stabiel", status: "matching", wachttijd: 1 }),
    ]);

    render(<WorkloadPage onCaseClick={vi.fn()} role="gemeente" />);

    fireEvent.click(screen.getByRole("tab", { name: "Wacht op aanbieder" }));

    expect(screen.getByText("1 casussen — 0 vragen aandacht")).toBeInTheDocument();
  });

  it("keeps CTA navigation aligned with classified waiting-provider state", () => {
    const onNavigateToWorkflow = vi.fn();
    const onCaseClick = vi.fn();
    mockData([
      makeCase({ id: "C-601", title: "Wacht op beoordeling", status: "provider_beoordeling", wachttijd: 6 }),
    ]);

    render(<WorkloadPage onCaseClick={onCaseClick} role="gemeente" onNavigateToWorkflow={onNavigateToWorkflow} />);
    fireEvent.click(screen.getByRole("tab", { name: "Wacht op aanbieder" }));
    fireEvent.click(screen.getByRole("button", { name: "Bekijk status" }));

    expect(onNavigateToWorkflow).toHaveBeenCalledWith("beoordelingen");
    expect(onCaseClick).not.toHaveBeenCalled();
  });

  it("renders minimal card structure and compact copy", () => {
    mockData([
      makeCase({ id: "C-701", title: "test", status: "intake", urgencyValidated: false }),
    ]);

    render(<WorkloadPage onCaseClick={vi.fn()} role="gemeente" />);

    expect(screen.getByText("test")).toBeInTheDocument();
    expect(screen.getByText(/\d+ jaar/)).toBeInTheDocument();
    expect(screen.getByText("Utrecht")).toBeInTheDocument();
    expect(screen.getByText("Ambulante zorg")).toBeInTheDocument();
    expect(screen.getAllByText("Blokkade").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Vul urgentie aan" })).toBeInTheDocument();
    expect(screen.getByText("1d")).toBeInTheDocument();
    expect(screen.queryByText(/^Blokkade:/)).not.toBeInTheDocument();
  });

  it("shows debug block only when running in dev mode", () => {
    mockData([
      makeCase({ id: "C-801", title: "debug test", status: "matching" }),
    ]);

    render(<WorkloadPage onCaseClick={vi.fn()} role="gemeente" />);

    if (import.meta.env.DEV) {
      expect(screen.getByLabelText("Open debug classificatie")).toBeInTheDocument();
    } else {
      expect(screen.queryByLabelText("Open debug classificatie")).not.toBeInTheDocument();
    }
  });
});
