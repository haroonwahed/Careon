import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, CalendarDays, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, Loader2, Save } from "lucide-react";
import { apiClient } from "../../lib/apiClient";
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
  onCreated?: () => void;
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

  useEffect(() => {
    let ignore = false;

    const bootstrap = async () => {
      try {
        const payload = await apiClient.get<IntakeFormPayload>("/care/api/cases/intake-form/");
        if (ignore) {
          return;
        }
        setFormState(payload.initial_values);
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
      setSuccessMessage(`Casus ${payload.title} is aangemaakt. Je wordt doorgestuurd naar het casusoverzicht.`);
      onCreated?.();
      window.location.href = payload.redirect_url || "/dashboard/?page=casussen";
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
          <p>Start met de intakegegevens. Na opslaan ga je direct naar het casusdossier voor beoordeling en matching.</p>
          <p>Velden met * zijn verplicht. Houd de intake kort en besluitgericht; aanvullende context kan later in het dossier.</p>
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
        <SectionHeader step="1" title="Identificatie" copy="Leg de minimale intake vast zodat regie, beoordeling en matching direct kunnen starten." />
        <div className="grid gap-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Client *</label>
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

            <DateField
              label="Doeldatum matchbesluit *"
              value={formState.target_completion_date}
              onChange={(nextValue) => updateField("target_completion_date", nextValue)}
              error={formErrors.target_completion_date}
            />
          </div>
        </div>
      </section>

      <section className="premium-card rounded-[28px] border border-border/70 p-5">
        <SectionHeader step="2" title="Zorgvraag" copy="Vat de hulpvraag compact samen en plaats de casus meteen in de juiste zorgcategorie." />
        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Hoofdcategorie zorgvraag *</label>
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
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Subcategorie zorgvraag</label>
              <select
                value={formState.care_category_sub}
                onChange={(event) => updateField("care_category_sub", event.target.value)}
                className={baseFieldClass}
              >
                <option value="">---------</option>
                {visibleSubcategories.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <FieldError message={formErrors.care_category_sub} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Intake samenvatting</label>
            <textarea
              value={formState.assessment_summary}
              onChange={(event) => updateField("assessment_summary", event.target.value)}
              className={`${baseTextareaClass} min-h-32`}
              placeholder="Kern van de hulpvraag, urgentie en aandachtspunten"
            />
            <FieldError message={formErrors.assessment_summary} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Gemeente</label>
              <select
                value={formState.gemeente}
                onChange={(event) => updateField("gemeente", event.target.value)}
                className={baseFieldClass}
              >
                {selectFieldOptions(options.gemeente, "Selecteer gemeente")}
              </select>
              <FieldError message={formErrors.gemeente} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Complexiteit *</label>
              <select
                value={formState.complexity}
                onChange={(event) => updateField("complexity", event.target.value)}
                className={baseFieldClass}
              >
                {selectFieldOptions(options.complexity)}
              </select>
              <FieldError message={formErrors.complexity} />
            </div>
          </div>
        </div>
      </section>

      <section className="premium-card rounded-[28px] border border-border/70 p-5">
        <SectionHeader step="3" title="Diagnostiek en urgentie" copy="Leg vast wat matching en triage direct nodig hebben. Niet alle details hoeven nu al volledig te zijn." />
        <div className="grid gap-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Diagnostiek</p>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
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

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Urgentie *</label>
              <select
                value={formState.urgency}
                onChange={(event) => updateField("urgency", event.target.value)}
                className={baseFieldClass}
              >
                {options.urgency.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <FieldError message={formErrors.urgency} />

              <label className="mt-3 inline-flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={formState.urgency_applied}
                  onChange={(event) => updateField("urgency_applied", event.target.checked)}
                  className="h-4 w-4 rounded border-border bg-card"
                />
                Urgentie aangevraagd
              </label>

              {formState.urgency_applied && (
                <div className="mt-3">
                  <DateField
                    label="Sinds wanneer aangevraagd"
                    value={formState.urgency_applied_since}
                    onChange={(nextValue) => updateField("urgency_applied_since", nextValue)}
                  />
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Gewenste zorgvorm *</label>
              <div className="grid gap-2">
                {options.preferred_care_form.map((option) => {
                  const active = formState.preferred_care_form === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        updateField("preferred_care_form", option.value);
                        updateField("zorgvorm_gewenst", option.value);
                      }}
                      className={`rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${active ? "border-primary/50 bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"}`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <FieldError message={formErrors.preferred_care_form} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Voorkeur regiotype</label>
              <select
                value={formState.preferred_region_type}
                onChange={(event) => updateField("preferred_region_type", event.target.value)}
                className={baseFieldClass}
              >
                {options.preferred_region_type.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <FieldError message={formErrors.preferred_region_type} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Voorkeursregio</label>
              <select
                value={formState.preferred_region}
                onChange={(event) => updateField("preferred_region", event.target.value)}
                className={baseFieldClass}
              >
                <option value="">Selecteer regio</option>
                {options.preferred_region.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <FieldError message={formErrors.preferred_region} />
            </div>
          </div>
        </div>
      </section>

      <section className="premium-card rounded-[28px] border border-border/70 p-5">
        <SectionHeader step="4" title="Cliëntprofiel" copy="Voeg alleen context toe die helpt bij prioritering, selectie en overdracht." />
        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Leeftijdscategorie cliënt</label>
              <select
                value={formState.client_age_category}
                onChange={(event) => updateField("client_age_category", event.target.value)}
                className={baseFieldClass}
              >
                <option value="">Selecteer</option>
                {options.client_age_category.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <FieldError message={formErrors.client_age_category} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Gezinssituatie</label>
              <select
                value={formState.family_situation}
                onChange={(event) => updateField("family_situation", event.target.value)}
                className={baseFieldClass}
              >
                <option value="">Selecteer</option>
                {options.family_situation.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <FieldError message={formErrors.family_situation} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Dagbesteding</label>
              <input
                value={formState.school_work_status}
                onChange={(event) => updateField("school_work_status", event.target.value)}
                className={baseFieldClass}
                placeholder="School, werk of daginvulling"
              />
              <FieldError message={formErrors.school_work_status} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Casusregisseur</label>
              <select
                value={formState.case_coordinator}
                onChange={(event) => updateField("case_coordinator", event.target.value)}
                className={baseFieldClass}
              >
                <option value="">Nog niet toegewezen</option>
                {options.case_coordinator.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <FieldError message={formErrors.case_coordinator} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Aanvullende opmerkingen</label>
            <textarea
              value={formState.description}
              onChange={(event) => updateField("description", event.target.value)}
              className={`${baseTextareaClass} min-h-28`}
              placeholder="Context voor beoordeling of matching die niet in de intake samenvatting past"
            />
            <FieldError message={formErrors.description} />
          </div>
        </div>
      </section>

      <div className="premium-card rounded-[24px] border border-border/70 bg-card/60 p-4">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" className="gap-2" onClick={() => onCancel?.()}>
            <ArrowLeft size={15} />
            Terug
          </Button>
          <Button className="gap-2" onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? "Opslaan..." : "Casus aanmaken"}
          </Button>
        </div>
      </div>
    </div>
  );
}