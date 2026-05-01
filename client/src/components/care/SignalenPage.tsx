import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Info,
  XCircle,
  Loader2,
} from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../ui/utils";
import { CarePageScaffold } from "./CarePageScaffold";
import {
  CareDominantStatus,
  CareFilterTabButton,
  CareFilterTabGroup,
  CareMetaChip,
  CarePrimaryList,
  CareSearchFiltersBar,
  CareWorkRow,
} from "./CareUnifiedPage";
import { CareEmptyState } from "./CareSurface";
import { useCases } from "../../hooks/useCases";
import { useProviders } from "../../hooks/useProviders";
import { useAssessments } from "../../hooks/useAssessments";
import { useRegions } from "../../hooks/useRegions";
import { buildWorkflowCases } from "../../lib/workflowUi";
import type { WorkflowCaseView } from "../../lib/workflowUi";

type SignalSeverity = "critical" | "warning" | "info";

/** Nav targets from signals: workflow URLs plus zorgaanbieders network view. */
type SignalNavigateTarget = WorkflowCaseView["nextBestActionUrl"] | "zorgaanbieders";

interface ActionSignal {
  id: string;
  severity: SignalSeverity;
  title: string;
  explanation: string;
  casusId: string | null;
  casusReference: string | null;
  actions: Array<
    | { kind: "open_case"; label: string; caseId: string }
    | { kind: "navigate"; label: string; target: SignalNavigateTarget }
  >;
}

interface SignalenPageProps {
  onOpenCase?: (caseId: string) => void;
  onNavigateToWorkflow?: (target: SignalNavigateTarget) => void;
}

const PHASE_LABELS: Record<string, string> = {
  intake: "intake",
  beoordeling: "beoordeling",
  matching: "matching",
  plaatsing: "plaatsing",
  afgerond: "afronding",
};

function severityLabel(severity: SignalSeverity): "kritiek" | "waarschuwing" | "info" {
  switch (severity) {
    case "critical":
      return "kritiek";
    case "warning":
      return "waarschuwing";
    default:
      return "info";
  }
}

function dominantToneClass(severity: SignalSeverity): string {
  switch (severity) {
    case "critical":
      return "border-destructive/40 bg-destructive/15 text-destructive";
    case "warning":
      return "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-200";
    default:
      return "border-border/70 bg-muted/25 text-muted-foreground";
  }
}

function SignalSeverityIcon({ severity }: { severity: SignalSeverity }) {
  switch (severity) {
    case "critical":
      return <XCircle size={16} className="text-red-400" />;
    case "warning":
      return <AlertTriangle size={16} className="text-amber-400" />;
    default:
      return <Info size={16} className="text-blue-400" />;
  }
}

function SignalWorkRow({
  signal,
  onRunAction,
}: {
  signal: ActionSignal;
  onRunAction: (action: ActionSignal["actions"][number]) => void;
}) {
  const primary = signal.actions[0];
  const secondary = signal.actions[1];
  const accentTone = signal.severity === "critical" ? "critical" : signal.severity === "warning" ? "warning" : "neutral";

  if (!primary) {
    return null;
  }

  const openFromRow = () => {
    onRunAction(primary);
  };

  return (
    <CareWorkRow
      testId="signalen-worklist-item"
      leading={<SignalSeverityIcon severity={signal.severity} />}
      title={signal.title}
      context={signal.explanation}
      status={
        <CareDominantStatus className={cn("justify-center", dominantToneClass(signal.severity))}>
          {severityLabel(signal.severity)}
        </CareDominantStatus>
      }
      time={
        signal.casusReference ? (
          <CareMetaChip title={signal.casusReference}>
            <span className="max-w-[200px] truncate">Casus: {signal.casusReference}</span>
          </CareMetaChip>
        ) : undefined
      }
      contextInfo={
        secondary ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 shrink-0 px-2 text-xs"
            onClick={(event) => {
              event.stopPropagation();
              onRunAction(secondary);
            }}
          >
            {secondary.label}
          </Button>
        ) : undefined
      }
      actionLabel={primary.label.replace(/\s*→\s*$/u, "").trim() || primary.label}
      actionVariant={signal.severity === "critical" || signal.severity === "warning" ? "primary" : "ghost"}
      onOpen={openFromRow}
      onAction={(event) => {
        event.stopPropagation();
        onRunAction(primary);
      }}
      accentTone={accentTone}
    />
  );
}

export function SignalenPage({ onOpenCase, onNavigateToWorkflow }: SignalenPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState<SignalSeverity | "all">("all");
  const [showSecondaryFilters, setShowSecondaryFilters] = useState(false);

  const { cases, loading: casesLoading, error: casesError, refetch: refetchCases } = useCases({ q: "" });
  const { providers, loading: providersLoading, error: providersError, refetch: refetchProviders } = useProviders({ q: "" });
  const { assessments, loading: assessmentsLoading, error: assessmentsError, refetch: refetchAssessments } = useAssessments({ q: "" });
  const { regions, loading: regionsLoading, error: regionsError, refetch: refetchRegions } = useRegions({ q: "" });

  const workflowCases = useMemo(() => buildWorkflowCases(cases, providers), [cases, providers]);

  const signals = useMemo<ActionSignal[]>(() => {
    const items: ActionSignal[] = [];
    const push = (signal: ActionSignal) => {
      if (!items.some((existing) => existing.id === signal.id)) {
        items.push(signal);
      }
    };

    workflowCases.forEach((workflowCase) => {
      const phaseName = PHASE_LABELS[workflowCase.phase] ?? "workflow";

      if (workflowCase.phase !== "afgerond" && workflowCase.daysInCurrentPhase >= 14) {
        push({
          id: `phase-time-critical-${workflowCase.id}`,
          severity: "critical",
          title: "Casus te lang in dezelfde fase",
          casusId: workflowCase.id,
          casusReference: workflowCase.title,
          explanation: `${workflowCase.daysInCurrentPhase} dagen in ${phaseName}. Directe opvolging nodig.`,
          actions: [
            { kind: "open_case", label: "Open casus", caseId: workflowCase.id },
            { kind: "navigate", label: "Naar workflow", target: workflowCase.nextBestActionUrl },
          ],
        });
      } else if (workflowCase.phase !== "afgerond" && workflowCase.daysInCurrentPhase >= 8) {
        push({
          id: `phase-time-warning-${workflowCase.id}`,
          severity: "warning",
          title: "Doorlooptijd loopt op",
          casusId: workflowCase.id,
          casusReference: workflowCase.title,
          explanation: `${workflowCase.daysInCurrentPhase} dagen in ${phaseName}. Plan vervolgstap om vertraging te voorkomen.`,
          actions: [
            { kind: "open_case", label: "Open casus", caseId: workflowCase.id },
            { kind: "navigate", label: "Werk queue", target: workflowCase.nextBestActionUrl },
          ],
        });
      }

      if (
        workflowCase.urgency === "critical"
        && workflowCase.phase === "matching"
        && (workflowCase.recommendedProvidersCount === 0 || workflowCase.isBlocked)
      ) {
        push({
          id: `urgent-no-match-${workflowCase.id}`,
          severity: "critical",
          title: "Urgente casus zonder match",
          casusId: workflowCase.id,
          casusReference: workflowCase.title,
          explanation: "Urgentie is kritiek maar er is nog geen geschikte aanbieder gevonden.",
          actions: [
            { kind: "open_case", label: "Open casus", caseId: workflowCase.id },
            { kind: "navigate", label: "Naar matching", target: "matching" },
          ],
        });
      }

      if (workflowCase.phase === "matching" && workflowCase.daysInCurrentPhase >= 4 && !workflowCase.readyForPlacement) {
        push({
          id: `missing-placement-${workflowCase.id}`,
          severity: workflowCase.daysInCurrentPhase >= 10 ? "critical" : "warning",
          title: "Plaatsing nog niet gestart",
          casusId: workflowCase.id,
          casusReference: workflowCase.title,
          explanation: "Casus staat in matching, maar er is nog geen plaatsing bevestigd.",
          actions: [
            { kind: "navigate", label: "Naar matching", target: "matching" },
            { kind: "open_case", label: "Open casus", caseId: workflowCase.id },
          ],
        });
      }
    });

    assessments
      .filter((assessment) => assessment.status !== "completed" || !assessment.matchingReady || assessment.missingInfo.length > 0)
      .forEach((assessment) => {
        push({
          id: `incomplete-assessment-${assessment.id}`,
          severity: assessment.missingInfo.some((item) => item.severity === "error") ? "critical" : "warning",
          title: "Samenvatting onvolledig",
          casusId: assessment.caseId,
          casusReference: assessment.caseTitle,
          explanation: assessment.missingInfo.length > 0
            ? `${assessment.missingInfo.length} ontbrekende punten blokkeren doorstroom naar matching.`
            : "Samenvatting is nog niet afgerond voor matching.",
          actions: [
            { kind: "navigate", label: "Naar casussen", target: "casussen" },
            { kind: "open_case", label: "Open casus", caseId: assessment.caseId },
          ],
        });
      });

    const capacityPressureCount = providers.filter((provider) => provider.availableSpots <= 0 || provider.waitingListLength >= 10).length;
    const matchingWithoutOptions = workflowCases.filter(
      (workflowCase) => workflowCase.phase === "matching" && workflowCase.recommendedProvidersCount === 0,
    ).length;

    if (capacityPressureCount > 0 || matchingWithoutOptions > 0) {
      push({
        id: "capacity-availability-issue",
        severity: matchingWithoutOptions > 0 ? "critical" : "warning",
        title: "Capaciteit en beschikbaarheid onder druk",
        casusId: null,
        casusReference: null,
        explanation: `${capacityPressureCount} aanbieders zonder ruimte, ${matchingWithoutOptions} matching-casussen zonder direct aanbod.`,
        actions: [
          { kind: "navigate", label: "Naar aanbieders", target: "zorgaanbieders" },
          { kind: "navigate", label: "Naar matching", target: "matching" },
        ],
      });
    }

    regions
      .filter((region) => region.status !== "stabiel")
      .slice(0, 8)
      .forEach((region) => {
        push({
          id: `region-health-${region.id}`,
          severity: region.status === "kritiek" ? "critical" : "warning",
          title: `Regio ${region.name}: ${region.status_label}`,
          casusId: null,
          casusReference: null,
          explanation: region.signaal_samenvatting,
          actions: [
            { kind: "navigate", label: "Naar matching", target: "matching" },
            { kind: "navigate", label: "Naar zorgaanbieders", target: "zorgaanbieders" },
          ],
        });
      });

    return items
      .sort((a, b) => {
        const score: Record<SignalSeverity, number> = { critical: 0, warning: 1, info: 2 };
        return score[a.severity] - score[b.severity];
      })
      .slice(0, 24);
  }, [assessments, providers, regions, workflowCases]);

  const loading = casesLoading || providersLoading || assessmentsLoading || regionsLoading;
  const error = casesError ?? providersError ?? assessmentsError ?? regionsError;

  const refetch = () => {
    refetchCases();
    refetchProviders();
    refetchAssessments();
    refetchRegions();
  };

  const filteredSignals = signals.filter((signal) => {
    if (selectedSeverity !== "all" && signal.severity !== selectedSeverity) return false;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    const haystack = [signal.title, signal.explanation, signal.casusReference ?? ""].join(" ").toLowerCase();
    return haystack.includes(query);
  });

  const runAction = (action: ActionSignal["actions"][number]) => {
    if (action.kind === "open_case") {
      onOpenCase?.(action.caseId);
      return;
    }
    onNavigateToWorkflow?.(action.target);
  };

  const criticalCount = signals.filter((s) => s.severity === "critical").length;
  const warningCount = signals.filter((s) => s.severity === "warning").length;
  const infoCount = signals.filter((s) => s.severity === "info").length;

  const toggleSeverityFilter = (key: SignalSeverity | "all") => {
    if (key === "all") {
      setSelectedSeverity("all");
      return;
    }
    setSelectedSeverity((current) => (current === key ? "all" : key));
  };

  return (
    <CarePageScaffold
      archetype="signal-action"
      className="pb-8"
      title="Signalen"
      subtitle={`Automatische detectie van problemen en afwijkingen · ${loading ? "…" : `${criticalCount} kritiek · ${warningCount} waarschuwing`}`}
      filters={
        <CareSearchFiltersBar
          tabs={
            <CareFilterTabGroup aria-label="Ernst signalen">
              <CareFilterTabButton selected={selectedSeverity === "all"} onClick={() => toggleSeverityFilter("all")}>
                Alles
              </CareFilterTabButton>
              <CareFilterTabButton
                selected={selectedSeverity === "critical"}
                onClick={() => toggleSeverityFilter("critical")}
              >
                Kritiek ({loading ? "—" : criticalCount})
              </CareFilterTabButton>
              <CareFilterTabButton
                selected={selectedSeverity === "warning"}
                onClick={() => toggleSeverityFilter("warning")}
              >
                Waarschuwing ({loading ? "—" : warningCount})
              </CareFilterTabButton>
              <CareFilterTabButton selected={selectedSeverity === "info"} onClick={() => toggleSeverityFilter("info")}>
                Info ({loading ? "—" : infoCount})
              </CareFilterTabButton>
            </CareFilterTabGroup>
          }
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Zoek signalen..."
          showSecondaryFilters={showSecondaryFilters}
          onToggleSecondaryFilters={() => setShowSecondaryFilters((current) => !current)}
          secondaryFilters={<p className="text-sm text-muted-foreground">Geen aanvullende filters beschikbaar.</p>}
        />
      }
    >
      <div className="space-y-3">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 size={18} className="animate-spin" />
            <span>Signalen laden…</span>
          </div>
        )}

        {error && (
          <CareEmptyState
            title="Kon signalen niet laden"
            copy={error}
            action={(
              <Button variant="outline" size="sm" onClick={refetch}>
                Opnieuw proberen
              </Button>
            )}
          />
        )}

        {!loading && !error && filteredSignals.length > 0 && (
          <div data-testid="signalen-worklist">
            <CarePrimaryList>
              {filteredSignals.map((signal) => (
                <SignalWorkRow key={signal.id} signal={signal} onRunAction={runAction} />
              ))}
            </CarePrimaryList>
          </div>
        )}

        {!loading && !error && filteredSignals.length === 0 && (
          <CareEmptyState
            title="Geen actieve signalen op dit moment"
            copy="De workflow loopt stabiel. Je kunt verder met reguliere casusopvolging."
            action={(
              <Button className="mt-2" onClick={() => onNavigateToWorkflow?.("casussen")}>
                Ga naar casussen
              </Button>
            )}
          />
        )}
      </div>
    </CarePageScaffold>
  );
}
