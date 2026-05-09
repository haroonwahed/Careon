import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { AlertCircle, AlertTriangle, ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, ExternalLink, Loader2, Lock, Save, ShieldCheck } from "lucide-react";
import { apiClient } from "../../lib/apiClient";
import { SPA_DASHBOARD_URL, toCareCaseDetail, toCareSettingsSection } from "../../lib/routes";
import { Button } from "../ui/button";
import { Calendar } from "../ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

type Option = {
  value: string;
  label: string;
};

type SubcategoryOption = Option & {
  mainCategoryId: string;
};

type IntakeFormState = {
  title: string;
  start_date: string;
  target_completion_date: string;
  care_category_main: string;
  care_category_sub: string;
  assessment_summary: string;
  gemeente: string;
  regio: string;
  urgency: string;
  complexity: string;
  urgency_applied: boolean;
  urgency_applied_since: string;
  diagnostiek: string[];
  zorgvorm_gewenst: string;
  preferred_care_form: string;
  preferred_region_type: string;
  preferred_region: string;
  max_toelaatbare_wachttijd_dagen: string;
  leeftijd: string;
  setting_voorkeur: string;
  contra_indicaties: string;
  problematiek_types: string;
  client_age_category: string;
  family_situation: string;
  school_work_status: string;
  case_coordinator: string;
  description: string;
};

type IntakeFormPayload = {
  initial_values: IntakeFormState;
  options: {
    care_category_main: Option[];
    care_category_sub: SubcategoryOption[];
    gemeente: Option[];
    regio: Option[];
    urgency: Option[];
    complexity: Option[];
    diagnostiek: Option[];
    zorgvorm_gewenst: Option[];
    preferred_care_form: Option[];
    preferred_region_type: Option[];
    preferred_region: Option[];
    client_age_category: Option[];
    family_situation: Option[];
    case_coordinator: Option[];
  };
};

type IntakeCreateSuccess = {
  ok: boolean;
  id: number;
  case_id?: string;
  title: string;
  redirect_url: string;
};

type IntakeCreateError = {
  errors?: Record<string, string | string[]>;
};

type WorkflowPhase = "casus" | "matching" | "aanbieder_beoordeling" | "plaatsing" | "intake";
type VisibilityRole = "gemeente" | "zorgaanbieder" | "regie";

const baseFieldClass = "h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/50";
const baseTextareaClass = "w-full rounded-2xl border border-border bg-card px-3 py-3 text-sm text-foreground outline-none focus:border-primary/50";
const SOURCE_REGISTRATION_OPTIONS: Option[] = [
  { value: "gemeente_den_haag", label: "Gemeente Den Haag" },
  { value: "jeugdplatform", label: "Jeugdplatform" },
  { value: "veilig_thuis", label: "Veilig Thuis" },
  { value: "zorgmail_intake", label: "Zorgmail Intake" },
  { value: "handmatige_regiecasus", label: "Handmatige Regiecasus" },
];
const compactLabelClass = "mb-1 block text-[11px] font-medium tracking-[0.04em] text-muted-foreground";
const compactGroupLabelClass = "mb-2 text-[11px] font-medium tracking-[0.04em] text-muted-foreground";
const quietToggleClass = "inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/55 px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground";
const quietBadgeClass = "inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-primary/90";

interface NieuweCasusPageProps {
  onCancel?: () => void;
  onCreated?: (caseId: string) => void;
}

function FieldError({ message }: { message?: string | string[] }) {
  if (!message) {
    return null;
  }

  return (
    <p className="mt-1 text-xs font-medium text-red-400">
      {Array.isArray(message) ? message[0] : message}
    </p>
  );
}

function SectionHeader({ step, title, copy }: { step: string; title: string; copy?: string }) {
  const [showCopy, setShowCopy] = useState(false);
  const copyId = `nieuw-casus-${step}-copy`;

  return (
    <div className="mb-3 flex items-start gap-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/5 text-[11px] font-semibold text-primary/90">
        {step}
      </div>
      <div>
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg font-semibold text-foreground md:text-xl">{title}</h2>
          {copy && (
            <button
              type="button"
              onClick={() => setShowCopy((current) => !current)}
              className={quietToggleClass}
              aria-expanded={showCopy}
              aria-controls={copyId}
            >
              <CircleHelp size={12} />
              Waarom?
              <ChevronDown size={12} className={showCopy ? "rotate-180 transition-transform" : "transition-transform"} />
            </button>
          )}
        </div>
        {copy && showCopy && <p id={copyId} className="mt-2 rounded-xl border border-border/70 bg-muted/15 px-3 py-2 text-sm text-muted-foreground">{copy}</p>}
      </div>
    </div>
  );
}

function parseDateValue(value: string): Date | undefined {
  if (!value) {
    return undefined;
  }

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!year || !month || !day) {
    return undefined;
  }

  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed;
}

function formatDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateDisplayValue(value: string): string {
  const parsed = parseDateValue(value);
  if (!parsed) {
    return "dd/mm/jjjj";
  }

  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function buildReference(prefix: "CO" | "TMP", now = new Date()): string {
  const year = now.getFullYear();
  const randomChunk = (() => {
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(4);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 6);
    }
    return Math.random().toString(16).slice(2, 8).padEnd(6, "0");
  })().toUpperCase();
  const serial = randomChunk;
  return `${prefix}-${year}-${serial}`;
}

function extractValidationErrors(error: unknown): Record<string, string | string[]> | null {
  if (!(error instanceof Error)) {
    return null;
  }
  const match = error.message.match(/API fout \d+:\s*(.*)$/s);
  const rawPayload = match ? match[1] : "";
  if (!rawPayload) {
    return null;
  }
  try {
    const parsed = JSON.parse(rawPayload) as IntakeCreateError;
    return parsed.errors ?? null;
  } catch {
    return null;
  }
}

function daysBetween(startDate: string, endDate: string): number | null {
  const start = parseDateValue(startDate);
  const end = parseDateValue(endDate);
  if (!start || !end) {
    return null;
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / msPerDay));
}

function selectFieldOptions(options: Option[], placeholder?: string) {
  return (
    <>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </>
  );
}

interface DateFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | string[];
}

function DateField({ label, value, onChange, error }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const selectedDate = parseDateValue(value);

  return (
    <div>
      <label className={compactLabelClass}>{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`${baseFieldClass} flex items-center justify-between text-left`}
            aria-label={label}
          >
            <span className={value ? "text-foreground" : "text-muted-foreground"}>{formatDateDisplayValue(value)}</span>
            <CalendarDays size={16} className="text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto rounded-2xl border border-border/80 bg-card p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              if (!date) {
                return;
              }
              onChange(formatDateInputValue(date));
              setOpen(false);
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      <FieldError message={error} />
    </div>
  );
}

export function NieuweCasusPage({ onCancel, onCreated }: NieuweCasusPageProps) {
  const [formState, setFormState] = useState<IntakeFormState | null>(null);
  const [options, setOptions] = useState<IntakeFormPayload["options"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string | string[]>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPageGuidance, setShowPageGuidance] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [stepError, setStepError] = useState<string | null>(null);
  const [searchRadiusKm, setSearchRadiusKm] = useState<10 | 25 | 50>(25);
  const [sourceRegistration, setSourceRegistration] = useState("");
  const [sourceReference, setSourceReference] = useState("");
  const [careonReference] = useState(() => buildReference("CO"));
  const [tempReference] = useState(() => buildReference("TMP"));
  const [previewPhase, setPreviewPhase] = useState<WorkflowPhase>("casus");
  const [previewRole, setPreviewRole] = useState<VisibilityRole>("gemeente");
  const [revealRequested, setRevealRequested] = useState(false);
  const [showRevealPreview, setShowRevealPreview] = useState(false);
  const [showControleDetails, setShowControleDetails] = useState(false);
  const pageGuidanceId = "nieuw-casus-page-guidance";
  const revealPreviewId = "nieuw-casus-reveal-preview";
  const controleDetailsId = "nieuw-casus-controle-details";

  const stepMeta: Array<{ id: 1 | 2 | 3; title: string; subtitle: string }> = [
    { id: 1, title: "Basis", subtitle: "Koppel bronregistratie" },
    { id: 2, title: "Zorgvraag", subtitle: "Vul zorgvraag in" },
    { id: 3, title: "Randvoorwaarden", subtitle: "Controle en afronding" },
  ];

  useEffect(() => {
    let ignore = false;

    const bootstrap = async () => {
      try {
        const payload = await apiClient.get<IntakeFormPayload>("/care/api/cases/intake-form/");
        if (ignore) {
          return;
        }

        const today = new Date();
        const nextWeek = addDays(today, 7);
        const urgencyDefault = payload.options.urgency.find((option) => option.value.toLowerCase().includes("medium"))?.value
          ?? payload.options.urgency[0]?.value
          ?? "";

        const complexityDefault = payload.options.complexity.find((option) => option.value.toLowerCase().includes("medium"))?.value
          ?? payload.options.complexity[0]?.value
          ?? "";

        const preferredRegionTypeDefault = payload.options.preferred_region_type[0]?.value ?? "";
        const preferredCareFormDefault = payload.options.preferred_care_form[0]?.value
          ?? payload.options.zorgvorm_gewenst[0]?.value
          ?? "";

        const regionDefault = payload.initial_values.regio
          || payload.options.regio[0]?.value
          || payload.options.preferred_region[0]?.value
          || "";

        const withDefaults: IntakeFormState = {
          ...payload.initial_values,
          start_date: payload.initial_values.start_date || formatDateInputValue(today),
          target_completion_date: payload.initial_values.target_completion_date || formatDateInputValue(nextWeek),
          urgency: payload.initial_values.urgency || urgencyDefault,
          complexity: payload.initial_values.complexity || complexityDefault,
          preferred_region_type: payload.initial_values.preferred_region_type || preferredRegionTypeDefault,
          preferred_care_form: payload.initial_values.preferred_care_form || preferredCareFormDefault,
          zorgvorm_gewenst: payload.initial_values.zorgvorm_gewenst || preferredCareFormDefault,
          regio: payload.initial_values.regio || regionDefault,
          preferred_region: payload.initial_values.preferred_region || regionDefault,
          max_toelaatbare_wachttijd_dagen: payload.initial_values.max_toelaatbare_wachttijd_dagen || "7",
        };

        setFormState(withDefaults);
        setOptions(payload.options);
      } catch (error) {
        if (!ignore) {
          setLoadError(error instanceof Error ? error.message : "Kon het intakeformulier niet laden.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    bootstrap();
    return () => {
      ignore = true;
    };
  }, []);

  const visibleSubcategories = useMemo(() => {
    if (!options || !formState) {
      return [];
    }
    return options.care_category_sub.filter((option) => option.mainCategoryId === formState.care_category_main);
  }, [options, formState]);

  const deadlineDays = useMemo(() => {
    if (!formState) {
      return null;
    }
    return daysBetween(formState.start_date, formState.target_completion_date);
  }, [formState]);

  const matchingPreview = useMemo(() => {
    if (!formState) {
      return { label: "Medium", tone: "warning" as const, score: 2, detail: "Vul de intake volledig in voor een scherpere voorspelling." };
    }

    let score = 0;
    const urgency = formState.urgency.toLowerCase();
    const complexity = formState.complexity.toLowerCase();

    if (urgency.includes("critical") || urgency.includes("high")) {
      score += 3;
    } else if (urgency.includes("medium")) {
      score += 1;
    }
    if (complexity.includes("high")) {
      score += 3;
    } else if (complexity.includes("medium")) {
      score += 1;
    }
    if ((deadlineDays ?? 7) <= 3) {
      score += 3;
    } else if ((deadlineDays ?? 7) <= 7) {
      score += 2;
    } else if ((deadlineDays ?? 7) <= 14) {
      score += 1;
    }
    if (!formState.care_category_sub) {
      score += 1;
    }
    if (searchRadiusKm <= 10) {
      score += 2;
    } else if (searchRadiusKm <= 25) {
      score += 1;
    }
    if (formState.diagnostiek.length >= 3) {
      score += 1;
    }
    if (formState.preferred_region_type.toLowerCase().includes("lokaal")) {
      score += 1;
    }
    if ((formState.assessment_summary ?? "").trim().length >= 100) {
      score -= 1;
    }

    if (score >= 9) {
      return { label: "Difficult", tone: "critical" as const, score, detail: "Hoge complexiteit. Match lastig." };
    }
    if (score >= 5) {
      return { label: "Medium", tone: "warning" as const, score, detail: "Matchbaar, maar strak sturen." };
    }
    return { label: "Good", tone: "good" as const, score, detail: "Goede uitgangspositie." };
  }, [deadlineDays, formState, searchRadiusKm]);

  const urgencyHint = useMemo(() => {
    if (!formState) {
      return "Kies urgentie op risico.";
    }

    const complexity = formState.complexity.toLowerCase();
    const urgency = formState.urgency.toLowerCase();
    if (complexity.includes("high") && !(urgency.includes("high") || urgency.includes("critical"))) {
      return "Overweeg hogere urgentie.";
    }
    if ((deadlineDays ?? 7) <= 3 && !urgency.includes("critical")) {
      return "Korte deadline: check urgentie.";
    }
    return "Urgentie past bij de intake.";
  }, [deadlineDays, formState]);

  const regionCapacityHint = useMemo(() => {
    if (!formState) {
      return "";
    }
    if (!formState.preferred_region && !formState.regio) {
      return "Kies een regio.";
    }
    if (searchRadiusKm <= 10) {
      return "Kleine radius geeft krapte.";
    }
    if (matchingPreview.tone === "critical") {
      return "Capaciteit krap. Vergroot regio.";
    }
    return "Regio ondersteunt matching.";
  }, [formState, matchingPreview.tone, searchRadiusKm]);

  const updateField = <K extends keyof IntakeFormState>(field: K, value: IntakeFormState[K]) => {
    setFormState((current) => current ? { ...current, [field]: value } : current);
    setFormErrors((current) => {
      if (!(field in current)) {
        return current;
      }
      const nextErrors = { ...current };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  const handleRadioKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    choices: Option[],
    value: string,
    onSelect: (nextValue: string) => void,
  ) => {
    const keys = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"];
    if (!keys.includes(event.key)) {
      return;
    }

    event.preventDefault();
    const currentIndex = choices.findIndex((choice) => choice.value === value);
    if (currentIndex < 0 || choices.length === 0) {
      return;
    }

    let nextIndex = currentIndex;
    if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = choices.length - 1;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + choices.length) % choices.length;
    } else {
      nextIndex = (currentIndex + 1) % choices.length;
    }

    const nextValue = choices[nextIndex]?.value;
    if (nextValue) {
      onSelect(nextValue);
      const container = event.currentTarget.closest('[role="radiogroup"]');
      const safeValue = nextValue.replace(/"/g, '\\"');
      const nextButton = container?.querySelector<HTMLButtonElement>(`button[data-radio-value="${safeValue}"]`);
      nextButton?.focus();
    }
  };

  const toggleDiagnostiek = (value: string) => {
    setFormState((current) => {
      if (!current) {
        return current;
      }
      const exists = current.diagnostiek.includes(value);
      return {
        ...current,
        diagnostiek: exists
          ? current.diagnostiek.filter((entry) => entry !== value)
          : [...current.diagnostiek, value],
      };
    });
  };

  const handleSubmit = async () => {
    if (!formState) {
      return;
    }

    setSaving(true);
    setFormErrors({});
    setSuccessMessage(null);
    setLoadError(null);

    try {
      const isManualRegieCase = sourceRegistration === "handmatige_regiecasus";
      const resolvedReference = isManualRegieCase ? tempReference : sourceReference.trim();
      const sourceLabel = SOURCE_REGISTRATION_OPTIONS.find((option) => option.value === sourceRegistration)?.label ?? sourceRegistration;
      const orchestrationNotice =
        `Regiecasus: ${careonReference}\n` +
        `Bronregistratie: ${sourceLabel || "onbekend"}\n` +
        `Bronreferentie: ${resolvedReference || "onbekend"}\n` +
        `Privacy: persoonsgegevens blijven in het bronsysteem tot formele koppeling/intake.`;
      const payload = await apiClient.post<IntakeCreateSuccess>("/care/api/cases/intake-create/", {
        ...formState,
        title: careonReference,
        assessment_summary: [formState.assessment_summary?.trim(), orchestrationNotice].filter(Boolean).join("\n\n"),
      });
      const createdCaseId = payload.case_id?.trim();
      setSuccessMessage(`Casus ${payload.title} is aangemaakt. Je wordt doorgestuurd naar het nieuwe regietraject.`);
      const target =
        payload.redirect_url ||
        (createdCaseId ? toCareCaseDetail(createdCaseId) : `${SPA_DASHBOARD_URL}?page=casussen`);
      if (createdCaseId) {
        onCreated?.(createdCaseId);
      }
      window.location.href = target;
    } catch (error) {
      const validationErrors = extractValidationErrors(error);
      if (validationErrors) {
        setFormErrors(validationErrors);
      } else {
        const responseText = error instanceof Error ? error.message : "Opslaan is mislukt.";
        setLoadError(responseText || "Opslaan is mislukt. Controleer de invoer en probeer opnieuw.");
      }
    } finally {
      setSaving(false);
    }
  };

  const setDeadlinePreset = (days: 3 | 7 | 14) => {
    if (!formState) {
      return;
    }
    const fromDate = parseDateValue(formState.start_date) ?? new Date();
    updateField("target_completion_date", formatDateInputValue(addDays(fromDate, days)));
  };

  const validateStep = (step: 1 | 2 | 3): boolean => {
    if (!formState) {
      return false;
    }

    if (step === 1) {
      const isManualRegieCase = sourceRegistration === "handmatige_regiecasus";
      if (!sourceRegistration || (!isManualRegieCase && !sourceReference.trim()) || !formState.start_date || !formState.target_completion_date) {
        setStepError("Kies bronregistratie, bronreferentie (of handmatige regiecasus), startdatum en deadline matching.");
        return false;
      }
    }

    if (step === 2) {
      if (!formState.care_category_main || !formState.complexity || !formState.urgency) {
        setStepError("Kies hoofdcategorie, complexiteit en urgentie om door te gaan.");
        return false;
      }
    }

    if (step === 3) {
      if (!formState.regio && !formState.preferred_region) {
        setStepError("Kies minimaal een regio binnen de randvoorwaarden.");
        return false;
      }
    }

    setStepError(null);
    return true;
  };

  const jumpToStep = (targetStep: 1 | 2 | 3) => {
    if (targetStep === currentStep) {
      return;
    }

    if (targetStep > currentStep && !validateStep(currentStep)) {
      return;
    }

    setStepError(null);
    setCurrentStep(targetStep);
  };

  if (loading) {
    return (
      <div className="panel-surface flex min-h-[320px] items-center justify-center rounded-[28px] border border-border/70 p-4">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 size={18} className="animate-spin" />
          Intakeformulier laden...
        </div>
      </div>
    );
  }

  if (loadError || !formState || !options) {
    return (
      <div className="panel-surface rounded-[28px] border border-red-500/20 p-4">
        <div className="flex items-start gap-3 text-red-300">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">Nieuwe casus kon niet worden geladen</h1>
            <p className="mt-2 text-sm text-muted-foreground">{loadError ?? "Er is een onverwacht probleem opgetreden."}</p>
          </div>
        </div>
      </div>
    );
  }

  const canRevealIdentity = previewPhase === "plaatsing" || previewPhase === "intake";
  const maskedIdentity = `${careonReference} · afgeschermd`;
  const revealedIdentity = sourceReference.trim() || tempReference;
  const isManualRegieCase = sourceRegistration === "handmatige_regiecasus";
  const identityDisplay =
    previewRole === "zorgaanbieder" && !canRevealIdentity
      ? maskedIdentity
      : canRevealIdentity && revealRequested
        ? revealedIdentity
        : maskedIdentity;

  const visibilityRows: Array<{
    phase: WorkflowPhase;
    label: string;
    gemeente: string;
    zorgaanbieder: string;
    regie: string;
  }> = [
    {
      phase: "casus",
      label: "Casus",
      gemeente: "CAS-ID, CLI-ID, zorgvraag, urgentie",
      zorgaanbieder: "Niet zichtbaar",
      regie: "Alleen pseudonieme metadata",
    },
    {
      phase: "matching",
      label: "Matching",
      gemeente: "Leeftijdscategorie, regio, zorgvraag, urgentie",
      zorgaanbieder: "Leeftijdscategorie + regio (geen NAW)",
      regie: "Need-to-know risicosignalen",
    },
    {
      phase: "aanbieder_beoordeling",
      label: "Aanbieder beoordeling",
      gemeente: "Casuscontext + advies",
      zorgaanbieder: "Beperkt profiel + pseudoniem",
      regie: "Processtatus en blokkades",
    },
    {
      phase: "plaatsing",
      label: "Plaatsing",
      gemeente: "Gecontroleerde reveal mogelijk",
      zorgaanbieder: "Reveal op autorisatie + audit",
      regie: "Audit + toestemmingstatus",
    },
    {
      phase: "intake",
      label: "Intake",
      gemeente: "Volledige gegevens voor geautoriseerde rollen",
      zorgaanbieder: "Volledige gegevens na acceptatie",
      regie: "Alleen noodzakelijke regievelden",
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-4 md:space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <div className={quietBadgeClass}>
            Intake
            <ChevronRight size={11} className="opacity-80" aria-hidden />
            Nieuwe casus
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Nieuwe casus</h1>
            <button
              type="button"
              onClick={() => setShowPageGuidance((current) => !current)}
              className={quietToggleClass}
              aria-expanded={showPageGuidance}
              aria-controls={pageGuidanceId}
            >
              <CircleHelp size={12} />
              Toelichting
              <ChevronDown size={12} className={showPageGuidance ? "rotate-180 transition-transform" : "transition-transform"} />
            </button>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:pt-1">
          <Button variant="outline" className="h-10 gap-2 rounded-xl px-4 text-[13px] font-semibold" onClick={() => onCancel?.()}>
            <ArrowLeft size={15} />
            Terug
          </Button>
        </div>
      </div>

      {showPageGuidance && (
        <div id={pageGuidanceId} className="space-y-2 rounded-xl border border-border/70 bg-muted/10 px-4 py-2.5 text-sm text-muted-foreground">
          <p>Vul alleen kerngegevens in; details blijven in het bronsysteem.</p>
          <p className="text-foreground">Velden met * zijn verplicht.</p>
        </div>
      )}

      {formErrors.__all__ && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3">
          <div className="flex items-start gap-3 text-red-300">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Controleer de invoer</p>
              <FieldError message={formErrors.__all__} />
            </div>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <div className="flex items-start gap-3 text-emerald-300">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <p className="text-sm">{successMessage}</p>
          </div>
        </div>
      )}

      <section className="panel-surface rounded-[24px] border border-border/70 p-5 shadow-sm md:p-6">
        <div className="mb-4">
          <div className="mb-2.5 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            <span>Stap {currentStep} van 3</span>
            <span className="tabular-nums text-foreground/90">{Math.round((currentStep / 3) * 100)}%</span>
          </div>
          <div className="mb-2.5 grid grid-cols-1 gap-2.5 md:grid-cols-3">
            {stepMeta.map((step) => {
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              return (
                <button
                  key={step.id}
                  type="button"
                  aria-current={isActive ? "step" : undefined}
                  aria-label={`Stap ${step.id}: ${step.title}`}
                  onClick={() => {
                    if (isCompleted || isActive) {
                      jumpToStep(step.id);
                    }
                  }}
                  disabled={!isCompleted && !isActive}
                  className={`min-h-[4rem] rounded-xl border px-3 py-2 text-left transition-colors ${isActive ? "border-primary/30 bg-primary/5 text-primary/90 ring-1 ring-primary/15" : isCompleted ? "border-emerald-500/25 bg-emerald-500/6 text-emerald-300 hover:border-emerald-400/35" : "border-border/60 bg-card/35 text-muted-foreground/70"}`}
                >
                  <span className="mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-current/30 text-[10px] font-semibold">
                    {step.id}
                  </span>
                  <span className="block text-[13px] font-semibold">{step.title}</span>
                  <span className="block text-[10px] font-medium opacity-85">{step.subtitle}</span>
                </button>
              );
            })}
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted/35"
            role="progressbar"
            aria-label="Voortgang nieuwe casus"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round((currentStep / 3) * 100)}
            aria-valuetext={`Stap ${currentStep} van 3`}
          >
            <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${(currentStep / 3) * 100}%` }} />
          </div>
        </div>

        {currentStep === 1 && (
          <div className="space-y-4">
            {/*
             * Privacy ribbon — surfaces the minimal-data principle BEFORE the user
             * encounters any input field. Reinforces that CareOn is a regielaag
             * (coördinatie + verwijzing) and not a centraal cliëntdossier.
             */}
            <div
              role="note"
              aria-label="Privacy en gegevensgebruik"
              className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/45 px-4 py-3 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-4"
              data-testid="nieuwe-casus-privacy-ribbon"
            >
              <div className="flex min-w-0 items-start gap-3">
                <ShieldCheck size={18} className="mt-0.5 shrink-0 text-primary/80" aria-hidden />
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold text-foreground">CareOn registreert alleen het minimum voor regie</p>
                  <p className="text-muted-foreground">
                    Bronregistratie, referentie, regio en zorgvraag zijn genoeg; persoonsgegevens blijven bij de bron.
                  </p>
                </div>
              </div>
              <a
                href={toCareSettingsSection("documenten-privacy")}
                className="inline-flex shrink-0 items-center gap-1.5 self-start text-[12px] font-semibold text-primary underline-offset-4 hover:text-primary/80 hover:underline sm:self-center"
              >
                Meer over gegevensbeheer
                <ExternalLink size={14} className="opacity-90" aria-hidden />
              </a>
            </div>

            <div className="rounded-2xl border border-border/55 bg-card/35 p-5 md:p-6">
            <SectionHeader step="1" title="Bronregistratie koppelen" copy="Koppel de bronregistratie en minimale referentie voor ketenregie." />

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={compactLabelClass}>Bronregistratie *</label>
                <select
                  value={sourceRegistration}
                  onChange={(event) => {
                    setSourceRegistration(event.target.value);
                    if (event.target.value === "handmatige_regiecasus") {
                      setSourceReference("");
                    }
                  }}
                  className={baseFieldClass}
                  aria-label="Bronregistratie *"
                >
                  <option value="">Selecteer bronregistratie</option>
                  {SOURCE_REGISTRATION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={compactLabelClass}>
                  Zoek bronreferentie {isManualRegieCase ? "" : "*"}
                </label>
                <input
                  value={sourceReference}
                  onChange={(event) => setSourceReference(event.target.value)}
                  className={baseFieldClass}
                  placeholder="Bijv. ZS-2026-8821"
                  disabled={isManualRegieCase}
                  aria-label={`Zoek bronreferentie ${isManualRegieCase ? "" : "*"}`.trim()}
                />
                <p className="mt-1 text-xs text-muted-foreground">Alleen minimale referentie voor ketenregie.</p>
              </div>
            </div>
            {isManualRegieCase && (
              <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/5 px-4 py-3 text-sm text-cyan-100">
                <p className="font-semibold">Handmatige regiecasus zonder bronkoppeling</p>
                <p className="mt-1 text-cyan-200/90">
                  Tijdelijke referentie: <span className="font-semibold">{tempReference}</span>. Geen persoonsgegevens vereist; koppeling kan later.
                </p>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="careon-casusreferentie"
                  className={compactLabelClass}
                >
                  CareOn casusreferentie
                </label>
                <input
                  id="careon-casusreferentie"
                  value={careonReference}
                  className={baseFieldClass}
                  readOnly
                />
                <p className="mt-1 text-xs text-muted-foreground">Automatisch gegenereerd.</p>
              </div>
              <DateField
                label="Startdatum casus *"
                value={formState.start_date}
                onChange={(nextValue) => updateField("start_date", nextValue)}
                error={formErrors.start_date}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <DateField
                  label="Deadline matching *"
                  value={formState.target_completion_date}
                  onChange={(nextValue) => updateField("target_completion_date", nextValue)}
                  error={formErrors.target_completion_date}
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[3, 7, 14].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setDeadlinePreset(days as 3 | 7 | 14)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${deadlineDays === days ? "border-primary/30 bg-primary/5 text-foreground" : "border-border/70 bg-card/30 text-muted-foreground hover:border-primary/25 hover:text-foreground"}`}
                    >
                      {days} dagen
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-card/30">
                    <Lock size={14} className="text-muted-foreground" aria-hidden />
                  </span>
                  <div>
                    <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground">Zichtbaarheid</p>
                    <p className="mt-1.5 text-sm leading-snug text-muted-foreground">
                      Persoonsgegevens blijven in het bronsysteem tot formele koppeling of intake.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-3">
            <SectionHeader step="2" title="Zorgvraag" copy="Maak de vraag concreet." />

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={compactLabelClass}>Hoofdcategorie *</label>
                <select
                  value={formState.care_category_main}
                  onChange={(event) => {
                    updateField("care_category_main", event.target.value);
                    updateField("care_category_sub", "");
                  }}
                  className={baseFieldClass}
                >
                  <option value="">Selecteer</option>
                  {options.care_category_main.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <FieldError message={formErrors.care_category_main} />
              </div>

              <div>
                <label className={compactLabelClass}>Subcategorie</label>
                <select
                  value={formState.care_category_sub}
                  onChange={(event) => updateField("care_category_sub", event.target.value)}
                  className={baseFieldClass}
                  disabled={!formState.care_category_main}
                >
                  <option value="">Selecteer</option>
                  {visibleSubcategories.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <FieldError message={formErrors.care_category_sub} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className={compactGroupLabelClass}>Complexiteit *</p>
                <p className="mb-2 text-xs text-muted-foreground">Kies 1 optie</p>
                <div className="grid gap-2" role="radiogroup" aria-label="Complexiteit">
                  {options.complexity.map((option) => {
                    const active = formState.complexity === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        data-radio-value={option.value}
                        onClick={() => updateField("complexity", option.value)}
                        onKeyDown={(event) => handleRadioKeyDown(event, options.complexity, formState.complexity, (nextValue) => updateField("complexity", nextValue))}
                        role="radio"
                        aria-checked={active}
                        tabIndex={active ? 0 : -1}
                        className={`rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${active ? "border-primary/30 bg-primary/5 text-foreground" : "border-border/70 bg-card/30 text-muted-foreground hover:border-primary/25 hover:text-foreground"}`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <FieldError message={formErrors.complexity} />
              </div>

              <div>
                <p className={compactGroupLabelClass}>Urgentie *</p>
                <p className="mb-2 text-xs text-muted-foreground">Kies 1 optie</p>
                <div className="grid gap-2" role="radiogroup" aria-label="Urgentie">
                  {options.urgency.map((option) => {
                    const active = formState.urgency === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        data-radio-value={option.value}
                        onClick={() => updateField("urgency", option.value)}
                        onKeyDown={(event) => handleRadioKeyDown(event, options.urgency, formState.urgency, (nextValue) => updateField("urgency", nextValue))}
                        role="radio"
                        aria-checked={active}
                        tabIndex={active ? 0 : -1}
                        className={`rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${active ? "border-primary/30 bg-primary/5 text-foreground" : "border-border/70 bg-card/30 text-muted-foreground hover:border-primary/25 hover:text-foreground"}`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <FieldError message={formErrors.urgency} />
              </div>
            </div>

            <div>
              <label className={compactLabelClass}>Toelichting (optioneel)</label>
              <textarea
                value={formState.assessment_summary}
                onChange={(event) => updateField("assessment_summary", event.target.value)}
                className={`${baseTextareaClass} min-h-28`}
                placeholder="Beschrijf kort context of aandachtspunten voor beoordeling en matching"
              />
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Urgentiesuggestie</p>
              <p className="mt-1 text-foreground/90">{urgencyHint}</p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Zichtbaarheid per fase</p>
                <button
                  type="button"
                  onClick={() => setShowRevealPreview((current) => !current)}
                  className={quietToggleClass}
                  aria-expanded={showRevealPreview}
                  aria-controls={revealPreviewId}
                >
                  {showRevealPreview ? "Verberg details" : "Toon details"}
                  <ChevronDown size={12} className={showRevealPreview ? "rotate-180 transition-transform" : "transition-transform"} />
                </button>
              </div>
              {showRevealPreview ? (
                <div id={revealPreviewId} className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[720px] border-separate border-spacing-y-2 text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-[0.08em] text-muted-foreground">
                        <th className="px-3">Fase</th>
                        <th className="px-3">Gemeente</th>
                        <th className="px-3">Zorgaanbieder</th>
                        <th className="px-3">Regie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibilityRows.map((row) => (
                        <tr key={row.phase} className="rounded-xl border border-border/50 bg-card/30">
                          <td className="px-3 py-2 font-semibold text-foreground">{row.label}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.gemeente}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.zorgaanbieder}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.regie}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Standaard: alleen pseudonieme gegevens tot plaatsing/intake.</p>
              )}
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-3">
            <SectionHeader step="3" title="Randvoorwaarden" copy="Bepaal de zoekruimte." />

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={compactLabelClass}>Regio *</label>
                <select
                  value={formState.regio}
                  onChange={(event) => {
                    updateField("regio", event.target.value);
                    if (!formState.preferred_region) {
                      updateField("preferred_region", event.target.value);
                    }
                  }}
                  className={baseFieldClass}
                >
                  <option value="">Selecteer regio</option>
                  {options.regio.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <FieldError message={formErrors.regio} />
              </div>

              <div>
                <label className={compactLabelClass}>Zoekradius</label>
                <div className="flex gap-1.5 pt-1">
                  {[10, 25, 50].map((radius) => (
                    <button
                      key={radius}
                      type="button"
                      onClick={() => setSearchRadiusKm(radius as 10 | 25 | 50)}
                      className={`rounded-full border px-2.5 py-1.5 text-[11px] font-medium ${searchRadiusKm === radius ? "border-primary/30 bg-primary/5 text-foreground" : "border-border/70 bg-card/30 text-muted-foreground hover:border-primary/25 hover:text-foreground"}`}
                    >
                      {radius} km
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <p className={compactGroupLabelClass}>Beperkingen</p>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {options.diagnostiek.map((option) => {
                  const active = formState.diagnostiek.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleDiagnostiek(option.value)}
                      className={`rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${active ? "border-primary/30 bg-primary/5 text-foreground" : "border-border/70 bg-card/30 text-muted-foreground hover:border-primary/25 hover:text-foreground"}`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
              <p className={compactGroupLabelClass}>Matchverwachting</p>
              <div className="mt-2 flex items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${matchingPreview.tone === "good" ? "bg-green-500/10 text-green-300" : matchingPreview.tone === "warning" ? "bg-yellow-500/10 text-yellow-300" : "bg-red-500/10 text-red-300"}`}>
                  {matchingPreview.label}
                </span>
                <span className="text-sm text-muted-foreground">{matchingPreview.detail}</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{regionCapacityHint}</p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Gecontroleerde identiteitsweergave</p>
                <div className="flex items-center gap-2">
                  <select
                    value={previewRole}
                    onChange={(event) => setPreviewRole(event.target.value as VisibilityRole)}
                    className="h-9 rounded-xl border border-border/70 bg-background px-2 text-xs text-foreground"
                    aria-label="Preview rol"
                  >
                    <option value="gemeente">Gemeente</option>
                    <option value="zorgaanbieder">Zorgaanbieder</option>
                    <option value="regie">Regie</option>
                  </select>
                  <select
                    value={previewPhase}
                    onChange={(event) => setPreviewPhase(event.target.value as WorkflowPhase)}
                    className="h-9 rounded-xl border border-border/70 bg-background px-2 text-xs text-foreground"
                    aria-label="Preview fase"
                  >
                    <option value="casus">Casus</option>
                    <option value="matching">Matching</option>
                    <option value="aanbieder_beoordeling">Aanbieder beoordeling</option>
                    <option value="plaatsing">Plaatsing</option>
                    <option value="intake">Intake</option>
                  </select>
                </div>
              </div>
              <div className="mt-3 rounded-xl border border-border/60 bg-card/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">Zichtbare identiteit</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{identityDisplay}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {canRevealIdentity
                    ? "Reveal toegestaan in deze fase. Event wordt auditbaar gelogd."
                    : "Reveal geblokkeerd: alleen pseudoniem zichtbaar op basis van need-to-know."}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-xl border-border/70 px-3 text-xs font-semibold"
                  onClick={() => setRevealRequested((current) => !current)}
                  disabled={!canRevealIdentity}
                >
                  {revealRequested ? "Verberg identiteit" : "Reveal identiteit"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  Auditstatus: {revealRequested && canRevealIdentity ? "Reveal aangevraagd (log klaar)" : "Geen reveal event"}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Controle</p>
                <button
                  type="button"
                  onClick={() => setShowControleDetails((current) => !current)}
                  className={quietToggleClass}
                  aria-expanded={showControleDetails}
                  aria-controls={controleDetailsId}
                >
                  {showControleDetails ? "Minder details" : "Toon details"}
                  <ChevronDown size={12} className={showControleDetails ? "rotate-180 transition-transform" : "transition-transform"} />
                </button>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-foreground md:grid-cols-2">
                <p><span className="text-muted-foreground">Bronregistratie:</span> {SOURCE_REGISTRATION_OPTIONS.find((o) => o.value === sourceRegistration)?.label ?? "-"}</p>
                <p><span className="text-muted-foreground">CareOn referentie:</span> {careonReference}</p>
                <p><span className="text-muted-foreground">Regio:</span> {(options.regio.find((o) => o.value === formState.regio)?.label ?? formState.regio) || "-"}</p>
                <p><span className="text-muted-foreground">Urgentie:</span> {options.urgency.find((o) => o.value === formState.urgency)?.label ?? "-"}</p>
              </div>
              {showControleDetails ? (
                <div id={controleDetailsId} className="mt-3 grid gap-3 text-sm text-foreground md:grid-cols-2">
                  <p><span className="text-muted-foreground">Bronreferentie:</span> {isManualRegieCase ? tempReference : (sourceReference || "-")}</p>
                  <p><span className="text-muted-foreground">Gecontroleerde toegang:</span> {identityDisplay}</p>
                  <p><span className="text-muted-foreground">Start:</span> {formatDateDisplayValue(formState.start_date)}</p>
                  <p><span className="text-muted-foreground">Deadline:</span> {formatDateDisplayValue(formState.target_completion_date)}</p>
                  <p><span className="text-muted-foreground">Hoofd:</span> {options.care_category_main.find((o) => o.value === formState.care_category_main)?.label ?? "-"}</p>
                  <p><span className="text-muted-foreground">Sub:</span> {visibleSubcategories.find((o) => o.value === formState.care_category_sub)?.label ?? "-"}</p>
                  <p><span className="text-muted-foreground">Complex:</span> {options.complexity.find((o) => o.value === formState.complexity)?.label ?? "-"}</p>
                  <p><span className="text-muted-foreground">Radius:</span> {searchRadiusKm} km</p>
                  <p className="md:col-span-2"><span className="text-muted-foreground">Beperkingen:</span> {formState.diagnostiek.length > 0 ? formState.diagnostiek.map((value) => options.diagnostiek.find((o) => o.value === value)?.label ?? value).join(", ") : "Geen"}</p>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </section>

      {stepError && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <p>{stepError}</p>
          </div>
        </div>
      )}

      <div className="panel-surface rounded-[20px] border border-border/70 bg-card/60 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="outline" className="h-11 min-h-11 gap-2 rounded-xl px-4 text-[13px] font-semibold" onClick={() => onCancel?.()}>
            <ArrowLeft size={15} />
            Terug
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            {currentStep > 1 && (
              <Button
                variant="outline"
                className="h-11 min-h-11 gap-2 rounded-xl px-4 text-[13px] font-semibold"
                onClick={() => {
                  setStepError(null);
                  setCurrentStep((current) => (current - 1) as 1 | 2 | 3);
                }}
              >
                <ArrowLeft size={15} />
                Vorige
              </Button>
            )}

            {currentStep < 3 && (
              <Button
                className="h-11 min-h-11 gap-2 rounded-xl px-5 text-[13px] font-semibold shadow-md"
                onClick={() => {
                  if (!validateStep(currentStep)) {
                    return;
                  }
                  setCurrentStep((current) => (current + 1) as 1 | 2 | 3);
                }}
              >
                Volgende
                <ArrowRight size={15} />
              </Button>
            )}

            {currentStep === 3 && (
              <Button
                className="h-11 min-h-11 gap-2 rounded-xl px-5 text-[13px] font-semibold shadow-md"
                onClick={() => {
                  if (!validateStep(3)) {
                    return;
                  }
                  handleSubmit();
                }}
                disabled={saving}
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                {saving ? "Aanmaken..." : "Casus aanmaken"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
