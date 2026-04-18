import { useState } from "react";
import { Search, SlidersHorizontal, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { AssessmentQueueCard } from "./AssessmentQueueCard";
import { useAssessments } from "../../hooks/useAssessments";

interface BeoordelingenPageProps {
  onCaseClick?: (caseId: string) => void;
}

export function BeoordelingenPage({ onCaseClick }: BeoordelingenPageProps = {}) {
  const [searchQuery, setSearchQuery] = useState("");
  const { assessments, loading, error, refetch } = useAssessments({ q: searchQuery });
  const openAssessments = assessments.filter(a => a.status !== "completed");

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
          Beoordeel casussen en bepaal zorgbehoefte · {loading ? '...' : `${openAssessments.length} open`}
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
            {loading ? '...' : `${openAssessments.length} te doen`}
          </span>
        </div>

        <div className="space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 size={18} className="animate-spin" />
              <span>Beoordelingen laden…</span>
            </div>
          )}
          {error && (
            <div className="premium-card p-6 text-center text-destructive space-y-2">
              <p>Kon beoordelingen niet laden: {error}</p>
              <Button variant="outline" size="sm" onClick={refetch}>Opnieuw proberen</Button>
            </div>
          )}
          {!loading && !error && openAssessments.map((assessment) => (
            <AssessmentQueueCard
              key={assessment.id}
              {...assessment}
              onStart={() => handleStartAssessment(assessment.caseId)}
            />
          ))}
        </div>
      </div>

      {/* Empty State */}
      {!loading && !error && openAssessments.length === 0 && (
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