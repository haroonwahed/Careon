import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CARE_UNIFIED_PAGE_STACK, CareListRow, CarePageTemplate, CareWorkRow } from "./CareUnifiedPage";

describe("CarePageTemplate", () => {
  it("renders header, optional attention and filters, and main children", () => {
    render(
      <CarePageTemplate
        header={<h1 data-testid="hdr">Titel</h1>}
        attention={<p data-testid="att">Aandacht</p>}
        filters={<p data-testid="fil">Filters</p>}
      >
        <p data-testid="main">Lijst</p>
      </CarePageTemplate>,
    );

    expect(screen.getByTestId("hdr")).toBeInTheDocument();
    expect(screen.getByTestId("att")).toBeInTheDocument();
    expect(screen.getByTestId("fil")).toBeInTheDocument();
    expect(screen.getByTestId("main")).toBeInTheDocument();
  });

  it("omits optional slots when undefined", () => {
    render(
      <CarePageTemplate header={<span data-testid="hdr">H</span>}>
        <span data-testid="main">M</span>
      </CarePageTemplate>,
    );

    expect(screen.getByTestId("hdr")).toBeInTheDocument();
    expect(screen.getByTestId("main")).toBeInTheDocument();
  });

  it("merges className onto the stack root", () => {
    const { container } = render(
      <CarePageTemplate className="pb-8" header={<span>h</span>}>
        <span>c</span>
      </CarePageTemplate>,
    );

    const root = container.firstElementChild;
    expect(root).toHaveClass(CARE_UNIFIED_PAGE_STACK.trim().split(/\s+/)[0]);
    expect(root).toHaveClass("pb-8");
    expect(root).toHaveClass("space-y-4");
  });
});

describe("CareWorkRow / CareListRow", () => {
  it("renders shared row skeleton with optional leading slot", () => {
    render(
      <CareWorkRow
        leading={<span data-testid="lead">L</span>}
        title="Titel"
        context="Context"
        status={<span data-testid="st">Status</span>}
        actionLabel="Actie →"
        onOpen={vi.fn()}
        onAction={vi.fn()}
      />,
    );
    const row = document.querySelector("[data-care-work-row]");
    expect(screen.getByTestId("lead")).toBeInTheDocument();
    expect(screen.getByText("Titel")).toBeInTheDocument();
    expect(screen.getAllByTestId("st")).toHaveLength(2);
    expect(screen.getByText("Actie →").closest("button")).toBeTruthy();
    expect(row).toBeTruthy();
    expect(row).not.toHaveAttribute("role");
    expect(within(row as HTMLElement).getAllByRole("button")).toHaveLength(2);
  });

  it("stops propagation on CTA so row handler is not double-fired from button", () => {
    const onOpen = vi.fn();
    const onAction = vi.fn();
    render(
      <CareWorkRow
        title="Rij"
        context="Onder"
        status={<span>S</span>}
        actionLabel="Klik"
        onOpen={onOpen}
        onAction={onAction}
      />,
    );
    const cta = screen.getByText("Klik").closest("button");
    expect(cta).toBeTruthy();
    fireEvent.click(cta!);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("aliases CareListRow to CareWorkRow", () => {
    expect(CareListRow).toBe(CareWorkRow);
  });

  it("hides the CTA when hideAction is true", () => {
    render(
      <CareWorkRow
        title="Rij"
        context="Onder"
        status={<span>S</span>}
        actionLabel="Verborgen"
        hideAction
        onOpen={vi.fn()}
        onAction={vi.fn()}
      />,
    );
    expect(screen.queryByText("Verborgen")).not.toBeInTheDocument();
  });
});
