import { ArrowRight } from "lucide-react";
import { Button } from "../ui/button";
import type { WorkflowCaseView } from "../../lib/workflowUi";

interface CasusListProps {
  cases: WorkflowCaseView[];
  onCaseClick: (caseId: string) => void;
  canCreateCase?: boolean;
  onCreateCase?: () => void;
}

function isUrgentWithoutMatch(item: WorkflowCaseView): boolean {
  return item.urgency === "critical" && item.isBlocked;
}

function isAgingCase(item: WorkflowCaseView): boolean {
  return item.daysInCurrentPhase >= 10;
}

function rowPriorityClasses(item: WorkflowCaseView): string {
  if (isUrgentWithoutMatch(item)) {
    return "border-red-500/40 bg-red-500/5";
  }
  if (isAgingCase(item)) {
    return "border-amber-500/35 bg-amber-500/5";
  }
  return "border-border bg-card";
}

function buildTags(item: WorkflowCaseView): string[] {
  const tags = [...item.tags];
  if (item.urgency === "critical") {
    tags.unshift("Urgent");
  }
  if (item.isBlocked) {
    tags.unshift("Geen match");
  }
  if (isAgingCase(item)) {
    tags.push("Wachttijd overschreden");
  }
  return Array.from(new Set(tags)).slice(0, 4);
}

export function CasusList({ cases, onCaseClick, canCreateCase = false, onCreateCase }: CasusListProps) {
  if (cases.length === 0) {
    return (
      <div className="rounded-2xl border bg-card p-12 text-center space-y-3">
        <p className="text-lg font-semibold text-foreground">Nog geen casussen in deze fase</p>
        <p className="text-sm text-muted-foreground">
          Pas filters aan of start direct met een nieuwe casus.
        </p>
        {canCreateCase && (
          <div>
            <Button onClick={onCreateCase}>Nieuwe casus</Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {cases.map((item) => {
        const tags = buildTags(item);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onCaseClick(item.id)}
            className={`w-full rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-sm ${rowPriorityClasses(item)}`}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Casus ID</p>
                  <p className="text-sm font-semibold text-foreground">{item.id}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cliënt</p>
                  <p className="text-sm font-medium text-foreground">{item.clientLabel} · {item.clientAge} jaar</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Zorgtype</p>
                  <p className="text-sm font-medium text-foreground">{item.careType}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="text-sm font-medium text-foreground">{item.phaseLabel}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Regio</p>
                  <p className="text-sm font-medium text-foreground">{item.region}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Wachttijd</p>
                  <p className="text-sm font-medium text-foreground">{item.daysInCurrentPhase} dagen</p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 lg:justify-end lg:min-w-[280px]">
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      key={`${item.id}-${tag}`}
                      className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-2 text-primary hover:bg-primary/10 hover:text-primary"
                  onClick={(event) => {
                    event.stopPropagation();
                    onCaseClick(item.id);
                  }}
                >
                  Open
                  <ArrowRight size={14} />
                </Button>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
