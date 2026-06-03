import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RegiosPage } from "./RegiosPage";

const mockUseRegions = vi.fn();

vi.mock("../../hooks/useRegions", () => ({
  useRegions: (...args: unknown[]) => mockUseRegions(...args),
}));

describe("RegiosPage", () => {
  it("lets users search jeugdregios with a type-ahead picker", async () => {
    mockUseRegions.mockReturnValue({
      regions: [
        {
          id: "R-1",
          name: "Rivierenland",
          code: "rivierenland",
          regionType: "JEUGDREGIO",
          configurationStatus: "actief",
          maxWaitDays: null,
          providerCount: 4,
          municipalityCount: 8,
          coordinator: "Regio-coördinator",
          actieve_casussen: 3,
          beschikbare_capaciteit: 7,
          capaciteitsratio: 0.3,
          gemiddelde_wachttijd_dagen: 12,
          urgente_casussen_zonder_match: 0,
          vastgelopen_casussen: 0,
          status: "stabiel",
          status_label: "Stabiel",
          heeft_tekort: false,
          heeft_hoge_wachttijd: false,
          heeft_kritiek_signaal: false,
          signaal_samenvatting: "Geen capaciteitsproblemen",
          casesCount: 3,
          gemeentenCount: 8,
          providersCount: 4,
          avgWaitingTime: 12,
          capacityStatus: "normal",
          totalCapacity: 10,
          usedCapacity: 3,
          trend: "stable",
        },
        {
          id: "R-2",
          name: "FoodValley",
          code: "foodvalley",
          regionType: "JEUGDREGIO",
          configurationStatus: "actief",
          maxWaitDays: null,
          providerCount: 5,
          municipalityCount: 6,
          coordinator: "Regio-coördinator",
          actieve_casussen: 2,
          beschikbare_capaciteit: 5,
          capaciteitsratio: 0.25,
          gemiddelde_wachttijd_dagen: 9,
          urgente_casussen_zonder_match: 0,
          vastgelopen_casussen: 0,
          status: "stabiel",
          status_label: "Stabiel",
          heeft_tekort: false,
          heeft_hoge_wachttijd: false,
          heeft_kritiek_signaal: false,
          signaal_samenvatting: "Geen capaciteitsproblemen",
          casesCount: 2,
          gemeentenCount: 6,
          providersCount: 5,
          avgWaitingTime: 9,
          capacityStatus: "normal",
          totalCapacity: 8,
          usedCapacity: 2,
          trend: "stable",
        },
      ],
      loading: false,
      error: null,
      totalCount: 2,
      refetch: vi.fn(),
    });

    const user = userEvent.setup();
    render(
      <RegiosPage
        onRegionClick={vi.fn()}
        onViewGemeenten={vi.fn()}
        onViewProviders={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Regio's" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zoek jeugdregio" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Zoek jeugdregio" }));
    await user.type(screen.getByPlaceholderText("Typ een jeugdregio..."), "Riv");

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Open regio" })).toHaveLength(1);
      expect(screen.getAllByRole("button", { name: "Aanbieders" })).toHaveLength(1);
      expect(screen.getByRole("button", { name: "Zoek jeugdregio" })).toHaveTextContent("Riv");
    });

    expect(mockUseRegions).toHaveBeenLastCalledWith(
      expect.objectContaining({
        q: "Riv",
        regionType: "JEUGDREGIO",
      }),
    );
  });
});
