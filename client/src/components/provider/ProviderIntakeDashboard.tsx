// DEMO_ONLY: retained as historical provider-facing mock, not linked from the active route map.
import { useState } from "react";
import { Search, Filter, X, CheckCircle2, Target, Lightbulb } from "lucide-react";
import { ProviderKPIStrip } from "./ProviderKPIStrip";
import { ProviderCaseCard } from "./ProviderCaseCard";
import { Button } from "../ui/button";

type CaseStatus = 
  | "nieuw" 
  | "in-beoordeling" 
  | "geaccepteerd" 
  | "intake-gepland" 
  | "afgewezen"
  | "wacht-op-reactie";

type UrgencyLevel = "high" | "medium" | "low";

interface ProviderCase {
  id: string;
  clientName: string;
  clientAge: number;
  region: string;
  caseType: string;
  urgency: UrgencyLevel;
  status: CaseStatus;
  waitingTime: string;
  problemSummary: string;
  municipality: string;
  placedDate: string;
}

export function ProviderIntakeDashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CaseStatus | "all">("all");
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyLevel | "all">("all");
  const [showFilters, setShowFilters] = useState(false);

  // Mock data
  const allCases: ProviderCase[] = [
    {
      id: "C-001",
      clientName: "Emma de Jong",
      clientAge: 14,
      region: "Amsterdam",
      caseType: "Intensieve begeleiding",
      urgency: "high",
      status: "nieuw",
      waitingTime: "2 uur",
      problemSummary: "Zorgvraag vereist beoordeling door aanbieder. Aanvullende context beschikbaar na gemeentelijke validatie.",
      municipality: "Gemeente Amsterdam",
      placedDate: "17 april, 11:30"
    },
    {
      id: "C-002",
      clientName: "Lucas van der Berg",
      clientAge: 16,
      region: "Utrecht",
      caseType: "Ambulante begeleiding",
      urgency: "medium",
      status: "nieuw",
      waitingTime: "5 uur",
      problemSummary: "Aanvullende context beschikbaar na gemeentelijke validatie.",
      municipality: "Gemeente Utrecht",
      placedDate: "17 april, 08:15"
    },
    {
      id: "C-003",
      clientName: "Sophie Hendriks",
      clientAge: 12,
      region: "Amsterdam",
      caseType: "Gezinsbegeleiding",
      urgency: "high",
      status: "wacht-op-reactie",
      waitingTime: "1 dag",
      problemSummary: "Zorgvraag vereist beoordeling door aanbieder. Aanvullende context beschikbaar na gemeentelijke validatie.",
      municipality: "Gemeente Amsterdam",
      placedDate: "16 april, 14:20"
    },
    {
      id: "C-004",
      clientName: "Daan Jansen",
      clientAge: 15,
      region: "Rotterdam",
      caseType: "Dagbesteding",
      urgency: "low",
      status: "intake-gepland",
      waitingTime: "-",
      problemSummary: "Startmoment wordt afgestemd na acceptatie.",
      municipality: "Gemeente Rotterdam",
      placedDate: "15 april, 16:45"
    },
    {
      id: "C-005",
      clientName: "Mila Peters",
      clientAge: 13,
      region: "Den Haag",
      caseType: "Ambulante begeleiding",
      urgency: "medium",
      status: "geaccepteerd",
      waitingTime: "-",
      problemSummary: "Startmoment wordt afgestemd na acceptatie.",
      municipality: "Gemeente Den Haag",
      placedDate: "15 april, 10:20"
    }
  ];

  // Calculate KPIs
  const kpiData = {
    nieuwe: allCases.filter(c => c.status === "nieuw").length,
    wachtOpReactie: allCases.filter(c => c.status === "wacht-op-reactie").length,
    intakeGepland: allCases.filter(c => c.status === "intake-gepland").length,
    afgewezen: allCases.filter(c => c.status === "afgewezen").length
  };

  // Filter cases
  const filteredCases = allCases.filter(c => {
    // Provider-side search is intentionally limited to operational identifiers
    // (casus-ID + regio) to reinforce need-to-know access. Names are never used
    // as a search axis on the provider surface.
    const matchesSearch = searchQuery === "" ||
      c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.region.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    const matchesUrgency = urgencyFilter === "all" || c.urgency === urgencyFilter;

    return matchesSearch && matchesStatus && matchesUrgency;
  });

  // Sort: urgent new cases first
  const sortedCases = [...filteredCases].sort((a, b) => {
    // Priority 1: New cases first
    if (a.status === "nieuw" && b.status !== "nieuw") return -1;
    if (a.status !== "nieuw" && b.status === "nieuw") return 1;
    
    // Priority 2: High urgency first
    const urgencyOrder = { high: 0, medium: 1, low: 2 };
    return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
  });

  const handleAccept = (caseId: string) => {
    console.log("Accept case:", caseId);
    // In real app: API call to accept case
  };

  const handleReject = (caseId: string) => {
    console.log("Reject case:", caseId);
    // In real app: Show rejection reason modal
  };

  const handleViewDetails = (caseId: string) => {
    console.log("View details:", caseId);
    // In real app: Navigate to intake page
  };

  const activeFiltersCount = 
    (statusFilter !== "all" ? 1 : 0) + 
    (urgencyFilter !== "all" ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Toegekende casussen
        </h1>
        <p className="text-muted-foreground">
          Casussen waarvoor jouw organisatie regie heeft gekregen — toegang ontstaat na gemeentelijke validatie en blijft beperkt tot wat nodig is.
        </p>
      </div>

      {/* KPI Strip */}
      <ProviderKPIStrip data={kpiData} />

      {/* Search and Filters */}
      <div className="premium-card p-4">
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search 
              size={20} 
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" 
            />
            <input
              type="text"
              placeholder="Zoek op casus-ID of regio…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-muted/30 border border-muted-foreground/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Filter Toggle */}
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant={showFilters ? "default" : "outline"}
            className="relative"
          >
            <Filter size={16} className="mr-2" />
            Filters
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-xs font-bold rounded-full flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </Button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-muted-foreground/20">
            <div className="grid grid-cols-3 gap-4">
              {/* Status Filter */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-2 block">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as CaseStatus | "all")}
                  className="w-full px-3 py-2 rounded-lg bg-muted/30 border border-muted-foreground/30 text-foreground text-sm"
                >
                  <option value="all">Alle statussen</option>
                  <option value="nieuw">Nieuw</option>
                  <option value="wacht-op-reactie">Wacht op reactie</option>
                  <option value="geaccepteerd">Geaccepteerd</option>
                  <option value="intake-gepland">Intake gepland</option>
                  <option value="afgewezen">Afgewezen</option>
                </select>
              </div>

              {/* Urgency Filter */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-2 block">
                  Urgentie
                </label>
                <select
                  value={urgencyFilter}
                  onChange={(e) => setUrgencyFilter(e.target.value as UrgencyLevel | "all")}
                  className="w-full px-3 py-2 rounded-lg bg-muted/30 border border-muted-foreground/30 text-foreground text-sm"
                >
                  <option value="all">Alle urgentieniveaus</option>
                  <option value="high">Hoge urgentie</option>
                  <option value="medium">Gemiddelde urgentie</option>
                  <option value="low">Lage urgentie</option>
                </select>
              </div>

              {/* Clear Filters */}
              <div className="flex items-end">
                <Button
                  onClick={() => {
                    setStatusFilter("all");
                    setUrgencyFilter("all");
                    setSearchQuery("");
                  }}
                  variant="outline"
                  className="w-full"
                  disabled={activeFiltersCount === 0 && searchQuery === ""}
                >
                  <X size={16} className="mr-2" />
                  Filters wissen
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left: Case Queue */}
        <div className="col-span-9">
          {/* Results Header */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {sortedCases.length} {sortedCases.length === 1 ? "casus" : "casussen"} gevonden
            </p>
            {activeFiltersCount > 0 && (
              <button
                onClick={() => {
                  setStatusFilter("all");
                  setUrgencyFilter("all");
                }}
                className="text-sm text-primary hover:underline"
              >
                Filters wissen
              </button>
            )}
          </div>

          {/* Case List */}
          {sortedCases.length > 0 ? (
            <div className="space-y-4">
              {sortedCases.map((caseData) => (
                <ProviderCaseCard
                  key={caseData.id}
                  case={caseData}
                  onAccept={handleAccept}
                  onReject={handleReject}
                  onViewDetails={handleViewDetails}
                />
              ))}
            </div>
          ) : (
            // Empty State
            <div className="premium-card p-12 text-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Target size={40} className="text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">
                Geen toegekende casussen
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                {searchQuery || activeFiltersCount > 0
                  ? "Probeer je zoekopdracht of filters aan te passen."
                  : "Je krijgt hier alleen casussen te zien waarvoor de gemeente jouw organisatie heeft uitgenodigd. Zodra een nieuwe casus wordt toegekend, verschijnt deze automatisch."
                }
              </p>
              {(searchQuery || activeFiltersCount > 0) && (
                <Button
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                    setUrgencyFilter("all");
                  }}
                  variant="outline"
                >
                  Reset alle filters
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Right: Info Panel */}
        <div className="col-span-3">
          <div className="sticky top-24 space-y-4">
            {/* Capacity Overview */}
            <div className="premium-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Target size={16} className="text-primary" />
                Jouw capaciteit
              </h3>
              
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Bezet</span>
                    <span className="text-sm font-semibold text-foreground">7 / 10</span>
                  </div>
                  <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-green-500 to-amber-500 rounded-full"
                      style={{ width: "70%" }}
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-muted-foreground/20">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Lopende intakes</span>
                    <span className="font-semibold text-foreground">3</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Beschikbare plekken</span>
                    <span className="font-semibold text-green-400">3</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tips */}
            <div className="premium-card p-5 border careon-alert-info">
              <h3 className="text-sm font-semibold text-blue-base mb-3 flex items-center gap-2">
                <Lightbulb size={16} />
                Tips
              </h3>
              <ul className="space-y-2 text-xs text-blue-base">
                <li className="flex items-start gap-2">
                  <span className="text-blue-base mt-0.5">•</span>
                  <span>Reageer binnen 24 uur op nieuwe casussen</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-base mt-0.5">•</span>
                  <span>Urgente cases vereisen snellere reactie</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-base mt-0.5">•</span>
                  <span>Download alle documenten voor intake</span>
                </li>
              </ul>
            </div>

            {/* Quick Stats */}
            <div className="premium-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">
                Deze week
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Geaccepteerd</span>
                  <span className="font-semibold text-green-400">4</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Afgewezen</span>
                  <span className="font-semibold text-muted-foreground">1</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Gem. reactietijd</span>
                  <span className="font-semibold text-foreground">3.2 uur</span>
                </div>
              </div>
            </div>

            {/* Success Indicator */}
            <div className="premium-card p-5 border careon-alert-success">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={20} className="text-green-base flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-green-base mb-1">
                    Sterke prestaties
                  </p>
                  <p className="text-xs text-green-base/80 leading-relaxed">
                    Je reactietijd ligt onder het gemiddelde. 
                    Blijf zo werken!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
