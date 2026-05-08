import { useLayoutEffect, type CSSProperties, type ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  Building2,
  Clock3,
  CreditCard,
  FileKey2,
  Globe,
  KeyRound,
  Layers3,
  Lock,
  Mail,
  Palette,
  Plug,
  Save,
  Scale,
  Shield,
  ShieldCheck,
  Users,
  Webhook,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../ui/button";
import { Switch } from "../../ui/switch";
import { cn } from "../../ui/utils";
import { tokens } from "../../../design/tokens";
import { CareInfoPopover } from "../CareUnifiedPage";
import { SETTINGS_NAV_GROUPS, type SettingsSectionId } from "./instellingenNav";
import { CARE_TERMS } from "../../../lib/terminology";

export type InstellingenSettingsExperienceProps = {
  activeSection: SettingsSectionId;
  onSectionChange: (id: SettingsSectionId) => void;
  organizationName: string;
  onOrganizationNameChange: (value: string) => void;
  defaultRegion: string;
  onDefaultRegionChange: (value: string) => void;
  themeLabel: string;
  languageLabel: string;
  timezoneLabel: string;
  dailyDigest: boolean;
  onDailyDigestChange: (value: boolean) => void;
  criticalAlerts: boolean;
  onCriticalAlertsChange: (value: boolean) => void;
  mfaRequired: boolean;
  onMfaRequiredChange: (value: boolean) => void;
  autoEscalation: boolean;
  onAutoEscalationChange: (value: boolean) => void;
  designModeSaving: boolean;
  designModeMessage: string | null;
  onDesignModeSave: () => void;
  orgSaveMessage: string | null;
  onOrgProfileSave: () => void;
  systemStrip: { label: string; warn: boolean };
  activeToggles: number;
};

export function InstellingenSettingsExperience({
  activeSection,
  onSectionChange,
  organizationName,
  onOrganizationNameChange,
  defaultRegion,
  onDefaultRegionChange,
  themeLabel,
  languageLabel,
  timezoneLabel,
  dailyDigest,
  onDailyDigestChange,
  criticalAlerts,
  onCriticalAlertsChange,
  mfaRequired,
  onMfaRequiredChange,
  autoEscalation,
  onAutoEscalationChange,
  designModeSaving,
  designModeMessage,
  onDesignModeSave,
  orgSaveMessage,
  onOrgProfileSave,
  systemStrip,
  activeToggles,
}: InstellingenSettingsExperienceProps) {
  useLayoutEffect(() => {
    const id = window.requestAnimationFrame(() => {
      document.getElementById("settings-section-heading")?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [activeSection]);

  return (
    <div
      data-testid="instellingen-workspace"
      className="flex min-h-0 w-full min-w-0 flex-col gap-6 lg:flex-row lg:gap-10"
    >
      <SettingsSidebar activeSection={activeSection} onSelect={onSectionChange} />

      <div className="min-w-0 flex-1 pb-10">
        <header className="mb-8 border-b border-border/30 pb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Instellingen</p>
          <h1 className="mt-1 text-[clamp(1.35rem,2.5vw,1.65rem)] font-semibold tracking-[-0.02em] text-foreground">
            Operationele regie
          </h1>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
            Configureer hoe CareOn besluitvorming ondersteunt: zichtbaarheid, ketenlogica, matching en verantwoording.
            Wijzigingen zijn bedoeld voor beheerders; elke aanpassing hoort traceerbaar te zijn.
          </p>
          <div
            className={cn(
              "mt-5 flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2.5 text-[13px] transition-colors",
              systemStrip.warn
                ? "border-amber-500/25 bg-amber-500/[0.06] text-amber-100/90"
                : "border-border/50 bg-card/25 text-muted-foreground",
            )}
          >
            <Activity className="size-4 shrink-0 opacity-80" aria-hidden />
            <span className="min-w-0 flex-1 font-medium text-foreground">{systemStrip.label}</span>
            <span className="tabular-nums text-[12px] text-muted-foreground">{activeToggles} ketenvoorkeuren actief</span>
          </div>
          <p className="mt-4 rounded-xl border border-border/45 bg-muted/20 px-3 py-2.5 text-[13px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Pilot:</span> meldingen, MFA, escalatie, organisatie en regio worden{" "}
            <span className="font-medium text-foreground">lokaal in deze browser</span> bewaard (zie bevestigingsknoppen per sectie). Schuifregelaars, fictieve integraties en voorbeelduitbreidingen zijn{" "}
            <span className="font-medium text-foreground">niet gekoppeld aan productie-API’s</span>.
          </p>
        </header>

        <main
          id="settings-main-panel"
          aria-labelledby="settings-section-heading"
          className="transition-opacity duration-200"
          style={{ maxWidth: tokens.settingsWorkspace.contentMeasure }}
        >
          {orgSaveMessage ? (
            <p
              role="status"
              aria-live="polite"
              className="mb-6 rounded-xl border border-border/55 bg-card/40 px-3 py-2.5 text-[13px] leading-relaxed text-muted-foreground shadow-sm"
            >
              {orgSaveMessage}
            </p>
          ) : null}
          {activeSection === "algemeen" && (
            <SettingsSection
              title="Algemeen"
              lede="Weergave, taal en tijd. Dit bepaalt hoe teams dezelfde feiten zien — zonder de keten zelf te wijzigen."
              primaryAction={
                <Button type="button" onClick={onOrgProfileSave} className="gap-2 rounded-xl">
                  <Save className="size-4" />
                  Basis voorkeuren vastleggen
                </Button>
              }
            >
              <p className="mb-5 border-l-2 border-primary/35 pl-3 text-[13px] leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Wat is hier actief:</span> alleen <strong className="font-medium text-foreground">organisatienaam</strong> kun je in dit blok aanpassen; kies <strong className="font-medium text-foreground">Basis voorkeuren vastleggen</strong> om te bevestigen (nu lokaal in deze browser; serveropslag volgt).{" "}
                <strong className="font-medium text-foreground">Thema</strong> wissel je met het zonnetje in de kopbalk.{" "}
                <strong className="font-medium text-foreground">Taal</strong> en <strong className="font-medium text-foreground">tijdzone</strong> staan in deze release vast.{" "}
                Meldingen (digest, kritieke alerts), MFA en escalatie vind je onder <strong className="font-medium text-foreground">Meldingen</strong>, <strong className="font-medium text-foreground">Gebruikers & rollen</strong> en <strong className="font-medium text-foreground">Workflow & regie</strong>.
              </p>
              <SettingsCluster title="Identiteit in het werkstation">
                <Field label="Organisatienaam" hint="Zichtbaar voor geautoriseerde gebruikers.">
                  <input
                    id="settings-organization-name"
                    name="organizationName"
                    autoComplete="organization"
                    value={organizationName}
                    onChange={(e) => onOrganizationNameChange(e.target.value)}
                    className="h-10 w-full rounded-xl border border-border/60 bg-background/80 px-3 text-sm text-foreground outline-none transition-shadow focus:border-primary/35 focus:ring-2 focus:ring-primary/15"
                  />
                </Field>
                <Field label="Logo" hint="Upload via beheerportaal (koppeling volgt).">
                  <div
                    className="flex h-10 items-center rounded-xl border border-dashed border-border/60 bg-muted/10 px-3 text-[13px] text-muted-foreground"
                    aria-disabled="true"
                  >
                    Geen bestand geselecteerd
                  </div>
                </Field>
              </SettingsCluster>

              <SettingsCluster
                title="Weergave & taal"
                hint="Alleen ter informatie op deze pagina — geen aparte schakelaars hieronder."
              >
                <div className="grid gap-4 sm:grid-cols-3">
                  <ReadOnlyTile icon={<Palette className="size-4" />} label="Thema" value={themeLabel} />
                  <ReadOnlyTile icon={<Globe className="size-4" />} label="Taal" value={languageLabel} />
                  <ReadOnlyTile icon={<Clock3 className="size-4" />} label="Tijdzone" value={timezoneLabel} />
                </div>
              </SettingsCluster>

              <SettingsCluster title="Workspace" hint="Vastgelegde ontwerpmodus beïnvloedt waar gebruikers werken.">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Regie-omgeving (SPA)</p>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      Moderne werkruimte voor casussen, matching en plaatsing.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onDesignModeSave}
                    disabled={designModeSaving}
                    className="shrink-0 gap-2 rounded-xl"
                  >
                    <Save className="size-4" />
                    {designModeSaving ? "Bezig met vastleggen…" : "Workspace vastleggen"}
                  </Button>
                </div>
                {designModeMessage ? (
                  <p role="status" aria-live="polite" className="text-[13px] text-muted-foreground">
                    {designModeMessage}
                  </p>
                ) : null}
              </SettingsCluster>
            </SettingsSection>
          )}

          {activeSection === "organisatie" && (
            <SettingsSection
              title="Organisatie"
              lede="Regionale context en standaarden. Dit stuurt geen individuele casussen aan, maar wel de standaard lens waaronder teams werken."
              primaryAction={
                <Button type="button" onClick={onOrgProfileSave} className="gap-2 rounded-xl">
                  <Building2 className="size-4" />
                  Regio-instellingen opslaan
                </Button>
              }
            >
              <SettingsCluster title="Regio & jurisdictie">
                <Field label="Standaard regio" hint="Voor nieuwe dossiers en matching zonder expliciete override.">
                  <select
                    value={defaultRegion}
                    onChange={(e) => onDefaultRegionChange(e.target.value)}
                    className="h-10 w-full rounded-xl border border-border/60 bg-background/80 px-3 text-sm text-foreground outline-none focus:border-primary/35 focus:ring-2 focus:ring-primary/15"
                  >
                    <option>Utrecht</option>
                    <option>Amsterdam</option>
                    <option>Rotterdam</option>
                    <option>Den Haag</option>
                  </select>
                </Field>
              </SettingsCluster>
              <details className="group rounded-xl border border-border/40 bg-card/20 px-4 py-3">
                <summary className="cursor-pointer list-none text-[13px] font-medium text-foreground group-open:mb-3">
                  Regionale afspraken{" "}
                  <span className="font-normal text-muted-foreground">— optioneel</span>
                </summary>
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  Koppel afspraken over wachttijden en escalatie aan je regio wanneer dit formeel is vastgelegd. Tot die tijd
                  blijft de keten onder gemeentelijke regie.
                </p>
              </details>
            </SettingsSection>
          )}

          {activeSection === "gebruikers-rollen" && (
            <SettingsSection
              title="Gebruikers & rollen"
              lede="Wie mag wat zien en doen. Zorgaanbieders zien uitsluitend gekoppelde casussen — dat is geen beperking, maar zichtbaarheidsbeleid."
              primaryAction={
                <Button
                  type="button"
                  className="gap-2 rounded-xl"
                  onClick={() =>
                    toast.info("Gebruikersbeheer opent straks vanuit het identiteitsportaal; hier nog geen live koppeling.")
                  }
                >
                  <Users className="size-4" />
                  Gebruikersbeheer openen
                </Button>
              }
            >
              <GovernanceCallout
                title="Zichtbaarheid voor aanbieders"
                copy="Provideraccounts hebben geen toegang tot de volledige werkvoorraad. Alleen gekoppelde dossiers na gemeentelijke regie — zo blijft de keten auditbaar."
              />
              <SettingsCluster title="Rollenmatrix">
                <div className="space-y-2">
                  <RoleRow role="Regisseur" scope="Casussen, matching, plaatsing, signalen" risk="Hoog" />
                  <RoleRow role="Gemeente validator" scope="Validatie na matching" risk="Middel" />
                  <RoleRow role="Zorgaanbieder" scope="Alleen toegewezen casussen" risk="Beperkt zicht" />
                  <RoleRow role="Beheerder" scope="Platform, integraties, audit" risk="Hoog" />
                </div>
              </SettingsCluster>
              <SettingsCluster title="Toegang & sessies">
                <ToggleRow
                  label="MFA verplicht"
                  description="Tweede factor voor alle actieve accounts."
                  checked={mfaRequired}
                  onCheckedChange={onMfaRequiredChange}
                />
                <ToggleRow
                  label="Tijdelijke toegang"
                  description="Gastrollen met vervaldatum (bijv. interimgemeente)."
                  checked={false}
                  onCheckedChange={() => undefined}
                  disabled
                />
                <p className="text-[12px] text-muted-foreground">
                  Sessies kunnen centraal worden ingetrokken na incident — zie Security voor beleid.
                </p>
              </SettingsCluster>
            </SettingsSection>
          )}

          {activeSection === "workflow-regie" && (
            <SettingsSection
              title="Workflow & regie"
              lede="De keten is vastgelegd: geen overslaan van stappen. Hier stuur je operationele drempels — SLA’s, herinneringen en escalatie — zonder de juridische volgorde te doorbreken."
              primaryAction={
                <Button type="button" className="gap-2 rounded-xl" onClick={onOrgProfileSave}>
                  <Layers3 className="size-4" />
                  Routingregels bijwerken
                </Button>
              }
            >
              <CanonWorkflowStrip />
              <SettingsCluster
                title="Operationele drempels"
                hint="Uren en vaste schakelaars hier zijn voorbeeld — alleen automatische escalatie onderaan wordt bewaard via ketenvoorkeuren."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Wacht op aanbiederreactie" hint="Herinnering vóór escalatie.">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        defaultValue={48}
                        className="h-10 w-20 rounded-xl border border-border/60 bg-background/80 px-3 text-sm tabular-nums"
                      />
                      <span className="text-[13px] text-muted-foreground">uur</span>
                    </div>
                  </Field>
                  <Field label="Escaleer na" hint="Na deze termijn naar regiekamer-eigenaar.">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        defaultValue={72}
                        className="h-10 w-20 rounded-xl border border-border/60 bg-background/80 px-3 text-sm tabular-nums"
                      />
                      <span className="text-[13px] text-muted-foreground">uur</span>
                    </div>
                  </Field>
                </div>
                <ToggleRow
                  label="Herinnering bij onvolledige casusgegevens"
                  description="Casusgegevens onvolledig — blokkeer geen stap, maar signaleer aan regisseur."
                  checked
                  onCheckedChange={() => undefined}
                />
                <ToggleRow
                  label="Intake vereist bevestiging"
                  description="Geen intake zonder bevestigde plaatsing."
                  checked
                  onCheckedChange={() => undefined}
                />
                <ToggleRow
                  label="Automatische escalatie"
                  description="Voorkomt stilstand; eigenaar blijft in audittrail zichtbaar."
                  checked={autoEscalation}
                  onCheckedChange={onAutoEscalationChange}
                />
              </SettingsCluster>
            </SettingsSection>
          )}

          {activeSection === "matching-engine" && (
            <SettingsSection
              title="Matching engine"
              lede="Advies, geen automatische toewijzing. Leg uit waarom aanbevelingen ontstaan — transparantie bouwt vertrouwen tussen gemeente en aanbieder."
              primaryAction={
                <Button
                  type="button"
                  className="gap-2 rounded-xl"
                  onClick={() =>
                    toast.info(
                      "Matchinggewichten zijn in deze pilot alleen visueel — geen serveropslag; gemeente blijft beslisser.",
                    )
                  }
                >
                  <Scale className="size-4" />
                  Matchingprofiel opslaan
                </Button>
              }
            >
              <GovernanceCallout
                title="Adviesintelligentie"
                copy="Gemeente valideert altijd. Gewichten verschuiven de volgorde van kandidaten, niet de beslissing."
              />
              <SettingsCluster
                title="Prioriteiten & weging"
                hint="Schuifregelaars zijn illustratief — waarden worden niet opgeslagen in deze build."
              >
                <Field label="Urgentie" hint="Hoe sterk urgentie de rangorde beïnvloedt.">
                  <input type="range" min={1} max={5} defaultValue={4} className="w-full accent-primary" />
                </Field>
                <Field label="Capaciteit & regio" hint="Balans tussen nabijheid en beschikbaarheid.">
                  <input type="range" min={1} max={5} defaultValue={3} className="w-full accent-primary" />
                </Field>
                <ToggleRow
                  label="Handelingsruimte in uitleg tonen"
                  description="Toon waarom trade-offs zijn gemaakt (bijv. reistijd vs. specialisme)."
                  checked
                  onCheckedChange={() => undefined}
                />
              </SettingsCluster>
              <details className="rounded-xl border border-border/40 bg-card/20 px-4 py-3">
                <summary className="cursor-pointer text-[13px] font-medium text-foreground">
                  Explainability — wat gebruikers zien
                </summary>
                <ul className="mt-3 list-inside list-disc space-y-1 text-[13px] text-muted-foreground">
                  <li>Factoren per aanbeveling (specialisatie, capaciteit, regio, urgentie, complexiteit).</li>
                  <li>Geen verborgen scores: alleen wat nodig is voor verantwoorde keuze.</li>
                </ul>
              </details>
            </SettingsSection>
          )}

          {activeSection === "documenten-privacy" && (
            <SettingsSection
              title="Documenten & privacy"
              lede="Gegevensminimalisatie en bewaartermijnen. Formuleer in mensentaal wat het systeem mag vastleggen en hoe lang."
              primaryAction={
                <Button
                  type="button"
                  className="gap-2 rounded-xl"
                  onClick={() =>
                    toast.info("Document- en privacybeleid: voorbeeldinterface — tenant-specifieke opslag volgt.")
                  }
                >
                  <ShieldCheck className="size-4" />
                  Beleid vastleggen
                </Button>
              }
            >
              <SettingsCluster title="Verwerking">
                <ToggleRow
                  label="Anonimisering vóór modelinvoer"
                  description="Gevoelige velden worden gemaskeerd waar mogelijk."
                  checked
                  onCheckedChange={() => undefined}
                />
                <Field label="Bewaartermijn auditdocumentatie" hint="Na deze periode: gearchiveerd volgens beleid.">
                  <select className="h-10 w-full rounded-xl border border-border/60 bg-background/80 px-3 text-sm">
                    <option>7 jaar (aanbevolen)</option>
                    <option>5 jaar</option>
                    <option>3 jaar</option>
                  </select>
                </Field>
                <ToggleRow
                  label="Export alleen met dubbele autorisatie"
                  description="Voorkomt onbedoelde gegevensuitstroom."
                  checked
                  onCheckedChange={() => undefined}
                />
              </SettingsCluster>
              <SettingsCluster title="Classificatie">
                <p className="text-[13px] text-muted-foreground">
                  Documenten worden gelabeld naar zorgprocesfase. Wijziging van labels vereist auditregel — beperk tot
                  beheerders.
                </p>
              </SettingsCluster>
            </SettingsSection>
          )}

          {activeSection === "meldingen" && (
            <SettingsSection
              title="Meldingen"
              lede="Welke signalen een team mogen onderbreken. Kalm betekent: alleen wat de keten echt nodig heeft."
              primaryAction={
                <Button type="button" className="gap-2 rounded-xl" onClick={onOrgProfileSave}>
                  <Mail className="size-4" />
                  Meldingsprofiel opslaan
                </Button>
              }
            >
              <SettingsCluster title="Kanalen">
                <ToggleRow
                  title="Dagelijkse samenvatting"
                  description="Overzicht bij start van de dienst."
                  checked={dailyDigest}
                  onCheckedChange={onDailyDigestChange}
                />
                <ToggleRow
                  title="Kritieke signalen direct"
                  description="Bij blokkades en escalaties die de keten stilzetten."
                  checked={criticalAlerts}
                  onCheckedChange={onCriticalAlertsChange}
                />
              </SettingsCluster>
            </SettingsSection>
          )}

          {activeSection === "integraties" && (
            <SettingsSection
              title="Integraties"
              lede="Verbindingen met e-mail, identiteit en bronsystemen. Gezondheid en laatste synchronisatie eerst — details op aanvraag."
              primaryAction={
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 rounded-xl"
                  onClick={() => toast.info("Integratiestatus is voorbeeld — geen live verbinding in deze omgeving.")}
                >
                  <Plug className="size-4" />
                  Status verversen
                </Button>
              }
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <IntegrationTile
                  name="Microsoft 365"
                  detail="Identiteit & agenda"
                  status="ok"
                  lastSync="12 min geleden"
                />
                <IntegrationTile name="Zorgmail" detail="Beveiligde berichten" status="warn" lastSync="4 uur geleden" />
                <IntegrationTile name="Azure OpenAI" detail="Samenvatting (geanonimiseerd)" status="ok" lastSync="Live" />
                <IntegrationTile name="ECD-koppeling" detail="Pilot" status="off" lastSync="—" />
              </div>
            </SettingsSection>
          )}

          {activeSection === "audit-compliance" && (
            <SettingsSection
              title="Audit & compliance"
              lede="Verantwoordingslijn: wie deed wat, wanneer en waarom. Geen spreadsheet — een tijdslijn van operatieve integriteit."
              primaryAction={
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 rounded-xl"
                  onClick={() => toast.info("Exporteren van audit-/compliancerapport volgt wanneer rapportage-API beschikbaar is.")}
                >
                  <FileKey2 className="size-4" />
                  Verantwoordingsrapport exporteren
                </Button>
              }
            >
              <p className="mb-6 text-[13px] text-muted-foreground">Operationele accountability timeline</p>
              <div className="space-y-0 border-l border-border/50 pl-4">
                <AuditTimelineItem
                  time="Vandaag · 09:14"
                  title="Workflow override"
                  detail="Regisseur · casus 20418 · reden: spoedplaatsing"
                />
                <AuditTimelineItem
                  time="Gisteren · 16:02"
                  title="Providerzichtbaarheid"
                  detail="Horizon Jeugdzorg · documentenreeks geopend (geautoriseerd)"
                />
                <AuditTimelineItem
                  time="5 mei · 11:40"
                  title="Mislukte aanmelding"
                  detail="3 pogingen · IP geblokkeerd na drempel"
                />
                <AuditTimelineItem
                  time="5 mei · 08:22"
                  title="Export dossier"
                  detail="Gemeente Utrecht · dubbele autorisatie OK"
                />
              </div>
            </SettingsSection>
          )}

          {activeSection === "security" && (
            <SettingsSection
              title="Security"
              lede="Toegang tot een systeem waar kwetsbare gegevens doorheen lopen. Minimaal oppervlak, maximale controle."
              primaryAction={
                <Button type="button" className="gap-2 rounded-xl" onClick={onOrgProfileSave}>
                  <Lock className="size-4" />
                  Beleid opslaan
                </Button>
              }
            >
              <SettingsCluster title="Identiteit">
                <ToggleRow label="SSO verplicht (SAML)" description="Nog niet geconfigureerd voor deze tenant." checked={false} onCheckedChange={() => undefined} disabled />
                <ToggleRow label="MFA verplicht" description="Zie ook Gebruikers & rollen." checked={mfaRequired} onCheckedChange={onMfaRequiredChange} />
              </SettingsCluster>
              <SettingsCluster title="Netwerk & sessies">
                <ToggleRow
                  label="IP-allowlist"
                  description="Alleen vertrouwde kantoorranges (leeg = niet afgedwongen)."
                  checked={false}
                  onCheckedChange={() => undefined}
                  disabled
                />
                <p className="text-[12px] text-muted-foreground">
                  Sessies: standaard 12 uur idle timeout. Uitloggen afdwingen kan centraal na incident.
                </p>
              </SettingsCluster>
            </SettingsSection>
          )}

          {activeSection === "api-developers" && (
            <SettingsSection
              title="API & developers"
              lede="Programmatische toegang is een verlengstuk van vertrouwen. Sleutels roteren, scopes minimaliseren."
              primaryAction={
                <Button
                  type="button"
                  className="gap-2 rounded-xl"
                  onClick={() => toast.info("API-sleutels beheren volgt in het platformportaal — nog niet actief in deze pilot.")}
                >
                  <KeyRound className="size-4" />
                  Nieuwe sleutel uitgeven
                </Button>
              }
            >
              <SettingsCluster title="Webhooks">
                <div className="flex items-start gap-3 rounded-xl border border-border/40 bg-card/15 px-3 py-3">
                  <Webhook className="mt-0.5 size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Casusstatus · productie</p>
                    <p className="text-[12px] text-muted-foreground">Laatste levering: 200 OK · 06:12</p>
                  </div>
                </div>
              </SettingsCluster>
              <SettingsCluster title="Sleutels">
                <div className="flex items-center justify-between rounded-xl border border-border/40 px-3 py-2.5">
                  <span className="font-mono text-[12px] text-muted-foreground">sk_live_••••8f3a</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => toast.info("Sleutel intrekken is een voorbeeld — geen echte sleutel actief.")}
                  >
                    Intrekken
                  </Button>
                </div>
              </SettingsCluster>
            </SettingsSection>
          )}

          {activeSection === "facturatie" && (
            <SettingsSection
              title="Facturatie"
              lede="Contractuele en administratieve gegevens. Los van casusbeslissingen, maar wel onderdeel van professionele dienstverlening."
              primaryAction={
                <Button
                  type="button"
                  className="gap-2 rounded-xl"
                  onClick={() =>
                    toast.info("Facturatiegegevens worden nog niet centraal opgeslagen — alleen invullen als voorbereiding.")
                  }
                >
                  <CreditCard className="size-4" />
                  Facturatiecontact bijwerken
                </Button>
              }
            >
              <SettingsCluster title="Administratie">
                <Field label="Facturatie e-mail">
                  <input
                    type="email"
                    placeholder="finance@gemeente.nl"
                    className="h-10 w-full rounded-xl border border-border/60 bg-background/80 px-3 text-sm"
                  />
                </Field>
                <Field label="BTW-nummer">
                  <input className="h-10 w-full rounded-xl border border-border/60 bg-background/80 px-3 text-sm" />
                </Field>
              </SettingsCluster>
            </SettingsSection>
          )}
        </main>
      </div>
    </div>
  );
}

function SettingsSidebar({
  activeSection,
  onSelect,
}: {
  activeSection: SettingsSectionId;
  onSelect: (id: SettingsSectionId) => void;
}) {
  return (
    <aside
      className="shrink-0 lg:w-[var(--settings-sidebar)]"
      style={
        {
          "--settings-sidebar": tokens.settingsWorkspace.sidebarWidth,
        } as CSSProperties
      }
    >
      <nav aria-label="Instellingen navigatie" className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-6 lg:overflow-visible lg:pb-0 lg:pr-2">
        {SETTINGS_NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80 lg:px-1">
              {group.label}
            </p>
            <ul className="flex min-w-0 gap-1 lg:flex-col lg:gap-0.5">
              {group.items.map((item) => {
                const active = item.id === activeSection;
                return (
                  <li key={item.id} className="shrink-0 lg:shrink">
                    <button
                      type="button"
                      data-testid={`settings-nav-${item.id}`}
                      aria-current={active ? "page" : undefined}
                      onClick={() => onSelect(item.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors duration-150",
                        active
                          ? "bg-primary/[0.09] font-medium text-foreground ring-1 ring-primary/30"
                          : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
                      )}
                    >
                      {active ? <ArrowRight className="size-3.5 shrink-0 text-primary opacity-90" aria-hidden /> : null}
                      <span className="min-w-0 truncate">{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

type SettingsSectionProps = {
  title: string;
  lede: string;
  primaryAction?: ReactNode;
  children: ReactNode;
};

function SettingsSection({ title, lede, primaryAction, children }: SettingsSectionProps) {
  return (
    <article className="space-y-8">
      <div>
        <h2
          id="settings-section-heading"
          tabIndex={-1}
          className="text-[22px] font-semibold tracking-[-0.02em] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {title}
        </h2>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-muted-foreground">{lede}</p>
      </div>
      <div className="space-y-6">{children}</div>
      {primaryAction ? (
        <footer className="flex flex-wrap items-center gap-3 border-t border-border/30 pt-6">{primaryAction}</footer>
      ) : null}
    </article>
  );
}

function SettingsCluster({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/35 bg-card/[0.12] p-4 shadow-sm md:p-5">
      <div className="mb-4">
        <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
        {hint ? <p className="mt-1 text-[12px] text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[12px] font-medium text-foreground">{label}</span>
      {children}
      {hint ? <span className="block text-[11px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

function ReadOnlyTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/40 px-3 py-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em]">{label}</span>
      </div>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function GovernanceCallout({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/[0.05] px-4 py-4 shadow-md">
      <div className="flex gap-3">
        <Shield className="mt-0.5 size-4 shrink-0 text-primary/90" aria-hidden />
        <div>
          <p className="text-[13px] font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{copy}</p>
        </div>
      </div>
    </div>
  );
}

function RoleRow({ role, scope, risk }: { role: string; scope: string; risk: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border/30 bg-background/30 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium text-foreground">{role}</p>
        <p className="text-[12px] text-muted-foreground">{scope}</p>
      </div>
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{risk}</span>
    </div>
  );
}

function ToggleRow({
  label,
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  label?: string;
  title?: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const heading = label ?? title ?? "";
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 rounded-xl border border-border/35 bg-background/25 px-3 py-3",
        disabled && "opacity-60",
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-foreground">{heading}</p>
        <CareInfoPopover ariaLabel={heading ? `Toelichting: ${heading}` : "Toelichting"} align="start" side="bottom">
          <p className="text-[12px] leading-snug text-muted-foreground">{description}</p>
        </CareInfoPopover>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} className="mt-0.5 shrink-0" />
    </div>
  );
}

function CanonWorkflowStrip() {
  const steps = [
    CARE_TERMS.workflow.casus,
    CARE_TERMS.workflow.matching,
    CARE_TERMS.workflow.gemeenteValidatie,
    CARE_TERMS.workflow.aanbiederBeoordeling,
    CARE_TERMS.workflow.plaatsing,
    CARE_TERMS.workflow.intake,
  ];
  return (
    <div className="rounded-2xl border border-border/35 bg-gradient-to-b from-card/[0.2] to-transparent p-4 md:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Canonieke keten</p>
        <CareInfoPopover ariaLabel="Uitleg canonieke keten" testId="instellingen-canonieke-keten-uitleg">
          <p className="text-[12px] leading-snug text-muted-foreground">
            Configuratie wijzigt termijnen en signalen — niet de volgorde van beslissingen.
          </p>
        </CareInfoPopover>
      </div>
      <div className="flex flex-wrap items-center gap-y-3">
        {steps.map((step, i) => (
          <div key={step} className="flex items-center">
            <span className="whitespace-nowrap rounded-full border border-border/50 bg-muted/15 px-3 py-1.5 text-[12px] font-medium text-foreground">
              {step}
            </span>
            {i < steps.length - 1 ? (
              <span className="mx-1.5 hidden text-muted-foreground sm:inline" aria-hidden>
                →
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function IntegrationTile({
  name,
  detail,
  status,
  lastSync,
}: {
  name: string;
  detail: string;
  status: "ok" | "warn" | "off";
  lastSync: string;
}) {
  const dot =
    status === "ok"
      ? "bg-emerald-400/90 ring-2 ring-emerald-400/30"
      : status === "warn"
        ? "bg-amber-400/90"
        : "bg-muted-foreground/40";
  return (
    <div className="flex flex-col rounded-2xl border border-border/40 bg-card/15 p-4 transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{name}</p>
          <p className="text-[12px] text-muted-foreground">{detail}</p>
        </div>
        <span className={cn("mt-1 size-2 shrink-0 rounded-full", dot)} title={status} />
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">Laatste sync: {lastSync}</p>
      <Button type="button" variant="outline" size="sm" className="mt-3 w-full rounded-lg text-[12px]">
        {status === "off" ? "Configureren" : "Opnieuw verbinden"}
      </Button>
    </div>
  );
}

function AuditTimelineItem({ time, title, detail }: { time: string; title: string; detail: string }) {
  return (
    <div className="relative pb-8 last:pb-0">
      <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-primary/40 bg-background ring-2 ring-primary/20" />
      <time className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{time}</time>
      <p className="mt-1 text-sm font-medium text-foreground">{title}</p>
      <p className="mt-0.5 text-[13px] text-muted-foreground">{detail}</p>
    </div>
  );
}
