import { useMemo, useState, type ReactNode } from "react";
import {
  Search,
  SlidersHorizontal,
  AlertTriangle,
  Info,
  XCircle,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Button } from "../ui/button";
import { useCases } from "../../hooks/useCases";
import { useProviders } from "../../hooks/useProviders";
import { useAssessments } from "../../hooks/useAssessments";
import { useRegions } from "../../hooks/useRegions";
import { buildWorkflowCases } from "../../lib/workflowUi";

type SignalSeverity = "critical" | "warning" | "info";
type WorkflowTarget = "casussen" | "beoordelingen" | "matching" | "plaatsingen" | "zorgaanbieders";

interface ActionSignal {
  id: string;
  severity: SignalSeverity;
  title: string;
  explanation: string;
  casusId: string | null;
  casusReference: string | null;
  actions: Array<
    | { kind: "open_case"; label: string; caseId: string }
    | { kind: "navigate"; label: string; target: WorkflowTarget }
  >;
}

interface SignalenPageProps {
  onOpenCase?: (caseId: string) => void;
  onNavigateToWorkflow?: (target: WorkflowTarget) => void;
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

export function SignalenPage({ onOpenCase, onNavigateToWorkflow }: SignalenPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState<SignalSeverity | "all">("all");

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
          title: "Beoordeling onvolledig",
          casusId: assessment.caseId,
          casusReference: assessment.caseTitle,
          explanation: assessment.missingInfo.length > 0
            ? `${assessment.missingInfo.length} ontbrekende punten blokkeren doorstroom naar matching.`
            : "Beoordeling is nog niet afgerond voor matching.",
          actions: [
            { kind: "navigate", label: "Naar beoordelingen", target: "beoordelingen" },
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

  const getSeverityIcon = (severity: SignalSeverity) => {
    switch (severity) {
      case "critical":
        return <XCircle size={16} className="text-red-400" />;
      case "warning":
        return <AlertTriangle size={16} className="text-amber-400" />;
      case "info":
        return <Info size={16} className="text-blue-400" />;
    }
  };

  const getSeverityColor = (severity: SignalSeverity) => {
    switch (severity) {
      case "critical":
        return "border-l-red-500 bg-red-500/5";
      case "warning":
        return "border-l-amber-500 bg-amber-500/5";
      case "info":
        return "border-l-blue-500 bg-blue-500/5";
    }
  };

  const getBadgeClasses = (severity: SignalSeverity) => {
    switch (severity) {
      case "critical":
        return "bg-red-500/10 text-red-300 border-red-500/30";
      case "warning":
        return "bg-amber-500/10 text-amber-300 border-amber-500/30";
      default:
        return "bg-blue-500/10 text-blue-300 border-blue-500/30";
    }
  };

  const renderSummaryCard = (
    key: SignalSeverity,
    label: string,
    count: number,
    icon: ReactNode,
    selectedClass: string,
  ) => (
    <button
      key={key}
      onClick={() => setSelectedSeverity(selectedSeverity === key ? "all" : key)}
      className={`premium-card p-4 text-left transition-all hover:scale-[1.02] ${
        selectedSeverity === key ? selectedClass : ""
      }`}
    >
      <div className="mb-1 flex items-center justify-between">
        <p className="text-2xl font-bold text-foreground">{loading ? "—" : count}</p>
        <div className="rounded-lg p-2">{icon}</div>
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </button>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2 text-3xl font-semibold text-foreground">Signalen</h1>
        <p className="text-muted-foreground">
          Automatische detectie van problemen en afwijkingen · {loading ? "…" : `${criticalCount} kritiek · ${warningCount} waarschuwing`}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {renderSummaryCard(
          "critical",
          "Kritieke signalen",
          criticalCount,
          <XCircle size={18} className="text-red-400" />,
          "border-2 border-red-500 shadow-lg shadow-red-500/20",
        )}
        {renderSummaryCard(
          "warning",
          "Waarschuwingen",
          warningCount,
          <AlertTriangle size={18} className="text-amber-400" />,
          "border-2 border-amber-500 shadow-lg shadow-amber-500/20",
        )}
        {renderSummaryCard(
          "info",
          "Informatie",
          infoCount,
          <Info size={18} className="text-blue-400" />,
          "border-2 border-blue-500 shadow-lg shadow-blue-500/20",
        )}
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Zoek signalen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 w-full rounded-xl border-2 border-muted-foreground/20 bg-background pl-11 pr-4 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none transition-colors"
          />
        </div>
        <Button variant="outline" className="border-2 border-muted-foreground/20">
          <SlidersHorizontal size={18} />
          Meer filters
        </Button>
      </div>

      <div className="space-y-3">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 size={18} className="animate-spin" />
            <span>Signalen laden…</span>
          </div>
        )}

        {error && (
          <div className="premium-card space-y-2 p-6 text-center text-destructive">
            <p>Kon signalen niet laden: {error}</p>
            <Button variant="outline" size="sm" onClick={refetch}>Opnieuw proberen</Button>
          </div>
        )}

        {!loading && !error && filteredSignals.map((signal) => (
          <div key={signal.id} className={`premium-card border-l-4 p-4 ${getSeverityColor(signal.severity)}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <h3 className="font-semibold text-foreground">{signal.title}</h3>
                  <span className={`rounded border px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.06em] ${getBadgeClasses(signal.severity)}`}>
                    {severityLabel(signal.severity)}
                  </span>
                </div>
                {signal.casusReference && (
                  <p className="mb-1 text-xs text-muted-foreground">Casus: {signal.casusReference}</p>
                )}
                <p className="text-sm text-muted-foreground">{signal.explanation}</p>
              </div>

              <div className="flex flex-shrink-0 items-center gap-2">
                {signal.actions.slice(0, 2).map((action, index) => (
                  <Button
                    key={`${signal.id}-${index}`}
                    size="sm"
                    variant={index === 0 ? "default" : "outline"}
                    className="gap-1"
                    onClick={() => runAction(action)}
                  >
                    {action.label}
                    <ArrowRight size={13} />
                  </Button>
                ))}
                <div className="mt-0.5 hidden md:block">{getSeverityIcon(signal.severity)}</div>
              </div>
            </div>
          </div>
        ))}

        {!loading && !error && filteredSignals.length === 0 && (
          <div className="premium-card p-10 text-center">
            <p className="text-base font-semibold text-foreground">Geen actieve signalen op dit moment</p>
            <p className="mt-1 text-sm text-muted-foreground">De workflow loopt stabiel. Je kunt verder met reguliere casusopvolging.</p>
            <Button className="mt-4" onClick={() => onNavigateToWorkflow?.("casussen")}>Ga naar casussen</Button>
          </div>
        )}
      </div>
    </div>
  );
}
