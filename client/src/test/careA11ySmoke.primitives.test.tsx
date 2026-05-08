import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { CareSearchFiltersBar } from "../components/care/CareDesignPrimitives";
import { ValidationPanel } from "../components/care/ValidationPanel";
import { WorkflowCaseCard } from "../components/care/workflow/WorkflowCaseCard";
import type { WorkflowCaseView } from "../lib/workflowUi";
import { expectNoA11yViolations, renderWithA11y } from "./utils/a11y";

function makeWorkflowItem(overrides: Partial<WorkflowCaseView> = {}): WorkflowCaseView {
  return {
    id: "CAS-1",
    title: "Test cliënt",
    clientLabel: "Test cliënt",
    clientAge: 42,
    careType: "Ambulant",
    region: "Utrecht",
    municipality: "Utrecht",
    lastUpdatedLabel: "Vandaag",
    urgency: "normal",
    urgencyLabel: "Normaal",
    phase: "matching",
    phaseLabel: "Matching",
    boardColumn: "matching",
    boardColumnLabel: "Matching",
    currentPhaseLabel: "Klaar voor matching",
    daysInCurrentPhase: 3,
    tags: ["Ambulant"],
    nextBestAction: "matching",
    nextBestActionLabel: "Bekijk matching",
    nextBestActionUrl: "matching",
    isBlocked: false,
    blockReason: null,
    readyForMatching: true,
    readyForPlacement: false,
    recommendedProvidersCount: 3,
    recommendedProviderName: null,
    intakeDateLabel: null,
    placementStatusLabel: "Open",
    workflowState: {} as WorkflowCaseView["workflowState"],
    canonicalWorkflowState: null,
    summarySnippet: "Korte samenvatting",
    whyInThisStep: "Waarom deze stap",
    responsibleParty: "Gemeente",
    primaryActionLabel: "Open casus",
    primaryActionEnabled: true,
    primaryActionReason: null,
    decisionBadges: [],
    missingDataItems: [],
    matchConfidenceLabel: "Fit sterk (89%)",
    matchConfidenceScore: 89,
    providerStatusLabel: null,
    providerStatusTone: null,
    waitlistBucket: 0,
    urgencyGrantedDate: null,
    intakeStartDate: null,
    arrangementTypeCode: "",
    arrangementProvider: "",
    arrangementEndDate: null,
    placementRequestStatus: null,
    placementProviderResponseStatus: null,
    ...overrides,
  };
}

describe("Care accessibility smoke: shared primitives", () => {
  it("CareSearchFiltersBar exposes expanded state and region", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <CareSearchFiltersBar
          searchValue=""
          onSearchChange={() => undefined}
          searchPlaceholder="Zoek casussen"
          showSecondaryFilters={open}
          onToggleSecondaryFilters={() => setOpen((current) => !current)}
          secondaryFiltersLabel="Filters"
          secondaryFilters={<span data-testid="extra-filters">Extra</span>}
        />
      );
    }

    const { container } = renderWithA11y(<Harness />);
    const toggle = screen.getByRole("button", { name: "Filters" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region", { name: "Filters" })).toBeInTheDocument();
    expect(screen.getByTestId("extra-filters")).toBeInTheDocument();
    await expectNoA11yViolations(container, "CareSearchFiltersBar");
  });

  it("ValidationPanel keeps suggestion actions explicit", async () => {
    const action = vi.fn();
    const { container } = renderWithA11y(
      <ValidationPanel
        validations={[{ level: "warning", message: "Let op" }]}
        suggestions={[{ text: "Pas voorstel toe", action }]}
      />,
    );

    const button = screen.getByRole("button", { name: "Toepassen" });
    expect(button).toHaveAttribute("type", "button");
    await expectNoA11yViolations(container, "ValidationPanel");
  });

  it("WorkflowCaseCard keeps the main open action and disclosure accessible", async () => {
    const onOpen = vi.fn();
    const { container } = renderWithA11y(<WorkflowCaseCard item={makeWorkflowItem()} onOpen={onOpen} />);

    const row = container.querySelector("article.w-full.rounded-2xl.border");
    expect(row).toBeTruthy();
    expect(within(row as HTMLElement).getAllByRole("button")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Open casus Test cliënt" })).toBeInTheDocument();
    expect(screen.getByText("Meer details")).toBeInTheDocument();
    await expectNoA11yViolations(container, "WorkflowCaseCard");
  });
});
