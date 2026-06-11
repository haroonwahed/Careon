import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CarePageScaffold } from "./CarePageScaffold";

describe("CarePageScaffold", () => {
  it("exposes stable test ids, archetype, and one h1", () => {
    render(
      <CarePageScaffold archetype="queue" title="Titel" subtitle="Subtitel">
        <p>Inhoud</p>
      </CarePageScaffold>,
    );
    const root = screen.getByTestId("care-page-scaffold");
    expect(root).toHaveAttribute("data-care-page-archetype", "queue");
    expect(screen.getByTestId("care-page-header")).toBeInTheDocument();
    expect(screen.getByTestId("care-unified-header")).toBeInTheDocument();
    expect(screen.getByTestId("care-page-content")).toBeInTheDocument();
    expect(screen.getByText("Inhoud")).toBeInTheDocument();
    expect(screen.getByText("Subtitel")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pagina-uitleg" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("care-page-insights")).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("renders optional dominantAction, kpiStrip, workflow, filters, detail, and insights only when provided", () => {
    render(
      <CarePageScaffold
        archetype="workspace"
        title="X"
        dominantAction={<div data-testid="nba-mock">NBA</div>}
        kpiStrip={<div data-testid="kpi-mock">KPI</div>}
        workflow={<div data-testid="workflow-mock">Workflow</div>}
        filters={<div data-testid="filters-mock">Filters</div>}
        detail={<div data-testid="detail-mock">Detail</div>}
        insights={<div data-testid="insight-mock">Inzicht</div>}
      >
        Body
      </CarePageScaffold>,
    );
    expect(screen.getByTestId("nba-mock")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-mock")).toBeInTheDocument();
    expect(screen.getByTestId("workflow-mock")).toBeInTheDocument();
    expect(screen.getByTestId("filters-mock")).toBeInTheDocument();
    expect(screen.getByTestId("detail-mock")).toBeInTheDocument();
    expect(screen.getByTestId("care-page-insights")).toBeInTheDocument();
    expect(screen.getByTestId("insight-mock")).toBeInTheDocument();
  });

  it("supports custom root testId", () => {
    render(
      <CarePageScaffold archetype="command" testId="acties-page-root" title="Acties">
        —
      </CarePageScaffold>,
    );
    expect(screen.getByTestId("acties-page-root")).toHaveAttribute("data-care-page-archetype", "command");
  });
});
