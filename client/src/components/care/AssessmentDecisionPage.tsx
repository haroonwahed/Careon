import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, CalendarClock, CheckCircle2, Clock3, Loader2, MapPin, ShieldAlert, Sparkles } from 'lucide-react';
import { Button } from '../ui/button';
import { useAssessmentDecision } from '../../hooks/useAssessmentDecision';

interface AssessmentDecisionPageProps {
  caseId: string;
  onBack: () => void;
  onSaved?: (nextPage: 'matching' | 'beoordelingen', caseId: string) => void;
}

type FormState = {
  decision: string;
  zorgtype: string;
  shortDescription: string;
  urgency: string;
  complexity: string;
  constraints: string[];
};

const fieldClass = 'h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/50';
const textareaClass = 'min-h-28 w-full rounded-2xl border border-border bg-card px-3 py-3 text-sm text-foreground outline-none focus:border-primary/50';

function formatDateLabel(value: string): string {
  if (!value) {
    return 'Nog niet gepland';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('nl-NL', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function signalClasses(severity: 'critical' | 'warning' | 'info') {
  switch (severity) {
    case 'critical':
      return 'border-red-500/30 bg-red-500/6 text-red-200';
    case 'warning':
      return 'border-amber-500/30 bg-amber-500/8 text-amber-100';
    default:
      return 'border-border bg-muted/30 text-muted-foreground';
  }
}

function timelineToneClasses(tone: 'neutral' | 'info' | 'warning') {
  switch (tone) {
    case 'info':
      return 'bg-primary/15 text-primary';
    case 'warning':
      return 'bg-amber-500/15 text-amber-200';
    default:
      return 'bg-muted/40 text-muted-foreground';
  }
}

export function AssessmentDecisionPage({ caseId, onBack, onSaved }: AssessmentDecisionPageProps) {
  const { data, loading, saving, error, save, refetch } = useAssessmentDecision(caseId);
  const [formState, setFormState] = useState<FormState | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) {
      return;
    }
    setFormState(data.form);
  }, [data]);

  const consequence = formState?.decision ? data?.consequences[formState.decision] : null;
  const isValid = Boolean(formState?.decision);

  const toggleConstraint = (value: string) => {
    setFormState((current) => {
      if (!current) {
        return current;
      }
      const exists = current.constraints.includes(value);
      return {
        ...current,
        constraints: exists
          ? current.constraints.filter((item) => item !== value)
          : [...current.constraints, value],
      };
    });
  };

  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setFormState((current) => (current ? { ...current, [field]: value } : current));
  };

  const handleSubmit = async () => {
    if (!formState || !isValid) {
      return;
    }
    setSubmitError(null);
    try {
      const result = await save(formState);
      onSaved?.(result.nextPage, caseId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Beoordeling bevestigen is mislukt.';
      setSubmitError(message);
    }
  };

  if (loading) {
    return <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">Beoordeling laden…</div>;
  }

  if (error || !data || !formState) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft size={16} />
          Terug naar beoordelingen
        </Button>
        <div className="rounded-2xl border bg-card p-10 text-center space-y-3">
          <p className="text-lg font-semibold text-foreground">Beoordeling niet beschikbaar</p>
          <p className="text-sm text-muted-foreground">{error ?? 'Deze beoordeling kon niet geladen worden.'}</p>
          <Button variant="outline" onClick={refetch}>Opnieuw proberen</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <Button variant="ghost" onClick={onBack} className="gap-2 hover:bg-primary/10 hover:text-primary">
        <ArrowLeft size={16} />
        Terug naar beoordelingen
      </Button>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-border bg-card p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Beoordeling</p>
                <h1 className="mt-1.5 text-2xl font-semibold text-foreground">Beslissing</h1>
                <p className="mt-1.5 max-w-2xl text-xs leading-5 text-muted-foreground">Kies direct of deze casus door kan naar matching. Vul alleen de informatie in die nodig is om die beslissing verantwoord te nemen.</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/20 px-3 py-2.5 text-right">
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Casus</p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">{data.summary.caseId}</p>
                <p className="text-xs text-muted-foreground">{data.summary.title}</p>
              </div>
            </div>

            <div className="space-y-2.5">
              {data.options.decision.map((option) => {
                const active = formState.decision === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateField('decision', option.value)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${active ? 'border-primary/45 bg-primary/10 shadow-sm' : 'border-border bg-card hover:border-primary/35 hover:bg-muted/20'}`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{option.label}</p>
                        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{data.consequences[option.value]?.description}</p>
                      </div>
                      {active && <CheckCircle2 size={18} className="text-primary" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {consequence && (
              <div className="mt-3 rounded-2xl border border-primary/20 bg-primary/6 px-4 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground">Gevolg van deze keuze</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{consequence.description}</p>
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-border bg-card p-6">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-foreground">Beslisinformatie</h2>
              <p className="mt-1 text-sm text-muted-foreground">Compact invoeren, direct bruikbaar voor het besluit.</p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Zorgtype</label>
                <select value={formState.zorgtype} onChange={(event) => updateField('zorgtype', event.target.value)} className={fieldClass}>
                  {data.options.zorgtype.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Urgentie</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {data.options.urgency.map((option) => {
                    const active = formState.urgency === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateField('urgency', option.value)}
                        className={`rounded-2xl border px-3 py-3 text-left text-sm ${active ? 'border-primary/45 bg-primary/10 text-foreground' : 'border-border bg-card text-muted-foreground hover:border-primary/35'}`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Complexiteit</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {data.options.complexity.map((option) => {
                    const active = formState.complexity === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateField('complexity', option.value)}
                        className={`rounded-2xl border px-3 py-3 text-left text-sm ${active ? 'border-primary/45 bg-primary/10 text-foreground' : 'border-border bg-card text-muted-foreground hover:border-primary/35'}`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Randvoorwaarden</p>
                <div className="grid gap-2">
                  {data.options.constraints.map((option) => {
                    const active = formState.constraints.includes(option.value);
                    return (
                      <label key={option.value} className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-3 text-sm ${active ? 'border-primary/45 bg-primary/10 text-foreground' : 'border-border bg-card text-muted-foreground hover:border-primary/35'}`}>
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleConstraint(option.value)}
                          className="h-4 w-4 rounded border-border bg-card"
                        />
                        <span>{option.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-5">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Korte omschrijving</label>
              <textarea
                value={formState.shortDescription}
                onChange={(event) => updateField('shortDescription', event.target.value)}
                className={textareaClass}
                placeholder="Vat alleen samen wat nodig is om deze beslissing te dragen."
              />
            </div>

            {data.hints.riskHints.length > 0 && (
              <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/6 px-4 py-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={16} className="mt-0.5 text-amber-200" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Aandachtspunten</p>
                    {data.hints.riskHints.map((hint) => (
                      <p key={hint} className="text-sm text-muted-foreground">{hint}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          <div className="sticky bottom-4 z-20 rounded-3xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Bevestig beoordeling</p>
                <p className="text-sm text-muted-foreground">{formState.decision ? data.consequences[formState.decision]?.title : 'Selecteer eerst een beslissing om verder te gaan.'}</p>
                {submitError && <p className="mt-1 text-sm text-red-300">{submitError}</p>}
              </div>
              <Button onClick={handleSubmit} disabled={!isValid || saving} className="min-w-[220px] gap-2">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {saving ? 'Opslaan...' : 'Bevestig beoordeling'}
              </Button>
            </div>
          </div>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <section className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-primary" />
              <h2 className="text-base font-semibold text-foreground">Casus summary</h2>
            </div>
            <div className="mt-4 grid gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Titel</p>
                <p className="font-medium text-foreground">{data.summary.title}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground">Regio</p>
                  <p className="font-medium text-foreground">{data.summary.region}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Gemeente</p>
                  <p className="font-medium text-foreground">{data.summary.municipality}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground">Zorgtype</p>
                  <p className="font-medium text-foreground">{data.summary.careType}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Wachttijd</p>
                  <p className="font-medium text-foreground">{data.summary.waitDays} dagen</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">Regisseur</p>
                <p className="font-medium text-foreground">{data.summary.coordinator}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Intake samenvatting</p>
                <p className="line-clamp-4 text-sm text-foreground">{data.summary.intakeSummary}</p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-primary" />
              <h2 className="text-base font-semibold text-foreground">Systeemhints</h2>
            </div>
            <div className="mt-4 space-y-4 text-sm">
              <div className="rounded-2xl border border-border bg-muted/20 p-3">
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Voorgestelde urgentie</p>
                <p className="mt-1 font-semibold text-foreground">{data.hints.suggestedUrgency.label}</p>
                <p className="mt-1 text-muted-foreground">{data.hints.suggestedUrgency.reason}</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/20 p-3">
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Matching-moeilijkheid</p>
                <p className="mt-1 font-semibold text-foreground">{data.hints.matchingDifficulty.level}</p>
                <p className="mt-1 text-muted-foreground">{data.hints.matchingDifficulty.detail}</p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <ShieldAlert size={16} className="text-primary" />
              <h2 className="text-base font-semibold text-foreground">Signalen</h2>
            </div>
            <div className="mt-4 space-y-3">
              {data.signals.length === 0 && (
                <p className="text-sm text-muted-foreground">Geen actieve signalen voor deze casus.</p>
              )}
              {data.signals.map((signal) => (
                <div key={signal.id} className={`rounded-2xl border px-3 py-3 text-sm ${signalClasses(signal.severity)}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-foreground">{signal.title}</p>
                    <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{signal.status}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{signal.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <CalendarClock size={16} className="text-primary" />
              <h2 className="text-base font-semibold text-foreground">Timeline</h2>
            </div>
            <div className="mt-4 space-y-3">
              {data.timeline.map((item) => (
                <div key={`${item.label}-${item.date}`} className="flex items-start gap-3">
                  <div className={`mt-1 rounded-full px-2 py-1 text-[11px] font-semibold ${timelineToneClasses(item.tone)}`}>
                    <Clock3 size={12} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{formatDateLabel(item.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
