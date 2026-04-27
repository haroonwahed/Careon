import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Plus, Search, ShieldAlert, Sparkles, UserCheck, Users } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { CareEmptyState, CareFilterLabel, CareInsightBanner, CarePageHeader, CareSectionCard } from "./CareSurface";
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
import { ActionCaseDecisionCard } from "./workflow/ActionCaseDecisionCard";

interface CasussenWorkflowPageProps {
  onCaseClick: (caseId: string) => void;
  onCreateCase?: () => void;
  canCreateCase?: boolean;
  role?: CaseDecisionRole;
  onNavigateToWorkflow?: (page: "casussen" | "beoordelingen" | "matching" | "plaatsingen" | "intake") => void;
}

type FocusChip = "all" | "my-actions" | "waiting-provider" | "blocked" | "ready-placement";
type AttentionKey = "waiting-provider" | "missing-summary" | "rejected" | "ready-placement" | "info-requested";

interface AttentionItem {
  key: AttentionKey;
  severity: "critical" | "warning" | "info" | "good";
  label: string;
  count: number;
}

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

function severityClasses(severity: AttentionItem["severity"]): string {
  switch (severity) {
    case "critical":
      return "border-red-500/35 bg-red-500/10 text-red-100";
    case "warning":
      return "border-amber-500/35 bg-amber-500/10 text-amber-100";
    case "good":
      return "border-emerald-500/35 bg-emerald-500/10 text-emerald-100";
    default:
      return "border-cyan-500/35 bg-cyan-500/10 text-cyan-100";
  }
}

function attentionPredicate(key: AttentionKey, item: WorkflowCaseView, decisionLabel: string, responsibleParty: string, blockedReason: string | null): boolean {
  switch (key) {
    case "missing-summary":
      return decisionLabel.toLowerCase().includes("samenvatting");
    case "waiting-provider":
      return responsibleParty === "Zorgaanbieder" && item.boardColumn === "aanbieder-beoordeling" && item.daysInCurrentPhase > 3;
    case "info-requested":
      return decisionLabel.toLowerCase().includes("informatie") || (blockedReason ?? "").toLowerCase().includes("informatie");
    case "rejected":
      return (blockedReason ?? "").toLowerCase().includes("afgewezen") || decisionLabel.toLowerCase().includes("nieuwe match zoeken");
    case "ready-placement":
      return decisionLabel.toLowerCase().includes("bevestig plaatsing") || item.boardColumn === "plaatsing";
  }
}

export function CasussenWorkflowPage({
  onCaseClick,
  onCreateCase,
  canCreateCase = false,
  role = "gemeente",
  onNavigateToWorkflow,
}: CasussenWorkflowPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [selectedUrgency, setSelectedUrgency] = useState("all");
  const [selectedPhase, setSelectedPhase] = useState<"all" | WorkflowBoardColumn>("all");
  const [selectedOwner, setSelectedOwner] = useState<"all" | "Gemeente" | "Zorgaanbieder" | "Systeem">("all");
  const [focusChip, setFocusChip] = useState<FocusChip>("all");
  const [activeAttention, setActiveAttention] = useState<AttentionKey | null>(null);

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

  const attentionItems = useMemo<AttentionItem[]>(() => {
    const waitingProviderCount = decisionItems.filter(({ item, decision }) => attentionPredicate("waiting-provider", item, decision.nextActionLabel, decision.responsibleParty, decision.blockedReason)).length;
    const missingSummaryCount = decisionItems.filter(({ item, decision }) => attentionPredicate("missing-summary", item, decision.nextActionLabel, decision.responsibleParty, decision.blockedReason)).length;
    const infoRequestedCount = decisionItems.filter(({ item, decision }) => attentionPredicate("info-requested", item, decision.nextActionLabel, decision.responsibleParty, decision.blockedReason)).length;
    const rejectedCount = decisionItems.filter(({ item, decision }) => attentionPredicate("rejected", item, decision.nextActionLabel, decision.responsibleParty, decision.blockedReason)).length;
    const readyPlacementCount = decisionItems.filter(({ item, decision }) => attentionPredicate("ready-placement", item, decision.nextActionLabel, decision.responsibleParty, decision.blockedReason)).length;

    return [
      {
        key: "waiting-provider",
        severity: waitingProviderCount > 0 ? "warning" : "info",
        count: waitingProviderCount,
        label: `${waitingProviderCount} wachten op aanbieder`,
      },
      {
        key: "missing-summary",
        severity: missingSummaryCount > 0 ? "warning" : "info",
        count: missingSummaryCount,
        label: `${missingSummaryCount} missen samenvatting`,
      },
      {
        key: "rejected",
        severity: rejectedCount > 0 ? "critical" : "info",
        count: rejectedCount,
        label: `${rejectedCount} vragen nieuwe match`,
      },
      {
        key: "ready-placement",
        severity: readyPlacementCount > 0 ? "good" : "info",
        count: readyPlacementCount,
        label: `${readyPlacementCount} klaar voor plaatsing`,
      },
      {
        key: "info-requested",
        severity: infoRequestedCount > 0 ? "warning" : "info",
        count: infoRequestedCount,
        label: `${infoRequestedCount} vragen info`,
      },
    ];
  }, [decisionItems]);

  const filteredItems = useMemo(() => {
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

        if (focusChip === "my-actions" && !decision.requiresCurrentUserAction) {
          return false;
        }

        if (focusChip === "waiting-provider" && !attentionPredicate("waiting-provider", item, decision.nextActionLabel, decision.responsibleParty, decision.blockedReason)) {
          return false;
        }

        if (focusChip === "blocked" && !item.isBlocked) {
          return false;
        }

        if (focusChip === "ready-placement" && !attentionPredicate("ready-placement", item, decision.nextActionLabel, decision.responsibleParty, decision.blockedReason)) {
          return false;
        }

        if (activeAttention && !attentionPredicate(activeAttention, item, decision.nextActionLabel, decision.responsibleParty, decision.blockedReason)) {
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
    focusChip,
    activeAttention,
  ]);

  const urgentItems = filteredItems.filter(({ item }) => item.urgency === "critical" || item.urgency === "warning");
  const stableItems = filteredItems.filter(({ item }) => item.urgency !== "critical" && item.urgency !== "warning");

  const handleCreateCase = () => {
    onCreateCase?.();
  };

  const handleNavigate = (page: "casussen" | "beoordelingen" | "matching" | "plaatsingen" | "intake") => {
    onNavigateToWorkflow?.(page);
  };

  const phaseOptions: Array<{ value: WorkflowBoardColumn; label: string }> = [
    { value: "casus", label: "Casus" },
    { value: "samenvatting", label: "Samenvatting" },
    { value: "matching", label: "Matching" },
    { value: "gemeente-validatie", label: "Gemeente Validatie" },
    { value: "aanbieder-beoordeling", label: "Beoordeling door aanbieder" },
    { value: "plaatsing", label: "Plaatsing" },
    { value: "intake", label: "Intake" },
  ];

  return (
    <div className="space-y-6 pb-10">
      <CarePageHeader
        eyebrow={<><Users size={16} className="text-primary" /><span>Casussen</span></>}
        title="Casussen"
        subtitle={`${workflowCases.length} actief · ${attentionItems.reduce((sum, item) => sum + item.count, 0)} aandacht`}
        actions={canCreateCase ? <Button onClick={handleCreateCase}><Plus size={16} className="mr-2" />Nieuwe casus</Button> : undefined}
      />

      <CareInsightBanner
        tone="warning"
        title={`${attentionItems[0]?.count ?? 0} casussen vragen directe opvolging`}
        copy="Triage op de volgende actie."
        action={<Button variant="outline" onClick={() => handleNavigate("matching")} className="gap-2"><Sparkles size={14} />Matching</Button>}
      />

      <CareSectionCard
        title="Aandacht nu"
        subtitle="Snelle focus op urgente signalen."
        actions={activeAttention ? <Button size="sm" variant="ghost" onClick={() => setActiveAttention(null)}>Wis</Button> : undefined}
      >
        <div className="flex gap-3 overflow-x-auto pb-1">
          {attentionItems.map((attention) => (
            <button
              key={attention.key}
              type="button"
              onClick={() => setActiveAttention((current) => (current === attention.key ? null : attention.key))}
              className={`min-w-[290px] shrink-0 rounded-2xl border px-4 py-3 text-left transition-colors ${severityClasses(attention.severity)} ${activeAttention === attention.key ? "ring-2 ring-primary/35" : ""}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.08em]">{attention.count}</span>
                {attention.severity === "critical" && <ShieldAlert size={16} />}
                {attention.severity === "warning" && <AlertTriangle size={16} />}
                {attention.severity === "good" && <CheckCircle2 size={16} />}
                {attention.severity === "info" && <Sparkles size={16} />}
              </div>
              <p className="mt-2 text-sm leading-5">{attention.label}</p>
            </button>
          ))}
        </div>
      </CareSectionCard>

      <CareSectionCard title="Filters" subtitle="Zoek en filter de werkvoorraad.">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">
            <div className="xl:col-span-2">
              <div className="flex items-center gap-2 rounded-3xl border border-border/80 bg-background/55 px-3 py-2.5">
                <Search className="shrink-0 text-muted-foreground" size={18} />
                <Input
                  type="text"
                  placeholder="Zoek op cliënt, casus, regio of zorgvraag"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="h-8 border-0 bg-transparent p-0 text-sm text-foreground shadow-none focus-visible:ring-0"
                />
              </div>
            </div>

            <CareFilterLabel label="Fase">
              <select value={selectedPhase} onChange={(event) => setSelectedPhase(event.target.value as "all" | WorkflowBoardColumn)} className="w-full rounded-3xl border border-border bg-card px-3 py-2.5 text-sm text-foreground">
                <option value="all">Alle fases</option>
                {phaseOptions.map((phase) => (
                  <option key={phase.value} value={phase.value}>{phase.label}</option>
                ))}
              </select>
            </CareFilterLabel>

            <CareFilterLabel label="Urgentie">
              <select value={selectedUrgency} onChange={(event) => setSelectedUrgency(event.target.value)} className="w-full rounded-3xl border border-border bg-card px-3 py-2.5 text-sm text-foreground">
                <option value="all">Alle urgentie</option>
                <option value="critical">Kritiek</option>
                <option value="warning">Hoog</option>
                <option value="normal">Normaal</option>
                <option value="stable">Laag</option>
              </select>
            </CareFilterLabel>

            <CareFilterLabel label="Regio">
              <select value={selectedRegion} onChange={(event) => setSelectedRegion(event.target.value)} className="w-full rounded-3xl border border-border bg-card px-3 py-2.5 text-sm text-foreground">
                {regions.map((region) => (
                  <option key={region} value={region}>{region === "all" ? "Alle regio's" : region}</option>
                ))}
              </select>
            </CareFilterLabel>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[280px_1fr]">
            <CareFilterLabel label="Verantwoordelijke">
              <select value={selectedOwner} onChange={(event) => setSelectedOwner(event.target.value as "all" | "Gemeente" | "Zorgaanbieder" | "Systeem")} className="w-full rounded-3xl border border-border bg-card px-3 py-2.5 text-sm text-foreground">
                <option value="all">Alle verantwoordelijken</option>
                <option value="Gemeente">Gemeente</option>
                <option value="Zorgaanbieder">Zorgaanbieder</option>
                <option value="Systeem">Systeem</option>
              </select>
            </CareFilterLabel>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant={focusChip === "all" ? "default" : "outline"} size="sm" onClick={() => setFocusChip("all")}>
                Alle casussen
              </Button>
              <Button variant={focusChip === "my-actions" ? "default" : "outline"} size="sm" onClick={() => setFocusChip("my-actions")}>
                <Users size={14} className="mr-1.5" />Mijn acties
              </Button>
              <Button variant={focusChip === "waiting-provider" ? "default" : "outline"} size="sm" onClick={() => setFocusChip("waiting-provider")}>
                <UserCheck size={14} className="mr-1.5" />Wacht op aanbieder
              </Button>
              <Button variant={focusChip === "blocked" ? "default" : "outline"} size="sm" onClick={() => setFocusChip("blocked")}>
                <AlertTriangle size={14} className="mr-1.5" />Geblokkeerd
              </Button>
              <Button variant={focusChip === "ready-placement" ? "default" : "outline"} size="sm" onClick={() => setFocusChip("ready-placement")}>
                <CheckCircle2 size={14} className="mr-1.5" />Klaar voor plaatsing
              </Button>
            </div>
          </div>
        </div>
      </CareSectionCard>

      {loading && <CareEmptyState title="Casussen laden…" copy="De triageweergave wordt opgebouwd." />}

      {!loading && error && (
        <CareEmptyState title="Casussen laden mislukt" copy={getShortReasonLabel(error, 100)} action={<Button variant="outline" onClick={refetch}>Opnieuw</Button>} />
      )}

      {!loading && !error && workflowCases.length === 0 && (
        <CareEmptyState
          title="Geen casussen."
          copy="Pas filters aan."
          action={canCreateCase ? <Button onClick={handleCreateCase}>Nieuwe casus</Button> : undefined}
        />
      )}

      {!loading && !error && workflowCases.length > 0 && filteredItems.length === 0 && (
        <CareEmptyState
          title={focusChip === "my-actions" ? "Geen open acties." : "Geen casussen."}
          copy={focusChip === "my-actions"
            ? "Alles ligt bij andere partijen."
            : focusChip === "waiting-provider" || activeAttention === "waiting-provider"
              ? "Geen casussen wachten langer dan 3 dagen."
              : "Pas filters aan."}
        />
      )}

      {!loading && !error && filteredItems.length > 0 && (
        <div className="space-y-5">
          {urgentItems.length > 0 && (
            <CareSectionCard title="Casussen die aandacht nodig hebben" subtitle={`${urgentItems.length} urgent`}>
              <div className="space-y-4">
                {urgentItems.map(({ item, decision }) => (
                  <ActionCaseDecisionCard key={item.id} item={item} decision={decision} role={role} onOpen={onCaseClick} onNavigate={handleNavigate} />
                ))}
              </div>
            </CareSectionCard>
          )}

          {stableItems.length > 0 && (
            <CareSectionCard title="Overige casussen" subtitle={`${stableItems.length} stabiel`}>
              <div className="space-y-4">
                {stableItems.map(({ item, decision }) => (
                  <ActionCaseDecisionCard key={item.id} item={item} decision={decision} role={role} onOpen={onCaseClick} onNavigate={handleNavigate} />
                ))}
              </div>
            </CareSectionCard>
          )}
        </div>
      )}
    </div>
  );
}
