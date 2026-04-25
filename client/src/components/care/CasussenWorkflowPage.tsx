import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Plus, Search, Shuffle, UserCheck } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useCases } from "../../hooks/useCases";
import { useProviders } from "../../hooks/useProviders";
import { buildWorkflowCases, type WorkflowBoardColumn, type WorkflowCaseView } from "../../lib/workflowUi";

interface CasussenWorkflowPageProps {
  onCaseClick: (caseId: string) => void;
  onCreateCase?: () => void;
  canCreateCase?: boolean;
}

type SmartFocus = "assessment" | "matching" | "placement" | "urgent" | null;

const BOARD_COLUMNS: Array<{ id: WorkflowBoardColumn; label: string }> = [
  { id: "nieuw", label: "Casus" },
  { id: "in-beoordeling", label: "Aanbieder Beoordeling" },
  { id: "klaar-voor-matching", label: "Klaar voor matching" },
  { id: "in-plaatsing", label: "Plaatsing" },
  { id: "afgerond", label: "Afgerond" },
];

function urgencyBadgeClasses(urgency: WorkflowCaseView["urgency"]) {
  switch (urgency) {
    case "critical":
      return "bg-red-500/10 text-red-400 border-red-500/30";
    case "warning":
      return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    case "normal":
      return "bg-blue-500/10 text-blue-400 border-blue-500/30";
    default:
      return "bg-muted/40 text-muted-foreground border-border";
  }
}

function shortcutLabel(item: WorkflowCaseView) {
  if (item.phase === "intake") return "Start matching";
  if (item.phase === "provider_beoordeling") return "Open aanbiederbeoordeling";
  if (item.phase === "matching") return "Start matching";
  if (item.phase === "plaatsing") return "Open plaatsing";
  return "Bekijk casus";
}

function workflowStepLabel(page: WorkflowCaseView["nextBestActionUrl"]) {
  switch (page) {
    case "beoordelingen":
      return "Aanbieder Beoordeling";
    case "matching":
      return "Matching";
    case "plaatsingen":
      return "Plaatsing";
    case "intake":
      return "Intake";
    default:
      return "Casussen";
  }
}

export function CasussenWorkflowPage({ onCaseClick, onCreateCase, canCreateCase = false }: CasussenWorkflowPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [selectedUrgency, setSelectedUrgency] = useState("all");
  const [smartFocus, setSmartFocus] = useState<SmartFocus>(null);

  const { cases, loading, error, refetch } = useCases({ q: searchQuery });
  const { providers } = useProviders({ q: "" });

  const workflowCases = useMemo(() => buildWorkflowCases(cases, providers), [cases, providers]);
  const regions = useMemo(() => ["all", ...Array.from(new Set(workflowCases.map((item) => item.region)))], [workflowCases]);

  const filteredCases = useMemo(() => {
    return workflowCases.filter((item) => {
      if (selectedRegion !== "all" && item.region !== selectedRegion) return false;
      if (selectedUrgency !== "all" && item.urgency !== selectedUrgency) return false;
      if (smartFocus === "assessment" && !(item.phase === "intake" || item.phase === "provider_beoordeling")) return false;
      if (smartFocus === "matching" && !item.readyForMatching) return false;
      if (smartFocus === "placement" && !item.readyForPlacement) return false;
      if (smartFocus === "urgent" && !(item.urgency === "critical" && item.isBlocked)) return false;
      return true;
    });
  }, [workflowCases, selectedRegion, selectedUrgency, smartFocus]);

  const stripMetrics = useMemo(() => ({
    waitingAssessment: workflowCases.filter((item) => item.phase === "intake" || item.phase === "provider_beoordeling").length,
    readyMatching: workflowCases.filter((item) => item.readyForMatching).length,
    waitingPlacement: workflowCases.filter((item) => item.readyForPlacement).length,
    urgentWithoutMatch: workflowCases.filter((item) => item.urgency === "critical" && item.isBlocked).length,
  }), [workflowCases]);

  const groupedCases = useMemo(() => {
    return BOARD_COLUMNS.reduce<Record<WorkflowBoardColumn, WorkflowCaseView[]>>((accumulator, column) => {
      accumulator[column.id] = filteredCases
        .filter((item) => item.boardColumn === column.id)
        .sort((left, right) => right.daysInCurrentPhase - left.daysInCurrentPhase);
      return accumulator;
    }, {
      nieuw: [],
      "in-beoordeling": [],
      "klaar-voor-matching": [],
      "in-plaatsing": [],
      afgerond: [],
    });
  }, [filteredCases]);

  const handleCreateCase = () => {
    onCreateCase?.();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">Casussen</h1>
          <p className="text-sm text-muted-foreground">Centrale pipeline van casus naar intake.</p>
        </div>
        {canCreateCase && (
          <Button onClick={handleCreateCase}>
            <Plus size={16} className="mr-2" />
            Nieuwe casus
          </Button>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card/45 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Workflow</p>
        <p className="mt-1 text-sm text-foreground">Casus → Samenvatting → Matching → Aanbieder Beoordeling → Plaatsing → Intake</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <button type="button" onClick={() => setSmartFocus(smartFocus === "assessment" ? null : "assessment")} className={`rounded-2xl border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-sm ${smartFocus === "assessment" ? "ring-2 ring-primary/35" : "border-border"}`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Wacht op aanbiederbeoordeling</span>
            <UserCheck size={18} className="text-blue-400" />
          </div>
          <p className="text-2xl font-semibold text-foreground">{stripMetrics.waitingAssessment}</p>
          <p className="mt-1 text-xs text-muted-foreground">Nieuwe of lopende aanbiederbeoordelingen</p>
        </button>
        <button type="button" onClick={() => setSmartFocus(smartFocus === "matching" ? null : "matching")} className={`rounded-2xl border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-sm ${smartFocus === "matching" ? "ring-2 ring-primary/35" : "border-border"}`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Klaar voor matching</span>
            <Shuffle size={18} className="text-amber-400" />
          </div>
          <p className="text-2xl font-semibold text-foreground">{stripMetrics.readyMatching}</p>
          <p className="mt-1 text-xs text-muted-foreground">Samenvatting gereed, klaar voor providerkeuze</p>
        </button>
        <button type="button" onClick={() => setSmartFocus(smartFocus === "placement" ? null : "placement")} className={`rounded-2xl border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-sm ${smartFocus === "placement" ? "ring-2 ring-primary/35" : "border-border"}`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Wacht op plaatsing</span>
            <CheckCircle2 size={18} className="text-cyan-400" />
          </div>
          <p className="text-2xl font-semibold text-foreground">{stripMetrics.waitingPlacement}</p>
          <p className="mt-1 text-xs text-muted-foreground">Klaar om plaatsing te bevestigen en intake te plannen</p>
        </button>
        <button type="button" onClick={() => setSmartFocus(smartFocus === "urgent" ? null : "urgent")} className={`rounded-2xl border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-sm ${smartFocus === "urgent" ? "ring-2 ring-primary/35" : "border-border"}`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Urgent zonder match</span>
            <AlertTriangle size={18} className="text-red-400" />
          </div>
          <p className="text-2xl font-semibold text-foreground">{stripMetrics.urgentWithoutMatch}</p>
          <p className="mt-1 text-xs text-muted-foreground">Kritieke casussen met blokkade of geen passend aanbod</p>
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 rounded-2xl border border-border bg-muted/35 p-3 flex items-center gap-2">
          <Search className="text-muted-foreground flex-shrink-0" size={18} />
          <Input type="text" placeholder="Zoek casussen, cliënten, regio's..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-8 p-0 text-sm text-foreground placeholder:text-muted-foreground" />
        </div>
        <select value={selectedRegion} onChange={(event) => setSelectedRegion(event.target.value)} className="w-44 px-3 py-3 pr-10 appearance-none bg-card border border-border rounded-2xl text-sm text-foreground">
          {regions.map((region) => (
            <option key={region} value={region}>{region === "all" ? "Alle regio's" : region}</option>
          ))}
        </select>
        <select value={selectedUrgency} onChange={(event) => setSelectedUrgency(event.target.value)} className="w-40 px-3 py-3 pr-10 appearance-none bg-card border border-border rounded-2xl text-sm text-foreground">
          <option value="all">Alle urgentie</option>
          <option value="critical">Kritiek</option>
          <option value="warning">Hoog</option>
          <option value="normal">Normaal</option>
          <option value="stable">Laag</option>
        </select>
      </div>

      {loading && <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">Casussen laden…</div>}

      {!loading && error && (
        <div className="rounded-2xl border bg-card p-10 text-center space-y-3">
          <p className="text-base font-semibold text-foreground">Casussen konden niet geladen worden</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={refetch}>Opnieuw proberen</Button>
        </div>
      )}

      {!loading && !error && filteredCases.length === 0 && (
        <div className="rounded-2xl border bg-card p-12 text-center space-y-3">
          <p className="text-lg font-semibold text-foreground">Nog geen casussen in de pipeline</p>
          <p className="text-sm text-muted-foreground">
            {canCreateCase
              ? "Start in de eerste workflowstap en voeg een nieuwe casus toe."
              : "Nieuwe casussen verschijnen hier zodra ze aan jouw werkvoorraad zijn toegewezen."}
          </p>
          {canCreateCase && <Button onClick={handleCreateCase}>Nieuwe casus</Button>}
        </div>
      )}

      {!loading && !error && filteredCases.length > 0 && (
        <div className="overflow-x-auto pb-2">
          <div className="grid min-w-[1180px] grid-cols-5 gap-4">
            {BOARD_COLUMNS.map((column) => (
              <section key={column.id} className="rounded-2xl border border-border bg-card/55 p-4 space-y-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">{column.label}</h2>
                  <p className="text-xs text-muted-foreground">{groupedCases[column.id].length} casussen</p>
                </div>

                <div className="space-y-3">
                  {groupedCases[column.id].map((item) => (
                    <button key={item.id} type="button" onClick={() => onCaseClick(item.id)} className="w-full rounded-2xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{item.id}</p>
                          <p className="text-sm text-muted-foreground mt-1">{item.clientLabel}</p>
                        </div>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${urgencyBadgeClasses(item.urgency)}`}>
                          {item.urgencyLabel}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                        <div>
                          <p>Leeftijd</p>
                          <p className="mt-1 text-sm font-medium text-foreground">{item.clientAge} jaar</p>
                        </div>
                        <div>
                          <p>Regio</p>
                          <p className="mt-1 text-sm font-medium text-foreground">{item.municipality}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">{tag}</span>
                        ))}
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Fase</p>
                          <p className="text-sm font-medium text-foreground">{item.phaseLabel}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Volgende stap</p>
                          <p className="text-sm font-medium text-foreground">{workflowStepLabel(item.nextBestActionUrl)}</p>
                        </div>
                        <Button size="sm" variant="ghost" className="gap-2 text-primary hover:bg-primary/10 hover:text-primary" onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                          event.stopPropagation();
                          onCaseClick(item.id);
                        }}>
                          {shortcutLabel(item)}
                          <ArrowRight size={14} />
                        </Button>
                      </div>
                    </button>
                  ))}

                  {groupedCases[column.id].length === 0 && (
                    <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center">
                      <p className="text-sm font-medium text-foreground">Geen casussen</p>
                      <p className="mt-1 text-xs text-muted-foreground">Deze kolom vult zich vanuit de vorige workflowstap.</p>
                    </div>
                  )}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
