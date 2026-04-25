import { X, GitMerge, UserCheck, AlertOctagon } from "lucide-react";
import { Button } from "../ui/button";

interface BulkActionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onStartMatching: () => void;
  onAssignAssessor: () => void;
  onEscalate: () => void;
}

export function BulkActionBar({
  selectedCount,
  onClearSelection,
  onStartMatching,
  onAssignAssessor,
  onEscalate
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div 
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 premium-card p-4 shadow-2xl"
      style={{
        minWidth: "500px"
      }}
    >
      <div className="flex items-center justify-between gap-6">
        {/* Selection Info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
            <span className="text-sm font-bold text-primary">{selectedCount}</span>
          </div>
          <div>
            <p className="font-semibold text-foreground">
              {selectedCount} {selectedCount === 1 ? "casus" : "casussen"} geselecteerd
            </p>
            <p className="text-xs text-muted-foreground">
              Kies een bulkactie om toe te passen
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onStartMatching}
            className="gap-2"
          >
            <GitMerge size={16} />
            Start matching
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onAssignAssessor}
            className="gap-2"
          >
            <UserCheck size={16} />
            Wijs aanbiederbeoordelaar toe
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onEscalate}
            className="gap-2 border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/10"
          >
            <AlertOctagon size={16} />
            Escaleren
          </Button>
          
          <div className="w-px h-8 bg-border mx-1" />
          
          <Button
            size="sm"
            variant="ghost"
            onClick={onClearSelection}
            className="gap-2"
          >
            <X size={16} />
            Annuleren
          </Button>
        </div>
      </div>
    </div>
  );
}
