/**
 * IntakeListPage - Provider view of intake requests
 */

import { useState } from "react";
import { Search, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "../ui/button";
import { UrgencyBadge } from "./UrgencyBadge";
import { useCases } from "../../hooks/useCases";
import { Loader2 } from "lucide-react";

interface IntakeListPageProps {
  onCaseClick: (caseId: string) => void;
}

export function IntakeListPage({ onCaseClick }: IntakeListPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "new" | "accepted" | "declined">("all");
  const [declinedRequestIds, setDeclinedRequestIds] = useState<string[]>([]);

  const { cases, loading, error } = useCases({ q: searchQuery });
  const mockCases = cases;

  // Mock intake requests for this provider
  const intakeCases = mockCases.filter(c => c.status === "intake" || c.status === "placement");
  const newRequestCases = mockCases
    .filter(c => (c.status === "assessment" || c.status === "matching") && !declinedRequestIds.includes(c.id))
    .slice(0, 3);
  
  const newRequests = newRequestCases.length;
  const acceptedRequests = intakeCases.length;
  const declinedRequests = declinedRequestIds.length;

  const filteredCases = intakeCases.filter(c => {
    const matchesSearch =
      searchQuery === "" ||
      c.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.id.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === "new") return false;
    if (statusFilter === "declined") return false;

    return true;
  });

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Intake Verzoeken
        </h1>
        <p className="text-sm text-muted-foreground">
          {newRequests} nieuwe verzoeken vereisen uw aandacht
        </p>
      </div>

      {/* STATS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <button
          onClick={() => setStatusFilter("new")}
          className={`premium-card p-6 text-left transition-all ${
            statusFilter === "new" ? "ring-2 ring-red-500" : ""
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Nieuwe verzoeken</p>
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          </div>
          <p className="text-3xl font-bold text-red-500">{newRequests}</p>
        </button>

        <button
          onClick={() => setStatusFilter("accepted")}
          className={`premium-card p-6 text-left transition-all ${
            statusFilter === "accepted" ? "ring-2 ring-green-500" : ""
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Geaccepteerd</p>
            <CheckCircle2 className="text-green-500" size={20} />
          </div>
          <p className="text-3xl font-bold text-green-500">{acceptedRequests}</p>
        </button>

        <button
          onClick={() => setStatusFilter("declined")}
          className={`premium-card p-6 text-left transition-all ${
            statusFilter === "declined" ? "ring-2 ring-gray-500" : ""
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Afgewezen</p>
            <XCircle className="text-muted-foreground" size={20} />
          </div>
          <p className="text-3xl font-bold text-muted-foreground">{declinedRequests}</p>
        </button>

        <div className="premium-card p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Capaciteit beschikbaar</p>
            <Clock className="text-blue-500" size={20} />
          </div>
          <p className="text-3xl font-bold text-blue-500">2/30</p>
        </div>
      </div>

      {/* NEW REQUESTS (Priority) */}
      {(statusFilter === "all" || statusFilter === "new") && newRequests > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">Nieuwe verzoeken</h2>
            <span className="px-3 py-1 rounded-full bg-red-500/10 text-red-500 text-sm font-semibold">
              {newRequests} nieuw
            </span>
          </div>

          <div className="space-y-3">
            {newRequestCases.map((caseItem, index) => (
              <div
                key={caseItem.id}
                className="premium-card p-6 hover:bg-card/80 transition-all cursor-pointer border-l-4 border-l-red-500"
                onClick={() => onCaseClick(caseItem.id)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-foreground">{caseItem.id}</h3>
                      <UrgencyBadge urgency={caseItem.urgency} />
                      <span className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-500 text-xs font-semibold">
                        NIEUW
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Gemeente {caseItem.region} · {caseItem.caseType} · {caseItem.clientAge} jaar
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ontvangen: {caseItem.lastActivity}
                  </p>
                </div>

                <div className="mb-4">
                  <p className="text-sm text-foreground mb-2">
                    <span className="font-semibold">Match score:</span> <span className="text-green-500 font-bold">{92 - index * 7}%</span>
                  </p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 size={14} className="text-green-500" />
                    <span>Specialisme match</span>
                    <CheckCircle2 size={14} className="text-green-500" />
                    <span>Leeftijd match</span>
                    <CheckCircle2 size={14} className="text-green-500" />
                    <span>Locatie match</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCaseClick(caseItem.id);
                    }}
                  >
                    <CheckCircle2 size={18} className="mr-2" />
                    Accepteer
                  </Button>
                  <Button
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCaseClick(caseItem.id);
                    }}
                  >
                    Bekijk details
                  </Button>
                  <Button
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeclinedRequestIds((previous) => [...previous, caseItem.id]);
                    }}
                  >
                    <XCircle size={18} className="mr-2" />
                    Afwijzen
                  </Button>
                </div>
              </div>
            ))}

            {newRequestCases.length === 0 && (
              <div className="premium-card p-6 text-center text-sm text-muted-foreground">
                Geen nieuwe intakeverzoeken.
              </div>
            )}
          </div>
        </div>
      )}

      {/* SEARCH */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">Geaccepteerde casussen</h2>
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
      </div>

      {loading && <div className="flex items-center justify-center py-12 text-muted-foreground gap-2"><Loader2 size={18} className="animate-spin" /><span>Laden…</span></div>}
      {error && <div className="p-4 text-destructive">Fout bij laden: {error}</div>}
      {/* ACCEPTED CASES LIST */}
      {(statusFilter === "all" || statusFilter === "accepted") && (
      <div className="space-y-3">
        {filteredCases.map((caseData) => (
          <div
            key={caseData.id}
            className="premium-card p-6 hover:bg-card/80 transition-all cursor-pointer"
            onClick={() => onCaseClick(caseData.id)}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-bold text-foreground">{caseData.id}</h3>
                  <UrgencyBadge urgency={caseData.urgency} />
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    caseData.status === "intake" 
                      ? "bg-blue-500/10 text-blue-500" 
                      : "bg-purple-500/10 text-purple-500"
                  }`}>
                    {caseData.status === "intake" ? "INTAKE GEPLAND" : "IN VOORBEREIDING"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {caseData.region} · {caseData.clientAge} jaar · Geaccepteerd op {new Date().toLocaleDateString('nl-NL')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Button variant="outline" size="sm">
                Bekijk details
              </Button>
              <Button variant="outline" size="sm">
                Documenten
              </Button>
            </div>
          </div>
        ))}
      </div>
      )}

      {statusFilter === "declined" && (
        <div className="premium-card p-6 text-sm text-muted-foreground">
          {declinedRequestIds.length > 0
            ? `${declinedRequestIds.length} verzoek(en) afgewezen in deze sessie.`
            : "Nog geen afgewezen verzoeken in deze sessie."}
        </div>
      )}

      {/* INFO BOX */}
      <div className="premium-card p-6 bg-blue-500/5 border-blue-500/20">
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <CheckCircle2 className="text-blue-500" size={24} />
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1">Intake verzoeken</p>
            <p className="text-sm text-muted-foreground">
              Nieuwe intake verzoeken van gemeentes worden hier getoond. Bekijk de match score en casus details
              voordat u accepteert of afwijst.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
