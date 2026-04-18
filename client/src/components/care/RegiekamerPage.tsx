import { useState } from "react";
import { 
  Users, 
  ClipboardList, 
  MapPin, 
  Clock, 
  ShieldAlert, 
  TrendingDown,
  Search,
  Filter,
  Download
} from "lucide-react";
import { CareKPICard } from "./CareKPICard";
import { CaseTableRow } from "./CaseTableRow";
import { SignalCard } from "./SignalCard";
import { PriorityActionCard } from "./PriorityActionCard";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { 
  mockSignals,
  mockPriorityActions,
} from "../../lib/casesData";
import { useCases } from "../../hooks/useCases";

interface RegiekamerPageProps {
  onCaseClick: (caseId: string) => void;
}

export function RegiekamerPage({ onCaseClick }: RegiekamerPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedUrgency, setSelectedUrgency] = useState<string>("all");

  const { cases } = useCases({ q: searchQuery });
  const mockCasusList = cases as unknown as typeof import("../../lib/casesData").mockCasusList;

  // Filter cases based on search and filters
  const filteredCases = mockCasusList
    .filter(c => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          c.id.toLowerCase().includes(query) ||
          c.clientName.toLowerCase().includes(query) ||
          c.careType.toLowerCase().includes(query)
        );
      }
      return true;
    })
    .filter(c => selectedRegion === "all" || c.region === selectedRegion)
    .filter(c => selectedStatus === "all" || c.phase === selectedStatus)
    .filter(c => selectedUrgency === "all" || c.urgency === selectedUrgency)
    .sort((a, b) => {
      const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    });

  // Calculate KPIs
  const casesWithoutMatch = mockCasusList.filter(c => 
    c.phase === "matching" || c.phase === "geblokkeerd"
  ).length;
  
  const openAssessments = mockCasusList.filter(c => 
    c.phase === "beoordeling"
  ).length;
  
  const placementsInProgress = mockCasusList.filter(c => 
    c.phase === "plaatsing"
  ).length;
  
  const avgWaitingTime = Math.round(
    mockCasusList.reduce((sum, c) => sum + c.waitingDays, 0) / mockCasusList.length
  );
  
  const highRiskCases = mockCasusList.filter(c => 
    c.complexity === "high"
  ).length;
  
  const capacityIssues = mockSignals.filter(s => 
    s.type === "capacity"
  ).length;

  const regions = ["all", ...Array.from(new Set(mockCasusList.map(c => c.region)))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">
            Regiekamer
          </h1>
          <p className="text-muted-foreground">
            Casussen die aandacht nodig hebben · {filteredCases.length} actief
          </p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download size={16} />
          Exporteer rapport
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="premium-card p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1">
            <div className="relative">
              <Search 
                size={18} 
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" 
              />
              <Input
                placeholder="Zoek casussen, cliënten, aanbieders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
            >
              <option value="all">Alle regio's</option>
              {regions.filter(r => r !== "all").map(region => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
            >
              <option value="all">Alle statussen</option>
              <option value="intake_initial">Intake</option>
              <option value="beoordeling">Beoordeling</option>
              <option value="matching">Matching</option>
              <option value="plaatsing">Plaatsing</option>
              <option value="geblokkeerd">Geblokkeerd</option>
            </select>
            <select
              value={selectedUrgency}
              onChange={(e) => setSelectedUrgency(e.target.value)}
              className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
            >
              <option value="all">Alle urgentie</option>
              <option value="critical">Kritiek</option>
              <option value="high">Hoog</option>
              <option value="medium">Gemiddeld</option>
              <option value="low">Laag</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <CareKPICard
          title="Casussen zonder match"
          value={casesWithoutMatch}
          icon={Users}
          urgency={casesWithoutMatch > 5 ? "critical" : casesWithoutMatch > 2 ? "warning" : "normal"}
        />
        <CareKPICard
          title="Open beoordelingen"
          value={openAssessments}
          icon={ClipboardList}
          urgency={openAssessments > 4 ? "warning" : "normal"}
        />
        <CareKPICard
          title="Plaatsingen bezig"
          value={placementsInProgress}
          icon={MapPin}
          urgency="normal"
        />
        <CareKPICard
          title="Gem. wachttijd"
          value={`${avgWaitingTime}d`}
          icon={Clock}
          urgency={avgWaitingTime > 10 ? "critical" : avgWaitingTime > 7 ? "warning" : "normal"}
        />
        <CareKPICard
          title="Hoog risico casussen"
          value={highRiskCases}
          icon={ShieldAlert}
          urgency={highRiskCases > 3 ? "critical" : highRiskCases > 1 ? "warning" : "normal"}
        />
        <CareKPICard
          title="Capaciteitstekorten"
          value={capacityIssues}
          icon={TrendingDown}
          urgency={capacityIssues > 2 ? "critical" : capacityIssues > 0 ? "warning" : "positive"}
        />
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Cases Table */}
        <div className="xl:col-span-2 space-y-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">
              Actieve casussen
            </h2>
            <span className="text-sm text-muted-foreground">
              {filteredCases.length} resultaten
            </span>
          </div>
          
          <div className="space-y-3 max-h-[800px] overflow-y-auto scrollbar-thin pr-2">
            {filteredCases.map(caseData => (
              <CaseTableRow
                key={caseData.id}
                case={caseData}
                onClick={() => onCaseClick(caseData.id)}
              />
            ))}
          </div>
        </div>

        {/* Right: Signals & Actions */}
        <div className="space-y-6">
          {/* Top Priority Actions - Preview only */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Volgende acties</h3>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-primary">
                Bekijk alle →
              </Button>
            </div>
            <div className="space-y-3">
              {mockPriorityActions.slice(0, 3).map(action => (
                <PriorityActionCard
                  key={action.id}
                  action={action}
                  onTakeAction={() => onCaseClick(action.caseId)}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {mockPriorityActions.length > 3 && `+${mockPriorityActions.length - 3} meer in Acties pagina`}
            </p>
          </div>

          {/* System Signals - Preview only */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Systeem signalen</h3>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-primary">
                Bekijk alle →
              </Button>
            </div>
            <div className="space-y-3">
              {mockSignals.slice(0, 3).map(signal => (
                <SignalCard key={signal.id} signal={signal} />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {mockSignals.length > 3 && `+${mockSignals.length - 3} meer in Signalen pagina`}
            </p>
          </div>

          {/* Capacity Overview */}
          <div className="premium-card p-4">
            <h3 className="text-sm font-semibold mb-3">Capaciteit overzicht</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Residentiële zorg</span>
                <span className="font-medium text-[#F59E0B]">23% vrij</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-[#F59E0B] w-[77%]" />
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Ambulante zorg</span>
                <span className="font-medium text-[#10B981]">48% vrij</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-[#10B981] w-[52%]" />
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Crisisopvang</span>
                <span className="font-medium text-[#EF4444]">0% vrij</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-[#EF4444] w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}