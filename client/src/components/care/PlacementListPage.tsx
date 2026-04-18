/**
 * PlacementListPage - Overview of placements
 */

import { useState } from "react";
import { Search, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Button } from "../ui/button";
import { SimpleCaseCard } from "./SimpleCaseCard";
import { mockCases } from "../../lib/casesData";

interface PlacementListPageProps {
  onCaseClick: (caseId: string) => void;
}

export function PlacementListPage({ onCaseClick }: PlacementListPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "confirmed" | "completed">("all");

  // Filter cases that are in placement phase
  const placementCases = mockCases.filter(c => 
    c.status === "placement" || c.status === "active" || c.status === "completed"
  );

  const filteredCases = placementCases.filter(c => {
    const matchesSearch = searchQuery === "" ||
      c.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" ||
      (statusFilter === "pending" && c.status === "placement") ||
      (statusFilter === "confirmed" && c.status === "active") ||
      (statusFilter === "completed" && c.status === "completed");
    
    return matchesSearch && matchesStatus;
  });

  const pendingCount = placementCases.filter(c => c.status === "placement").length;
  const confirmedCount = placementCases.filter(c => c.status === "active").length;
  const completedCount = placementCases.filter(c => c.status === "completed").length;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Plaatsingen
        </h1>
        <p className="text-sm text-muted-foreground">
          {placementCases.length} plaatsing(en) in behandeling
        </p>
      </div>

      {/* STATS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <button
          onClick={() => setStatusFilter("pending")}
          className={`premium-card p-6 text-left transition-all ${
            statusFilter === "pending" ? "ring-2 ring-amber-500" : ""
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Te bevestigen</p>
            <Clock className="text-amber-500" size={20} />
          </div>
          <p className="text-3xl font-bold text-amber-500">{pendingCount}</p>
        </button>

        <button
          onClick={() => setStatusFilter("confirmed")}
          className={`premium-card p-6 text-left transition-all ${
            statusFilter === "confirmed" ? "ring-2 ring-blue-500" : ""
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Bevestigd (intake)</p>
            <AlertCircle className="text-blue-500" size={20} />
          </div>
          <p className="text-3xl font-bold text-blue-500">{confirmedCount}</p>
        </button>

        <button
          onClick={() => setStatusFilter("completed")}
          className={`premium-card p-6 text-left transition-all ${
            statusFilter === "completed" ? "ring-2 ring-green-500" : ""
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Afgerond</p>
            <CheckCircle2 className="text-green-500" size={20} />
          </div>
          <p className="text-3xl font-bold text-green-500">{completedCount}</p>
        </button>

        <button
          onClick={() => setStatusFilter("all")}
          className={`premium-card p-6 text-left transition-all ${
            statusFilter === "all" ? "ring-2 ring-purple-500" : ""
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Totaal</p>
          </div>
          <p className="text-3xl font-bold text-foreground">{placementCases.length}</p>
        </button>
      </div>

      {/* SEARCH */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
        <input
          type="text"
          placeholder="Zoek op naam, casus ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* CASES LIST */}
      <div className="space-y-3">
        {filteredCases.length === 0 ? (
          <div className="premium-card p-12 text-center">
            <CheckCircle2 className="mx-auto mb-4 text-muted-foreground" size={48} />
            <p className="text-lg font-semibold text-foreground mb-2">Geen plaatsingen gevonden</p>
            <p className="text-sm text-muted-foreground">
              {searchQuery ? "Probeer een andere zoekopdracht" : 
               statusFilter !== "all" ? "Geen plaatsingen met deze status" :
               "Er zijn momenteel geen plaatsingen"}
            </p>
          </div>
        ) : (
          filteredCases.map((caseData) => (
            <SimpleCaseCard
              key={caseData.id}
              caseData={caseData}
              onClick={() => onCaseClick(caseData.id)}
            />
          ))
        )}
      </div>

      {/* INFO BOX */}
      <div className="premium-card p-6 bg-green-500/5 border-green-500/20">
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-lg bg-green-500/10">
            <CheckCircle2 className="text-green-500" size={24} />
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1">Plaatsing workflow</p>
            <p className="text-sm text-muted-foreground">
              Na matching wordt de plaatsing bevestigd → intake gepland → overdracht voorbereid → plaatsing afgerond.
              Klik op een casus om de voortgang te bekijken.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}