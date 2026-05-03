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
  it("shows Aanbieder beoordeling title and Bekijk status CTA", () => {
    mockUseCases.mockReturnValue({
      cases: [makeCase({ id: "C-G1", title: "Monitor casus" })],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<AanbiederBeoordelingPage role="gemeente" onCaseClick={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Aanbieder beoordeling" })).toBeInTheDocument();
    expect(
      screen.getByText(/Gemeente volgt\. Wacht op reactie van de aanbieder; aanbieder beslist\./),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bekijk status" })).toBeInTheDocument();
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
  });
});
