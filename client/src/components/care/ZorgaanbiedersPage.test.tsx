import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ZorgaanbiedersPage } from "./ZorgaanbiedersPage";

const mockUseProviders = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastInfo = vi.fn();

vi.mock("../../hooks/useProviders", () => ({
  useProviders: (...args: unknown[]) => mockUseProviders(...args),
}));

vi.mock("./ProviderNetworkMap", () => ({
  ProviderNetworkMap: () => <div data-testid="provider-network-map" />,
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    info: (...args: unknown[]) => mockToastInfo(...args),
  },
}));

function setupProviders() {
  mockUseProviders.mockReturnValue({
    providers: [
      {
        id: "p-1",
        name: "Zorgaanbieder Toegankelijk",
        city: "Utrecht",
        status: "active",
        currentCapacity: 4,
        maxCapacity: 10,
        waitingListLength: 1,
        averageWaitDays: 5,
        offersOutpatient: true,
        offersDayTreatment: false,
        offersResidential: false,
        offersCrisis: false,
        serviceArea: "Utrecht",
        specialFacilities: "Trauma",
        availableSpots: 4,
        region: "Utrecht",
        type: "ambulant",
        specializations: ["Trauma", "Autisme"],
        latitude: null,
        longitude: null,
        hasCoordinates: false,
        locationLabel: "Utrecht",
        regionLabel: "Utrecht",
        municipalityLabel: "Utrecht",
        secondaryRegionLabels: [],
        allRegionLabels: ["Utrecht"],
      },
    ],
    loading: false,
    error: null,
    totalCount: 1,
    networkSummary: null,
    lastUpdatedAt: Date.now(),
    refetch: vi.fn(),
  });
}

describe("ZorgaanbiedersPage accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupProviders();
  });

  it("uses button semantics for provider card selection", () => {
    render(<ZorgaanbiedersPage theme="light" />);
    expect(screen.getByRole("button", { name: "Selecteer Zorgaanbieder Toegankelijk" })).toBeInTheDocument();
  });

  it("selects provider card with Enter and Space", async () => {
    const user = userEvent.setup();
    render(<ZorgaanbiedersPage theme="light" />);

    const cardButton = screen.getByRole("button", { name: "Selecteer Zorgaanbieder Toegankelijk" });
    expect(cardButton).toHaveAttribute("aria-pressed", "false");

    cardButton.focus();
    await user.keyboard("{Enter}");
    expect(cardButton).toHaveAttribute("aria-pressed", "true");

    await user.keyboard(" ");
    expect(cardButton).toHaveAttribute("aria-pressed", "true");
  });

  it("supports tab navigation and keeps child actions clickable", async () => {
    const user = userEvent.setup();
    render(<ZorgaanbiedersPage theme="light" />);

    const cardButton = screen.getByRole("button", { name: "Selecteer Zorgaanbieder Toegankelijk" });
    for (let index = 0; index < 6; index += 1) {
      await user.tab();
      if (cardButton === document.activeElement) {
        break;
      }
    }
    expect(cardButton).toHaveFocus();

    await user.keyboard("{Enter}");
    const selectButton = screen.getByRole("button", { name: "Selecteer" });
    expect(selectButton).toBeInTheDocument();

    await user.click(selectButton);
    expect(mockToastSuccess).toHaveBeenCalled();
  });
});
