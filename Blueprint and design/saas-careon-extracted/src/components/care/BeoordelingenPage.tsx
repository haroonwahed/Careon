import { useState } from "react";
import { Search, SlidersHorizontal, CheckCircle2 } from "lucide-react";
import { Button } from "../ui/button";
import { AssessmentQueueCard } from "./AssessmentQueueCard";

// Mock data
const mockAssessments = [
  {
    id: "A-001",
    caseId: "C-001",
    caseTitle: "Jeugd 14 – Complex gedrag",
    regio: "Amsterdam",
    wachttijd: 8,
    status: "in_progress" as const,
    missingInfo: [
      { field: "Urgentie niet ingevuld", severity: "error" as const },
      { field: "Risicofactoren ontbreken", severity: "warning" as const }
    ]
  },
  {
    id: "A-002",
    caseId: "C-005",
    caseTitle: "Jeugd 13 – Trauma & angststoornis",
    regio: "Eindhoven",
    wachttijd: 5,
    status: "open" as const,
    missingInfo: [
      { field: "Psychiatrische beoordeling ontbreekt", severity: "error" as const }
    ]
  },
  {
    id: "A-003",
    caseId: "C-007",
    caseTitle: "Jeugd 10 – ADHD",
    regio: "Utrecht",
    wachttijd: 2,
    status: "open" as const,
    missingInfo: []
  }
];

interface BeoordelingenPageProps {
  onCaseClick?: (caseId: string) => void;
}

export function BeoordelingenPage({ onCaseClick }: BeoordelingenPageProps = {}) {
  const [searchQuery, setSearchQuery] = useState("");

  const handleStartAssessment = (caseId: string) => {
    // This should navigate to the Casus Control Center with assessment phase active
    if (onCaseClick) {
      onCaseClick(caseId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold text-foreground mb-2">
          Beoordelingen
        </h1>
        <p className="text-muted-foreground">
          Beoordeel casussen en bepaal zorgbehoefte · {mockAssessments.filter(a => a.status !== "completed").length} open
        </p>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Zoek beoordelingen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-11 pr-4 rounded-xl border-2 border-muted-foreground/20 
                     bg-background text-foreground placeholder:text-muted-foreground
                     focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>
        <Button
          variant="outline"
          className="border-2 border-muted-foreground/20"
        >
          <SlidersHorizontal size={18} />
          Filters
        </Button>
      </div>

      {/* Assessment Queue */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            Open beoordelingen
          </h2>
          <span className="text-sm text-muted-foreground">
            {mockAssessments.filter(a => a.status !== "completed").length} te doen
          </span>
        </div>

        <div className="space-y-4">
          {mockAssessments
            .filter(a => a.status !== "completed")
            .map((assessment) => (
              <AssessmentQueueCard
                key={assessment.id}
                {...assessment}
                onStart={() => handleStartAssessment(assessment.caseId)}
              />
            ))}
        </div>
      </div>

      {/* Empty State */}
      {mockAssessments.filter(a => a.status !== "completed").length === 0 && (
        <div className="premium-card p-12 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <div 
              className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(34, 197, 94, 0.05) 100%)",
                border: "2px solid rgba(34, 197, 94, 0.3)"
              }}
            >
              <CheckCircle2 size={40} className="text-green-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-foreground">
                Geen open beoordelingen 🎯
              </h3>
              <p className="text-muted-foreground">
                Alle beoordelingen zijn afgerond. Goed bezig!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}