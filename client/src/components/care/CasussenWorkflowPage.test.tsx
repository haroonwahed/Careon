import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  it("renders Casussen shell: ketenstrip, tabel en samenvatting", () => {
    mockData([
      makeCase({ id: "C-101", title: "Casus Utrecht" }),
      makeCase({ id: "C-102", title: "Casus Matching", status: "matching", urgency: "warning" }),
    ]);

    const { container } = render(<WorkloadPage onCaseClick={vi.fn()} role="gemeente" canCreateCase onCreateCase={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Casussen" })).toBeInTheDocument();
    expect(screen.getByText(/2 casussen ·/)).toBeInTheDocument();
    expect(screen.getByTestId("casussen-workflow-strip")).toBeInTheDocument();
    const columnHeaders = screen.getByTestId("casussen-werkvoorraad-column-headers");
    expect(within(columnHeaders).getByText("Prioriteit")).toBeInTheDocument();
    expect(within(columnHeaders).getByText("Casus")).toBeInTheDocument();
    expect(within(columnHeaders).getByText(/Blokkade/)).toBeInTheDocument();
    expect(within(columnHeaders).getByText("Volgende actie")).toBeInTheDocument();
    expect(container.innerHTML).not.toContain(`#${"0F172A"}`);
    expect(container.innerHTML).not.toContain(`#${"111c31"}`);
    expect(container.innerHTML).not.toContain(`#${"E5E7EB"}`);
  });

  it("surfaces Casussen as a municipal worklist with an explicit top attention bar", () => {
    mockData([
      makeCase({ id: "C-103", title: "Casus blokkade", status: "intake", urgencyValidated: false, urgencyDocumentPresent: false }),
    ]);

    render(<WorkloadPage onCaseClick={vi.fn()} role="gemeente" canCreateCase onCreateCase={vi.fn()} />);

    expect(screen.getByText(/vragen gemeentelijke actie/i)).toBeInTheDocument();
    expect(screen.getByText(/blokkades en wachttijd bepalen de volgende eigenaar/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bekijk kritieke casussen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nieuwe casus" })).toBeInTheDocument();
  });

  it("enforces casussen screen responsibility boundaries", () => {
    mockData([
      makeCase({ id: "C-901", title: "Casus triage", status: "provider_beoordeling", wachttijd: 4, urgency: "warning" }),
      makeCase({ id: "C-902", title: "Casus stabiel", status: "matching", urgency: "normal" }),
    ]);

    const { container } = render(<WorkloadPage onCaseClick={vi.fn()} role="gemeente" />);

    expectCasussenMode();
    expect(screen.getByRole("heading", { name: "Casussen" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Zoek casussen, cliënten, aanbieders…")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Alle casussen/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Mijn werkvoorraad/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Wacht op actie/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^Kritiek/i })).toBeInTheDocument();
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

    expect(screen.getByRole("tab", { name: /Alle casussen/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Mijn werkvoorraad/i })).toBeInTheDocument();
    expect(screen.queryByText("Verantwoordelijke")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Filters$/i }));
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

    fireEvent.click(screen.getByRole("tab", { name: /Wacht op actie/i }));

    expect(screen.getByText("Lang wachtend")).toBeInTheDocument();
    expect(screen.getByText("Geblokkeerde intake")).toBeInTheDocument();
  });

  it("keeps summary count aligned with filtered visible results", () => {
    mockData([
      makeCase({ id: "C-501", title: "Wacht op provider", status: "provider_beoordeling", wachttijd: 5 }),
      makeCase({ id: "C-502", title: "Stabiel", status: "matching", wachttijd: 1 }),
    ]);

    render(<WorkloadPage onCaseClick={vi.fn()} role="gemeente" />);

    fireEvent.click(screen.getByRole("tab", { name: /Wacht op actie/i }));

    expect(screen.getByText(/\d+ casussen ·/)).toBeInTheDocument();
  });

  it("keeps CTA navigation aligned with classified waiting-provider state", () => {
    const onNavigateToWorkflow = vi.fn();
    const onCaseClick = vi.fn();
    mockData([
      makeCase({ id: "C-601", title: "Wacht op beoordeling", status: "provider_beoordeling", wachttijd: 6 }),
    ]);

    render(<WorkloadPage onCaseClick={onCaseClick} role="gemeente" onNavigateToWorkflow={onNavigateToWorkflow} />);
    fireEvent.click(screen.getByRole("tab", { name: /Wacht op actie/i }));
    fireEvent.click(screen.getByRole("button", { name: "Bekijk status" }));

    expect(onNavigateToWorkflow).toHaveBeenCalledWith("beoordelingen");
    expect(onCaseClick).not.toHaveBeenCalled();
  });

  it("renders werkvoorraad grid row with compact blokkade copy (Regiekamer-pariteit)", () => {
    mockData([
      makeCase({ id: "C-701", title: "test", status: "intake", urgencyValidated: false }),
    ]);

    render(<WorkloadPage onCaseClick={vi.fn()} role="gemeente" />);

    const worklist = screen.getByTestId("worklist");
    expect(worklist).toBeInTheDocument();
    expect(screen.getByText("test")).toBeInTheDocument();
    expect(within(worklist).getByText(/— Blokkade$/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vul casus aan" })).toBeInTheDocument();
    expect(within(worklist).getByText(/dag geleden|Vandaag/)).toBeInTheDocument();
    expect(screen.queryByText(/^Blokkade:/)).not.toBeInTheDocument();
  });

  it("after Bekijk geblokkeerde casussen shows context hint and Toon alle casussen (button does not vanish)", () => {
    mockData([
      makeCase({
        id: "C-901",
        title: "Onvolledig",
        status: "intake",
        urgencyValidated: false,
        urgencyDocumentPresent: false,
      }),
    ]);
    render(<WorkloadPage onCaseClick={vi.fn()} role="gemeente" />);

    fireEvent.click(screen.getByRole("button", { name: "Bekijk kritieke casussen" }));

    expect(screen.getByTestId("worklist-blocked-filter-hint")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("worklist-blocked-filter-hint"));
    expect(screen.getByText(/Weergave: kritiek \/ geblokkeerd/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toon alle casussen" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Toon alle casussen" }));

    expect(screen.queryByTestId("worklist-blocked-filter-hint")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bekijk kritieke casussen" })).toBeInTheDocument();
  });

  it("omits worklist tab shortcut when there are no dossiers but keeps Nieuwe casus when allowed", () => {
    mockData([]);
    render(<WorkloadPage onCaseClick={vi.fn()} role="gemeente" canCreateCase onCreateCase={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Bekijk mijn werkvoorraad" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bekijk kritieke casussen" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nieuwe casus" })).toBeInTheDocument();
  });

  it("shows debug block only when running in dev mode", async () => {
    mockData([
      makeCase({ id: "C-801", title: "debug test", status: "matching" }),
    ]);

    const user = userEvent.setup();
    render(<WorkloadPage onCaseClick={vi.fn()} role="gemeente" />);

    await user.click(screen.getByRole("button", { name: /Weergave/i }));
    await user.click(await screen.findByRole("menuitem", { name: /Kaarten/i }));

    if (import.meta.env.DEV) {
      expect(screen.getByLabelText("Open debug classificatie")).toBeInTheDocument();
    } else {
      expect(screen.queryByLabelText("Open debug classificatie")).not.toBeInTheDocument();
    }
  });
});
