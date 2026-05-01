import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  CareFilterTabButton,
  CareFilterTabGroup,
  CareSearchFiltersBar,
} from "./CareUnifiedPage";

describe("CareSearchFiltersBar", () => {
  it("renders shared control stack with search and optional tabs", () => {
    render(
      <CareSearchFiltersBar
        tabs={
          <CareFilterTabGroup aria-label="Test tabs">
            <CareFilterTabButton selected onClick={vi.fn()}>
              Tab A
            </CareFilterTabButton>
          </CareFilterTabGroup>
        }
        searchValue=""
        onSearchChange={vi.fn()}
        searchPlaceholder="Zoek…"
      />,
    );

    expect(screen.getByTestId("care-search-control-stack")).toBeInTheDocument();
    expect(screen.getByTestId("care-search-input")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Zoek…")).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "Test tabs" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Tab A" })).toHaveAttribute("aria-selected", "true");
  });

  it("forwards search input changes and exposes Meer filters control when expandable", () => {
    const onChange = vi.fn();
    render(
      <CareSearchFiltersBar
        searchValue="x"
        onSearchChange={onChange}
        searchPlaceholder="Zoek casus"
        showSecondaryFilters={false}
        onToggleSecondaryFilters={vi.fn()}
        secondaryFilters={<span data-testid="extra-filters">Extra</span>}
      />,
    );

    const input = screen.getByTestId("care-search-input");
    expect(input).toHaveValue("x");
    fireEvent.change(input, { target: { value: "y" } });
    expect(onChange).toHaveBeenCalledWith("y");

    expect(screen.queryByTestId("extra-filters")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Meer filters/i })).toBeInTheDocument();
  });

  it("shows secondary filters when expanded", () => {
    const toggle = vi.fn();
    const { rerender } = render(
      <CareSearchFiltersBar
        searchValue=""
        onSearchChange={vi.fn()}
        searchPlaceholder="Zoek"
        showSecondaryFilters={false}
        onToggleSecondaryFilters={toggle}
        secondaryFilters={<span data-testid="extra-filters">Extra</span>}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Meer filters/i }));
    expect(toggle).toHaveBeenCalled();

    rerender(
      <CareSearchFiltersBar
        searchValue=""
        onSearchChange={vi.fn()}
        searchPlaceholder="Zoek"
        showSecondaryFilters
        onToggleSecondaryFilters={toggle}
        secondaryFilters={<span data-testid="extra-filters">Extra</span>}
      />,
    );
    expect(screen.getByTestId("extra-filters")).toBeInTheDocument();
  });
});
