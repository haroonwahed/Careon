import { useMemo, useState } from "react";
import { Building2, ChevronDown, ChevronUp, Clock3 } from "lucide-react";
import { Button } from "../ui/button";
import { CareEmptyState } from "./CareSurface";
import { CarePageScaffold } from "./CarePageScaffold";
import {
  CanonicalPhaseBadge,
  CareDominantStatus,
  CareMetricBadge,
  CareMetaChip,
  CareFilterTabButton,
  CareFilterTabGroup,
  CarePrimaryList,
  CareSearchFiltersBar,
  CareWorkRow,
  normalizeBoardColumnToPhaseId,
} from "./CareUnifiedPage";
import { useCases } from "../../hooks/useCases";
import { useProviders } from "../../hooks/useProviders";
import { getShortReasonLabel } from "../../lib/uxCopy";
import {
  buildWorkflowCases,
  getCaseDecisionState,
  type CaseDecisionRole,
  type WorkflowBoardColumn,
  type WorkflowCaseView,
} from "../../lib/workflowUi";
import { classifyCasusWorkboardState, type CasusWorkboardSection } from "./casusWorkboardClassification";

interface WorkloadPageProps {
  onCaseClick: (caseId: string) => void;
  onCreateCase?: () => void;
  canCreateCase?: boolean;
  role?: CaseDecisionRole;
  onNavigateToWorkflow?: (page: "casussen" | "beoordelingen" | "matching" | "plaatsingen" | "intake") => void;
}

type FocusChip = "all" | "my-actions" | "waiting-provider" | "blocked";
type SectionKey = CasusWorkboardSection;

function urgencyRank(urgency: WorkflowCaseView["urgency"]): number {
  switch (urgency) {
    case "critical":
      return 4;
    case "warning":
      return 3;
    case "normal":
      return 2;
    default:
      return 1;
  }
}

export function WorkloadPage({
  onCaseClick,
  onCreateCase,
  canCreateCase = false,
  role = "gemeente",
  onNavigateToWorkflow,
}: WorkloadPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [selectedUrgency, setSelectedUrgency] = useState("all");
  const [selectedPhase, setSelectedPhase] = useState<"all" | WorkflowBoardColumn>("all");
  const [selectedOwner, setSelectedOwner] = useState<"all" | "Gemeente" | "Zorgaanbieder" | "Systeem">("all");
  const [focusChip, setFocusChip] = useState<FocusChip>("all");
  const [showSecondaryFilters, setShowSecondaryFilters] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<SectionKey, boolean>>({
    attention: false,
    "waiting-provider": false,
    stable: false,
  });
  const [visibleBySection, setVisibleBySection] = useState<Record<SectionKey, number>>({
    attention: 8,
    "waiting-provider": 8,
    stable: 8,
  });

  const { cases, loading, error, refetch } = useCases({ q: searchQuery });
  const { providers } = useProviders({ q: "" });

  const workflowCases = useMemo(() => buildWorkflowCases(cases, providers), [cases, providers]);

  const decisionItems = useMemo(() => {
    return workflowCases.map((item) => ({
      item,
      decision: getCaseDecisionState(item, role),
    }));
  }, [workflowCases, role]);

  const regions = useMemo(() => ["all", ...Array.from(new Set(decisionItems.map(({ item }) => item.region)))], [decisionItems]);

  const baseFilteredItems = useMemo(() => {
    const searchLower = searchQuery.trim().toLowerCase();

    return decisionItems
      .filter(({ item, decision }) => {
        if (searchLower.length > 0) {
          const haystack = [item.id, item.clientLabel, item.region, item.careType, item.recommendedProviderName ?? "", ...item.tags]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(searchLower)) {
            return false;
          }
        }

        if (selectedRegion !== "all" && item.region !== selectedRegion) {
          return false;
        }

        if (selectedUrgency !== "all" && item.urgency !== selectedUrgency) {
          return false;
        }

        if (selectedPhase !== "all" && item.boardColumn !== selectedPhase) {
          return false;
        }

        if (selectedOwner !== "all" && decision.responsibleParty !== selectedOwner) {
          return false;
        }

        return true;
      })
      .sort((left, right) => {
        const urgencyDiff = urgencyRank(right.item.urgency) - urgencyRank(left.item.urgency);
        if (urgencyDiff !== 0) return urgencyDiff;

        const blockedDiff = Number(right.item.isBlocked) - Number(left.item.isBlocked);
        if (blockedDiff !== 0) return blockedDiff;

        const myActionDiff = Number(right.decision.requiresCurrentUserAction) - Number(left.decision.requiresCurrentUserAction);
        if (myActionDiff !== 0) return myActionDiff;

        const waitingDiff = right.item.daysInCurrentPhase - left.item.daysInCurrentPhase;
        if (waitingDiff !== 0) return waitingDiff;

        return left.item.id.localeCompare(right.item.id);
      });
  }, [
    decisionItems,
    searchQuery,
    selectedRegion,
    selectedUrgency,
    selectedPhase,
    selectedOwner,
  ]);

  const filteredItems = useMemo(() => {
    return baseFilteredItems.filter(({ item, decision }) => {
      if (focusChip === "my-actions") return decision.requiresCurrentUserAction;
      if (focusChip === "waiting-provider") return classifyCasusWorkboardState(item, decision).section === "waiting-provider";
      if (focusChip === "blocked") return item.isBlocked || item.missingDataItems.length > 0;
      return true;
    });
  }, [baseFilteredItems, focusChip]);

  const classifiedItems = useMemo(() => {
    return filteredItems.map(({ item, decision }) => ({
      item,
      decision,
      classification: classifyCasusWorkboardState(item, decision),
    }));
  }, [filteredItems]);

  const attentionCount = classifiedItems.filter(({ classification }) => classification.section === "attention").length;
  const sectionedItems = useMemo(() => ({
    attention: classifiedItems.filter(({ classification }) => classification.section === "attention"),
    "waiting-provider": classifiedItems.filter(({ classification }) => classification.section === "waiting-provider"),
    stable: classifiedItems.filter(({ classification }) => classification.section === "stable"),
  }), [classifiedItems]);

  const handleNavigate = (page: "casussen" | "beoordelingen" | "matching" | "plaatsingen" | "intake") => {
    onNavigateToWorkflow?.(page);
  };

  const toggleSection = (section: SectionKey) => {
    setCollapsedSections((current) => ({ ...current, [section]: !current[section] }));
  };

  const sectionHeaders: Record<SectionKey, string> = {
    attention: "⚠ Vraagt aandacht",
    "waiting-provider": "⏳ Wacht op aanbieder",
    stable: "✓ Stabiel",
  };

  const sectionEmptyLabel: Record<SectionKey, string> = {
    attention: "Geen casussen in deze categorie",
    "waiting-provider": "Geen casussen in deze categorie",
    stable: "Geen casussen in deze categorie",
  };

  const compactProblemLabel = (item: (typeof classifiedItems)[number]["item"], decision: (typeof classifiedItems)[number]["decision"]): string => {
    const problem = getShortReasonLabel(decision.blockedReason ?? item.missingDataItems[0] ?? decision.whyHere).toLowerCase();
    if (item.isBlocked || item.missingDataItems.length > 0) return "Blokkade";
    if (problem.includes("urgentie")) return "Blokkade";
    if (problem.includes("samenvatting")) return "Blokkade";
    if (problem.includes("beoordeling") || problem.includes("aanbieder")) return "Wacht op aanbieder";
    return decision.requiresCurrentUserAction ? "Actie vereist" : "Geen actie nodig";
  };

  const compactActionLabel = (decision: (typeof classifiedItems)[number]["decision"]): string => {
    const action = decision.nextActionLabel.toLowerCase();
    if (action.includes("urgentie") || action.includes("vul")) return "Vul urgentie aan";
    if (action.includes("genereer") || action.includes("samenvatting")) return "Genereer samenvatting";
    if (action.includes("controleer") && action.includes("match")) return "Start matching";
    if (action.includes("start matching")) return "Start matching";
    if ((action.includes("bekijk") && action.includes("reactie")) || action.includes("aanbiederreactie")) return "Bekijk status";
    if (action.includes("status") && !action.includes("beoordeling uitvoeren")) return "Bekijk status";
    if (action.includes("intake") && action.includes("bekijk")) return "Bekijk intake";
    if (action.includes("open")) return "Open casus";
    return decision.nextActionLabel;
  };

  const compactDaysLabel = (lastUpdatedLabel: string): string => {
    const match = lastUpdatedLabel.match(/(\d+)/);
    if (match) return `${match[1]}d`;
    if (lastUpdatedLabel.toLowerCase().includes("vandaag")) return "0d";
    return lastUpdatedLabel;
  };

  const phaseOptions: Array<{ value: WorkflowBoardColumn; label: string }> = [
    { value: "casus", label: "Casus" },
    { value: "samenvatting", label: "Samenvatting" },
    { value: "matching", label: "Matching" },
    { value: "gemeente-validatie", label: "Gemeente Validatie" },
    { value: "aanbieder-beoordeling", label: "Wacht op aanbieder" },
    { value: "plaatsing", label: "Plaatsing" },
    { value: "intake", label: "Intake" },
  ];

  return (
    <CarePageScaffold
      archetype="worklist"
      className="pb-8"
      title="Werkvoorraad"
      subtitle="Beheer en stuur casussen"
      metric={
        <CareMetricBadge>
          {filteredItems.length} casussen — {attentionCount} vragen aandacht
        </CareMetricBadge>
      }
      filters={
        <CareSearchFiltersBar
          tabs={
            <CareFilterTabGroup aria-label="Werkvoorraad-weergave">
              {[
                { key: "all" as const, label: "Alles" },
                { key: "my-actions" as const, label: "Mijn acties" },
                { key: "waiting-provider" as const, label: "Wacht op aanbieder" },
                { key: "blocked" as const, label: "Geblokkeerd" },
              ].map((tab) => (
                <CareFilterTabButton key={tab.key} selected={focusChip === tab.key} onClick={() => setFocusChip(tab.key)}>
                  {tab.label}
                </CareFilterTabButton>
              ))}
            </CareFilterTabGroup>
          }
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Zoek op client, casus, regio of zorgvraag"
          showSecondaryFilters={showSecondaryFilters}
          onToggleSecondaryFilters={() => setShowSecondaryFilters((current) => !current)}
          secondaryFilters={
            <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-4">
              <label className="text-sm">
                <span className="mb-1 block text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Fase</span>
                <select value={selectedPhase} onChange={(event) => setSelectedPhase(event.target.value as "all" | WorkflowBoardColumn)} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground">
                  <option value="all">Alle fases</option>
                  {phaseOptions.map((phase) => (
                    <option key={phase.value} value={phase.value}>{phase.label}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Urgentie</span>
                <select value={selectedUrgency} onChange={(event) => setSelectedUrgency(event.target.value)} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground">
                  <option value="all">Alle urgentie</option>
                  <option value="critical">Kritiek</option>
                  <option value="warning">Hoog</option>
                  <option value="normal">Normaal</option>
                  <option value="stable">Laag</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Regio</span>
                <select value={selectedRegion} onChange={(event) => setSelectedRegion(event.target.value)} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground">
                  {regions.map((region) => (
                    <option key={region} value={region}>{region === "all" ? "Alle regio's" : region}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Verantwoordelijke</span>
                <select value={selectedOwner} onChange={(event) => setSelectedOwner(event.target.value as "all" | "Gemeente" | "Zorgaanbieder" | "Systeem")} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground">
                  <option value="all">Alle verantwoordelijken</option>
                  <option value="Gemeente">Gemeente</option>
                  <option value="Zorgaanbieder">Zorgaanbieder</option>
                  <option value="Systeem">Systeem</option>
                </select>
              </label>
            </div>
          }
        />
      }
    >
      {loading && <CareEmptyState title="Casussen laden…" copy="De werkvoorraad wordt opgebouwd." />}

      {!loading && error && (
        <CareEmptyState title="Casussen laden mislukt" copy={getShortReasonLabel(error, 100)} action={<Button variant="outline" onClick={refetch}>Opnieuw</Button>} />
      )}

      {!loading && !error && workflowCases.length === 0 && (
        <CareEmptyState
          title="Geen casussen."
          copy="Pas filters aan."
          action={canCreateCase ? <Button onClick={onCreateCase}>Nieuwe casus</Button> : undefined}
        />
      )}

      {!loading && !error && workflowCases.length > 0 && filteredItems.length === 0 && (
        <CareEmptyState
          title={focusChip === "my-actions" ? "Geen open acties." : "Geen casussen."}
          copy={focusChip === "my-actions" ? "Alles ligt bij andere partijen." : "Pas filters aan."}
        />
      )}

      {!loading && !error && filteredItems.length > 0 && (
        <div data-testid="worklist" data-density="compact" className="space-y-3.5">
          {(Object.keys(sectionedItems) as SectionKey[]).map((sectionKey) => {
            const items = sectionedItems[sectionKey];
            const isCollapsed = collapsedSections[sectionKey];
            const visibleItems = items.slice(0, visibleBySection[sectionKey]);
            return (
              <section key={sectionKey} className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleSection(sectionKey)}
                  className="flex w-full items-center justify-between rounded-lg px-1 py-0.5 text-left"
                >
                  <h2 className="text-[15px] font-semibold">
                    {sectionHeaders[sectionKey]} ({items.length})
                  </h2>
                  {isCollapsed ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronUp size={16} className="text-muted-foreground" />}
                </button>

                {!isCollapsed && (
                  <>
                    {items.length === 0 && <p className="text-[13px] text-muted-foreground">{sectionEmptyLabel[sectionKey]}</p>}
                    {items.length > 0 && (
                      <CarePrimaryList>
                        {visibleItems.map(({ item, decision }) => {
                          // Keep debug diagnostics directly in UI for rapid triage in development.
                          // This block is dev-only and excluded from production usage.
                          const classification = classifyCasusWorkboardState(item, decision);
                          const showPrimaryCta = decision.requiresCurrentUserAction && decision.primaryActionEnabled;
                          return (
                          <div key={item.id} className="group relative">
                            <CareWorkRow
                              leading={<CanonicalPhaseBadge phaseId={normalizeBoardColumnToPhaseId(item.boardColumn)} />}
                              title={item.clientLabel}
                              context={
                                <>
                                  <CareMetaChip>{item.clientAge} jaar</CareMetaChip>
                                  <CareMetaChip>{item.region}</CareMetaChip>
                                  <CareMetaChip title={item.careType}>
                                    <span className="max-w-[10rem] truncate">{item.careType}</span>
                                  </CareMetaChip>
                                </>
                              }
                              status={
                                <CareDominantStatus
                                  className={
                                    item.isBlocked || item.missingDataItems.length > 0
                                      ? "border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-200"
                                      : sectionKey === "attention"
                                      ? "border-destructive/35 bg-destructive/10 text-destructive"
                                      : sectionKey === "waiting-provider"
                                        ? "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-200"
                                        : "border-border/70 bg-muted/20 text-muted-foreground"
                                  }
                                >
                                  {compactProblemLabel(item, decision)}
                                </CareDominantStatus>
                              }
                              time={
                                <CareMetaChip>
                                  <Clock3 size={12} />
                                  {compactDaysLabel(item.lastUpdatedLabel)}
                                </CareMetaChip>
                              }
                              contextInfo={
                                item.recommendedProviderName ? (
                                  <CareMetaChip title={item.recommendedProviderName}>
                                    <Building2 size={12} />
                                    <span className="max-w-[200px] truncate">{item.recommendedProviderName}</span>
                                  </CareMetaChip>
                                ) : undefined
                              }
                              actionLabel={compactActionLabel(decision)}
                              actionVariant={showPrimaryCta ? "primary" : "ghost"}
                              onOpen={() => onCaseClick(item.id)}
                              onAction={(event) => {
                                event.stopPropagation();
                                handleNavigate(decision.nextActionRoute);
                              }}
                              accentTone={sectionKey === "attention" ? "critical" : sectionKey === "waiting-provider" ? "warning" : "neutral"}
                            />
                            {import.meta.env.DEV && (
                              <details className="absolute right-2 top-1">
                                <summary
                                  aria-label="Open debug classificatie"
                                  className="inline-block cursor-pointer list-none rounded-full px-1 text-[10px] text-muted-foreground opacity-0 transition-opacity hover:bg-muted/40 group-hover:opacity-100 focus-visible:opacity-100"
                                >
                                  i
                                </summary>
                                <div className="mt-1 space-y-1 text-left text-[11px] text-muted-foreground md:absolute md:right-6 md:z-10 md:rounded-md md:border md:border-border/60 md:bg-background/95 md:p-2">
                                  <p>Bucket: {classification.debug.assignedBucket}</p>
                                  <p>Regel: {classification.debug.winningRule}</p>
                                  <p>isBlocked: {String(classification.debug.signals.isBlocked)}</p>
                                  <p>primaryActionEnabled: {String(classification.debug.signals.primaryActionEnabled)}</p>
                                  <p>missingDataItems: {classification.debug.signals.missingDataItems.join(", ") || "geen"}</p>
                                  <p>requiresCurrentUserAction: {String(classification.debug.signals.requiresCurrentUserAction)}</p>
                                  <p>responsibleParty: {classification.debug.signals.responsibleParty}</p>
                                  <p>boardColumn: {classification.debug.signals.boardColumn}</p>
                                  <p>providerStatusLabel: {classification.debug.signals.providerStatusLabel ?? "geen"}</p>
                                  <p>nextActionRoute: {classification.debug.nextActionRoute}</p>
                                </div>
                              </details>
                            )}
                          </div>
                          );
                        })}
                      </CarePrimaryList>
                    )}
                    {items.length > visibleItems.length && (
                      <Button
                        variant="outline"
                        onClick={() => setVisibleBySection((current) => ({ ...current, [sectionKey]: current[sectionKey] + 8 }))}
                      >
                        Toon meer
                      </Button>
                    )}
                  </>
                )}
              </section>
            );
          })}
        </div>
      )}
    </CarePageScaffold>
  );
}
