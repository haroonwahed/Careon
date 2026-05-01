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
  it("shows Wacht op aanbieder title and Bekijk status CTA", () => {
    mockUseCases.mockReturnValue({
      cases: [makeCase({ id: "C-G1", title: "Monitor casus" })],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<AanbiederBeoordelingPage role="gemeente" onCaseClick={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Wacht op aanbieder" })).toBeInTheDocument();
    expect(screen.getByText(/Gemeente volgt\. Aanbieder beslist\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bekijk status" })).toBeInTheDocument();
  });
});
