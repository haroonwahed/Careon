import { useEffect, useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, Loader2, Save } from "lucide-react";
import { apiClient } from "../../lib/apiClient";
import { SPA_DASHBOARD_URL } from "../../lib/routes";
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

const baseFieldClass = "h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/50";
const baseTextareaClass = "w-full rounded-2xl border border-border bg-card px-3 py-3 text-sm text-foreground outline-none focus:border-primary/50";

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

  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-sm font-semibold text-primary">
        {step}
      </div>
      <div>
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          {copy && (
            <button
              type="button"
              onClick={() => setShowCopy((current) => !current)}
              className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-card/70 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:border-primary/35 hover:text-foreground"
              aria-expanded={showCopy}
            >
              <CircleHelp size={12} />
              Info
              <ChevronDown size={12} className={showCopy ? "rotate-180 transition-transform" : "transition-transform"} />
            </button>
          )}
        </div>
        {copy && showCopy && <p className="mt-2 rounded-xl border border-border/70 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">{copy}</p>}
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
      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</label>
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

  const stepMeta: Array<{ id: 1 | 2 | 3; title: string }> = [
    { id: 1, title: "Basis" },
    { id: 2, title: "Zorgvraag" },
    { id: 3, title: "Randvoorwaarden" },
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
      const payload = await apiClient.post<IntakeCreateSuccess>("/care/api/cases/intake-create/", formState);
      const createdCaseId = payload.case_id?.trim();
      setSuccessMessage(`Casus ${payload.title} is aangemaakt. Je wordt doorgestuurd naar het nieuwe casusdossier.`);
      const target =
        payload.redirect_url ||
        (createdCaseId ? `/care/cases/${createdCaseId}/` : `${SPA_DASHBOARD_URL}?page=casussen`);
      if (createdCaseId) {
        onCreated?.(createdCaseId);
      }
      window.location.href = target;
    } catch (error) {
      const responseText = error instanceof Error ? error.message : "Opslaan is mislukt.";
      const match = responseText.match(/API fout 400: (.*)$/);
      if (match) {
        try {
          const parsed = JSON.parse(match[1]) as IntakeCreateError;
          if (parsed.errors) {
            setFormErrors(parsed.errors);
          } else {
            setLoadError("Controleer de invoer en probeer opnieuw.");
          }
        } catch {
          setLoadError("Opslaan is mislukt. Controleer de invoer en probeer opnieuw.");
        }
      } else {
        setLoadError(responseText);
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
      if (!formState.title.trim() || !formState.start_date || !formState.target_completion_date) {
        setStepError("Vul cliënt, startdatum en deadline matching in voordat je doorgaat.");
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
      <div className="premium-card flex min-h-[320px] items-center justify-center rounded-[28px] border border-border/70 p-8">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 size={18} className="animate-spin" />
          Intakeformulier laden...
        </div>
      </div>
    );
  }

  if (loadError || !formState || !options) {
    return (
      <div className="premium-card rounded-[28px] border border-red-500/20 p-8">
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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            Intake
            <ChevronRight size={12} />
            Nieuwe casus
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold text-foreground">Nieuwe casus</h1>
            <button
              type="button"
              onClick={() => setShowPageGuidance((current) => !current)}
              className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-card/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:border-primary/35 hover:text-foreground"
              aria-expanded={showPageGuidance}
            >
              <CircleHelp size={12} />
              Toelichting
              <ChevronDown size={12} className={showPageGuidance ? "rotate-180 transition-transform" : "transition-transform"} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => onCancel?.()}>
            <ArrowLeft size={15} />
            Terug
          </Button>
        </div>
      </div>

      {showPageGuidance && (
        <div className="space-y-3 rounded-2xl border border-border/80 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          <p>Vul de kern in. Daarna gaat de casus door naar matching.</p>
          <p>Velden met * zijn verplicht.</p>
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

      <section className="premium-card rounded-[28px] border border-border/70 p-5">
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <span>Stap {currentStep} van 3</span>
            <span>{Math.round((currentStep / 3) * 100)}%</span>
          </div>
          <div className="mb-3 grid grid-cols-3 gap-2">
            {stepMeta.map((step) => {
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => {
                    if (isCompleted || isActive) {
                      jumpToStep(step.id);
                    }
                  }}
                  disabled={!isCompleted && !isActive}
                  className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors ${isActive ? "border-primary/50 bg-primary/10 text-primary" : isCompleted ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400/45" : "border-border/60 bg-card/40 text-muted-foreground/70"}`}
                >
                  <span className="block">Stap {step.id}</span>
                  <span className="block text-[11px] font-medium">{step.title}</span>
                </button>
              );
            })}
          </div>
          <div className="h-2 w-full rounded-full bg-muted/40">
            <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${(currentStep / 3) * 100}%` }} />
          </div>
        </div>

        {currentStep === 1 && (
          <div className="space-y-4">
            <SectionHeader step="1" title="Basisinformatie" copy="Leg de kern vast." />

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Cliënt *</label>
              <input
                value={formState.title}
                onChange={(event) => updateField("title", event.target.value)}
                className={baseFieldClass}
                placeholder="Bijv. Voornaam + initialiteit"
              />
              <FieldError message={formErrors.title} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <DateField
                label="Startdatum casus *"
                value={formState.start_date}
                onChange={(nextValue) => updateField("start_date", nextValue)}
                error={formErrors.start_date}
              />

              <div>
                <DateField
                  label="Deadline matching *"
                  value={formState.target_completion_date}
                  onChange={(nextValue) => updateField("target_completion_date", nextValue)}
                  error={formErrors.target_completion_date}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {[3, 7, 14].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setDeadlinePreset(days as 3 | 7 | 14)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${deadlineDays === days ? "border-primary/45 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/35 hover:text-foreground"}`}
                    >
                      {days} dagen
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <SectionHeader step="2" title="Zorgvraag" copy="Maak de vraag concreet." />

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Hoofdcategorie *</label>
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
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Subcategorie</label>
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
                <p className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Complexiteit *</p>
                <p className="mb-2 text-xs text-muted-foreground">Kies 1 optie</p>
                <div className="grid gap-2" role="radiogroup" aria-label="Complexiteit">
                  {options.complexity.map((option) => {
                    const active = formState.complexity === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateField("complexity", option.value)}
                        role="radio"
                        aria-checked={active}
                        className={`rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${active ? "border-primary/50 bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"}`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <FieldError message={formErrors.complexity} />
              </div>

              <div>
                <p className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Urgentie *</p>
                <p className="mb-2 text-xs text-muted-foreground">Kies 1 optie</p>
                <div className="grid gap-2" role="radiogroup" aria-label="Urgentie">
                  {options.urgency.map((option) => {
                    const active = formState.urgency === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateField("urgency", option.value)}
                        role="radio"
                        aria-checked={active}
                        className={`rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${active ? "border-primary/50 bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"}`}
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
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Toelichting (optioneel)</label>
              <textarea
                value={formState.assessment_summary}
                onChange={(event) => updateField("assessment_summary", event.target.value)}
                className={`${baseTextareaClass} min-h-28`}
                placeholder="Beschrijf kort context of aandachtspunten voor beoordeling en matching"
              />
            </div>

            <div className="rounded-2xl border border-blue-500/25 bg-blue-500/5 px-4 py-3 text-sm text-blue-100">
              <p className="font-semibold">Urgentiesuggestie</p>
              <p className="mt-1 text-blue-200/90">{urgencyHint}</p>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-5">
            <SectionHeader step="3" title="Randvoorwaarden" copy="Bepaal de zoekruimte." />

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Regio *</label>
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
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Zoekradius</label>
                <div className="flex gap-2 pt-1">
                  {[10, 25, 50].map((radius) => (
                    <button
                      key={radius}
                      type="button"
                      onClick={() => setSearchRadiusKm(radius as 10 | 25 | 50)}
                      className={`rounded-full border px-3 py-2 text-xs font-semibold ${searchRadiusKm === radius ? "border-primary/45 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/35 hover:text-foreground"}`}
                    >
                      {radius} km
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Beperkingen</p>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {options.diagnostiek.map((option) => {
                  const active = formState.diagnostiek.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleDiagnostiek(option.value)}
                      className={`rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${active ? "border-primary/50 bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"}`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-muted/15 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Matchverwachting</p>
              <div className="mt-2 flex items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${matchingPreview.tone === "good" ? "bg-green-500/15 text-green-300" : matchingPreview.tone === "warning" ? "bg-yellow-500/15 text-yellow-300" : "bg-red-500/15 text-red-300"}`}>
                  {matchingPreview.label}
                </span>
                <span className="text-sm text-muted-foreground">{matchingPreview.detail}</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{regionCapacityHint}</p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card/50 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Controle</p>
              <div className="grid gap-3 text-sm text-foreground md:grid-cols-2">
                <p><span className="text-muted-foreground">Cliënt:</span> {formState.title || "-"}</p>
                <p><span className="text-muted-foreground">Start:</span> {formatDateDisplayValue(formState.start_date)}</p>
                <p><span className="text-muted-foreground">Deadline:</span> {formatDateDisplayValue(formState.target_completion_date)}</p>
                <p><span className="text-muted-foreground">Hoofd:</span> {options.care_category_main.find((o) => o.value === formState.care_category_main)?.label ?? "-"}</p>
                <p><span className="text-muted-foreground">Sub:</span> {visibleSubcategories.find((o) => o.value === formState.care_category_sub)?.label ?? "-"}</p>
                <p><span className="text-muted-foreground">Complex:</span> {options.complexity.find((o) => o.value === formState.complexity)?.label ?? "-"}</p>
                <p><span className="text-muted-foreground">Urgentie:</span> {options.urgency.find((o) => o.value === formState.urgency)?.label ?? "-"}</p>
                <p><span className="text-muted-foreground">Regio:</span> {(options.regio.find((o) => o.value === formState.regio)?.label ?? formState.regio) || "-"}</p>
                <p><span className="text-muted-foreground">Radius:</span> {searchRadiusKm} km</p>
                <p className="md:col-span-2"><span className="text-muted-foreground">Beperkingen:</span> {formState.diagnostiek.length > 0 ? formState.diagnostiek.map((value) => options.diagnostiek.find((o) => o.value === value)?.label ?? value).join(", ") : "Geen"}</p>
              </div>
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

      <div className="premium-card rounded-[24px] border border-border/70 bg-card/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="outline" className="gap-2" onClick={() => onCancel?.()}>
            <ArrowLeft size={15} />
            Terug
          </Button>

          <div className="flex items-center gap-2">
            {currentStep > 1 && (
              <Button
                variant="outline"
                className="gap-2"
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
                className="gap-2"
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
                className="gap-2"
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
