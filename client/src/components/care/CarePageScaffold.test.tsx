import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CarePageScaffold } from "./CarePageScaffold";

describe("CarePageScaffold", () => {
  it("exposes stable test ids, archetype, and one h1", () => {
    render(
      <CarePageScaffold archetype="worklist" title="Titel" subtitle="Ondertitel">
        <p>Inhoud</p>
      </CarePageScaffold>,
    );
    const root = screen.getByTestId("care-page-scaffold");
    expect(root).toHaveAttribute("data-care-page-archetype", "worklist");
    expect(screen.getByTestId("care-page-header")).toBeInTheDocument();
    expect(screen.getByTestId("care-unified-header")).toBeInTheDocument();
    expect(screen.getByTestId("care-page-content")).toBeInTheDocument();
    expect(screen.getByText("Inhoud")).toBeInTheDocument();
    expect(screen.queryByTestId("care-page-insights")).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("renders optional dominantAction, kpiStrip, filters, and insights only when provided", () => {
    render(
      <CarePageScaffold
        archetype="decision"
        title="X"
        dominantAction={<div data-testid="nba-mock">NBA</div>}
        kpiStrip={<div data-testid="kpi-mock">KPI</div>}
        filters={<div data-testid="filters-mock">Filters</div>}
        insights={<div data-testid="insight-mock">Inzicht</div>}
      >
        Body
      </CarePageScaffold>,
    );
    expect(screen.getByTestId("nba-mock")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-mock")).toBeInTheDocument();
    expect(screen.getByTestId("filters-mock")).toBeInTheDocument();
    expect(screen.getByTestId("care-page-insights")).toBeInTheDocument();
    expect(screen.getByTestId("insight-mock")).toBeInTheDocument();
  });

  it("supports custom root testId", () => {
    render(
      <CarePageScaffold archetype="signal-action" testId="acties-page-root" title="Acties">
        —
      </CarePageScaffold>,
    );
    expect(screen.getByTestId("acties-page-root")).toHaveAttribute("data-care-page-archetype", "signal-action");
  });
});
