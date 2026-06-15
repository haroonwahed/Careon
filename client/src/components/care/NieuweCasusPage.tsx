import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from "react";
import { AlertCircle, AlertTriangle, ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, ChevronDown, CircleHelp, ExternalLink, Loader2, Lock, Save, Search, ShieldCheck, X } from "lucide-react";
import { apiClient } from "../../lib/apiClient";
import { tokens } from "../../design/tokens";
import { SPA_DASHBOARD_URL, toCareCaseDetail, toCareSettingsSection } from "../../lib/routes";
import { Button } from "../ui/button";
import { Calendar } from "../ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { VideoHelpTrigger } from "../guidance";
import { CareInfoPopover } from "./CareUnifiedPage";
import { derivePlacementPressure } from "../../lib/placementPressure";

type Option = {
  value: string;
  label: string;
};

type MunicipalityOption = Option & {
  urgencyDocumentRequestUrl?: string;
};

type SubcategoryOption = Option & {
  mainCategoryId: string;
};

type IntakeFormState = {
  title: string;
  source_reference: string;
  start_date: string;
  target_completion_date: string;
  care_category_main: string;
  care_category_sub: string;
  assessment_summary: string;
  gemeente: string;
  jeugdhulpregio: string;
  regio: string;
  urgency: string;
  complexity: string;
  placement_pressure_horizon: string;
  safety_pressure: boolean;
  time_sensitive_arrangement: boolean;
  escalation_needed: boolean;
  placement_pressure_notes: string;
  has_urgency_declaration: boolean;
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
    gemeente: MunicipalityOption[];
    jeugdhulpregio: Option[];
    regio: Option[];
    urgency: Option[];
    complexity: Option[];
    placement_pressure_horizon: Option[];
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
type VisibilityRole = "gemeente" | "zorgaanbieder" | "coordinatie";

const baseFieldClass = "h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/50";
const baseTextareaClass = "w-full rounded-2xl border border-border bg-card px-3 py-3 text-sm text-foreground outline-none focus:border-primary/50";
const compactLabelClass = "mb-1 block text-[11px] font-medium tracking-[0.04em] text-muted-foreground";
const compactGroupLabelClass = "mb-2 text-[11px] font-medium tracking-[0.04em] text-muted-foreground";
const wizardFieldGridClass = "grid gap-5 md:grid-cols-2";
const quietToggleClass = "inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/55 px-2 py-1 text-[11px] font-medium leading-none text-muted-foreground transition-colors hover:border-border/70 hover:text-foreground";
const placementPressureHorizonChoices = [
  { value: "TODAY", label: "Directe inzet" },
  { value: "3_DAYS", label: "Binnen 72 uur" },
  { value: "1_WEEK", label: "Binnen 1 week" },
  { value: "2_WEEKS", label: "Binnen 2 weken" },
  { value: ">2_WEEKS", label: "Meer dan 2 weken" },
] as const;

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

function SectionHeader({
  step,
  eyebrow,
  title,
  context,
  video,
  status,
}: {
  step: string;
  eyebrow?: string;
  title: string;
  context?: string;
  video?: {
    title: string;
    description?: string;
    script: string;
    testId?: string;
  };
  status?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-muted/25 text-[11px] font-semibold text-foreground">
            {step}
          </div>
          <h2 className="min-w-0 text-[22px] font-semibold leading-tight tracking-tight text-foreground md:text-[24px]">
            {eyebrow ? (
              <>
                <span>{eyebrow}</span>
                <span className="mx-2 text-muted-foreground/80">–</span>
                <span>{title}</span>
              </>
            ) : (
              title
            )}
          </h2>
          {video && (
            <VideoHelpTrigger
              title={video.title}
              description={video.description}
              script={video.script}
              triggerLabel="Bekijk uitleg"
              testId={video.testId}
            />
          )}
        </div>
        {context ? <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{context}</p> : null}
      </div>
      {status}
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

function buildReference(prefix: "CO" | "TMP" | "BR", now = new Date()): string {
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

const NIEUWE_CASUS_DRAFT_STORAGE_KEY = "careon:nieuwe-casus-draft:v2";

type NieuweCasusDraft = {
  currentStep: 1 | 2 | 3;
  formState: IntakeFormState;
  searchRadiusKm: 10 | 25 | 50;
};

function getDraftStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storage = window.localStorage as Storage | undefined;
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function" || typeof storage.removeItem !== "function") {
    return null;
  }
  return storage;
}

function readNieuweCasusDraft(): NieuweCasusDraft | null {
  const storage = getDraftStorage();
  if (!storage) {
    return null;
  }

  const raw = storage.getItem(NIEUWE_CASUS_DRAFT_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<NieuweCasusDraft> | null;
    if (!parsed || typeof parsed !== "object" || !parsed.formState) {
      return null;
    }
    const currentStep = parsed.currentStep === 1 || parsed.currentStep === 2 || parsed.currentStep === 3 ? parsed.currentStep : 1;
    const searchRadiusKm = parsed.searchRadiusKm === 10 || parsed.searchRadiusKm === 25 || parsed.searchRadiusKm === 50 ? parsed.searchRadiusKm : 25;
    return {
      currentStep,
      searchRadiusKm,
      formState: parsed.formState as IntakeFormState,
    };
  } catch {
    return null;
  }
}

function clearNieuweCasusDraft() {
  const storage = getDraftStorage();
  if (!storage) {
    return;
  }

  storage.removeItem(NIEUWE_CASUS_DRAFT_STORAGE_KEY);
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

function isFilled(value: string | null | undefined): boolean {
  return Boolean(value && value.trim());
}

function shouldAvoidBrowserNavigation(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  if (import.meta.env.MODE === "test") {
    return true;
  }
  return /jsdom/i.test(window.navigator.userAgent ?? "");
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
  labelAction?: ReactNode;
}

function DateField({ label, value, onChange, error, labelAction }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const selectedDate = parseDateValue(value);

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <label className={compactLabelClass}>{label}</label>
        {labelAction}
      </div>
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

interface MunicipalityComboboxProps {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  error?: string | string[];
  placeholder?: string;
  labelAction?: ReactNode;
}

function MunicipalityCombobox({
  label,
  value,
  options,
  onChange,
  error,
  placeholder = "Selecteer gemeente",
  labelAction,
}: MunicipalityComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedLabel = options.find((option) => option.value === value)?.label ?? "";
  const normalizedQuery = query.trim().toLowerCase();

  const filteredOptions = useMemo(() => {
    if (!normalizedQuery) {
      return options;
    }
    return options.filter((option) => {
      const labelMatch = option.label.toLowerCase().includes(normalizedQuery);
      const valueMatch = option.value.toLowerCase().includes(normalizedQuery);
      return labelMatch || valueMatch;
    });
  }, [normalizedQuery, options]);

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <label className={compactLabelClass}>{label}</label>
        {labelAction}
      </div>
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (nextOpen) {
            setQuery("");
          }
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`${baseFieldClass} flex items-center justify-between gap-3 text-left`}
            aria-label={label}
            aria-expanded={open}
            aria-haspopup="listbox"
          >
            <span className={value ? "text-foreground" : "text-muted-foreground"}>{selectedLabel || placeholder}</span>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Search size={16} />
              <ChevronDown size={14} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] rounded-2xl border border-border/80 bg-card p-0 shadow-xl" align="start">
          <Command shouldFilter={false} className="rounded-2xl">
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Zoek gemeente..."
            />
            <CommandList>
              <CommandEmpty>Geen gemeente gevonden.</CommandEmpty>
              <CommandGroup>
                {filteredOptions.map((option) => {
                  const active = option.value === value;
                  return (
                    <CommandItem
                      key={option.value}
                      value={option.label}
                      onSelect={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}
                      className="flex items-center justify-between"
                    >
                      <span>{option.label}</span>
                      {active && <Check size={14} className="text-primary" aria-hidden />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <FieldError message={error} />
    </div>
  );
}

const NIEUWE_CASUS_PRIVACY_GUIDANCE = [
  "We koppelen deze casus aan het woonplaatsbeginsel en genereren automatisch een bronreferentie.",
  "Vul alleen de minimale gegevens in om te starten. Aanvullende informatie volgt in de volgende stappen.",
  "Persoonsgegevens blijven afgeschermd tot formele intake of koppeling.",
] as const;

function NieuweCasusPrivacyGuidance({
  id,
  className,
  showRequiredFieldsNote = false,
  showPrivacyLink = true,
}: {
  id?: string;
  className?: string;
  showRequiredFieldsNote?: boolean;
  showPrivacyLink?: boolean;
}) {
  const rootClass = [
    "flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/30 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div id={id} role="note" aria-label="Privacy en gegevensgebruik" className={rootClass}>
      <div className="flex min-w-0 items-start gap-3">
        <Lock size={16} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 space-y-1">
          {NIEUWE_CASUS_PRIVACY_GUIDANCE.map((paragraph, index) => (
            <p
              key={paragraph}
              className={index === 0 ? "text-foreground" : "mt-1 text-muted-foreground"}
            >
              {paragraph}
            </p>
          ))}
          {showRequiredFieldsNote ? (
            <p className="text-foreground">Velden met * zijn verplicht.</p>
          ) : null}
        </div>
      </div>
      {showPrivacyLink ? (
        <a
          href={toCareSettingsSection("documenten-privacy")}
          className="inline-flex shrink-0 items-center gap-1.5 self-start text-[12px] font-semibold text-primary underline-offset-4 hover:text-muted-foreground hover:underline sm:self-center"
        >
          Meer over privacy en zichtbaarheid
          <ExternalLink size={14} className="opacity-90" aria-hidden />
        </a>
      ) : null}
    </div>
  );
}

function NieuweCasusToelichtingDialog({
  open,
  onOpenChange,
  id,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  id?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent id={id} className="max-w-2xl border-border/70 bg-card">
        <DialogHeader className="text-left">
          <DialogTitle>Toelichting nieuwe casus</DialogTitle>
          <DialogDescription>Uitleg over privacy, minimale gegevens en zichtbaarheid per stap.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <NieuweCasusPrivacyGuidance showRequiredFieldsNote showPrivacyLink={false} />
          <div className="flex items-center justify-end border-t border-border/60 pt-3">
            <a
              href={toCareSettingsSection("documenten-privacy")}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary underline-offset-4 hover:text-muted-foreground hover:underline"
            >
              Meer over privacy en zichtbaarheid
              <ExternalLink size={14} className="opacity-90" aria-hidden />
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
  const [showPageGuidanceDialog, setShowPageGuidanceDialog] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [stepError, setStepError] = useState<string | null>(null);
  const skipScrollOnFirstStepPaint = useRef(true);
  const stepErrorBannerRef = useRef<HTMLDivElement | null>(null);

  /** Shell main uses `overflow-y-auto`; scroll the wizard top into view when the step changes (e.g. Volgende). */
  useLayoutEffect(() => {
    if (skipScrollOnFirstStepPaint.current) {
      skipScrollOnFirstStepPaint.current = false;
      return;
    }
    const anchor = document.querySelector("[data-nieuwe-casus-scroll-top]");
    if (anchor && typeof (anchor as Element).scrollIntoView === "function") {
      (anchor as Element).scrollIntoView({ block: "start", behavior: "auto" });
    }
  }, [currentStep]);

  useEffect(() => {
    if (!stepError) {
      return;
    }

    const banner = stepErrorBannerRef.current;
    if (!banner) {
      return;
    }

    if (typeof banner.scrollIntoView === "function") {
      banner.scrollIntoView({ block: "center", behavior: "auto" });
    }

    if (typeof banner.focus === "function") {
      banner.focus({ preventScroll: true });
    }
  }, [stepError]);
  const [searchRadiusKm, setSearchRadiusKm] = useState<10 | 25 | 50>(25);
  const [urgencyDocument, setUrgencyDocument] = useState<File | null>(null);
  const [careonReference] = useState(() => buildReference("CO"));
  const [previewPhase, setPreviewPhase] = useState<WorkflowPhase>("casus");
  const [previewRole, setPreviewRole] = useState<VisibilityRole>("gemeente");
  const [revealRequested, setRevealRequested] = useState(false);
  const [showRevealPreview, setShowRevealPreview] = useState(false);
  const [showControleDetails, setShowControleDetails] = useState(false);
  const [showSupportNeedsPicker, setShowSupportNeedsPicker] = useState(false);
  const pageGuidanceDialogId = "nieuw-casus-page-guidance-dialog";
  const revealPreviewId = "nieuw-casus-reveal-preview";
  const controleDetailsId = "nieuw-casus-controle-details";

  const stepMeta: Array<{ id: 1 | 2 | 3; title: string; hint?: string }> = [
    { id: 1, title: "Basisgegevens" },
    { id: 2, title: "Zorgvraag" },
    { id: 3, title: "Randvoorwaarden" },
  ];

  const complexityLabelMap: Record<string, string> = {
    LOW: "Enkelvoudig",
    MEDIUM: "Meervoudig",
    HIGH: "Intensief",
    SIMPLE: "Enkelvoudig",
    MULTIPLE: "Meervoudig",
    SEVERE: "Intensief",
  };

  useEffect(() => {
    let ignore = false;

    const bootstrap = async () => {
      try {
        const payload = await apiClient.get<IntakeFormPayload>("/care/api/cases/intake-form/");
        if (ignore) {
          return;
        }

        const draft = readNieuweCasusDraft();
        // Merge over an all-empty base so a partial options payload (e.g. a backend that
        // omits a newer key like jeugdhulpregio) can never crash the wizard on `.map`.
        const payloadOptions = {
          care_category_main: [],
          care_category_sub: [],
          gemeente: [],
          jeugdhulpregio: [],
          regio: [],
          urgency: [],
          complexity: [],
          placement_pressure_horizon: [],
          diagnostiek: [],
          zorgvorm_gewenst: [],
          preferred_care_form: [],
          preferred_region_type: [],
          preferred_region: [],
          client_age_category: [],
          family_situation: [],
          case_coordinator: [],
          ...(payload.options ?? {}),
        };

        const today = new Date();
        const nextWeek = addDays(today, 7);
        const urgencyDefault = payloadOptions.urgency.find((option) => option.value.toLowerCase().includes("medium"))?.value
          ?? payloadOptions.urgency[0]?.value
          ?? "";

        const complexityDefault = payloadOptions.complexity.find((option) => option.value.toLowerCase().includes("medium"))?.value
          ?? payloadOptions.complexity[0]?.value
          ?? "";

        const preferredRegionTypeDefault = payloadOptions.preferred_region_type[0]?.value ?? "JEUGDREGIO";
        const preferredCareFormDefault = payloadOptions.preferred_care_form[0]?.value
          ?? payloadOptions.zorgvorm_gewenst[0]?.value
          ?? "";
        const jeugdhulpregioOptionValues = new Set(payloadOptions.jeugdhulpregio.map((option) => option.value));
        const preferredRegionTypeOptionValues = new Set(payloadOptions.preferred_region_type.map((option) => option.value));

        const regionDefault = payload.initial_values.jeugdhulpregio
          || payload.initial_values.preferred_region
          || payload.initial_values.regio
          || payloadOptions.jeugdhulpregio[0]?.value
          || payloadOptions.preferred_region[0]?.value
          || payloadOptions.regio[0]?.value
          || "";
        const draftPreferredRegionType = draft?.formState?.preferred_region_type;
        const normalizedDraftPreferredRegionType =
          draftPreferredRegionType && draftPreferredRegionType === "JEUGDREGIO" && preferredRegionTypeOptionValues.has(draftPreferredRegionType)
            ? draftPreferredRegionType
            : "";
        const draftRegion = draft?.formState?.jeugdhulpregio && jeugdhulpregioOptionValues.has(draft.formState.jeugdhulpregio)
          ? draft.formState.jeugdhulpregio
          : "";
        const draftLegacyRegion = draft?.formState?.regio && jeugdhulpregioOptionValues.has(draft.formState.regio)
          ? draft.formState.regio
          : "";
        const draftPreferredRegion = draft?.formState?.preferred_region && jeugdhulpregioOptionValues.has(draft.formState.preferred_region)
          ? draft.formState.preferred_region
          : "";
        const withDefaults: IntakeFormState = {
          ...payload.initial_values,
          source_reference: "",
          start_date: payload.initial_values.start_date || formatDateInputValue(today),
          target_completion_date: payload.initial_values.target_completion_date || formatDateInputValue(nextWeek),
          urgency: payload.initial_values.urgency || urgencyDefault,
          complexity: payload.initial_values.complexity || complexityDefault,
          placement_pressure_horizon: payload.initial_values.placement_pressure_horizon || ">2_WEEKS",
          safety_pressure: payload.initial_values.safety_pressure ?? false,
          time_sensitive_arrangement: payload.initial_values.time_sensitive_arrangement ?? false,
          escalation_needed: payload.initial_values.escalation_needed ?? false,
          placement_pressure_notes: payload.initial_values.placement_pressure_notes ?? "",
          has_urgency_declaration: payload.initial_values.has_urgency_declaration ?? false,
          preferred_region_type: payload.initial_values.preferred_region_type || preferredRegionTypeDefault,
          preferred_care_form: payload.initial_values.preferred_care_form || preferredCareFormDefault,
          zorgvorm_gewenst: payload.initial_values.zorgvorm_gewenst || preferredCareFormDefault,
          jeugdhulpregio: payload.initial_values.jeugdhulpregio || regionDefault,
          regio: payload.initial_values.regio || regionDefault,
          preferred_region: payload.initial_values.preferred_region || regionDefault,
          max_toelaatbare_wachttijd_dagen: payload.initial_values.max_toelaatbare_wachttijd_dagen || "7",
        };

        if (draft?.formState) {
          withDefaults.title = draft.formState.title || withDefaults.title;
          withDefaults.start_date = draft.formState.start_date || withDefaults.start_date;
          withDefaults.target_completion_date = draft.formState.target_completion_date || withDefaults.target_completion_date;
          withDefaults.care_category_main = draft.formState.care_category_main || withDefaults.care_category_main;
          withDefaults.care_category_sub = draft.formState.care_category_sub || withDefaults.care_category_sub;
          withDefaults.assessment_summary = draft.formState.assessment_summary ?? withDefaults.assessment_summary;
          withDefaults.gemeente = draft.formState.gemeente || withDefaults.gemeente;
          withDefaults.jeugdhulpregio = draftRegion || draftLegacyRegion || draftPreferredRegion || withDefaults.jeugdhulpregio;
          withDefaults.regio = draftRegion || draftLegacyRegion || draftPreferredRegion || withDefaults.regio;
          withDefaults.urgency = draft.formState.urgency || withDefaults.urgency;
          withDefaults.complexity = draft.formState.complexity || withDefaults.complexity;
          withDefaults.placement_pressure_horizon = draft.formState.placement_pressure_horizon || withDefaults.placement_pressure_horizon;
          withDefaults.safety_pressure = draft.formState.safety_pressure ?? withDefaults.safety_pressure;
          withDefaults.time_sensitive_arrangement = draft.formState.time_sensitive_arrangement ?? withDefaults.time_sensitive_arrangement;
          withDefaults.escalation_needed = draft.formState.escalation_needed ?? withDefaults.escalation_needed;
          withDefaults.placement_pressure_notes = draft.formState.placement_pressure_notes ?? withDefaults.placement_pressure_notes;
          withDefaults.has_urgency_declaration = draft.formState.has_urgency_declaration ?? withDefaults.has_urgency_declaration;
          withDefaults.urgency_applied = draft.formState.urgency_applied ?? withDefaults.urgency_applied;
          withDefaults.urgency_applied_since = draft.formState.urgency_applied_since || withDefaults.urgency_applied_since;
          withDefaults.diagnostiek = draft.formState.diagnostiek ?? withDefaults.diagnostiek;
          withDefaults.zorgvorm_gewenst = draft.formState.zorgvorm_gewenst || withDefaults.zorgvorm_gewenst;
          withDefaults.preferred_care_form = draft.formState.preferred_care_form || withDefaults.preferred_care_form;
          withDefaults.preferred_region_type = normalizedDraftPreferredRegionType || withDefaults.preferred_region_type;
          withDefaults.jeugdhulpregio = draftRegion || draftLegacyRegion || draftPreferredRegion || withDefaults.jeugdhulpregio;
          withDefaults.regio = draftRegion || draftLegacyRegion || draftPreferredRegion || withDefaults.regio;
          withDefaults.preferred_region = draftPreferredRegion || draftLegacyRegion || draftRegion || withDefaults.preferred_region;
          withDefaults.max_toelaatbare_wachttijd_dagen = draft.formState.max_toelaatbare_wachttijd_dagen || withDefaults.max_toelaatbare_wachttijd_dagen;
          withDefaults.leeftijd = draft.formState.leeftijd || withDefaults.leeftijd;
          withDefaults.setting_voorkeur = draft.formState.setting_voorkeur || withDefaults.setting_voorkeur;
          withDefaults.contra_indicaties = draft.formState.contra_indicaties || withDefaults.contra_indicaties;
          withDefaults.problematiek_types = draft.formState.problematiek_types || withDefaults.problematiek_types;
          withDefaults.client_age_category = draft.formState.client_age_category || withDefaults.client_age_category;
          withDefaults.family_situation = draft.formState.family_situation || withDefaults.family_situation;
          withDefaults.school_work_status = draft.formState.school_work_status || withDefaults.school_work_status;
          withDefaults.case_coordinator = draft.formState.case_coordinator || withDefaults.case_coordinator;
          withDefaults.description = draft.formState.description || withDefaults.description;
        }

        setFormState(withDefaults);
        setOptions(payloadOptions);
        if (draft?.currentStep) {
          setCurrentStep(draft.currentStep);
        }
        if (draft?.searchRadiusKm) {
          setSearchRadiusKm(draft.searchRadiusKm);
        }
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

  const formatSpecificCareNeedLabel = (label: string) => {
    const cleaned = String(label || "").trim();
    if (!cleaned) {
      return cleaned;
    }
    const arrowParts = cleaned.split("→").map((part) => part.trim()).filter(Boolean);
    return arrowParts.length > 1 ? arrowParts[arrowParts.length - 1] : cleaned;
  };

  const pressureAssessment = useMemo(() => {
    if (!formState) {
      return null;
    }

    return derivePlacementPressure({
      start_date: formState.start_date,
      target_completion_date: formState.target_completion_date,
      placement_pressure_horizon: formState.placement_pressure_horizon,
      safety_pressure: formState.safety_pressure,
      time_sensitive_arrangement: formState.time_sensitive_arrangement,
      escalation_needed: formState.escalation_needed,
    });
  }, [formState]);

  const matchingPreview = useMemo(() => {
    if (!formState || !pressureAssessment) {
      return { label: "Normaal", tone: "warning" as const, score: 2, detail: "Vul de intake volledig in voor een scherpere voorspelling." };
    }

    let score = 0;
    const urgency = pressureAssessment.band;
    const complexity = formState.complexity.toLowerCase();

    if (urgency === "critical") {
      score += 4;
    } else if (urgency === "high") {
      score += 3;
    } else if (urgency === "normal") {
      score += 1;
    }
    if (complexity.includes("high")) {
      score += 3;
    } else if (complexity.includes("medium")) {
      score += 1;
    }
    if (pressureAssessment.band === "critical") {
      score += 3;
    } else if (pressureAssessment.band === "high") {
      score += 2;
    }
    if (formState.placement_pressure_horizon === "TODAY" || formState.placement_pressure_horizon === "3_DAYS") {
      score += 3;
    } else if (formState.placement_pressure_horizon === "1_WEEK") {
      score += 2;
    } else if (formState.placement_pressure_horizon === "2_WEEKS") {
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

    if (pressureAssessment.band === "critical" || score >= 9) {
      return { label: "Spoedroute", tone: "critical" as const, score, detail: "Plaatsing vraagt directe routing en strakke opvolging." };
    }
    if (score >= 5) {
      return { label: "Normaal", tone: "warning" as const, score, detail: "Matchbaar, maar strak sturen." };
    }
    return { label: "Ruim", tone: "good" as const, score, detail: "Goede uitgangspositie voor inhoudelijke vergelijking." };
  }, [formState, pressureAssessment, searchRadiusKm]);

  const selectedGemeenteOption = useMemo(() => {
    if (!options || !formState?.gemeente) {
      return null;
    }
    return options.gemeente.find((option) => option.value === formState.gemeente) ?? null;
  }, [formState?.gemeente, options]);

  const selectedGemeenteLabel = selectedGemeenteOption?.label ?? formState?.gemeente ?? "";
  const selectedGemeenteUrgencyRequestUrl = selectedGemeenteOption?.urgencyDocumentRequestUrl?.trim() ?? "";
  const selectedJeugdhulpregioOption = useMemo(() => {
    if (!options || !formState) {
      return null;
    }
    const selectedRegionId = formState.jeugdhulpregio || formState.preferred_region || formState.regio || "";
    if (!selectedRegionId) {
      return null;
    }
    const regionOptions = options.jeugdhulpregio ?? [];
    const preferredRegionOptions = options.preferred_region ?? [];
    return regionOptions.find((option) => option.value === selectedRegionId)
      ?? preferredRegionOptions.find((option) => option.value === selectedRegionId)
      ?? null;
  }, [formState?.jeugdhulpregio, formState?.preferred_region, formState?.regio, options]);
  const selectedJeugdhulpregioLabel = selectedJeugdhulpregioOption?.label ?? formState?.jeugdhulpregio ?? formState?.preferred_region ?? formState?.regio ?? "";

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

  const updateJeugdhulpregio = (value: string) => {
    updateField("jeugdhulpregio", value);
    updateField("regio", value);
    updateField("preferred_region", value);
    updateField("preferred_region_type", "JEUGDREGIO");
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

  const buildIntakeCreateBody = () => {
    if (!formState) {
      return null;
    }

    const assessmentSummary = [formState.assessment_summary?.trim(), (
      `Coördinatiecasus: ${careonReference}\n` +
      `Woonplaatsbeginsel: ${selectedGemeenteLabel || "onbekend"}\n` +
      `Privacy: casusgegevens worden AVG-minimaal verwerkt. Persoonsidentificerende gegevens blijven afgeschermd totdat formele koppeling, intake of geautoriseerde toegang nodig is.`
    )].filter(Boolean).join("\n\n");
    const operationalUrgency = pressureAssessment?.urgency ?? (formState.urgency as IntakeFormState["urgency"]);

    if (!urgencyDocument) {
      return {
        ...formState,
        urgency: operationalUrgency,
        title: careonReference,
        assessment_summary: assessmentSummary,
      };
    }

    const formData = new FormData();
    const appendValue = (key: string, value: string | number | boolean) => {
      formData.append(key, String(value));
    };

    Object.entries({
      ...formState,
      urgency: operationalUrgency,
      title: careonReference,
      assessment_summary: assessmentSummary,
    }).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((entry) => formData.append(key, entry));
        return;
      }
      if (typeof value === "boolean") {
        appendValue(key, value);
        return;
      }
      appendValue(key, value ?? "");
    });
    formData.append("urgency_document", urgencyDocument);
    return formData;
  };

  useEffect(() => {
    if (loading || !formState) {
      return;
    }

    try {
      const storage = getDraftStorage();
      if (!storage) {
        return;
      }
      storage.setItem(
        NIEUWE_CASUS_DRAFT_STORAGE_KEY,
        JSON.stringify({
          currentStep,
          searchRadiusKm,
          formState,
        } satisfies NieuweCasusDraft),
      );
    } catch {
      // Draft persistence is best-effort.
    }
  }, [currentStep, formState, loading, searchRadiusKm]);

  const handleSubmit = async () => {
    if (!formState) {
      return;
    }

    setSaving(true);
    setFormErrors({});
    setSuccessMessage(null);
    setLoadError(null);

    try {
      const requestBody = buildIntakeCreateBody();
      if (!requestBody) {
        return;
      }
      const payload = await apiClient.post<IntakeCreateSuccess>("/care/api/cases/intake-create/", requestBody);
      clearNieuweCasusDraft();
      const createdCaseId = payload.case_id?.trim();
      // @ts-ignore
      setSuccessMessage(`Casus ${payload.title} is aangemaakt. Let op: voeg deze CareOn referentiecode toe aan het dossier van uw client binnen uw ECD. Referentiecode: ${payload.source_reference || careonReference}. Je wordt doorgestuurd naar het nieuwe coördinatietraject.`);
      const target =
        payload.redirect_url ||
        (createdCaseId ? toCareCaseDetail(createdCaseId) : `${SPA_DASHBOARD_URL}?page=casussen`);
      if (createdCaseId) {
        onCreated?.(createdCaseId);
      }
      if (!shouldAvoidBrowserNavigation()) {
        window.location.href = target;
      }
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
      if (!formState.gemeente || !formState.start_date || !formState.target_completion_date) {
        setStepError("Kies woonplaatsbeginsel, gewenste startdatum en uiterste plaatsingsdatum.");
        return false;
      }
    }

    if (step === 2) {
      if (!formState.care_category_main || !formState.complexity || !formState.placement_pressure_horizon) {
        setStepError("Kies zorgbehoefte, complexiteit en plaatsingsdruk om door te gaan.");
        return false;
      }
      if (pressureAssessment && (pressureAssessment.band === "high" || pressureAssessment.band === "critical") && formState.has_urgency_declaration && !urgencyDocument) {
        setStepError("Upload de urgentieverklaring of vink aan dat deze nog ontbreekt.");
        return false;
      }
      if (!isFilled(formState.assessment_summary)) {
        setStepError("Vul het persoonsbeeld in om door te gaan.");
        return false;
      }
    }

    if (step === 3) {
      const hasRegionOptions = (options.jeugdhulpregio?.length ?? 0) > 0;
      if (hasRegionOptions && !formState.jeugdhulpregio && !formState.regio && !formState.preferred_region) {
        setStepError("Kies minimaal een jeugdhulpregio binnen de randvoorwaarden.");
        return false;
      }
    }

    setStepError(null);
    return true;
  };

  const handleAdvance = async () => {
    if (!validateStep(currentStep)) {
      return;
    }

    if (currentStep === 3) {
      await handleSubmit();
      return;
    }

    setCurrentStep((current) => (current + 1) as 1 | 2 | 3);
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
  const revealedIdentity = careonReference;
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
    coordinatie: string;
  }> = [
    {
      phase: "casus",
      label: "Casus",
      gemeente: "CAS-ID, CLI-ID, zorgvraag, urgentie",
      zorgaanbieder: "Niet zichtbaar",
      coordinatie: "Alleen pseudonieme metadata",
    },
    {
      phase: "matching",
      label: "Matching",
      gemeente: "Leeftijdscategorie, jeugdhulpregio, zorgvraag, urgentie",
      zorgaanbieder: "Leeftijdscategorie + jeugdhulpregio (geen NAW)",
      coordinatie: "Need-to-know coördinatiesignalen",
    },
    {
      phase: "aanbieder_beoordeling",
      label: "Aanbieder beoordeling",
      gemeente: "Casuscontext + advies",
      zorgaanbieder: "Beperkt profiel + pseudoniem",
      coordinatie: "Processtatus en blokkades",
    },
    {
      phase: "plaatsing",
      label: "Plaatsing",
      gemeente: "Gecontroleerde reveal mogelijk",
      zorgaanbieder: "Reveal op autorisatie + audit",
      coordinatie: "Audit + toestemmingstatus",
    },
    {
      phase: "intake",
      label: "Intake",
      gemeente: "Volledige gegevens voor geautoriseerde rollen",
      zorgaanbieder: "Volledige gegevens na acceptatie",
      coordinatie: "Alleen noodzakelijke coördinatievelden",
    },
  ];

  const supportNeedLabels = formState.diagnostiek
    .map((value) => options.diagnostiek.find((option) => option.value === value)?.label ?? value)
    .filter(Boolean);
  const supportNeedPreview = supportNeedLabels.slice(0, 3);
  const supportNeedOverflow = Math.max(0, supportNeedLabels.length - supportNeedPreview.length);
  return (
    <div
      data-nieuwe-casus-scroll-top
      className="mx-auto w-full space-y-4 md:space-y-5"
      style={{ maxWidth: tokens.layout.pageMaxWidth }}
    >
      <div className="min-w-0 space-y-2">
        <button
          type="button"
          onClick={() => onCancel?.()}
          className="inline-flex items-center gap-1.5 text-[15px] font-medium leading-none text-primary transition-colors hover:text-muted-foreground"
        >
          <ArrowLeft size={15} className="translate-y-px" />
          Terug naar casussen
        </button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Nieuwe casus</h1>
            <button
              type="button"
              onClick={() => setShowPageGuidanceDialog(true)}
              className={quietToggleClass}
              aria-expanded={showPageGuidanceDialog}
              aria-controls={pageGuidanceDialogId}
            >
              <CircleHelp size={12} />
              Toelichting
              <ChevronDown size={12} className={showPageGuidanceDialog ? "rotate-180 transition-transform" : "transition-transform"} />
            </button>
          </div>
          {currentStep === 3 ? (
            <Button
              className="h-11 gap-2 rounded-full px-5 text-[15px] font-medium leading-none shadow-sm"
              onClick={handleAdvance}
            >
              Casus aanmaken
              <Save size={15} className="translate-y-px" />
            </Button>
          ) : null}
        </div>
      </div>

      <NieuweCasusToelichtingDialog
        id={pageGuidanceDialogId}
        open={showPageGuidanceDialog}
        onOpenChange={setShowPageGuidanceDialog}
      />

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

      {stepError ? (
        <div
          ref={stepErrorBannerRef}
          tabIndex={-1}
          role="alert"
          aria-live="assertive"
          className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 shadow-sm outline-none"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-300" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Je kunt nog niet verder</p>
              <p className="mt-1 text-sm text-amber-100/90">{stepError}</p>
            </div>
          </div>
        </div>
      ) : null}

      <section className="rounded-[22px] border border-border/70 bg-panel/70 p-3 shadow-sm backdrop-blur-sm md:p-4">
        <div className="space-y-3">
          <nav className="grid grid-cols-1 gap-2 md:grid-cols-3" aria-label="Wizard stappen">
            {stepMeta.map((step) => {
              const isFinalStep = currentStep === 3;
              const isActive = currentStep === step.id && !isFinalStep;
              const isCompleted = isFinalStep || currentStep > step.id;
              const isClickable = isCompleted || isActive;
              const stepToneClass = isActive
                ? "border-primary/35 bg-primary/10 text-foreground ring-1 ring-primary/20"
                : isCompleted
                  ? "border-emerald-500/20 bg-emerald-500/8 text-foreground hover:border-emerald-400/30"
                  : "border-border/70 bg-card/20 text-muted-foreground hover:border-primary/20 hover:bg-card/30 hover:text-foreground";

              return (
                <button
                  key={step.id}
                  type="button"
                  aria-current={isActive ? "step" : undefined}
                  aria-label={`Stap ${step.id}: ${step.title}`}
                  onClick={() => {
                    if (isClickable) {
                      jumpToStep(step.id);
                    }
                  }}
                  disabled={!isClickable}
                className={`flex min-h-[58px] items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${stepToneClass}`}
                >
                  <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-sm font-semibold leading-none ${isActive ? "border-primary/20 bg-primary text-primary-foreground" : isCompleted ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-border/70 bg-background/20 text-foreground"}`}>
                    {isCompleted ? <CheckCircle2 size={15} aria-hidden /> : step.id}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[13px] font-semibold leading-tight ${isActive ? "text-foreground" : isCompleted ? "text-foreground" : "text-inherit"}`}>{step.title}</span>
                    {step.hint ? (
                      <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground">{step.hint}</span>
                    ) : null}
                  </span>
                  {isActive ? (
                    <span className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-primary">
                      Actief
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        {currentStep === 1 && (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-border/55 bg-card/35 p-5 md:p-6">
              <SectionHeader
                step="1"
                title="Geef basisgegevens op"
                video={{
                  title: "Woonplaatsbeginsel",
                  description: "Waarom deze keuze belangrijk is",
                  script:
                    "Controleer welke gemeente verantwoordelijk is voor de casus. Bij verhuizing of plaatsing buiten de eigen gemeente kan verantwoordelijkheid veranderen. Deze keuze beïnvloedt validatie, bekostiging en vervolgafstemming. Gebruik de gemeente die leidend is voor het woonplaatsbeginsel.",
                  testId: "nieuwe-casus-gemeente-video",
                }}
              />

              <div className={wizardFieldGridClass}>
                <div>
                  <MunicipalityCombobox
                    label="Gemeente (woonplaatsbeginsel) *"
                    value={formState.gemeente}
                    options={options.gemeente}
                    onChange={(nextValue) => updateField("gemeente", nextValue)}
                    placeholder="Zoek gemeente"
                    labelAction={
                      <CareInfoPopover ariaLabel="Waarom deze gemeente?" testId="nieuwe-casus-gemeente-info">
                        <p>Kies de gemeente die leidend is voor het woonplaatsbeginsel.</p>
                      </CareInfoPopover>
                    }
                    error={formErrors.gemeente}
                  />
                </div>

                <div>
                  <DateField
                    label="Gewenste startdatum *"
                    value={formState.start_date}
                    onChange={(nextValue) => updateField("start_date", nextValue)}
                    error={formErrors.start_date}
                    labelAction={
                      <CareInfoPopover ariaLabel="Waarom gewenste startdatum?" testId="nieuwe-casus-startdatum-info">
                        <p>Vanaf wanneer de client zoekt naar (vervolg)plaatsing.</p>
                      </CareInfoPopover>
                    }
                  />
                </div>
                <div>
                  <DateField
                    label="Uiterste plaatsingsdatum *"
                    value={formState.target_completion_date}
                    onChange={(nextValue) => updateField("target_completion_date", nextValue)}
                    error={formErrors.target_completion_date}
                    labelAction={
                      <CareInfoPopover ariaLabel="Waarom uiterste plaatsingsdatum?" testId="nieuwe-casus-streefdatum-info">
                        <p>Deze datum markeert de uiterste operationele plaatsingsgrens.</p>
                        <p>Bij wijzigingen in plaatsingsdruk of context kan de datum worden aangepast.</p>
                      </CareInfoPopover>
                    }
                  />
                </div>

                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <label className={compactLabelClass}>Jeugdhulpregio *</label>
                    <span aria-hidden className="h-8 w-8 shrink-0" />
                  </div>
                  <select
                    value={formState.jeugdhulpregio}
                    onChange={(event) => updateJeugdhulpregio(event.target.value)}
                    className={baseFieldClass}
                    aria-label="Jeugdhulpregio *"
                  >
                    <option value="">Selecteer jeugdhulpregio</option>
                    {options.jeugdhulpregio.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <FieldError message={formErrors.jeugdhulpregio ?? formErrors.regio} />
                </div>
              </div>

            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="mt-6 space-y-3">
            <SectionHeader
              step="2"
              title="Zorgvraag"
              video={{
                  title: "Zorgvraag",
                  description: "Uitleg over zorgbehoefte, plaatsingsdruk en routing.",
                  script: "Gebruik deze stap om de zorgvraag expliciet te maken. Kies de zorgbehoefte categorie en de specifieke zorgbehoefte, bepaal de complexiteit en modelleer vervolgens de plaatsingsdruk met houdbaarheid, veiligheidsdruk, tijdskritisch arrangement en escalatie. Het systeem leidt hieruit de urgentie af en gebruikt die voor matching en coördinatie.",
                  testId: "nieuwe-casus-zorgvraag-video",
                }}
              />

            <div className={wizardFieldGridClass}>
              <div>
                <label htmlFor="nieuw-casus-hoofdcategorie" className={compactLabelClass}>Zorgbehoefte categorie *</label>
                <select
                  id="nieuw-casus-hoofdcategorie"
                  value={formState.care_category_main}
                  onChange={(event) => {
                    const nextMainValue = event.target.value;
                    const nextVisibleSubcategories = options.care_category_sub.filter((option) => option.mainCategoryId === nextMainValue);
                    const currentSubcategoryStillValid = nextVisibleSubcategories.some((option) => option.value === formState.care_category_sub);
                    updateField("care_category_main", nextMainValue);
                    updateField("care_category_sub", currentSubcategoryStillValid ? formState.care_category_sub : "");
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
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <label htmlFor="nieuw-casus-subcategorie" className={compactLabelClass}>Specifieke zorgbehoefte</label>
                </div>
                <select
                  id="nieuw-casus-subcategorie"
                  value={formState.care_category_sub}
                  onChange={(event) => updateField("care_category_sub", event.target.value)}
                  className={baseFieldClass}
                  disabled={!formState.care_category_main}
                >
                  <option value="">Selecteer</option>
                  {visibleSubcategories.map((option) => (
                    <option key={option.value} value={option.value}>{formatSpecificCareNeedLabel(option.label)}</option>
                  ))}
                </select>
                <FieldError message={formErrors.care_category_sub} />
              </div>
            </div>

            <div className={wizardFieldGridClass}>
              <div>
                <p className={compactGroupLabelClass}>Complexiteit *</p>
                <select
                  value={formState.complexity}
                  onChange={(event) => updateField("complexity", event.target.value)}
                  className={baseFieldClass}
                  aria-label="Complexiteit *"
                >
                  <option value="">Selecteer complexiteit</option>
                  {options.complexity.map((option) => {
                    const label = complexityLabelMap[option.value.toUpperCase()] ?? option.label;
                    return (
                      <option key={option.value} value={option.value}>
                        {label}
                      </option>
                    );
                  })}
                </select>
                <FieldError message={formErrors.complexity} />
              </div>
            </div>
            <section className="rounded-[24px] border border-border/70 bg-card/35 p-4 shadow-sm">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-[17px] font-semibold text-foreground">Plaatsingsdruk &amp; urgentie</h3>
                </div>
                <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${
                  pressureAssessment?.band === "critical"
                    ? "border-red-500/30 bg-red-500/10 text-red-200"
                    : pressureAssessment?.band === "high"
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                      : pressureAssessment?.band === "normal"
                        ? "border-sky-500/30 bg-sky-500/10 text-sky-200"
                        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                }`}>
                  {pressureAssessment?.label ?? "Normaal"}
                </span>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
                <div className="space-y-4">
                  <div className="space-y-3 rounded-2xl border border-border/60 bg-card/25 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <label className={compactGroupLabelClass}>Hoe lang is de zorgsituatie nog houdbaar? *</label>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {placementPressureHorizonChoices.map((option) => {
                        const active = formState.placement_pressure_horizon === option.value;
                        return (
                            <button
                              key={option.value}
                              type="button"
                              aria-pressed={active}
                              aria-label={`Zorgsituatie nog houdbaar: ${option.label.toLowerCase()}`}
                              onClick={() => updateField("placement_pressure_horizon", option.value)}
                              className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${
                              active
                                ? "border-primary/40 bg-primary/10 text-foreground shadow-sm"
                                : "border-border/60 bg-background/40 text-muted-foreground hover:border-border/90 hover:text-foreground"
                            }`}
                          >
                            <span className="block font-medium">{option.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    <FieldError message={formErrors.placement_pressure_horizon} />
                  </div>

                  <div className="space-y-3 rounded-2xl border border-border/60 bg-card/25 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className={compactGroupLabelClass}>Risicosignalen</p>
                      <span className="rounded-full border border-border/60 bg-background/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Triage-indicatoren
                      </span>
                    </div>
                    <label className="flex items-start gap-3 text-sm text-foreground">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary/60"
                        checked={formState.safety_pressure}
                        onChange={(event) => updateField("safety_pressure", event.target.checked)}
                      />
                      <span>
                        <span className="block font-medium">Veiligheidsdruk</span>
                      </span>
                    </label>
                    <label className="flex items-start gap-3 text-sm text-foreground">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary/60"
                        checked={formState.time_sensitive_arrangement}
                        onChange={(event) => updateField("time_sensitive_arrangement", event.target.checked)}
                      />
                      <span>
                        <span className="block font-medium">Tijdskritisch arrangement</span>
                      </span>
                    </label>
                    <label className="flex items-start gap-3 text-sm text-foreground">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary/60"
                        checked={formState.escalation_needed}
                        onChange={(event) => updateField("escalation_needed", event.target.checked)}
                      />
                      <span>
                        <span className="block font-medium">Escalatie nodig</span>
                      </span>
                    </label>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-2xl border border-border/60 bg-card/30 px-4 py-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Urgentieadvies</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        pressureAssessment?.band === "critical"
                          ? "bg-red-500/10 text-red-200"
                          : pressureAssessment?.band === "high"
                            ? "bg-amber-500/10 text-amber-200"
                            : pressureAssessment?.band === "normal"
                              ? "bg-sky-500/10 text-sky-200"
                              : "bg-emerald-500/10 text-emerald-200"
                      }`}>
                        {pressureAssessment?.label ?? "Normaal"}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-medium leading-snug text-foreground">
                      {pressureAssessment?.reason ?? "Plaatsingsdruk lijkt stabiel."}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {pressureAssessment?.implication ?? "Normale routing"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-card/30 px-4 py-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Matchverwachting</p>
                    <p className="mt-2 text-sm font-medium leading-snug text-foreground">
                      {matchingPreview.label}
                    </p>
                    <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Toelichting</p>
                    <p className="mt-1 text-sm text-muted-foreground">{matchingPreview.detail}</p>
                    <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-[11px] font-medium ${matchingPreview.tone === "good" ? "bg-green-500/10 text-green-300" : matchingPreview.tone === "warning" ? "bg-yellow-500/10 text-yellow-300" : "bg-red-500/10 text-red-300"}`}>
                      {matchingPreview.label}
                    </span>
                  </div>

                </div>
              </div>

              <div className="mt-4">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <label htmlFor="nieuw-casus-placement-pressure-notes" className={compactLabelClass}>Toelichting</label>
                  <CareInfoPopover ariaLabel="Waarom toelichting plaatsingsdruk?" testId="nieuwe-casus-place-pressure-info">
                    <p>Gebruik alleen operationele context die nodig is voor triage en matching.</p>
                    <p>Laat namen, adressen, telefoonnummers, e-mailadressen en BSN weg.</p>
                  </CareInfoPopover>
                </div>
                <textarea
                  id="nieuw-casus-placement-pressure-notes"
                  value={formState.placement_pressure_notes}
                  onChange={(event) => updateField("placement_pressure_notes", event.target.value)}
                  className={`${baseTextareaClass} min-h-24`}
                  placeholder="Korte operationele toelichting zonder direct herleidbare persoonsgegevens"
                />
                <FieldError message={formErrors.placement_pressure_notes} />
              </div>

              {pressureAssessment?.band && pressureAssessment.band !== "low" ? (
                <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-4">
                  <div className="space-y-4">
                    <label className="flex items-start gap-3 text-sm text-foreground">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary/60"
                        checked={formState.has_urgency_declaration}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          updateField("has_urgency_declaration", checked);
                          if (!checked) {
                            setUrgencyDocument(null);
                            updateField("urgency_applied", false);
                            updateField("urgency_applied_since", "");
                            setFormErrors((current) => {
                              if (!('urgency_document' in current)) {
                                return current;
                              }
                              const nextErrors = { ...current };
                              delete nextErrors.urgency_document;
                              return nextErrors;
                            });
                          }
                        }}
                        aria-describedby="nieuw-casus-urgency-declaration-help"
                      />
                      <span>Client heeft al een urgentieverklaring</span>
                    </label>
                    <div id="nieuw-casus-urgency-declaration-help" className="rounded-xl border border-border/60 bg-card/30 px-4 py-3 text-sm text-muted-foreground">
                      {formState.has_urgency_declaration ? (
                        <div className="space-y-3">
                          <p className="text-foreground">Upload de bestaande urgentieverklaring zodat de casus direct compleet is.</p>
                          <div>
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <label htmlFor="nieuw-casus-urgency-document" className={compactLabelClass}>Urgentieverklaring *</label>
                              <CareInfoPopover ariaLabel="Waarom uploaden?" testId="nieuwe-casus-urgency-document-info">
                                <p>Verplicht wanneer de client al een urgentieverklaring heeft.</p>
                                <p>Voeg een PDF of afbeelding toe.</p>
                              </CareInfoPopover>
                            </div>
                            <input
                              id="nieuw-casus-urgency-document"
                              type="file"
                              accept=".pdf,image/*"
                              className={`${baseFieldClass} py-2 file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary-foreground`}
                              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                                const file = event.target.files?.[0] ?? null;
                                setUrgencyDocument(file);
                                if (file) {
                                  setFormErrors((current) => {
                                    if (!('urgency_document' in current)) {
                                      return current;
                                    }
                                    const nextErrors = { ...current };
                                    delete nextErrors.urgency_document;
                                    return nextErrors;
                                  });
                                }
                              }}
                            />
                            <FieldError message={formErrors.urgency_document} />
                          </div>
                          <p className="font-medium text-foreground">{urgencyDocument ? urgencyDocument.name : "Nog geen bestand gekozen"}</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <p className="text-foreground">
                              Vraag eerst een urgentieverklaring aan bij {selectedGemeenteLabel || "de gemeente"} of het aangewezen loket.
                            </p>
                            {selectedGemeenteUrgencyRequestUrl ? (
                              <a
                                href={selectedGemeenteUrgencyRequestUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
                              >
                                Vraag urgentieverklaring aan
                                <ExternalLink size={14} />
                              </a>
                            ) : null}
                          </div>
                          <label className="flex items-start gap-3 text-sm text-foreground">
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary/60"
                              checked={formState.urgency_applied}
                              onChange={(event) => {
                                const checked = event.target.checked;
                                updateField("urgency_applied", checked);
                                if (checked && !formState.urgency_applied_since) {
                                  updateField("urgency_applied_since", formatDateInputValue(new Date()));
                                }
                                if (!checked) {
                                  updateField("urgency_applied_since", "");
                                }
                              }}
                            />
                            <span>Urgentieverklaring aangevraagd</span>
                          </label>
                          {formState.urgency_applied ? (
                            <div>
                              <label htmlFor="nieuw-casus-urgency-applied-since" className={compactLabelClass}>Aangevraagd op</label>
                              <input
                                id="nieuw-casus-urgency-applied-since"
                                type="date"
                                value={formState.urgency_applied_since}
                                onChange={(event) => updateField("urgency_applied_since", event.target.value)}
                                className={baseFieldClass}
                              />
                              <FieldError message={formErrors.urgency_applied_since} />
                            </div>
                          ) : null}
                          <p>Pas daarna kun je de upload toevoegen. Zonder verklaring kun je deze stap nog wel opslaan.</p>
                          {selectedGemeenteUrgencyRequestUrl ? null : (
                            <p className="text-xs text-muted-foreground">
                              Er is nog geen casuslink gekoppeld voor {selectedGemeenteLabel || "deze gemeente"}.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </section>

            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <label htmlFor="nieuw-casus-persoonsbeeld" className={compactLabelClass}>Persoonsbeeld *</label>
                <CareInfoPopover ariaLabel="Waarom persoonsbeeld?" testId="nieuwe-casus-persoonsbeeld-info">
                  <p>Beschrijf alleen de operationele context die nodig is voor beoordeling en matching.</p>
                  <p>Laat namen, adressen, telefoons, e-mailadressen en BSN achterwege.</p>
                </CareInfoPopover>
              </div>
              <textarea
                id="nieuw-casus-persoonsbeeld"
                value={formState.assessment_summary}
                onChange={(event) => updateField("assessment_summary", event.target.value)}
                className={`${baseTextareaClass} min-h-28`}
                placeholder="Beschrijf kort de casuscontext zonder herleidbare persoonsgegevens, met aandachtspunten voor beoordeling en matching"
              />
              <FieldError message={formErrors.assessment_summary} />
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Wie ziet wat per fase</p>
                  <CareInfoPopover ariaLabel="Wie voeg ik toe?" testId="nieuwe-casus-partijen-help">
                    <p>Voeg alleen partijen toe die betrokken zijn bij beoordeling, plaatsing of opvolging.</p>
                  </CareInfoPopover>
                </div>
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
                        <th className="px-3">Coördinatie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibilityRows.map((row) => (
                        <tr key={row.phase} className="rounded-xl border border-border/50 bg-card/30">
                          <td className="px-3 py-2 font-semibold text-foreground">{row.label}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.gemeente}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.zorgaanbieder}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.coordinatie}</td>
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
          <div className="mt-6 space-y-3">
            <SectionHeader
              step="3"
              title="Randvoorwaarden"
            />

            {(options.jeugdhulpregio?.length ?? 0) === 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3 text-sm text-amber-200">
                <span className="font-semibold">Geen jeugdhulpregio's geconfigureerd.</span>{" "}
                Ga naar <a href="/care/regio's/" className="underline underline-offset-2 hover:text-amber-100">Regio's</a> om er een aan te maken voordat je een casus plaatst. De casus wordt opgeslagen zonder regiokoppeling.
              </div>
            )}

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.9fr)_minmax(350px,1fr)]">
              <div className="space-y-3">
                <section className="panel-surface rounded-[24px] border border-border/70 p-4 shadow-sm">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <h3 className="text-[17px] font-semibold text-foreground">Gemeente &amp; Jeugdhulpregio</h3>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                    <div>
                      <label htmlFor="nieuw-casus-regio" className={compactLabelClass}>Jeugdhulpregio *</label>
                      <select
                        id="nieuw-casus-regio"
                        value={formState.jeugdhulpregio}
                        onChange={(event) => {
                          updateJeugdhulpregio(event.target.value);
                        }}
                        className={baseFieldClass}
                      >
                        <option value="">Selecteer jeugdhulpregio</option>
                        {options.jeugdhulpregio.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <FieldError message={formErrors.jeugdhulpregio ?? formErrors.regio} />
                    </div>

                    <div>
                      <label className={compactLabelClass}>Zoekradius</label>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {[10, 25, 50].map((radius) => (
                          <button
                            key={radius}
                            type="button"
                            onClick={() => setSearchRadiusKm(radius as 10 | 25 | 50)}
                            className={`rounded-full border px-3 py-1.5 text-[11px] font-medium ${searchRadiusKm === radius ? "border-primary/30 bg-primary/10 text-foreground" : "border-border/70 bg-card/30 text-muted-foreground hover:border-border/70 hover:text-foreground"}`}
                          >
                            {radius} km
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="min-w-0 rounded-2xl border border-border/50 bg-card/30 px-3 py-3">
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Gemeente (woonplaatsbeginsel)</p>
                      <p className="mt-1 break-words text-sm font-medium leading-snug text-foreground">{selectedGemeenteLabel || "Wordt afgeleid uit gemeente"}</p>
                    </div>
                    <div className="min-w-0 rounded-2xl border border-border/50 bg-card/30 px-3 py-3">
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Jeugdhulpregio</p>
                      <p className="mt-1 break-words text-sm font-medium leading-snug text-foreground">{selectedJeugdhulpregioLabel || "Wordt afgeleid uit jeugdhulpregio"}</p>
                    </div>
                    <div className="min-w-0 rounded-2xl border border-border/50 bg-card/30 px-3 py-3">
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Herbeoordeling</p>
                      <p className="mt-1 break-words text-sm font-medium leading-snug text-foreground">
                        {formState.gemeente && formState.jeugdhulpregio ? "Alleen bij grensverschil" : "Nog niet bepaald"}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="panel-surface rounded-[24px] border border-border/70 p-4 shadow-sm">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <h3 className="text-[17px] font-semibold text-foreground">Ondersteuningsbehoeften</h3>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-full border-border/70 px-3 text-xs font-medium"
                      onClick={() => setShowSupportNeedsPicker((current) => !current)}
                    >
                      + Toevoegen
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {supportNeedPreview.map((label) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => {
                          const option = options.diagnostiek.find((entry) => entry.label === label);
                          if (option) {
                            toggleDiagnostiek(option.value);
                          }
                        }}
                        className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/30 px-3 py-1.5 text-sm text-foreground transition-colors hover:border-border/70 hover:bg-muted/30"
                      >
                        <span>{label}</span>
                        <X size={14} className="text-muted-foreground" aria-hidden />
                      </button>
                    ))}
                    {supportNeedOverflow > 0 && (
                      <span className="inline-flex items-center rounded-full border border-border/70 bg-card/30 px-3 py-1.5 text-sm text-muted-foreground">
                        +{supportNeedOverflow}
                      </span>
                    )}
                  </div>

                  {showSupportNeedsPicker && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {options.diagnostiek
                        .filter((option) => !formState.diagnostiek.includes(option.value))
                        .map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => toggleDiagnostiek(option.value)}
                            className="rounded-full border border-border/70 bg-card/25 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-border/70 hover:text-foreground"
                          >
                            {option.label}
                          </button>
                        ))}
                    </div>
                  )}
                </section>

                <div className="grid gap-3 md:grid-cols-2">
                  <section className="panel-surface h-full rounded-[24px] border border-border/70 p-4 shadow-sm">
                    <div className="flex h-full flex-col">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-400">
                          <AlertTriangle size={16} aria-hidden />
                        </div>
                        <h3 className="min-w-0 text-[17px] font-semibold leading-snug text-foreground">Matchverwachting</h3>
                      </div>
                      <div className="mt-4 rounded-2xl border border-border/50 bg-card/30 px-3 py-3">
                        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                          Verwachte uitkomst
                        </p>
                        <p className="mt-1 text-sm font-medium leading-snug text-foreground">
                          {matchingPreview.label}
                        </p>
                        <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-[11px] font-medium ${matchingPreview.tone === "good" ? "bg-green-500/10 text-green-300" : matchingPreview.tone === "warning" ? "bg-yellow-500/10 text-yellow-300" : "bg-red-500/10 text-red-300"}`}>
                          {matchingPreview.label}
                        </span>
                      </div>
                    </div>
                  </section>

                  <section className="panel-surface h-full rounded-[24px] border border-border/70 p-4 shadow-sm">
                    <div className="flex h-full flex-col">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-violet-500/20 bg-violet-500/10 text-violet-300">
                          <Lock size={16} aria-hidden />
                        </div>
                        <h3 className="min-w-0 text-[17px] font-semibold leading-snug text-foreground">Privacy &amp; zichtbaarheid</h3>
                      </div>
                      <div className="mt-4 rounded-2xl border border-border/50 bg-card/30 px-3 py-3">
                        <div className="flex flex-col gap-2 text-sm text-foreground">
                          <p className="grid min-w-0 grid-cols-[14px_minmax(0,1fr)] items-start gap-2 leading-snug">
                            <Lock size={14} className="text-violet-300" aria-hidden />
                            <span className="min-w-0 break-words">Alleen pseudonieme gegevens zichtbaar</span>
                          </p>
                          <p className="grid min-w-0 grid-cols-[14px_minmax(0,1fr)] items-start gap-2 leading-snug">
                            <ShieldCheck size={14} className="text-violet-300" aria-hidden />
                            <span className="min-w-0 break-words">Openbaar voor: Gemeente, Matching</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </div>

              <aside className="panel-surface rounded-[24px] border border-border/70 p-4 shadow-sm">
                <div className="mb-3">
                  <h3 className="text-[17px] font-semibold text-foreground">Samenvatting voor verzending</h3>
                </div>
                <div className="mt-4 divide-y divide-border/60">
                  <div className="flex min-w-0 items-start justify-between gap-3 py-3 text-sm">
                    <span className="text-muted-foreground">Gemeente (woonplaatsbeginsel)</span>
                    <span className="min-w-0 break-words text-right font-medium text-foreground">{(selectedGemeenteLabel || "-")}</span>
                  </div>
                  <div className="flex min-w-0 items-start justify-between gap-3 py-3 text-sm">
                    <span className="text-muted-foreground">Jeugdhulpregio</span>
                    <span className="min-w-0 break-words text-right font-medium text-foreground">{(options.jeugdhulpregio.find((option) => option.value === formState.jeugdhulpregio)?.label ?? formState.jeugdhulpregio) || (options.preferred_region.find((option) => option.value === formState.preferred_region)?.label ?? formState.preferred_region) || "-"}</span>
                  </div>
                  <div className="flex min-w-0 items-start justify-between gap-3 py-3 text-sm">
                    <span className="text-muted-foreground">Zoekradius</span>
                    <span className="min-w-0 break-words text-right font-medium text-foreground">{searchRadiusKm} km</span>
                  </div>
                  <div className="flex min-w-0 items-start justify-between gap-3 py-3 text-sm">
                    <span className="text-muted-foreground">Urgentieadvies</span>
                    <span className="inline-flex min-w-0 items-center justify-end gap-2 text-right font-medium text-foreground">
                      <span className={`h-2.5 w-2.5 rounded-full ${pressureAssessment?.band === "low" ? "bg-green-400" : pressureAssessment?.band === "normal" ? "bg-sky-400" : pressureAssessment?.band === "high" ? "bg-amber-400" : "bg-red-400"}`} />
                      {pressureAssessment?.label ?? "-"}
                    </span>
                  </div>
                  <div className="py-3 text-sm">
                    <div className="mb-2 flex min-w-0 items-start justify-between gap-3">
                      <span className="text-muted-foreground">Ondersteuningsbehoeften</span>
                      {supportNeedOverflow > 0 && <span className="text-xs text-muted-foreground">+{supportNeedOverflow}</span>}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {supportNeedPreview.map((label) => (
                        <span key={label} className="rounded-full border border-violet-500/25 bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-200">
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex min-w-0 items-start justify-between gap-3 py-3 text-sm">
                    <span className="text-muted-foreground">Matchverwachting</span>
                    <span className={`min-w-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${matchingPreview.tone === "good" ? "bg-green-500/10 text-green-300" : matchingPreview.tone === "warning" ? "bg-yellow-500/10 text-yellow-300" : "bg-red-500/10 text-red-300"}`}>
                      {matchingPreview.label}
                    </span>
                  </div>
                  <div className="flex min-w-0 items-start justify-between gap-3 py-3 text-sm">
                    <span className="text-muted-foreground">Zichtbaarheid</span>
                    <span className="min-w-0 break-words text-right font-medium text-foreground">Afgeschermd tot intake/koppeling</span>
                  </div>
                </div>

              </aside>
            </div>
          </div>
        )}
      </section>

      {currentStep === 1 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/35 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="outline" className="h-11 gap-2 rounded-full px-5 text-[15px] font-medium" onClick={() => onCancel?.()}>
            Annuleren
          </Button>
          <Button className="h-11 gap-2 rounded-full px-5 text-[15px] font-medium shadow-sm" onClick={handleAdvance}>
            Volgende stap
            <ArrowRight size={15} />
          </Button>
        </div>
      )}

      {currentStep === 2 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/35 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="outline" className="h-11 gap-2 rounded-full px-5 text-[15px] font-medium" onClick={() => onCancel?.()}>
            <ArrowLeft size={15} />
            Terug
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-11 gap-2 rounded-full px-5 text-[15px] font-medium"
              onClick={() => jumpToStep((currentStep - 1) as 1 | 2 | 3)}
            >
              <ArrowLeft size={15} />
              Vorige
            </Button>
            <Button
              className="h-11 gap-2 rounded-full px-5 text-[15px] font-medium shadow-sm"
              onClick={handleAdvance}
            >
              Volgende
              <ArrowRight size={15} />
            </Button>
          </div>
        </div>
      )}

      {currentStep === 3 && (
        <div className="space-y-3 rounded-2xl border border-border/70 bg-card/35 px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="outline" className="h-11 gap-2 rounded-full px-5 text-[15px] font-medium" onClick={() => onCancel?.()}>
              <ArrowLeft size={15} />
              Vorige stap
            </Button>
            <Button className="h-11 gap-2 rounded-full px-5 text-[15px] font-medium shadow-sm" onClick={handleAdvance}>
              Casus aanmaken
              <Save size={15} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
