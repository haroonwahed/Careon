import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SpaCase } from "../../hooks/useCases";
import { IntakeListPage } from "./IntakeListPage";

const mockUseCases = vi.fn();
const mockPost = vi.fn();

vi.mock("../../hooks/useCases", () => ({
  useCases: (...args: unknown[]) => mockUseCases(...args),
}));

vi.mock("../../lib/apiClient", () => ({
  apiClient: {
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

function makeCase(overrides: Partial<SpaCase>): SpaCase {
  return {
    id: "C-INT-1",
    title: "Intake casus",
    regio: "Utrecht",
    zorgtype: "Ambulante zorg",
    wachttijd: 4,
    status: "plaatsing",
    urgency: "normal",
    problems: [],
    systemInsight: "Korte toelichting.",
    recommendedAction: "Plan intake",
    urgencyValidated: true,
    urgencyDocumentPresent: true,
    urgencyGrantedDate: null,
    waitlistBucket: 1,
    intakeStartDate: null,
    arrangementTypeCode: "",
    arrangementProvider: "Zorg Z",
    arrangementEndDate: null,
    ...overrides,
  };
}

describe("IntakeListPage", () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockPost.mockResolvedValue({});
  });

  it("renders intake shell and empty state when no placement cases", () => {
    mockUseCases.mockReturnValue({
      cases: [makeCase({ status: "provider_beoordeling", id: "C-P" })],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<IntakeListPage onCaseClick={vi.fn()} view="intake" />);

    expect(screen.getByRole("heading", { name: "Intake en plaatsing" })).toBeInTheDocument();
    expect(screen.getByText("Geen casussen in dit overzicht")).toBeInTheDocument();
  });

  it("lists placement cases with Bekijk casus", () => {
    mockUseCases.mockReturnValue({
      cases: [makeCase({ id: "C-PL1", title: "Plaatsing casus", status: "plaatsing" })],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<IntakeListPage onCaseClick={vi.fn()} view="intake" />);

    expect(screen.getByRole("heading", { name: "CLI-ONBEKEND" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bekijk casus" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accepteren" })).not.toBeInTheDocument();
  });

  it("hides provider accept/reject for gemeente on requests view", () => {
    mockUseCases.mockReturnValue({
      cases: [makeCase({ id: "C-REQ", status: "provider_beoordeling", title: "Open verzoek" })],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<IntakeListPage onCaseClick={vi.fn()} view="requests" role="gemeente" />);

    expect(screen.getByRole("heading", { name: "Nieuwe aanvragen" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accepteren" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Afwijzen" })).not.toBeInTheDocument();
  });

  it("accepts pending request as zorgaanbieder and calls API + refetch", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mockUseCases.mockReturnValue({
      cases: [
        makeCase({
          id: "C-ACC",
          title: "Te accepteren",
          status: "provider_beoordeling",
          wachttijd: 2,
        }),
      ],
      loading: false,
      error: null,
      refetch,
    });

    render(<IntakeListPage onCaseClick={vi.fn()} view="requests" role="zorgaanbieder" />);

    await user.click(screen.getByRole("button", { name: "Accepteren" }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/care/api/cases/C-ACC/provider-decision/", { status: "ACCEPTED" });
    });
    expect(refetch).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText(/Casus C-ACC is geaccepteerd/)).toBeInTheDocument();
    });
  });
});
