import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NieuweCasusPage } from "./NieuweCasusPage";

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock("../../lib/apiClient", () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

function makeIntakeFormPayload() {
  return {
    initial_values: {
      title: "",
      start_date: "",
      target_completion_date: "",
      care_category_main: "",
      care_category_sub: "",
      assessment_summary: "",
      gemeente: "",
      regio: "",
      urgency: "",
      complexity: "",
      urgency_applied: false,
      urgency_applied_since: "",
      diagnostiek: [] as string[],
      zorgvorm_gewenst: "",
      preferred_care_form: "",
      preferred_region_type: "",
      preferred_region: "",
      max_toelaatbare_wachttijd_dagen: "",
      leeftijd: "",
      setting_voorkeur: "",
      contra_indicaties: "",
      problematiek_types: "",
      client_age_category: "",
      family_situation: "",
      school_work_status: "",
      case_coordinator: "",
      description: "",
    },
    options: {
      care_category_main: [{ value: "ggz", label: "GGZ" }],
      care_category_sub: [{ value: "ggz-jeugd", label: "Jeugd GGZ", mainCategoryId: "ggz" }],
      gemeente: [{ value: "utrecht", label: "Utrecht" }],
      regio: [{ value: "utrecht", label: "Utrecht" }],
      urgency: [
        { value: "low", label: "Laag" },
        { value: "medium", label: "Midden" },
        { value: "high", label: "Hoog" },
      ],
      complexity: [
        { value: "low", label: "Laag" },
        { value: "medium", label: "Midden" },
        { value: "high", label: "Hoog" },
      ],
      diagnostiek: [{ value: "trauma", label: "Trauma" }],
      zorgvorm_gewenst: [{ value: "ambulant", label: "Ambulant" }],
      preferred_care_form: [{ value: "ambulant", label: "Ambulant" }],
      preferred_region_type: [{ value: "lokaal", label: "Lokaal" }],
      preferred_region: [{ value: "utrecht", label: "Utrecht" }],
      client_age_category: [{ value: "jeugd", label: "Jeugd" }],
      family_situation: [{ value: "thuis", label: "Thuis" }],
      case_coordinator: [{ value: "gemeente", label: "Gemeente" }],
    },
  };
}

function makeReadyIntakeFormPayload() {
  const payload = makeIntakeFormPayload();
  return {
    ...payload,
    initial_values: {
      ...payload.initial_values,
      start_date: "2026-05-08",
      target_completion_date: "2026-05-15",
      care_category_main: "ggz",
      care_category_sub: "ggz-jeugd",
      urgency: "medium",
      complexity: "medium",
      regio: "utrecht",
      preferred_region: "utrecht",
      preferred_region_type: "lokaal",
    },
  };
}

describe("NieuweCasusPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue(makeIntakeFormPayload());
    mockPost.mockResolvedValue({
      ok: true,
      id: 1,
      case_id: "CAS-1",
      title: "CLI-12345",
      redirect_url: "/care/cases/CAS-1/",
    });
  });

  it("shows the workflow-privacy guidance and step gate copy", async () => {
    const user = userEvent.setup();
    render(<NieuweCasusPage />);

    expect(await screen.findByRole("heading", { name: "Nieuwe casus" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Toelichting" }));
    expect(screen.getByText("Persoonsgegevens zijn alleen zichtbaar voor geautoriseerde rollen.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Info" }));
    expect(
      screen.getByText("Leg de kern vast met minimale gegevensverwerking en pseudonieme coördinatie."),
    ).toBeInTheDocument();
  });

  it("requires a client reference before advancing the intake flow", async () => {
    const user = userEvent.setup();
    render(<NieuweCasusPage />);

    const nextButton = await screen.findByRole("button", { name: "Volgende" });
    await user.click(nextButton);
    expect(
      screen.getByText("Vul cliëntreferentie, startdatum en deadline matching in voordat je doorgaat."),
    ).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("CLI-88314"), "CLI-12345");
    await user.click(screen.getByRole("button", { name: "Volgende" }));
    expect(screen.getByRole("heading", { name: "Zorgvraag" })).toBeInTheDocument();
  });

  it("posts the opaque client reference on submit", async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValueOnce(makeReadyIntakeFormPayload());
    render(<NieuweCasusPage />);

    expect(await screen.findByRole("heading", { name: "Nieuwe casus" })).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("CLI-88314"), "CLI-12345");
    await user.click(await screen.findByRole("button", { name: "Volgende" }));
    await user.click(await screen.findByRole("button", { name: "Volgende" }));
    await user.click(screen.getByRole("button", { name: "Casus aanmaken" }));

    expect(mockPost).toHaveBeenCalledWith(
      "/care/api/cases/intake-create/",
      expect.objectContaining({
        title: "CLI-12345",
      }),
    );
  });
});
