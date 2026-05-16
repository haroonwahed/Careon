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

vi.mock("./ProviderMapSurface", () => ({
  ProviderMapSurface: ({
    selectedProviderId,
    onNavigateToMatching,
  }: {
    selectedProviderId: string | null;
    onNavigateToMatching?: () => void;
  }) => (
    <div data-testid="provider-network-map">
      {selectedProviderId && onNavigateToMatching ? (
        <button type="button" data-testid="zorgaanbieders-map-naar-matching" onClick={onNavigateToMatching}>
          Naar Matching
        </button>
      ) : null}
    </div>
  ),
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

describe("ZorgaanbiedersPage operatieve aandacht action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupProviders();
  });

  it("labels the banner primary action as Selecteer alternatief when no filters are active", () => {
    render(<ZorgaanbiedersPage theme="light" />);
    expect(screen.getByRole("button", { name: "Selecteer alternatief" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Wis filters" })).not.toBeInTheDocument();
  });

  it("switches the banner label to Wis filters after Selecteer alternatief applies a capaciteit filter", async () => {
    const user = userEvent.setup();
    render(<ZorgaanbiedersPage theme="light" />);
    await user.click(screen.getByRole("button", { name: "Selecteer alternatief" }));
    expect(screen.getByRole("button", { name: "Wis filters" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Selecteer alternatief" })).not.toBeInTheDocument();
  });

  it("labels the banner primary action as Selecteer beste match when a casus context is active and filters stay clear", () => {
    render(
      <ZorgaanbiedersPage
        theme="light"
        activeCaseContext={{
          region: "Onbekende regio",
          careType: "Jeugd GGZ",
          urgency: "normaal",
        }}
      />,
    );
    expect(screen.getByRole("button", { name: "Selecteer beste match" })).toBeInTheDocument();
  });

  it("shows the network-overview subtitle instead of workflow language", async () => {
    const user = userEvent.setup();
    render(<ZorgaanbiedersPage theme="light" />);

    expect(screen.getByRole("button", { name: "Pagina-uitleg" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Pagina-uitleg" }));
    expect(
      screen.getByText("Netwerkoverzicht van capaciteit en regionale dekking. Gebruik Matching om casusvoorkeuren vast te leggen."),
    ).toBeInTheDocument();
  });

  it("keeps split-view count copy consistent between list and map headers", () => {
    render(<ZorgaanbiedersPage theme="light" />);
    expect(screen.getByText("1 zorgaanbieders beschikbaar")).toBeInTheDocument();
    expect(screen.getByText("Split modus · 1 van 1 aanbieders zichtbaar")).toBeInTheDocument();
    expect(screen.getByText("Split view toont resultaten links en de kaart rechts.")).toBeInTheDocument();
  });
});

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
    cardButton.focus();
    expect(cardButton).toHaveFocus();

    await user.keyboard("{Enter}");
    const selectButton = screen.getByRole("button", { name: "Selecteer" });
    expect(selectButton).toBeInTheDocument();

    await user.click(selectButton);
    expect(mockToastSuccess).toHaveBeenCalledWith("Zorgaanbieder Toegankelijk uitgelicht op de kaart");
  });

  it("toont Naar Matching op de kaart na Selecteer wanneer shell-navigatie is gezet", async () => {
    const user = userEvent.setup();
    const onMatching = vi.fn();
    render(<ZorgaanbiedersPage theme="light" onNavigateToMatching={onMatching} />);

    await user.click(screen.getByRole("button", { name: "Selecteer" }));
    expect(screen.getByTestId("zorgaanbieders-map-naar-matching")).toBeInTheDocument();

    await user.click(screen.getByTestId("zorgaanbieders-map-naar-matching"));
    expect(onMatching).toHaveBeenCalledTimes(1);
  });
});
