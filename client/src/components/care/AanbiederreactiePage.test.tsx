import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderEvaluation } from "../../hooks/useProviderEvaluations";
import type { SpaCase } from "../../hooks/useCases";
import { AanbiederreactiePage } from "./AanbiederreactiePage";

const mockUseCases = vi.fn();
const mockUseProviderEvaluations = vi.fn();

vi.mock("../../hooks/useCases", () => ({
  useCases: (...args: unknown[]) => mockUseCases(...args),
}));

vi.mock("../../hooks/useProviderEvaluations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../hooks/useProviderEvaluations")>();
  return {
    ...actual,
    useProviderEvaluations: () => mockUseProviderEvaluations(),
  };
});

function makeCase(overrides: Partial<SpaCase>): SpaCase {
  return {
    id: "CO-2026-C533C8",
    title: "Aanvraag 41",
    owner: "Gemeente",
    regio: "Rotterdam Rijnmond",
    zorgtype: "Gedrag & ontwikkeling",
    wachttijd: 1,
    status: "provider_beoordeling",
    urgency: "critical",
    problems: [],
    systemInsight: "",
    recommendedAction: "",
    urgencyValidated: true,
    urgencyDocumentPresent: true,
    urgencyGrantedDate: null,
    waitlistBucket: 1,
    intakeStartDate: null,
    arrangementTypeCode: "",
    arrangementProvider: "Levvel Jeugd & Opvoedhulp",
    arrangementEndDate: null,
    ...overrides,
  };
}

function makeEvaluation(overrides: Partial<ProviderEvaluation>): ProviderEvaluation {
  return {
    id: "pl-1",
    caseId: "CO-2026-C533C8",
    caseTitle: "Aanvraag 41",
    clientLabel: "CLI-00001",
    region: "Rotterdam Rijnmond",
    urgency: "Spoed",
    complexity: "Hoog",
    careType: "Gedrag & ontwikkeling",
    providerId: "p1",
    providerName: "Levvel Jeugd & Opvoedhulp",
    municipalityId: "m1",
    selectedMatchId: null,
    status: "PENDING",
    rejectionReasonCode: null,
    providerComment: null,
    informationRequestType: null,
    informationRequestComment: null,
    requestedAt: "2026-06-09T09:42:00.000Z",
    respondedAt: null,
    decidedAt: null,
    createdAt: "2026-06-09T09:42:00.000Z",
    updatedAt: "2026-06-09T09:42:00.000Z",
    daysPending: 1,
    slaDeadlineAt: null,
    matchScore: null,
    ...overrides,
  };
}

beforeEach(() => {
  mockUseCases.mockReset();
  mockUseProviderEvaluations.mockReset();
});

describe("AanbiederreactiePage", () => {
  it("renders the operational follow-up state with count-consistent filters and worklist", () => {
    mockUseCases.mockReturnValue({
      cases: [makeCase({})],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseProviderEvaluations.mockReturnValue({
      evaluations: [makeEvaluation({})],
      totalCount: 1,
      loading: false,
      error: null,
      refetch: vi.fn(),
      submitDecision: vi.fn(),
      submitting: false,
      submitError: null,
      clearSubmitError: vi.fn(),
    });

    render(
      <AanbiederreactiePage
        role="gemeente"
        onCaseClick={vi.fn()}
        onNavigateToMatching={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Aanbiederreactie" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bekijk matching" })).toBeInTheDocument();
    expect(screen.getByText("1 casus wacht op aanbiederreactie")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Alle reacties (1)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Wacht op aanbiederreactie (1)" })).toBeInTheDocument();
    expect(screen.getByTestId("aanbiederreactie-worklist")).toBeInTheDocument();
    expect(screen.getByText("CO-2026-C533C8")).toBeInTheDocument();
    expect(screen.getAllByText("Levvel Jeugd & Opvoedhulp").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Wacht op aanbiederreactie").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Volg aanbiederreactie op" }).length).toBeGreaterThan(0);
  });

  it("shows the compact empty state when no provider responses are visible", () => {
    mockUseCases.mockReturnValue({
      cases: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseProviderEvaluations.mockReturnValue({
      evaluations: [],
      totalCount: 0,
      loading: false,
      error: null,
      refetch: vi.fn(),
      submitDecision: vi.fn(),
      submitting: false,
      submitError: null,
      clearSubmitError: vi.fn(),
    });

    render(
      <AanbiederreactiePage
        role="gemeente"
        onCaseClick={vi.fn()}
        onNavigateToMatching={vi.fn()}
      />,
    );

    expect(screen.getByText("Geen openstaande aanbiederreacties")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bekijk matching" })).toBeInTheDocument();
    expect(screen.queryByTestId("aanbiederreactie-worklist")).not.toBeInTheDocument();
  });

  it("maps information requests to the expected follow-up action", () => {
    mockUseCases.mockReturnValue({
      cases: [makeCase({})],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseProviderEvaluations.mockReturnValue({
      evaluations: [makeEvaluation({ status: "INFO_REQUESTED", informationRequestComment: "Graag aanvullende diagnostiek." })],
      totalCount: 1,
      loading: false,
      error: null,
      refetch: vi.fn(),
      submitDecision: vi.fn(),
      submitting: false,
      submitError: null,
      clearSubmitError: vi.fn(),
    });

    render(
      <AanbiederreactiePage
        role="gemeente"
        onCaseClick={vi.fn()}
      />,
    );

    expect(screen.getByText("Aanvullende informatie gevraagd")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Vraag gegevens op" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Graag aanvullende diagnostiek\./).length).toBeGreaterThan(0);
  });
});
