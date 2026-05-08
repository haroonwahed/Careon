import { useCurrentUser } from "../../hooks/useCurrentUser";
import { CareAttentionBar, CareInfoPopover, CareMetaChip, CarePageScaffold, CareSection, CareSectionBody, CareSectionHeader, ErrorState, LoadingState, PrimaryActionButton } from "./CareDesignPrimitives";
import { Button } from "../ui/button";

interface ProfielPageProps {
  onNavigateToSettings?: () => void;
}

export function ProfielPage({ onNavigateToSettings }: ProfielPageProps) {
  const { me, loading, error, refetch } = useCurrentUser();

  const dominantAction =
    !loading && !error ? (
      <CareAttentionBar
        tone="info"
        message="Dit is je persoonlijke accountprofiel; organisatie-, meldingen- en workflowvoorkeuren beheer je in Instellingen."
        action={
          onNavigateToSettings ? <PrimaryActionButton onClick={onNavigateToSettings}>Naar instellingen</PrimaryActionButton> : undefined
        }
      />
    ) : undefined;

  return (
    <CarePageScaffold
      archetype="exception"
      className="pb-8"
      title="Profiel"
      subtitleInfoTestId="profiel-page-info"
      subtitleAriaLabel="Uitleg profiel"
      subtitle={
        <div className="space-y-2">
          <p className="font-semibold text-foreground">Persoonlijke accountcontext</p>
          <p>Bekijk wie je bent in deze sessie, welke rol actief is en welke organisatie aan dit account hangt.</p>
          <p className="text-muted-foreground">Instellingen blijft de plek voor governance, meldingen en workflowvoorkeuren.</p>
        </div>
      }
      actions={
        <Button variant="outline" onClick={() => void refetch()}>
          Ververs
        </Button>
      }
      dominantAction={dominantAction}
    >
      <CareSection>
        <CareSectionHeader
          title="Accountgegevens"
          description="Deze gegevens bepalen hoe je in de workspace zichtbaar bent."
        />
        <CareSectionBody className="space-y-4">
          {loading && <LoadingState title="Profiel laden…" copy="Je accountgegevens worden opgehaald." />}

          {!loading && error && (
            <ErrorState
              title="Profiel laden mislukt"
              copy={error}
              action={<Button variant="outline" onClick={() => void refetch()}>Opnieuw proberen</Button>}
            />
          )}

          {!loading && !error && me ? (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <ProfileCard label="Naam" value={me.fullName} />
                <ProfileCard label="Gebruikersnaam" value={me.username} />
                <ProfileCard label="E-mail" value={me.email} />
                <ProfileCard label="Rol" value={me.workflowRole} />
              </div>

              <div className="rounded-xl border border-border/50 bg-card/40 p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-foreground">Organisatie en permissies</p>
                    <p className="text-sm text-muted-foreground">
                      {me.organization?.name ?? "Geen organisatie gekoppeld"} · role switch{" "}
                      {me.permissions.allowRoleSwitch ? "toegestaan" : "uitgezet"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CareMetaChip>{me.organization?.slug ?? "geen-organisatie"}</CareMetaChip>
                    <CareMetaChip>{me.flags.pilotUi ? "Pilot UI" : "Productie UI"}</CareMetaChip>
                    <CareMetaChip>{me.flags.spaOnlyWorkflow ? "SPA only" : "Gemengd"}</CareMetaChip>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border/50 bg-card/30 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 space-y-2">
                    <p className="text-sm font-semibold text-foreground">Wat je hier niet wijzigt</p>
                    <p className="text-sm text-muted-foreground">
                      Workflowregels, escalatie en meldingen horen in Instellingen. Dit profiel geeft alleen de huidige sessiecontext weer.
                    </p>
                  </div>
                  <CareInfoPopover ariaLabel="Uitleg profiel en instellingen" testId="profiel-page-context-info">
                    <p className="text-muted-foreground">
                      Profiel is de persoonlijke accountweergave. Instellingen blijft de plek voor organisatie- en ketenvoorkeuren.
                    </p>
                  </CareInfoPopover>
                </div>
              </div>
            </>
          ) : null}
        </CareSectionBody>
      </CareSection>
    </CarePageScaffold>
  );
}

function ProfileCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/30 p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
