import { useState } from "react";
import { 
  Search, 
  SlidersHorizontal, 
  AlertTriangle,
  AlertCircle,
  Info,
  XCircle,
  ChevronRight,
  Clock,
  Users,
  TrendingDown
} from "lucide-react";
import { Button } from "../ui/button";

type SignalSeverity = "critical" | "warning" | "info";
type SignalCategory = "capacity" | "delay" | "quality" | "system";

interface Signal {
  id: string;
  severity: SignalSeverity;
  category: SignalCategory;
  title: string;
  description: string;
  affectedCases: number;
  region?: string;
  detectedAt: string;
  linkedCaseId?: string;
}

const mockSignals: Signal[] = [
  {
    id: "S-001",
    severity: "critical",
    category: "capacity",
    title: "Capaciteitstekort in regio Utrecht",
    description: "3 aanbieders voor intensive begeleiding hebben afgemeld voor Q2. 7 casussen wachten op match.",
    affectedCases: 7,
    region: "Utrecht",
    detectedAt: "15 apr 2026, 09:23"
  },
  {
    id: "S-002",
    severity: "critical",
    category: "delay",
    title: "5 casussen wachten langer dan norm (14 dagen)",
    description: "Wachttijd overschrijdt de 14-dagen norm. Urgente actie vereist om escalatie te voorkomen.",
    affectedCases: 5,
    detectedAt: "16 apr 2026, 11:15"
  },
  {
    id: "S-003",
    severity: "warning",
    category: "quality",
    title: "Hoge afwijzingsratio bij aanbieder Horizon Jeugdzorg",
    description: "4 van de laatste 6 matches zijn afgewezen. Mogelijk onrealistische verwachtingen of capaciteitsprobleem.",
    affectedCases: 4,
    region: "Amsterdam",
    detectedAt: "16 apr 2026, 08:42",
    linkedCaseId: "C-001"
  },
  {
    id: "S-004",
    severity: "warning",
    category: "delay",
    title: "Beoordelingen lopen vertraging op",
    description: "3 beoordelingen zijn meer dan 5 dagen over deadline. Neem contact op met beoordelaars.",
    affectedCases: 3,
    detectedAt: "15 apr 2026, 14:30"
  },
  {
    id: "S-005",
    severity: "info",
    category: "capacity",
    title: "Nieuwe aanbieder beschikbaar in Den Haag",
    description: "Zorggroep De Haven heeft 8 nieuwe plekken vrijgemaakt voor residentiële zorg.",
    affectedCases: 8,
    region: "Den Haag",
    detectedAt: "17 apr 2026, 07:00"
  },
  {
    id: "S-006",
    severity: "info",
    category: "system",
    title: "Matching algoritme verbeterd",
    description: "Update v2.3: Betere weging van reistijd en specialisatie. Verwachte verbetering: 12% snellere matching.",
    affectedCases: 0,
    detectedAt: "14 apr 2026, 22:15"
  }
];

export function SignalenPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState<SignalSeverity | "all">("all");
  const [selectedCategory, setSelectedCategory] = useState<SignalCategory | "all">("all");

  const filteredSignals = mockSignals.filter(signal => {
    if (selectedSeverity !== "all" && signal.severity !== selectedSeverity) return false;
    if (selectedCategory !== "all" && signal.category !== selectedCategory) return false;
    if (searchQuery && !signal.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const criticalCount = mockSignals.filter(s => s.severity === "critical").length;
  const warningCount = mockSignals.filter(s => s.severity === "warning").length;

  const getSeverityIcon = (severity: SignalSeverity) => {
    switch (severity) {
      case "critical":
        return <XCircle size={20} className="text-red-400" />;
      case "warning":
        return <AlertTriangle size={20} className="text-amber-400" />;
      case "info":
        return <Info size={20} className="text-blue-400" />;
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

  const getCategoryIcon = (category: SignalCategory) => {
    switch (category) {
      case "capacity":
        return <Users size={16} />;
      case "delay":
        return <Clock size={16} />;
      case "quality":
        return <TrendingDown size={16} />;
      case "system":
        return <AlertCircle size={16} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold text-foreground mb-2">
          Signalen
        </h1>
        <p className="text-muted-foreground">
          Automatische detectie van problemen en afwijkingen · {criticalCount} kritiek · {warningCount} waarschuwing
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <button
          onClick={() => setSelectedSeverity(selectedSeverity === "critical" ? "all" : "critical")}
          className={`premium-card p-4 text-left transition-all hover:scale-[1.02] ${
            selectedSeverity === "critical" ? "border-2 border-red-500 shadow-lg shadow-red-500/20" : ""
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-lg bg-red-500/10">
              <XCircle size={18} className="text-red-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mb-1">{criticalCount}</p>
          <p className="text-sm text-muted-foreground">Kritieke signalen</p>
        </button>

        <button
          onClick={() => setSelectedSeverity(selectedSeverity === "warning" ? "all" : "warning")}
          className={`premium-card p-4 text-left transition-all hover:scale-[1.02] ${
            selectedSeverity === "warning" ? "border-2 border-amber-500 shadow-lg shadow-amber-500/20" : ""
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <AlertTriangle size={18} className="text-amber-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mb-1">{warningCount}</p>
          <p className="text-sm text-muted-foreground">Waarschuwingen</p>
        </button>

        <button
          onClick={() => setSelectedSeverity(selectedSeverity === "info" ? "all" : "info")}
          className={`premium-card p-4 text-left transition-all hover:scale-[1.02] ${
            selectedSeverity === "info" ? "border-2 border-blue-500 shadow-lg shadow-blue-500/20" : ""
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Info size={18} className="text-blue-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mb-1">
            {mockSignals.filter(s => s.severity === "info").length}
          </p>
          <p className="text-sm text-muted-foreground">Informatie</p>
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Zoek signalen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-11 pr-4 rounded-xl border-2 border-muted-foreground/20 
                     bg-background text-foreground placeholder:text-muted-foreground
                     focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value as SignalCategory | "all")}
          className="px-4 py-2 rounded-lg bg-card border border-border text-foreground text-sm"
        >
          <option value="all">Alle categorieën</option>
          <option value="capacity">Capaciteit</option>
          <option value="delay">Vertraging</option>
          <option value="quality">Kwaliteit</option>
          <option value="system">Systeem</option>
        </select>

        <Button variant="outline" className="border-2 border-muted-foreground/20">
          <SlidersHorizontal size={18} />
          Meer filters
        </Button>
      </div>

      {/* Signals List */}
      <div className="space-y-3">
        {filteredSignals.map((signal) => (
          <div
            key={signal.id}
            className={`premium-card p-5 border-l-4 ${getSeverityColor(signal.severity)} hover:bg-muted/20 transition-all cursor-pointer group`}
          >
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className="flex-shrink-0 mt-0.5">
                {getSeverityIcon(signal.severity)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {signal.title}
                      </h3>
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-muted/50 text-muted-foreground">
                        {getCategoryIcon(signal.category)}
                        <span className="text-xs capitalize">{signal.category}</span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {signal.description}
                    </p>
                  </div>
                </div>

                {/* Meta Info */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3">
                  <span>{signal.detectedAt}</span>
                  {signal.affectedCases > 0 && (
                    <span className="flex items-center gap-1">
                      <Users size={12} />
                      {signal.affectedCases} {signal.affectedCases === 1 ? "casus" : "casussen"}
                    </span>
                  )}
                  {signal.region && (
                    <span>{signal.region}</span>
                  )}
                  {signal.linkedCaseId && (
                    <button className="text-primary hover:underline">
                      {signal.linkedCaseId}
                    </button>
                  )}
                </div>
              </div>

              {/* Action Arrow */}
              <ChevronRight 
                size={18} 
                className="text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" 
              />
            </div>
          </div>
        ))}

        {filteredSignals.length === 0 && (
          <div className="premium-card p-12 text-center">
            <p className="text-muted-foreground">
              Geen signalen gevonden met de huidige filters
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
