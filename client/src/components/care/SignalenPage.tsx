import { useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, Info, XCircle } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../ui/utils";
import {
  CareDominantStatus,
  CareQueueInlineAction,
  EmptyState,
  ErrorState,
  LoadingState,
} from "./CareDesignPrimitives";
import {
  CareCommandShell,
  CareMetricStrip,
  CareMetricCard,
  CareWorklist,
  CareWorklistTabs,
  CareWorklistToolbar,
  CareWorklistColumnHeader,
  CareWorklistBody,
  CareWorklistRow,
  CareWorklistRowAction,
  CareWorklistPagination,
  ROW_ACTION_CLASSES,
} from "./CareCommandPrimitives";
import { useCases } from "../../hooks/useCases";
import { useProviders } from "../../hooks/useProviders";
import { useAssessments } from "../../hooks/useAssessments";
import { useRegions } from "../../hooks/useRegions";
import { buildWorkflowCases } from "../../lib/workflowUi";
import type { WorkflowCaseView } from "../../lib/workflowUi";

type SignalSeverity = "critical" | "warning" | "info";
type SignalTab = "all" | "critical" | "warning" | "info";
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

const SIGNALEN_COLS = "minmax(12rem,2fr) minmax(12rem,2fr) minmax(8rem,1.2fr) minmax(8rem,1fr)";

function severityLabel(severity: SignalSeverity): string {
  switch (severity) {
    case "critical": return "Kritiek";
    case "warning": return "Waarschuwing";
    default: return "Info";
  }
}

function severityToneClass(severity: SignalSeverity): string {
  switch (severity) {
    case "critical": return "border-care-urgent-border bg-care-urgent-bg text-care-urgent-text";
    case "warning": return "border-care-warning-border bg-care-warning-bg text-care-warning-text";
    default: return "border-care-info-border bg-care-info-bg text-care-info-text";
  }
}

function SignalIcon({ severity }: { severity: SignalSeverity }) {
  switch (severity) {
    case "critical": return <XCircle size={15} className="text-care-urgent-solid shrink-0" />;
    case "warning": return <AlertTriangle size={15} className="text-care-warning-solid shrink-0" />;
    default: return <Info size={15} className="text-care-info-solid shrink-0" />;
  }
}

export function SignalenPage({ onOpenCase, onNavigateToWorkflow }: SignalenPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SignalTab>("all");

  const { cases, loading: casesLoading, error: casesError, refetch: refetchCases } = useCases({ q: "" });
  const { providers, loading: providersLoading, error: providersError, refetch: refetchProviders } = useProviders({ q: "" });
  const { assessments, loading: assessmentsLoading, error: assessmentsError, refetch: refetchAssessments } = useAssessments({ q: "" });
  const { regions, loading: regionsLoading, error: regionsError, refetch: refetchRegions } = useRegions({ q: "" });

  const loading = casesLoading || providersLoading || assessmentsLoading || regionsLoading;
  const error = casesError ?? providersError ?? assessmentsError ?? regionsError;

  const workflowCases = useMemo(() => buildWorkflowCases(cases, providers), [cases, providers]);

  const signals = useMemo<ActionSignal[]>(() => {
    const items: ActionSignal[] = [];
    const push = (signal: ActionSignal) => {
      if (!items.some((existing) => existing.id === signal.id)) items.push(signal);
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

      if (workflowCase.urgency === "critical" && workflowCase.phase === "matching" && (workflowCase.recommendedProvidersCount === 0 || workflowCase.isBlocked)) {
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
      .filter((a) => a.status !== "completed" || !a.matchingReady || a.missingInfo.length > 0)
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

    const capacityPressureCount = providers.filter((p) => p.availableSpots <= 0 || p.waitingListLength >= 10).length;
    const matchingWithoutOptions = workflowCases.filter((c) => c.phase === "matching" && c.recommendedProvidersCount === 0).length;

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
      .filter((r) => r.status !== "stabiel")
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

  const criticalCount = signals.filter((s) => s.severity === "critical").length;
  const warningCount = signals.filter((s) => s.severity === "warning").length;
  const infoCount = signals.filter((s) => s.severity === "info").length;

  const filteredSignals = useMemo(() => {
    let list = signals;
    if (activeTab !== "all") list = list.filter((s) => s.severity === activeTab);
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((s) =>
        [s.title, s.explanation, s.casusReference ?? ""].join(" ").toLowerCase().includes(q),
      );
    }
    return list;
  }, [signals, activeTab, searchQuery]);

  const refetch = () => {
    refetchCases();
    refetchProviders();
    refetchAssessments();
    refetchRegions();
  };

  const runAction = (action: ActionSignal["actions"][number]) => {
    if (action.kind === "open_case") { onOpenCase?.(action.caseId); return; }
    onNavigateToWorkflow?.(action.target);
  };

  const tabs = [
    { id: "all" as const, label: "Alles", count: signals.length },
    { id: "critical" as const, label: "Kritiek", count: criticalCount },
    { id: "warning" as const, label: "Waarschuwing", count: warningCount },
    { id: "info" as const, label: "Info", count: infoCount },
  ];

  return (
    <CareCommandShell
      title="Signalen"
      actions={
        !loading && !error && signals.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-[10px] border-border/70 px-4 text-[13px] font-medium"
            onClick={() => refetch()}
          >
            Ververs
          </Button>
        ) : undefined
      }
    >
      <CareMetricStrip>
        <CareMetricCard
          value={criticalCount}
          label="Kritiek"
          tone="urgent"
          isActive={activeTab === "critical"}
          onClick={() => setActiveTab((t) => (t === "critical" ? "all" : "critical"))}
        />
        <CareMetricCard
          value={warningCount}
          label="Waarschuwing"
          tone="warning"
          isActive={activeTab === "warning"}
          onClick={() => setActiveTab((t) => (t === "warning" ? "all" : "warning"))}
        />
        <CareMetricCard
          value={infoCount}
          label="Info"
          tone="neutral"
          isActive={activeTab === "info"}
          onClick={() => setActiveTab((t) => (t === "info" ? "all" : "info"))}
        />
      </CareMetricStrip>

      {loading && <LoadingState title="Signalen laden…" copy="Overzicht wordt opgebouwd." />}

      {!loading && error && (
        <ErrorState
          title="Kon signalen niet laden"
          copy={error}
          action={<Button variant="outline" size="sm" onClick={refetch}>Opnieuw proberen</Button>}
        />
      )}

      {!loading && !error && (
        <CareWorklist testId="signalen-uitvoerlijst">
          <CareWorklistTabs
            tabs={tabs}
            activeId={activeTab}
            onChange={(id) => setActiveTab(id as SignalTab)}
          />

          <CareWorklistToolbar
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Zoek signalen..."
          />

          {filteredSignals.length === 0 ? (
            <EmptyState
              title="Geen actieve signalen op dit moment"
              copy="De workflow loopt stabiel. Je kunt verder met reguliere casusopvolging."
              action={
                activeTab !== "all" ? (
                  <CareQueueInlineAction type="button" onClick={() => setActiveTab("all")}>Toon alle signalen</CareQueueInlineAction>
                ) : (
                  <CareQueueInlineAction onClick={() => onNavigateToWorkflow?.("casussen")}>
                    Naar casussen
                  </CareQueueInlineAction>
                )
              }
            />
          ) : (
            <div className="overflow-x-auto" data-testid="signalen-worklist">
              <CareWorklistColumnHeader
                columns={["Signaal", "Toelichting", "Casus", "Actie"]}
                cols={SIGNALEN_COLS}
                minWidth="760px"
              />
              <CareWorklistBody>
                {filteredSignals.map((signal) => {
                  const primary = signal.actions[0];
                  const secondary = signal.actions[1];
                  if (!primary) return null;

                  const accentTone = signal.severity === "critical" ? "urgent" as const : signal.severity === "warning" ? "warning" as const : "neutral" as const;
                  const actionClass = signal.severity === "critical" || signal.severity === "warning" ? ROW_ACTION_CLASSES.primary : ROW_ACTION_CLASSES.default;

                  return (
                    <CareWorklistRow
                      key={signal.id}
                      cols={SIGNALEN_COLS}
                      minWidth="760px"
                      accentTone={accentTone}
                      testId="signalen-worklist-item"
                      onRowClick={() => runAction(primary)}
                    >
                      {/* Signaal */}
                      <div className="min-w-0">
                        <div className="flex items-start gap-1.5">
                          <SignalIcon severity={signal.severity} />
                          <span className="block truncate text-[13px] font-medium leading-tight text-foreground">{signal.title}</span>
                        </div>
                        <CareDominantStatus className={cn("mt-1", severityToneClass(signal.severity))}>
                          {severityLabel(signal.severity)}
                        </CareDominantStatus>
                      </div>

                      {/* Toelichting */}
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-[12px] leading-snug text-muted-foreground/85">{signal.explanation}</p>
                        {secondary && (
                          <button
                            type="button"
                            className="mt-1 text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground relative z-10"
                            onClick={(e) => { e.stopPropagation(); runAction(secondary); }}
                          >
                            {secondary.label}
                          </button>
                        )}
                      </div>

                      {/* Casus */}
                      <div className="min-w-0">
                        {signal.casusReference ? (
                          <span className="inline-flex items-center rounded-full border border-border/60 bg-card/55 px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                            {signal.casusReference}
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground/60">—</span>
                        )}
                      </div>

                      {/* Actie */}
                      <CareWorklistRowAction>
                        <button
                          type="button"
                          className={actionClass}
                          onClick={(e) => { e.stopPropagation(); runAction(primary); }}
                        >
                          {primary.label.replace(/\s*→\s*$/u, "").trim() || primary.label}
                          <ChevronRight size={12} className="shrink-0 opacity-60" aria-hidden />
                        </button>
                      </CareWorklistRowAction>
                    </CareWorklistRow>
                  );
                })}
              </CareWorklistBody>
            </div>
          )}

          <CareWorklistPagination count={filteredSignals.length} singular="signaal" plural="signalen" />
        </CareWorklist>
      )}
    </CareCommandShell>
  );
}
