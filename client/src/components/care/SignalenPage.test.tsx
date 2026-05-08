import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SignalenPage } from "./SignalenPage";

const mockUseCases = vi.fn();
const mockUseProviders = vi.fn();
const mockUseAssessments = vi.fn();
const mockUseRegions = vi.fn();

vi.mock("../../hooks/useCases", () => ({
  useCases: (...args: unknown[]) => mockUseCases(...args),
}));

vi.mock("../../hooks/useProviders", () => ({
  useProviders: (...args: unknown[]) => mockUseProviders(...args),
}));

vi.mock("../../hooks/useAssessments", () => ({
  useAssessments: (...args: unknown[]) => mockUseAssessments(...args),
}));

vi.mock("../../hooks/useRegions", () => ({
  useRegions: (...args: unknown[]) => mockUseRegions(...args),
}));

describe("SignalenPage", () => {
  it("frames signals as a regie-overview and exposes the dominant action", async () => {
    mockUseCases.mockReturnValue({
      cases: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseProviders.mockReturnValue({
      providers: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseAssessments.mockReturnValue({
      assessments: [
        {
          id: "A-1",
          caseId: "C-1",
          caseTitle: "Casus A",
          status: "open",
          matchingReady: false,
          missingInfo: [{ severity: "error" }],
        },
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseRegions.mockReturnValue({
      regions: [
        {
          id: "R-1",
          name: "Utrecht",
          status: "stabiel",
          status_label: "Stabiel",
          signaal_samenvatting: "Geen druk",
        },
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    const user = userEvent.setup();
    render(<SignalenPage onOpenCase={vi.fn()} onNavigateToWorkflow={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Signalen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bekijk kritiek" })).toBeInTheDocument();

    await user.click(screen.getByTestId("signalen-page-uitleg"));
    expect(screen.getByText(/regie-overzicht/i)).toBeInTheDocument();
    expect(screen.getByText(/sidebar Acties blijft de aparte takenlijst/i)).toBeInTheDocument();
  });
});
