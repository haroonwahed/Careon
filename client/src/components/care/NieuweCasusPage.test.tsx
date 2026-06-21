import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NieuweCasusPage } from "./NieuweCasusPage";

const mockGet = vi.fn();
const mockPost = vi.fn();

function isoDaysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const memoryStorage = (() => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
})();

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
      source_reference: "",
      start_date: "",
      target_completion_date: "",
      care_category_main: "",
      care_category_sub: "",
      assessment_summary: "",
      gemeente: "",
      regio: "",
      urgency: "",
      complexity: "",
      placement_pressure_horizon: ">2_WEEKS",
      safety_pressure: false,
      time_sensitive_arrangement: false,
      escalation_needed: false,
      placement_pressure_notes: "",
      has_urgency_declaration: false,
      urgency_applied: false,
      urgency_applied_since: "",
      diagnostiek: [] as string[],
      zorgvorm_gewenst: "",
      preferred_care_form: "",
      preferred_region_type: "JEUGDREGIO",
      preferred_region: "utrecht-stad",
      jeugdhulpregio: "utrecht-stad",
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
      care_category_main: [{ value: "WONEN_VERBLIJF", label: "Wonen & verblijf" }],
      care_category_sub: [{ value: "WONEN_VERBLIJF_WOONVOORZIENING", label: "Wonen & verblijf → Woonvoorziening", mainCategoryId: "WONEN_VERBLIJF" }],
      gemeente: [
        { value: "aalten", label: "Aalten", urgencyDocumentRequestUrl: "https://www.aalten.nl/ontwerp-volkshuisvestingsprogramma" },
        { value: "amsterdam", label: "Amsterdam", urgencyDocumentRequestUrl: "https://www.amsterdam.nl/wonen-bouwen-verbouwen/woonruimte-vinden/urgentieverklaring-aanvragen/" },
        { value: "utrecht", label: "Utrecht", urgencyDocumentRequestUrl: "https://www.utrecht.nl/wonen-en-leven/wonen/woning-zoeken/urgentie-voor-een-woning/" },
      ],
      jeugdhulpregio: [
        { value: "utrecht-stad", label: "Utrecht Stad" },
        { value: "amsterdam-stad", label: "Amsterdam Stad" },
      ],
      regio: [
        { value: "utrecht-stad", label: "Utrecht Stad" },
        { value: "amsterdam-stad", label: "Amsterdam Stad" },
      ],
      urgency: [
        { value: "LOW", label: "Laag" },
        { value: "MEDIUM", label: "Midden" },
        { value: "HIGH", label: "Hoog" },
      ],
      placement_pressure_horizon: [
        { value: "TODAY", label: "Vandaag" },
        { value: "3_DAYS", label: "3 dagen" },
        { value: "1_WEEK", label: "1 week" },
        { value: "2_WEEKS", label: "2 weken" },
        { value: ">2_WEEKS", label: ">2 weken" },
      ],
      complexity: [
        { value: "SIMPLE", label: "Enkelvoudig" },
        { value: "MULTIPLE", label: "Meervoudig" },
        { value: "SEVERE", label: "Intensief" },
      ],
      diagnostiek: [{ value: "trauma", label: "Trauma" }],
      zorgvorm_gewenst: [{ value: "ambulant", label: "Ambulant" }],
      preferred_care_form: [{ value: "ambulant", label: "Ambulant" }],
      preferred_region_type: [{ value: "JEUGDREGIO", label: "Jeugdregio" }],
      preferred_region: [
        { value: "utrecht-stad", label: "Utrecht Stad" },
        { value: "amsterdam-stad", label: "Amsterdam Stad" },
      ],
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
      start_date: isoDaysFromNow(7),
      target_completion_date: isoDaysFromNow(14),
      care_category_main: "WONEN_VERBLIJF",
      care_category_sub: "WONEN_VERBLIJF_WOONVOORZIENING",
      urgency: "MEDIUM",
      complexity: "MULTIPLE",
      placement_pressure_horizon: ">2_WEEKS",
      jeugdhulpregio: "utrecht-stad",
      regio: "utrecht-stad",
      preferred_region: "utrecht-stad",
      preferred_region_type: "JEUGDREGIO",
    },
  };
}

function makeHighUrgencyIntakeFormPayload() {
  const payload = makeReadyIntakeFormPayload();
  return {
    ...payload,
    initial_values: {
      ...payload.initial_values,
      start_date: isoDaysFromNow(2),
      target_completion_date: isoDaysFromNow(6),
      placement_pressure_horizon: "1_WEEK",
      safety_pressure: true,
      urgency: "HIGH",
    },
  };
}

async function chooseMunicipality(user: ReturnType<typeof userEvent.setup>, value = "Utrecht") {
  await user.click(screen.getByRole("button", { name: "Gemeente (woonplaatsbeginsel) *" }));
  const input = screen.getByPlaceholderText("Zoek gemeente...");
  await user.clear(input);
  await user.type(input, value);
  const choice = document.querySelector(`[cmdk-item][data-value="${value}"]`) as HTMLElement | null;
  expect(choice).not.toBeNull();
  await user.click(choice!);
}

describe("NieuweCasusPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "localStorage", { value: memoryStorage, configurable: true });
    memoryStorage.clear();
    mockGet.mockResolvedValue(makeIntakeFormPayload());
    mockPost.mockResolvedValue({
      ok: true,
      id: 1,
      case_id: "CAS-1",
      title: "CLI-12345",
      source_reference: "BR-2026-ABCDEF",
      redirect_url: "/care/cases/CAS-1/",
    });
  });

  it("shows the workflow-privacy guidance and step gate copy", async () => {
    const user = userEvent.setup();
    render(<NieuweCasusPage />);

    expect(await screen.findByRole("heading", { name: "Nieuwe casus" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terug naar casussen" })).toBeInTheDocument();
    expect(screen.getByTestId("nieuwe-casus-gemeente-video")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Waarom deze gemeente?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Waarom gewenste startdatum?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Waarom uiterste plaatsingsdatum?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Waarom uiterste plaatsingsdatum?" }));
    expect(screen.getByText("Deze datum markeert de uiterste operationele plaatsingsgrens.")).toBeInTheDocument();
    expect(screen.getByText("Bij wijzigingen in plaatsingsdruk of context kan de datum worden aangepast.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Waarom gewenste startdatum?" }));
    expect(screen.getByText("Vanaf wanneer de client zoekt naar (vervolg)plaatsing.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Waarom deze gemeente?" }));
    expect(screen.getByText("Kies de gemeente die leidend is voor het woonplaatsbeginsel.")).toBeInTheDocument();
    expect(screen.getByLabelText("Regio (afgeleid van gemeente)")).toHaveTextContent("Utrecht Stad");
    await user.click(screen.getByRole("button", { name: "Toelichting" }));
    expect(await screen.findByRole("dialog", { name: "Toelichting nieuwe casus" })).toBeInTheDocument();
    const dialog = screen.getByRole("dialog", { name: "Toelichting nieuwe casus" });
    expect(within(dialog).getByRole("note", { name: "Privacy en gegevensgebruik" })).toBeInTheDocument();
    expect(within(dialog).getByText("We koppelen deze casus aan het woonplaatsbeginsel en genereren automatisch een bronreferentie.")).toBeInTheDocument();
    expect(within(dialog).getByText("Vul alleen de minimale gegevens in om te starten. Aanvullende informatie volgt in de volgende stappen.")).toBeInTheDocument();
    expect(dialog).toHaveTextContent(/Persoonsgegevens blijven afgeschermd tot formele intake of koppeling/i);
    expect(within(dialog).getByRole("link", { name: "Meer over privacy en zichtbaarheid" })).toBeInTheDocument();
    expect(dialog).toHaveTextContent(/Velden met \* zijn verplicht/i);
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByTestId("nieuwe-casus-gemeente-video"));
    expect(screen.getByRole("dialog", { name: "Woonplaatsbeginsel" })).toBeInTheDocument();
  });

  it("shows the full gemeente list when opening woonplaatsbeginsel", async () => {
    const user = userEvent.setup();
    render(<NieuweCasusPage />);

    expect(await screen.findByRole("heading", { name: "Nieuwe casus" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Gemeente (woonplaatsbeginsel) *" }));
    expect(screen.getByText("Amsterdam")).toBeInTheDocument();
    expect(screen.getByText("Utrecht")).toBeInTheDocument();
  });

  it("requires a woonplaatsbeginsel before advancing the intake flow", async () => {
    const user = userEvent.setup();
    render(<NieuweCasusPage />);

    const nextButton = await screen.findByRole("button", { name: "Volgende stap" });
    await user.click(nextButton);
    expect(screen.getByText("Kies woonplaatsbeginsel, gewenste startdatum en uiterste plaatsingsdatum.")).toBeInTheDocument();

    await chooseMunicipality(user);
    await user.click(screen.getByRole("button", { name: "Volgende stap" }));
    expect(screen.getByRole("heading", { name: "Zorgvraag" })).toBeInTheDocument();
  });

  it("surfaces the persoonsbeeld blocker inline when step 2 cannot continue", async () => {
    const user = userEvent.setup();
    render(<NieuweCasusPage />);

    expect(await screen.findByRole("heading", { name: "Nieuwe casus" })).toBeInTheDocument();
    await chooseMunicipality(user);
    await user.click(screen.getByRole("button", { name: "Volgende stap" }));

    await user.selectOptions(screen.getByLabelText("Zorgbehoefte categorie *"), "WONEN_VERBLIJF");
    await user.selectOptions(screen.getByLabelText("Specifieke zorgbehoefte"), "WONEN_VERBLIJF_WOONVOORZIENING");
    await user.click(screen.getByRole("button", { name: /Binnen 1 week/i }));

    await user.click(screen.getByRole("button", { name: "Volgende" }));

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Je kunt nog niet verder");
    expect(alert).toHaveTextContent("Vul het persoonsbeeld in om door te gaan.");
  });

  it("supports keyboard navigation for choice groups and disclosure controls", async () => {
    const user = userEvent.setup();
    render(<NieuweCasusPage />);

    expect(await screen.findByRole("heading", { name: "Nieuwe casus" })).toBeInTheDocument();
    await chooseMunicipality(user);
    await user.click(screen.getByRole("button", { name: "Volgende stap" }));

    await user.selectOptions(screen.getByLabelText("Zorgbehoefte categorie *"), "WONEN_VERBLIJF");
    await user.selectOptions(screen.getByLabelText("Specifieke zorgbehoefte"), "WONEN_VERBLIJF_WOONVOORZIENING");
    expect(screen.getByLabelText("Specifieke zorgbehoefte")).toHaveValue("WONEN_VERBLIJF_WOONVOORZIENING");

    const guidanceToggle = screen.getByRole("button", { name: "Toelichting" });
    expect(guidanceToggle).toHaveAttribute("aria-controls", "nieuw-casus-page-guidance-dialog");
    await user.click(guidanceToggle);
    expect(screen.getByRole("dialog", { name: "Toelichting nieuwe casus" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Toelichting nieuwe casus" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Terug" }).length).toBe(1);
    expect(screen.getByRole("button", { name: "Vorige" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Volgende" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Waarom persoonsbeeld?" }));
    expect(screen.getByText("Beschrijf alleen de operationele context die nodig is voor beoordeling en matching.")).toBeInTheDocument();
    expect(screen.getByText("Laat namen, adressen, telefoons, e-mailadressen en BSN achterwege.")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /Plaatsingsdruk/i })).toBeInTheDocument();
    await user.click(screen.getByTestId("nieuwe-casus-zorgvraag-video"));
    const zorgvraagDialog = screen.getByRole("dialog", { name: "Zorgvraag" });
    expect(zorgvraagDialog).toBeInTheDocument();
    expect(within(zorgvraagDialog).getByText(/modelleer vervolgens de plaatsingsdruk/i)).toBeInTheDocument();
    expect(within(zorgvraagDialog).getByText(/Het systeem leidt hieruit de urgentie af/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
  }, 10000);

  it("restores draft progress after remount", async () => {
    const user = userEvent.setup();
    const firstRender = render(<NieuweCasusPage />);

    expect(await screen.findByRole("heading", { name: "Nieuwe casus" })).toBeInTheDocument();
    await chooseMunicipality(user);
    await user.click(screen.getByRole("button", { name: "Volgende stap" }));
    await user.selectOptions(screen.getByLabelText("Zorgbehoefte categorie *"), "WONEN_VERBLIJF");
    await user.selectOptions(screen.getByLabelText("Specifieke zorgbehoefte"), "WONEN_VERBLIJF_WOONVOORZIENING");

    firstRender.unmount();
    render(<NieuweCasusPage />);

    expect(await screen.findByRole("heading", { name: "Zorgvraag" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vorige" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Vorige" }));
    expect(screen.getByRole("button", { name: "Gemeente (woonplaatsbeginsel) *" })).toHaveTextContent("Utrecht");
    await user.click(screen.getByRole("button", { name: "Volgende stap" }));
    expect(screen.getByRole("heading", { name: "Zorgvraag" })).toBeInTheDocument();
    expect(screen.getByLabelText("Zorgbehoefte categorie *")).toHaveValue("WONEN_VERBLIJF");
    expect(screen.getByLabelText("Specifieke zorgbehoefte")).toHaveValue("WONEN_VERBLIJF_WOONVOORZIENING");
  });

  it("ignores legacy municipal region drafts and falls back to youth regions", async () => {
    memoryStorage.setItem(
      "carelane:nieuwe-casus-draft:v2",
      JSON.stringify({
        currentStep: 1,
        searchRadiusKm: 25,
        formState: {
          preferred_region_type: "GEMEENTELIJK",
          regio: "amsterdam-gemeentelijk",
          preferred_region: "amsterdam-gemeentelijk",
        },
      }),
    );

    render(<NieuweCasusPage />);

    expect(await screen.findByRole("heading", { name: "Nieuwe casus" })).toBeInTheDocument();
    expect(await screen.findByLabelText("Regio (afgeleid van gemeente)")).toHaveTextContent("Utrecht Stad");
    expect(screen.getByRole("button", { name: /Gemeente \(woonplaatsbeginsel\) \*/ })).toHaveTextContent("Zoek gemeente");
  });

  it("posts the woonplaatsbeginsel, source reference and urgency document on submit", async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValueOnce(makeHighUrgencyIntakeFormPayload());
    render(<NieuweCasusPage />);

    expect(await screen.findByRole("heading", { name: "Nieuwe casus" })).toBeInTheDocument();
    await chooseMunicipality(user);
    await user.click(await screen.findByRole("button", { name: "Volgende stap" }));
    await user.click(screen.getByRole("button", { name: /Binnen 1 week/i }));
    await user.selectOptions(screen.getByLabelText("Zorgbehoefte categorie *"), "WONEN_VERBLIJF");
    await user.selectOptions(screen.getByLabelText("Specifieke zorgbehoefte"), "WONEN_VERBLIJF_WOONVOORZIENING");
    await user.type(screen.getByLabelText("Persoonsbeeld *"), "Beschrijf hier het persoonsbeeld.");
    const safetyPressure = await screen.findByRole("checkbox", { name: /Veiligheidsdruk/i });
    await user.click(safetyPressure);
    expect((safetyPressure as HTMLInputElement).checked).toBe(true);
    await user.click(screen.getByRole("checkbox", { name: "Client heeft al een urgentieverklaring" }));
    await user.upload(
      screen.getByLabelText("Urgentieverklaring *"),
      new File(["urgent"], "urgentieverklaring.pdf", { type: "application/pdf" }),
    );
    await user.click(await screen.findByRole("button", { name: "Volgende" }));
    const createButtons = screen.getAllByRole("button", { name: "Casus aanmaken" });
    await user.click(createButtons[createButtons.length - 1]!);

    const [, body] = mockPost.mock.calls.at(-1) ?? [];
    expect(body).toBeInstanceOf(FormData);
    const formData = body as FormData;
    expect(formData.get("title")).toMatch(/^CO-\d{4}-[A-F0-9]{6}$/);
    expect(formData.get("gemeente")).toBe("utrecht");
    expect(formData.get("jeugdhulpregio")).toBe("utrecht-stad");
    expect(formData.get("regio")).toBe("utrecht-stad");
    expect(formData.get("preferred_region")).toBe("utrecht-stad");
    expect(formData.get("preferred_region_type")).toBe("JEUGDREGIO");
    expect(formData.get("source_reference")).toBe("");
    expect(["HIGH", "CRISIS"]).toContain(formData.get("urgency"));
    expect(formData.get("has_urgency_declaration")).toBe("true");
    expect(formData.get("placement_pressure_horizon")).toBe("1_WEEK");
    expect(formData.get("safety_pressure")).toBe("true");
    const urgencyDocument = formData.get("urgency_document");
    expect(urgencyDocument).toBeInstanceOf(File);
    expect((urgencyDocument as File).name).toBe("urgentieverklaring.pdf");
    expect(screen.getByText(/Let op: voeg deze Carelane referentiecode toe aan het dossier van uw client binnen uw ECD\./i)).toBeInTheDocument();
  }, 10000);

  it("shows advice and municipality link when the client has no urgency declaration", async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValueOnce(makeHighUrgencyIntakeFormPayload());
    render(<NieuweCasusPage />);

    expect(await screen.findByRole("heading", { name: "Nieuwe casus" })).toBeInTheDocument();
    await chooseMunicipality(user, "Aalten");
    await user.click(await screen.findByRole("button", { name: "Volgende stap" }));
    await user.click(screen.getByRole("button", { name: /Binnen 1 week/i }));
    const safetyPressure = await screen.findByRole("checkbox", { name: /Veiligheidsdruk/i });
    await user.click(safetyPressure);
    expect((safetyPressure as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole("link", { name: "Vraag urgentieverklaring aan" })).toHaveAttribute(
      "href",
      "https://www.aalten.nl/ontwerp-volkshuisvestingsprogramma",
    );
    expect(screen.getByRole("checkbox", { name: "Urgentieverklaring aangevraagd" })).not.toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "Urgentieverklaring aangevraagd" }));
    expect(screen.getByLabelText("Aangevraagd op")).toBeInTheDocument();

    expect(screen.getByRole("checkbox", { name: "Client heeft al een urgentieverklaring" })).not.toBeChecked();
    expect(screen.queryByLabelText("Urgentieverklaring *")).not.toBeInTheDocument();
    expect(screen.getByText("Vraag eerst een urgentieverklaring aan bij Aalten of het aangewezen loket.")).toBeInTheDocument();
  });
});
