import { useEffect, useState } from "react";
import { Bell, Building2, CheckCircle2, ChevronDown, Save, Shield, UserCog, Workflow } from "lucide-react";
import { Button } from "../ui/button";

export function InstellingenPage() {
  const [organizationName, setOrganizationName] = useState("Gemeente Utrecht");
  const [defaultRegion, setDefaultRegion] = useState("Utrecht");
  const [dailyDigest, setDailyDigest] = useState(true);
  const [criticalAlerts, setCriticalAlerts] = useState(true);
  const [mfaRequired, setMfaRequired] = useState(true);
  const [autoEscalation, setAutoEscalation] = useState(true);
  const [designMode, setDesignMode] = useState<"spa">("spa");
  const [designModeSaving, setDesignModeSaving] = useState(false);
  const [designModeMessage, setDesignModeMessage] = useState<string | null>(null);

  const systemStateStrip = !criticalAlerts
    ? { label: "Kritieke signalen uit", warn: true }
    : autoEscalation
      ? { label: "Automatisering actief", warn: false }
      : { label: "Escalatie gedeeltelijk actief", warn: false };

  const digestStateText = dailyDigest ? "Actief" : "Uitgeschakeld";
  const criticalSignalsStateText = criticalAlerts ? "Geen recente signalen" : "Signalen staan uit";
  const escalationStateText = autoEscalation ? "Laatste escalatie: onbekend" : "Handmatige opvolging";

  useEffect(() => {
    let ignore = false;

    const bootstrapDesignMode = async () => {
      try {
        const response = await fetch("/settings/design-mode/", {
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
          },
        });
        if (!response.ok) {
          throw new Error("Kon ontwerpmodus niet laden.");
        }
        const payload = (await response.json()) as { design_mode?: "spa" };
        const nextMode: "spa" = payload.design_mode === "spa" ? "spa" : "spa";
        if (!ignore) {
          setDesignMode(nextMode);
          try {
            window.localStorage.setItem("careon-design-mode", nextMode);
          } catch {
            // Ignore storage failures.
          }
        }
      } catch {
        const storedMode = window.localStorage.getItem("careon-design-mode");
        if (!ignore && storedMode === "spa") {
          setDesignMode("spa");
        }
      }
    };

    bootstrapDesignMode();
    return () => {
      ignore = true;
    };
  }, []);

  const getCsrfToken = () => {
    const match = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  };

  const handleDesignModeSave = async () => {
    setDesignModeSaving(true);
    setDesignModeMessage(null);

    try {
      const response = await fetch("/settings/design-mode/", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCsrfToken(),
          Accept: "application/json",
        },
        body: JSON.stringify({ design_mode: designMode }),
      });

      if (!response.ok) {
        throw new Error("Kon ontwerpmodus niet opslaan.");
      }

      try {
        window.localStorage.setItem("careon-design-mode", designMode);
      } catch {
        // Ignore storage failures.
      }

      setDesignModeMessage("Ontwerpmodus opgeslagen. Workspace wordt bijgewerkt...");
      window.location.href = "/dashboard/";
    } catch {
      setDesignModeMessage("Opslaan is mislukt. Probeer opnieuw.");
      setDesignModeSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="mb-2 text-3xl font-semibold text-foreground">Instellingen</h1>
          <p className="text-sm text-muted-foreground">
            Beheer organisatievoorkeuren, meldingen, beveiliging en workflowregels.
          </p>
        </div>
        <Button className="gap-2">
          <Save size={15} />
          Wijzigingen opslaan
        </Button>
      </div>

      <div className={`rounded-xl border px-4 py-2 flex items-center gap-2 ${
        systemStateStrip.warn
          ? "border-amber-500/25 bg-amber-500/5 text-amber-600 dark:text-amber-400"
          : "border-border bg-muted/35 text-muted-foreground"
      }`}>
        <CheckCircle2 size={13} className="flex-shrink-0" />
        <p className="text-xs font-medium">{systemStateStrip.label}</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="premium-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Workflow size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Ontwerpmodus</h2>
          </div>

          <p className="mb-3 text-xs text-muted-foreground">
            De moderne workspace is de standaardinterface voor je werkruimte.
          </p>

          <label className="mb-3 block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Actieve modus</span>
            <div className="h-10 w-full rounded-xl border border-border bg-muted/50 px-3 text-sm text-foreground flex items-center">
              Modern workspace (SPA)
            </div>
          </label>

          <Button onClick={handleDesignModeSave} disabled={designModeSaving} className="gap-2">
            <Save size={15} />
            {designModeSaving ? "Opslaan..." : "Ontwerpmodus toepassen"}
          </Button>

          {designModeMessage && (
            <p className="mt-3 text-xs text-muted-foreground">{designModeMessage}</p>
          )}
        </section>

        <section className="premium-card p-5 border-border/80 bg-card/95">
          <div className="mb-4 flex items-center gap-2">
            <Building2 size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Organisatie</h2>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Naam</span>
              <input
                value={organizationName}
                onChange={(event) => setOrganizationName(event.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Standaard regio</span>
              <div className="relative">
              <select
                value={defaultRegion}
                onChange={(event) => setDefaultRegion(event.target.value)}
                className="h-10 w-full appearance-none rounded-xl border border-border bg-card pl-3 pr-8 text-sm text-foreground"
              >
                <option>Utrecht</option>
                <option>Amsterdam</option>
                <option>Rotterdam</option>
                <option>Den Haag</option>
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
            </label>

            <p className="text-xs text-muted-foreground">Stabiele configuratie, zelden gewijzigd.</p>
          </div>
        </section>

        <section className="premium-card p-5 border-border/90 bg-card/98">
          <div className="mb-4 flex items-center gap-2">
            <Bell size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Meldingen</h2>
          </div>
          <div className="space-y-3">
            <ToggleRow
              title="Dagelijkse samenvatting"
              description="Dagelijks overzicht bij start"
              context={digestStateText}
              checked={dailyDigest}
              onChange={setDailyDigest}
            />
            <ToggleRow
              title="Kritieke signalen direct"
              description="Direct bij blokkades"
              context={criticalSignalsStateText}
              checked={criticalAlerts}
              onChange={setCriticalAlerts}
            />
          </div>
        </section>

        <section className="premium-card p-5 border-blue-border/40 bg-blue-light/20">
          <div className="mb-4 flex items-center gap-2">
            <Shield size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Beveiliging</h2>
          </div>
          <div className="space-y-3">
            <ToggleRow
              title="MFA verplichten"
              description="Veilige toegang gegarandeerd"
              context={mfaRequired ? "Actief voor alle gebruikers" : "Niet verplicht"}
              checked={mfaRequired}
              onChange={setMfaRequired}
            />
            <div className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
              Laatste wachtwoordbeleid update: 10 april 2026
            </div>
          </div>
        </section>

        <section className="premium-card border-primary/35 bg-primary/5 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Workflow size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Workflow</h2>
          </div>
          <div className="space-y-3">
            <ToggleRow
              title="Automatische escalatie"
              description="Voorkomt vastlopen"
              context={escalationStateText}
              checked={autoEscalation}
              onChange={setAutoEscalation}
            />
            <div className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
              Escalatie-eigenaar: Regisseur dienstdoende
            </div>
          </div>
        </section>
      </div>

      <section className="premium-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <UserCog size={16} className="text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Toegangsprofielen</h3>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <AccessCard title="Regisseurs" count={14} description="Case triage, matching en plaatsing" />
          <AccessCard title="Beoordelaars" count={9} description="Beoordeling en kwaliteitscontrole" />
          <AccessCard title="Admins" count={3} description="Platformbeheer en autorisaties" />
        </div>
      </section>
    </div>
  );
}

interface ToggleRowProps {
  title: string;
  description: string;
  context?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

function ToggleRow({ title, description, context, checked, onChange }: ToggleRowProps) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2">
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
        {context && <p className="mt-1 text-xs text-muted-foreground/90">{context}</p>}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 accent-primary"
      />
    </label>
  );
}

interface AccessCardProps {
  title: string;
  count: number;
  description: string;
}

function AccessCard({ title, count, description }: AccessCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{count} <span className="text-xs font-medium text-muted-foreground">actief</span></p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
