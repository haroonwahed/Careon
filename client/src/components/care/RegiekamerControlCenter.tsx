/**
 * RegiekamerControlCenter - Operational Control Tower
 * 
 * This is NOT a dashboard. This is a command center that:
 * - Shows what needs attention NOW
 * - Prioritizes urgent cases
 * - Highlights bottlenecks
 * - Guides users toward action
 * 
 * Users do NOT execute workflows here - they decide WHERE to act.
 */

import { useState, useMemo } from "react";
import { 
  Search,
  Filter,
  Download,
  AlertTriangle,
  Clock,
  Users,
  TrendingUp,
  ChevronRight,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  XCircle
} from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { mockCases, Case } from "../../lib/casesData";

// AI Components
import { SystemInsight } from "../ai";

interface RegiekamerControlCenterProps {
  onCaseClick: (caseId: string) => void;
}

export function RegiekamerControlCenter({ onCaseClick }: RegiekamerControlCenterProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedUrgency, setSelectedUrgency] = useState<string>("high"); // Default: show urgent
  const [activeKPIFilter, setActiveKPIFilter] = useState<string | null>(null);

  // Calculate system intelligence
  const systemState = useMemo(() => {
    const urgent = mockCases.filter(c => c.urgency === "high" || c.urgency === "critical");
    const blocked = mockCases.filter(c => c.status === "blocked");
    const delayed = mockCases.filter(c => c.waitingDays > 7);
    const noMatch = mockCases.filter(c => c.status === "matching" && c.waitingDays > 3);
    
    return {
      urgentCount: urgent.length,
      blockedCount: blocked.length,
      delayedCount: delayed.length,
      noMatchCount: noMatch.length,
      urgent,
      blocked,
      delayed
    };
  }, []);

  // KPI Calculations with context
  const kpis = useMemo(() => {
    const yesterday = mockCases.length - 2; // Mock comparison
    
    return {
      casesWithoutMatch: {
        value: mockCases.filter(c => c.status === "matching" || c.status === "blocked").length,
        change: "+2",
        trend: "up" as const,
        status: "warning" as const,
        label: "Casussen zonder match"
      },
      openAssessments: {
        value: mockCases.filter(c => c.status === "assessment").length,
        change: "-1",
        trend: "down" as const,
        status: "normal" as const,
        label: "Open beoordelingen"
      },
      placementsInProgress: {
        value: mockCases.filter(c => c.status === "placement").length,
        change: "+3",
        trend: "up" as const,
        status: "good" as const,
        label: "Plaatsingen bezig"
      },
      avgWaitingTime: {
        value: Math.round(mockCases.reduce((sum, c) => sum + c.waitingDays, 0) / mockCases.length),
        change: "↑ boven norm",
        trend: "up" as const,
        status: "warning" as const,
        label: "Gem. wachttijd (dagen)"
      },
      highRiskCases: {
        value: mockCases.filter(c => c.risk === "high").length,
        change: "+1",
        trend: "up" as const,
        status: "critical" as const,
        label: "Hoog risico casussen"
      },
      capacityIssues: {
        value: 3,
        change: "urgent",
        trend: "up" as const,
        status: "critical" as const,
        label: "Capaciteitstekorten"
      }
    };
  }, []);

  // Filter and sort cases
  const filteredCases = useMemo(() => {
    return mockCases
      .filter(c => {
        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          if (!(
            c.id.toLowerCase().includes(query) ||
            c.clientName.toLowerCase().includes(query) ||
            c.caseType.toLowerCase().includes(query)
          )) return false;
        }
        
        // Region filter
        if (selectedRegion !== "all" && c.region !== selectedRegion) return false;
        
        // Status filter
        if (selectedStatus !== "all" && c.status !== selectedStatus) return false;
        
        // Urgency filter
        if (selectedUrgency !== "all" && c.urgency !== selectedUrgency) return false;
        
        // KPI filter (when user clicks a KPI)
        if (activeKPIFilter) {
          if (activeKPIFilter === "noMatch" && c.status !== "matching" && c.status !== "blocked") return false;
          if (activeKPIFilter === "assessment" && c.status !== "assessment") return false;
          if (activeKPIFilter === "placement" && c.status !== "placement") return false;
          if (activeKPIFilter === "highRisk" && c.risk !== "high") return false;
          if (activeKPIFilter === "delayed" && c.waitingDays <= 7) return false;
        }
        
        return true;
      })
      .sort((a, b) => {
        // CRITICAL: Sort by urgency AND delay, not creation date
        const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
        
        if (urgencyDiff !== 0) return urgencyDiff;
        
        // If same urgency, sort by waiting days (descending)
        return b.waitingDays - a.waitingDays;
      });
  }, [searchQuery, selectedRegion, selectedStatus, selectedUrgency, activeKPIFilter]);

  const regions = ["all", ...Array.from(new Set(mockCases.map(c => c.region)))];

  // Get next action for a case
  const getNextAction = (caseItem: Case): { action: string; type: "urgent" | "normal" | "waiting" } => {
    if (caseItem.status === "intake") {
      return { action: "Start beoordeling", type: "urgent" };
    }
    if (caseItem.status === "assessment") {
      return { action: "Voltooi beoordeling", type: "urgent" };
    }
    if (caseItem.status === "matching") {
      return { action: "Controleer matching", type: "urgent" };
    }
    if (caseItem.status === "placement") {
      return { action: "Bevestig plaatsing", type: "normal" };
    }
    if (caseItem.status === "blocked") {
      return { action: "Los blokkade op", type: "urgent" };
    }
    if (caseItem.status === "completed") {
      return { action: "Archiveren", type: "waiting" };
    }
    return { action: "Wacht op aanbieder reactie", type: "waiting" };
  };

  return (
    <div className="space-y-6 pb-24">
      
      {/* HEADER */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Regiekamer
          </h1>
          <p className="text-sm text-muted-foreground">
            Casussen die aandacht nodig hebben
          </p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download size={16} />
          Exporteer rapport
        </Button>
      </div>

      {/* AI COMMAND STRIP - PRIMARY FEATURE */}
      <div className="premium-card p-5 border-l-4 border-l-primary bg-primary/5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {/* Urgent cases */}
              {systemState.urgentCount > 0 && (
                <>
                  <button
                    onClick={() => {
                      setSelectedUrgency("high");
                      setActiveKPIFilter(null);
                    }}
                    className="font-semibold text-red-400 hover:underline cursor-pointer"
                  >
                    {systemState.urgentCount} casussen vereisen directe actie
                  </button>
                  <span className="text-muted-foreground">•</span>
                </>
              )}
              
              {/* Blocked cases */}
              {systemState.blockedCount > 0 && (
                <>
                  <button
                    onClick={() => {
                      setSelectedStatus("blocked");
                      setActiveKPIFilter(null);
                    }}
                    className="font-semibold text-amber-400 hover:underline cursor-pointer"
                  >
                    {systemState.blockedCount} dossiers blokkeren matching
                  </button>
                  <span className="text-muted-foreground">•</span>
                </>
              )}
              
              {/* Capacity issues */}
              <button
                onClick={() => setActiveKPIFilter("capacity")}
                className="font-semibold text-amber-400 hover:underline cursor-pointer"
              >
                Capaciteitstekort in regio Utrecht
              </button>
            </div>
          </div>

          {systemState.urgentCount > 0 && (
            <Button 
              size="sm"
              onClick={() => {
                setSelectedUrgency("high");
                setActiveKPIFilter(null);
              }}
              className="bg-red-500 hover:bg-red-600 flex-shrink-0"
            >
              Bekijk urgente casussen
              <ChevronRight size={14} className="ml-1" />
            </Button>
          )}
        </div>
      </div>

      {/* KPI BLOCKS - ENHANCED */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard
          label={kpis.casesWithoutMatch.label}
          value={kpis.casesWithoutMatch.value}
          context={kpis.casesWithoutMatch.change}
          status={kpis.casesWithoutMatch.status}
          icon={<Users size={18} />}
          active={activeKPIFilter === "noMatch"}
          onClick={() => setActiveKPIFilter(activeKPIFilter === "noMatch" ? null : "noMatch")}
        />
        
        <KPICard
          label={kpis.openAssessments.label}
          value={kpis.openAssessments.value}
          context={kpis.openAssessments.change}
          status={kpis.openAssessments.status}
          icon={<CheckCircle2 size={18} />}
          active={activeKPIFilter === "assessment"}
          onClick={() => setActiveKPIFilter(activeKPIFilter === "assessment" ? null : "assessment")}
        />
        
        <KPICard
          label={kpis.placementsInProgress.label}
          value={kpis.placementsInProgress.value}
          context={kpis.placementsInProgress.change}
          status={kpis.placementsInProgress.status}
          icon={<TrendingUp size={18} />}
          active={activeKPIFilter === "placement"}
          onClick={() => setActiveKPIFilter(activeKPIFilter === "placement" ? null : "placement")}
        />
        
        <KPICard
          label={kpis.avgWaitingTime.label}
          value={kpis.avgWaitingTime.value}
          context={kpis.avgWaitingTime.change}
          status={kpis.avgWaitingTime.status}
          icon={<Clock size={18} />}
          active={activeKPIFilter === "delayed"}
          onClick={() => setActiveKPIFilter(activeKPIFilter === "delayed" ? null : "delayed")}
        />
        
        <KPICard
          label={kpis.highRiskCases.label}
          value={kpis.highRiskCases.value}
          context={kpis.highRiskCases.change}
          status={kpis.highRiskCases.status}
          icon={<ShieldAlert size={18} />}
          active={activeKPIFilter === "highRisk"}
          onClick={() => setActiveKPIFilter(activeKPIFilter === "highRisk" ? null : "highRisk")}
        />
        
        <KPICard
          label={kpis.capacityIssues.label}
          value={kpis.capacityIssues.value}
          context={kpis.capacityIssues.change}
          status={kpis.capacityIssues.status}
          icon={<AlertTriangle size={18} />}
          active={activeKPIFilter === "capacity"}
          onClick={() => setActiveKPIFilter(activeKPIFilter === "capacity" ? null : "capacity")}
        />
      </div>

      {/* INLINE AI SIGNAL */}
      {systemState.delayedCount > 0 && (
        <SystemInsight
          type="warning"
          message={`${systemState.delayedCount} casussen wachten langer dan 7 dagen`}
        />
      )}

      {systemState.noMatchCount > 0 && (
        <SystemInsight
          type="info"
          message={`${systemState.noMatchCount} casussen zonder beschikbare aanbieder binnen 48 uur`}
        />
      )}

      {/* FILTER + SEARCH BAR */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            placeholder="Zoek op casus ID, naam, of type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filters */}
        <select
          value={selectedRegion}
          onChange={(e) => setSelectedRegion(e.target.value)}
          className="px-4 py-2 rounded-lg bg-card border border-border text-foreground text-sm"
        >
          <option value="all">Alle regio's</option>
          {regions.filter(r => r !== "all").map(region => (
            <option key={region} value={region}>{region}</option>
          ))}
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-4 py-2 rounded-lg bg-card border border-border text-foreground text-sm"
        >
          <option value="all">Alle statussen</option>
          <option value="intake">Intake</option>
          <option value="assessment">Beoordeling</option>
          <option value="matching">Matching</option>
          <option value="placement">Plaatsing</option>
          <option value="blocked">Geblokkeerd</option>
        </select>

        <select
          value={selectedUrgency}
          onChange={(e) => setSelectedUrgency(e.target.value)}
          className="px-4 py-2 rounded-lg bg-card border border-border text-foreground text-sm"
        >
          <option value="all">Alle urgentie</option>
          <option value="critical">Kritiek</option>
          <option value="high">Hoog</option>
          <option value="medium">Gemiddeld</option>
          <option value="low">Laag</option>
        </select>
      </div>

      {/* Active filters indicator */}
      {(selectedUrgency !== "all" || activeKPIFilter) && (
        <div className="flex items-center gap-2 text-sm">
          <Filter size={14} className="text-muted-foreground" />
          <span className="text-muted-foreground">Gefilterd op:</span>
          {selectedUrgency !== "all" && (
            <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-semibold">
              Urgentie: {selectedUrgency}
            </span>
          )}
          {activeKPIFilter && (
            <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-semibold">
              {activeKPIFilter === "noMatch" && "Zonder match"}
              {activeKPIFilter === "assessment" && "Open beoordelingen"}
              {activeKPIFilter === "placement" && "Plaatsingen"}
              {activeKPIFilter === "highRisk" && "Hoog risico"}
              {activeKPIFilter === "delayed" && "Vertraagd"}
            </span>
          )}
          <button
            onClick={() => {
              setSelectedUrgency("all");
              setActiveKPIFilter(null);
            }}
            className="text-xs text-primary hover:underline"
          >
            Wis filters
          </button>
        </div>
      )}

      {/* CASUS LIST - CORE WORKING AREA */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground">
            Actieve casussen
          </h2>
          <span className="text-sm text-muted-foreground">
            {filteredCases.length} {filteredCases.length === 1 ? 'casus' : 'casussen'}
          </span>
        </div>

        <div className="space-y-2">
          {filteredCases.map((caseItem) => {
            const nextAction = getNextAction(caseItem);
            
            return (
              <CaseRow
                key={caseItem.id}
                caseItem={caseItem}
                nextAction={nextAction}
                onClick={() => onCaseClick(caseItem.id)}
              />
            );
          })}

          {filteredCases.length === 0 && (
            <div className="premium-card p-12 text-center">
              <p className="text-muted-foreground">
                Geen casussen gevonden met de huidige filters
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedRegion("all");
                  setSelectedStatus("all");
                  setSelectedUrgency("all");
                  setActiveKPIFilter(null);
                }}
              >
                Reset filters
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Enhanced KPI Card Component
interface KPICardProps {
  label: string;
  value: number;
  context: string;
  status: "good" | "normal" | "warning" | "critical";
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}

function KPICard({ label, value, context, status, icon, active, onClick }: KPICardProps) {
  const statusColors = {
    good: "text-green-400 border-green-500/30",
    normal: "text-blue-400 border-blue-500/30",
    warning: "text-amber-400 border-amber-500/30",
    critical: "text-red-400 border-red-500/30"
  };

  const bgColors = {
    good: "bg-green-500/5",
    normal: "bg-blue-500/5",
    warning: "bg-amber-500/5",
    critical: "bg-red-500/5"
  };

  return (
    <button
      onClick={onClick}
      className={`premium-card p-4 text-left transition-all hover:scale-[1.02] cursor-pointer ${
        active ? "border-2 border-primary shadow-lg shadow-primary/20" : ""
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${bgColors[status]}`}>
          <div className={statusColors[status]}>{icon}</div>
        </div>
        {active && (
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        )}
      </div>

      <div className="space-y-1">
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground line-clamp-2">{label}</p>
        <p className={`text-xs font-semibold ${statusColors[status]}`}>
          {context}
        </p>
      </div>
    </button>
  );
}

// Case Row Component with Next Action
interface CaseRowProps {
  caseItem: Case;
  nextAction: { action: string; type: "urgent" | "normal" | "waiting" };
  onClick: () => void;
}

function CaseRow({ caseItem, nextAction, onClick }: CaseRowProps) {
  const urgencyColors = {
    critical: "border-l-red-500 bg-red-500/5",
    high: "border-l-amber-500 bg-amber-500/5",
    medium: "border-l-blue-500/30",
    low: "border-l-muted"
  };

  const statusLabels = {
    intake: { label: "Intake", color: "bg-blue-500/10 text-blue-400" },
    assessment: { label: "Beoordeling", color: "bg-purple-500/10 text-purple-400" },
    matching: { label: "Matching", color: "bg-amber-500/10 text-amber-400" },
    placement: { label: "Plaatsing", color: "bg-green-500/10 text-green-400" },
    blocked: { label: "Geblokkeerd", color: "bg-red-500/10 text-red-400" },
    completed: { label: "Afgerond", color: "bg-muted/30 text-muted-foreground" }
  };

  const riskIcons = {
    high: <AlertCircle size={16} className="text-red-400" />,
    medium: <AlertCircle size={16} className="text-amber-400" />,
    low: <CheckCircle2 size={16} className="text-green-400" />
  };

  return (
    <button
      onClick={onClick}
      className={`w-full premium-card p-4 border-l-4 ${urgencyColors[caseItem.urgency]} hover:bg-muted/20 transition-all text-left group`}
    >
      <div className="grid grid-cols-12 gap-4 items-center">
        
        {/* LEFT: ID & Type */}
        <div className="col-span-3">
          <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
            {caseItem.id}
          </p>
          <p className="text-xs text-muted-foreground">{caseItem.caseType}</p>
        </div>

        {/* CENTER: Status, Waiting Time, Risk */}
        <div className="col-span-5 flex items-center gap-4">
          <span className={`px-2 py-1 rounded text-xs font-semibold ${statusLabels[caseItem.status].color}`}>
            {statusLabels[caseItem.status].label}
          </span>
          
          <div className="flex items-center gap-1.5">
            <Clock size={14} className={caseItem.waitingDays > 7 ? "text-red-400" : "text-muted-foreground"} />
            <span className={`text-xs font-semibold ${caseItem.waitingDays > 7 ? "text-red-400" : "text-muted-foreground"}`}>
              {caseItem.waitingDays}d
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {riskIcons[caseItem.risk]}
          </div>
        </div>

        {/* RIGHT: NEXT ACTION (CRITICAL) */}
        <div className="col-span-4 flex items-center justify-end gap-3">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Volgende actie:</p>
            <p className={`text-sm font-semibold ${
              nextAction.type === "urgent" ? "text-red-400" :
              nextAction.type === "normal" ? "text-foreground" :
              "text-muted-foreground"
            }`}>
              {nextAction.action}
            </p>
          </div>
          <ChevronRight size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </div>
    </button>
  );
}
