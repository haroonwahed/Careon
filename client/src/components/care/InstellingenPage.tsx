import { useState } from "react";
import { Bell, Building2, Save, Shield, UserCog, Workflow } from "lucide-react";
import { Button } from "../ui/button";

export function InstellingenPage() {
  const [organizationName, setOrganizationName] = useState("Gemeente Utrecht");
  const [defaultRegion, setDefaultRegion] = useState("Utrecht");
  const [dailyDigest, setDailyDigest] = useState(true);
  const [criticalAlerts, setCriticalAlerts] = useState(true);
  const [mfaRequired, setMfaRequired] = useState(true);
  const [autoEscalation, setAutoEscalation] = useState(true);

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

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="premium-card p-5">
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
              <select
                value={defaultRegion}
                onChange={(event) => setDefaultRegion(event.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground"
              >
                <option>Utrecht</option>
                <option>Amsterdam</option>
                <option>Rotterdam</option>
                <option>Den Haag</option>
              </select>
            </label>
          </div>
        </section>

        <section className="premium-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Bell size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Meldingen</h2>
          </div>
          <div className="space-y-3">
            <ToggleRow
              title="Dagelijkse samenvatting"
              description="Ontvang elke ochtend een overzicht van bottlenecks en open acties."
              checked={dailyDigest}
              onChange={setDailyDigest}
            />
            <ToggleRow
              title="Kritieke signalen direct"
              description="Stuur direct een melding bij kritieke wachttijd- of capaciteitsproblemen."
              checked={criticalAlerts}
              onChange={setCriticalAlerts}
            />
          </div>
        </section>

        <section className="premium-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Shield size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Beveiliging</h2>
          </div>
          <div className="space-y-3">
            <ToggleRow
              title="MFA verplichten"
              description="Alle gebruikers loggen in met een extra verificatiestap."
              checked={mfaRequired}
              onChange={setMfaRequired}
            />
            <div className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
              Laatste wachtwoordbeleid update: 10 april 2026
            </div>
          </div>
        </section>

        <section className="premium-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Workflow size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Workflow</h2>
          </div>
          <div className="space-y-3">
            <ToggleRow
              title="Automatische escalatie"
              description="Escaleren wanneer een casus langer dan 14 dagen in matching staat."
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
  checked: boolean;
  onChange: (value: boolean) => void;
}

function ToggleRow({ title, description, checked, onChange }: ToggleRowProps) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2">
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
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
      <p className="mt-1 text-xl font-semibold text-foreground">{count}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
