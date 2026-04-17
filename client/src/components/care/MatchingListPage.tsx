/**
 * MatchingListPage - Overview of cases ready for matching
 */

import { useState } from "react";
import { Search, SlidersHorizontal, MapPin } from "lucide-react";
import { Button } from "../ui/button";
import { SimpleCaseCard } from "./SimpleCaseCard";
import { mockCases } from "../../lib/casesData";

interface MatchingListPageProps {
  onCaseClick: (caseId: string) => void;
}

export function MatchingListPage({ onCaseClick }: MatchingListPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Filter cases that are ready for matching
  const matchingCases = mockCases.filter(c => 
    c.status === "matching" || c.status === "beoordeling"
  );

  const filteredCases = matchingCases.filter(c =>
    searchQuery === "" ||
    c.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Matching
        </h1>
        <p className="text-sm text-muted-foreground">
          {matchingCases.length} casus(sen) klaar voor matching
        </p>
      </div>

      {/* STATS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="premium-card p-6">
          <p className="text-sm text-muted-foreground mb-2">Wachtend op matching</p>
          <p className="text-3xl font-bold text-foreground">{matchingCases.length}</p>
        </div>
        <div className="premium-card p-6">
          <p className="text-sm text-muted-foreground mb-2">Urgent</p>
          <p className="text-3xl font-bold text-red-500">
            {matchingCases.filter(c => c.urgency === "urgent").length}
          </p>
        </div>
        <div className="premium-card p-6">
          <p className="text-sm text-muted-foreground mb-2">Gem. wachttijd</p>
          <p className="text-3xl font-bold text-amber-500">
            {Math.round(matchingCases.reduce((acc, c) => acc + c.waitingDays, 0) / matchingCases.length)} dagen
          </p>
        </div>
        <div className="premium-card p-6">
          <p className="text-sm text-muted-foreground mb-2">Beschikbare aanbieders</p>
          <p className="text-3xl font-bold text-green-500">47</p>
        </div>
      </div>

      {/* SEARCH & FILTERS */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <input
            type="text"
            placeholder="Zoek op naam, casus ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <Button
          variant={showFilters ? "default" : "outline"}
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal size={18} className="mr-2" />
          Filters
        </Button>
      </div>

      {/* FILTERS (if shown) */}
      {showFilters && (
        <div className="premium-card p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Urgentie</label>
              <select className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                <option>Alle</option>
                <option>Urgent</option>
                <option>Hoog</option>
                <option>Medium</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Regio</label>
              <select className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                <option>Alle regio's</option>
                <option>Amsterdam</option>
                <option>Utrecht</option>
                <option>Rotterdam</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Wachttijd</label>
              <select className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                <option>Alle</option>
                <option>&lt; 7 dagen</option>
                <option>7-14 dagen</option>
                <option>&gt; 14 dagen</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Zorgvorm</label>
              <select className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                <option>Alle vormen</option>
                <option>Residentieel</option>
                <option>Ambulant</option>
                <option>Dagbehandeling</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* CASES LIST */}
      <div className="space-y-3">
        {filteredCases.length === 0 ? (
          <div className="premium-card p-12 text-center">
            <MapPin className="mx-auto mb-4 text-muted-foreground" size={48} />
            <p className="text-lg font-semibold text-foreground mb-2">Geen casussen gevonden</p>
            <p className="text-sm text-muted-foreground">
              {searchQuery ? "Probeer een andere zoekopdracht" : "Alle casussen zijn gematched"}
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
      <div className="premium-card p-6 bg-purple-500/5 border-purple-500/20">
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <MapPin className="text-purple-500" size={24} />
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1">Klik op een casus om te matchen</p>
            <p className="text-sm text-muted-foreground">
              Start de geografische matching wizard om de beste zorgaanbieder te vinden op basis van locatie, 
              expertise, capaciteit en wachttijd.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}