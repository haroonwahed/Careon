import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderEvaluation } from "../../hooks/useProviderEvaluations";
import type { SpaCase } from "../../hooks/useCases";
import { AanbiederBeoordelingPage } from "./AanbiederBeoordelingPage";

const mockUseCases = vi.fn();
const mockApiGet = vi.fn();

const hoisted = vi.hoisted(() => {
  const submitDecision = vi.fn();
  const evaluations: ProviderEvaluation[] = [];
  return {
    submitDecision,
    evaluations,
    reset() {
      evaluations.length = 0;
      submitDecision.mockReset();
    },
    hookReturn() {
      return {
        evaluations: [...evaluations],
        totalCount: evaluations.length,
        loading: false,
        error: null,
        refetch: vi.fn(),
        submitDecision,
        submitting: false,
        submitError: null,
        clearSubmitError: vi.fn(),
      };
    },
  };
});

vi.mock("../../hooks/useCases", () => ({
  useCases: (...args: unknown[]) => mockUseCases(...args),
}));

vi.mock("../../hooks/useProviderEvaluations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../hooks/useProviderEvaluations")>();
  return {
    ...actual,
    useProviderEvaluations: () => hoisted.hookReturn(),
  };
});

vi.mock("../../lib/apiClient", () => ({
  apiClient: {
    get: (...args: unknown[]) => mockApiGet(...args),
  },
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

function makeEvaluation(overrides: Partial<ProviderEvaluation>): ProviderEvaluation {
  return {
    id: "pl-1",
    caseId: "C-G3",
    caseTitle: "Monitor casus",
    clientLabel: "CLI-00001",
    region: "Utrecht",
    urgency: "Normaal",
    complexity: "Laag",
    careType: "Ambulant",
    providerId: "p1",
    providerName: "Levvel Jeugd & Opvoedhulp",
    municipalityId: "",
    selectedMatchId: null,
    status: "REJECTED",
    rejectionReasonCode: "geen_capaciteit",
    providerComment: "Korte toelichting voor audit.",
    informationRequestType: null,
    informationRequestComment: null,
    requestedAt: null,
    respondedAt: "2026-05-01T12:00:00.000Z",
    decidedAt: "2026-05-01T12:00:00.000Z",
    createdAt: "2026-05-01T10:00:00.000Z",
    updatedAt: "2026-05-01T12:00:00.000Z",
    daysPending: 1,
    slaDeadlineAt: null,
    matchScore: null,
    ...overrides,
  };
}

beforeEach(() => {
  hoisted.reset();
  mockApiGet.mockReset();
});

describe("AanbiederBeoordelingPage (gemeente)", () => {
  it("shows case-detail monitoring layout with provider rows and primary CTAs", () => {
    mockApiGet.mockResolvedValue({ caseId: "C-G1", placement: {} });
    mockUseCases.mockReturnValue({
      cases: [makeCase({ id: "C-G1", title: "Monitor casus" })],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<AanbiederBeoordelingPage role="gemeente" onCaseClick={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Reacties" })).toBeInTheDocument();
    expect(screen.getByTestId("aanbieder-beoordeling-gemeente-root")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terug naar casus" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Herinner aanbieders" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bekijk profiel" })).toBeInTheDocument();
    expect(screen.getByText(/Levvel Jeugd & Opvoedhulp/)).toBeInTheDocument();
    expect(screen.getByText(/De beoordelingsperiode duurt maximaal 72 uur/)).toBeInTheDocument();
  });

  it("shows structured placement evidence when placement-detail has a recorded response", async () => {
    mockApiGet.mockResolvedValue({
      caseId: "C-G2",
      placement: {
        id: "99",
        status: "IN_REVIEW",
        providerResponseStatus: "REJECTED",
        providerResponseReasonCode: "CAPACITY",
        decisionNotes: "Korte toelichting voor audit.",
        proposedProviderId: "1",
        selectedProviderId: "1",
        careForm: "OUTPATIENT",
      },
    });
    mockUseCases.mockReturnValue({
      cases: [makeCase({ id: "C-G2", title: "Met reactie" })],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<AanbiederBeoordelingPage role="gemeente" onCaseClick={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("aanbieder-gemeente-placement-evidence")).toBeInTheDocument();
    });
    expect(screen.getByText(/Redencode: CAPACITY/)).toBeInTheDocument();
  });

  it("shows contract redencode in provider row when evaluation API carries a structured rejection", () => {
    mockApiGet.mockResolvedValue({ caseId: "C-G3", placement: {} });
    hoisted.evaluations.push(makeEvaluation({ caseId: "C-G3", providerComment: null }));
    mockUseCases.mockReturnValue({
      cases: [makeCase({ id: "C-G3", title: "Met API-reactie" })],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<AanbiederBeoordelingPage role="gemeente" onCaseClick={vi.fn()} />);

    expect(screen.getByText(/redencode: geen_capaciteit/)).toBeInTheDocument();
    expect(screen.getByText(/Geen capaciteit \(redencode: geen_capaciteit\)/)).toBeInTheDocument();
  });

  it("includes gemeente name in provider monitoring row tags when evaluation has municipalityName", () => {
    mockApiGet.mockResolvedValue({ caseId: "C-G6", placement: {} });
    hoisted.evaluations.push(
      makeEvaluation({
        caseId: "C-G6",
        status: "PENDING",
        rejectionReasonCode: null,
        providerComment: null,
        municipalityName: "Utrecht (test)",
      }),
    );
    mockUseCases.mockReturnValue({
      cases: [makeCase({ id: "C-G6", title: "Met gemeente-tag" })],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<AanbiederBeoordelingPage role="gemeente" onCaseClick={vi.fn()} />);

    expect(screen.getByText(/Utrecht \(test\)/)).toBeInTheDocument();
  });

  it("shows structured info-request placement evidence when provider asked for more information", async () => {
    mockApiGet.mockResolvedValue({
      caseId: "C-G4",
      placement: {
        id: "101",
        status: "IN_REVIEW",
        providerResponseStatus: "NEEDS_INFO",
        providerResponseReasonCode: "NONE",
        decisionNotes: "",
        providerResponseNotes: "[INFO_TYPE:diagnostiek]\nGraag laatste neuropsychologisch rapport.",
        proposedProviderId: "1",
        selectedProviderId: "1",
        careForm: "OUTPATIENT",
      },
    });
    mockUseCases.mockReturnValue({
      cases: [makeCase({ id: "C-G4", title: "Infoverzoek" })],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<AanbiederBeoordelingPage role="gemeente" onCaseClick={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("aanbieder-gemeente-placement-evidence")).toBeInTheDocument();
    });
    expect(screen.getByText(/Aanbieder vraagt aanvullende informatie/)).toBeInTheDocument();
    expect(screen.getByText(/type: Diagnostiek/)).toBeInTheDocument();
    expect(screen.getByText(/neuropsychologisch rapport/)).toBeInTheDocument();
  });

  it("shows structured info-request row for gemeente when evaluation status is INFO_REQUESTED", () => {
    mockApiGet.mockResolvedValue({ caseId: "C-G5", placement: {} });
    hoisted.evaluations.push(
      makeEvaluation({
        caseId: "C-G5",
        status: "INFO_REQUESTED",
        rejectionReasonCode: null,
        providerComment: null,
        informationRequestType: "diagnostiek",
        informationRequestComment: "Graag BSN-gemaskeerd verslag.",
      }),
    );
    mockUseCases.mockReturnValue({
      cases: [makeCase({ id: "C-G5", title: "Info uit API" })],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<AanbiederBeoordelingPage role="gemeente" onCaseClick={vi.fn()} />);

    expect(screen.getByText(/Diagnostiek \(type-code: diagnostiek\)/)).toBeInTheDocument();
    expect(screen.getByText(/Graag BSN-gemaskeerd verslag/)).toBeInTheDocument();
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

    expect(screen.getByText("Geen aanvragen in deze fase")).toBeInTheDocument();
    expect(
      screen.getByText(/nog geen aanvragen naar een aanbieder verzonden/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Naar matching" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terug naar werkvoorraad" })).toBeInTheDocument();
  });
});

describe("AanbiederBeoordelingPage (zorgaanbieder)", () => {
  it("renders scaffold header, search, and active review when a case is pending", () => {
    mockApiGet.mockResolvedValue({ caseId: "C-Z1", placement: {} });
    mockUseCases.mockReturnValue({
      cases: [makeCase({ id: "C-Z1", title: "Te beoordelen" })],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<AanbiederBeoordelingPage role="zorgaanbieder" onCaseClick={vi.fn()} />);

    expect(screen.getByTestId("aanbieder-beoordeling-zorgaanbieder-root")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Reacties" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Zoek op casus-ID, regio/i)).toBeInTheDocument();
    expect(screen.getByText("Actieve reactie")).toBeInTheDocument();
    expect(screen.getByTestId("provider-review-idle-hint")).toBeInTheDocument();
  });

  it("shows read-model handoff line when evaluations API provides intake context", () => {
    mockApiGet.mockResolvedValue({ caseId: "C-Z5", placement: {} });
    hoisted.evaluations.push(
      makeEvaluation({
        caseId: "C-Z5",
        status: "PENDING",
        rejectionReasonCode: null,
        providerComment: null,
        municipalityName: "Utrecht (test)",
        entryRouteLabel: "Wijkteam intake",
        aanmelderActorProfile: "WIJKTEAM",
        aanmelderActorProfileLabel: "Wijkteam (instroom WIJKTEAM)",
      }),
    );
    mockUseCases.mockReturnValue({
      cases: [makeCase({ id: "C-Z5", title: "Handoff casus" })],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<AanbiederBeoordelingPage role="zorgaanbieder" onCaseClick={vi.fn()} />);

    expect(screen.getByTestId("provider-review-why-us-block")).toBeInTheDocument();
    expect(screen.getByText(/Waarom deze aanvraag bij jullie ligt/i)).toBeInTheDocument();
    const ctx = screen.getByTestId("provider-review-handoff-context");
    expect(ctx).toHaveTextContent("Gemeente: Utrecht (test)");
    expect(ctx).toHaveTextContent("Instroom: Wijkteam intake");
    expect(ctx).toHaveTextContent("Aanmeldercontext:");
  });

  it("shows advisory match and arrangement lines when API provides hints", () => {
    mockApiGet.mockResolvedValue({ caseId: "C-Z6", placement: {} });
    hoisted.evaluations.push(
      makeEvaluation({
        caseId: "C-Z6",
        status: "PENDING",
        matchFitSummary: "Sterke fit op regio en specialisatie.",
        matchTradeOffsHint: "Capaciteit beperkt in piekperiode.",
        matchScore: 82,
        arrangementHintLine: "Arrangement (indicatief): PGB",
        arrangementHintDisclaimer:
          "Indicatief arrangement — geen budget- of tarieftoezegging; bevestig financiering in eigen proces.",
      }),
    );
    mockUseCases.mockReturnValue({
      cases: [makeCase({ id: "C-Z6", title: "Hints casus" })],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<AanbiederBeoordelingPage role="zorgaanbieder" onCaseClick={vi.fn()} />);

    const matchHint = screen.getByTestId("provider-review-match-hint");
    expect(matchHint).toHaveTextContent(/Advies match:/);
    expect(matchHint).toHaveTextContent(/score en fit zijn indicatief/i);
    expect(screen.getByTestId("provider-review-arrangement-disclaimer")).toHaveTextContent(/geen budget/i);
  });

  it("shows structured audit line on processed rejections from the evaluations API", () => {
    mockApiGet.mockResolvedValue({ caseId: "C-Z2", placement: {} });
    hoisted.evaluations.push(
      makeEvaluation({
        caseId: "C-Z2",
        status: "REJECTED",
        rejectionReasonCode: "geen_capaciteit",
        providerComment: "Geen plek binnen termijn — auditregel.",
      }),
    );
    mockUseCases.mockReturnValue({
      cases: [makeCase({ id: "C-Z2", title: "Afgewezen casus" })],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<AanbiederBeoordelingPage role="zorgaanbieder" onCaseClick={vi.fn()} />);

    expect(screen.getByTestId("provider-rejected-summary")).toBeInTheDocument();
    expect(screen.getByTestId("provider-rejected-audit-line")).toHaveTextContent(/geen_capaciteit/);
    expect(screen.getByText(/Geen plek binnen termijn/)).toBeInTheDocument();
  });

  it("opens info-request modal from active review and closes on cancel", async () => {
    mockApiGet.mockResolvedValue({ caseId: "C-Z4", placement: {} });
    mockUseCases.mockReturnValue({
      cases: [makeCase({ id: "C-Z4", title: "Modal casus" })],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    const user = userEvent.setup();

    render(<AanbiederBeoordelingPage role="zorgaanbieder" onCaseClick={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Meer informatie vragen" }));
    const modal = screen.getByTestId("provider-info-request-modal");
    expect(modal).toBeInTheDocument();
    expect(screen.getByTestId("provider-info-request-submit")).toBeDisabled();
    await user.click(screen.getByTestId("provider-info-request-cancel"));
    expect(screen.queryByTestId("provider-info-request-modal")).not.toBeInTheDocument();
  });

  it("shows structured audit on processed info-request from the evaluations API", () => {
    mockApiGet.mockResolvedValue({ caseId: "C-Z3", placement: {} });
    hoisted.evaluations.push(
      makeEvaluation({
        caseId: "C-Z3",
        status: "INFO_REQUESTED",
        rejectionReasonCode: null,
        providerComment: null,
        informationRequestType: "woonsituatie",
        informationRequestComment: "Graag actueel thuissituatie-overzicht voor matching.",
      }),
    );
    mockUseCases.mockReturnValue({
      cases: [makeCase({ id: "C-Z3", title: "Infoverzoek casus" })],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<AanbiederBeoordelingPage role="zorgaanbieder" onCaseClick={vi.fn()} />);

    expect(screen.getByTestId("provider-info-requested-summary")).toBeInTheDocument();
    expect(screen.getByTestId("provider-info-requested-audit-line")).toHaveTextContent(/woonsituatie/);
    expect(screen.getByText(/Graag actueel thuissituatie-overzicht/)).toBeInTheDocument();
  });
});
