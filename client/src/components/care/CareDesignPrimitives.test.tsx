import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  AppShell,
  CareAlertCard,
  CareFlowBoard,
  CareFlowStepCard,
  CasusWorkspaceStatusBadges,
  EmptyState,
  ErrorState,
  FlowPhaseBadge,
  LoadingState,
  PageHeader,
  PrimaryActionButton,
} from "./CareDesignPrimitives";

describe("CareDesignPrimitives", () => {
  it("exposes AppShell as CareAppFrame", () => {
    render(
      <AppShell>
        <span data-testid="inner">x</span>
      </AppShell>,
    );
    expect(screen.getByTestId("care-app-frame")).toBeInTheDocument();
    expect(screen.getByTestId("inner")).toBeInTheDocument();
  });

  it("renders PageHeader (CareUnifiedHeader) with subtitle behind info trigger", () => {
    render(<PageHeader title="Regiekamer" subtitle="Operatief overzicht" />);
    expect(screen.getByTestId("care-unified-header")).toHaveTextContent("Regiekamer");
    expect(screen.queryByText("Operatief overzicht")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pagina-uitleg" }));
    expect(screen.getByText("Operatief overzicht")).toBeInTheDocument();
  });

  it("renders FlowPhaseBadge mapped to decision phases", () => {
    render(<FlowPhaseBadge phaseId="gemeente_validatie" />);
    expect(screen.getByTitle("Stap in de keten (vier beslissingen)")).toHaveTextContent("Klaar voor matching");
  });

  it("LoadingState sets busy status", () => {
    render(<LoadingState title="Casussen laden…" copy="Even geduld." />);
    expect(screen.getByTestId("care-loading-state")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Casussen laden…");
  });

  it("ErrorState is an alert", () => {
    render(<ErrorState title="Fout" copy="Probeer opnieuw." />);
    expect(screen.getByTestId("care-error-state")).toHaveAttribute("role", "alert");
  });

  it("EmptyState alias renders", () => {
    render(<EmptyState title="Geen items" copy="Nog geen casussen." />);
    expect(screen.getByText("Geen items")).toBeInTheDocument();
  });

  it("PrimaryActionButton renders a single dominant CTA", () => {
    render(<PrimaryActionButton>Volgende stap</PrimaryActionButton>);
    expect(screen.getByRole("button", { name: "Volgende stap" })).toHaveClass("rounded-xl");
  });

  it("CasusWorkspaceStatusBadges reflect variant", () => {
    const { rerender } = render(<CasusWorkspaceStatusBadges variant="active" />);
    expect(screen.getByText("Actief")).toBeInTheDocument();
    rerender(<CasusWorkspaceStatusBadges variant="blocked" hint="Samenvatting ontbreekt" />);
    expect(screen.getByText("Geblokkeerd")).toBeInTheDocument();
    expect(screen.getByText("Samenvatting ontbreekt")).toBeInTheDocument();
  });

  it("CareAlertCard renders strict icon-metric-content-actions structure", () => {
    render(
      <CareAlertCard
        testId="care-alert"
        tone="critical"
        icon={<span>!</span>}
        metric="10"
        title="10 kritieke blokkades actief"
        description="10 casussen wachten op actie"
        primaryAction={<button type="button">Los blokkades op</button>}
        secondaryAction={<button type="button">Open werkvoorraad</button>}
      />,
    );

    expect(screen.getByTestId("care-alert-icon")).toBeInTheDocument();
    expect(screen.getByTestId("care-alert-metric")).toHaveTextContent("10");
    expect(screen.getByTestId("care-alert-content")).toHaveTextContent("10 kritieke blokkades actief");
    expect(screen.getByTestId("care-alert-actions")).toHaveTextContent("Los blokkades op");
  });

  it("CareFlowBoard keeps exactly four decision cards", () => {
    render(
      <CareFlowBoard testId="care-flow-board">
        {[0, 1, 2, 3].map((index) => (
          <CareFlowStepCard
            key={index}
            testId={`step-${index}`}
            icon={<span>i</span>}
            metric={index + 1}
            title={`Stap ${index + 1}`}
            subStatusLines={["Regel 1", "Regel 2"]}
          />
        ))}
      </CareFlowBoard>,
    );

    expect(screen.getByTestId("care-flow-board").children).toHaveLength(4);
  });
});
