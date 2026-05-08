import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SpaCase } from "../../hooks/useCases";
import { AanbiederBeoordelingPage } from "./AanbiederBeoordelingPage";

const mockUseCases = vi.fn();
const mockSubmit = vi.fn();

vi.mock("../../hooks/useCases", () => ({
  useCases: (...args: unknown[]) => mockUseCases(...args),
}));

vi.mock("../../hooks/useProviderEvaluations", () => ({
  useProviderEvaluations: () => ({
    submitDecision: mockSubmit,
    submitting: false,
    submitError: null,
    clearSubmitError: vi.fn(),
  }),
  REJECTION_REASON_LABELS: {},
  INFO_REQUEST_TYPE_LABELS: {},
}));

function makeCase(overrides: Partial<SpaCase>): SpaCase {
  return {
    id: "C-1",
    title: "Casus",
    regio: "Utrecht",
    zorgtype: "Ambulante zorg",
    wachttijd: 3,
    status: "provider_beoordeling",
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
    arrangementProvider: "Aanbieder Z",
    arrangementEndDate: null,
    ...overrides,
  };
}

describe("AanbiederBeoordelingPage (gemeente)", () => {
  it("shows case-detail monitoring layout with provider rows and primary CTAs", () => {
    mockUseCases.mockReturnValue({
      cases: [makeCase({ id: "C-G1", title: "Monitor casus" })],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<AanbiederBeoordelingPage role="gemeente" onCaseClick={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Aanbieder beoordeling" })).toBeInTheDocument();
    expect(screen.getByTestId("aanbieder-beoordeling-gemeente-root")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terug naar casus" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Herinner aanbieders" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bekijk profiel" })).toBeInTheDocument();
    expect(screen.getByText(/Levvel Jeugd & Opvoedhulp/)).toBeInTheDocument();
    expect(screen.getByText(/De beoordelingsperiode duurt maximaal 72 uur/)).toBeInTheDocument();
  });

  it("shows a phase-gate empty state when no casus has reached provider review yet", () => {
    mockUseCases.mockReturnValue({
      cases: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    const onMatching = vi.fn();
    const onCasussen = vi.fn();

    render(
      <AanbiederBeoordelingPage
        role="gemeente"
        onCaseClick={vi.fn()}
        onNavigateToMatching={onMatching}
        onNavigateToCasussen={onCasussen}
      />,
    );

    expect(screen.getByText("Geen casussen in deze fase")).toBeInTheDocument();
    expect(
      screen.getByText(/matching heeft gevalideerd en de casus heeft verzonden/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Naar matching" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terug naar werkvoorraad" })).toBeInTheDocument();
  });
});

describe("AanbiederBeoordelingPage (zorgaanbieder)", () => {
  it("renders scaffold header, search, and active review when a case is pending", () => {
    mockUseCases.mockReturnValue({
      cases: [makeCase({ id: "C-Z1", title: "Te beoordelen" })],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<AanbiederBeoordelingPage role="zorgaanbieder" onCaseClick={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Aanbieder beoordeling" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Zoek op casus-ID, regio/i)).toBeInTheDocument();
    expect(screen.getByText("Actieve beoordeling")).toBeInTheDocument();
    expect(screen.getByTestId("provider-review-idle-hint")).toBeInTheDocument();
  });
});
