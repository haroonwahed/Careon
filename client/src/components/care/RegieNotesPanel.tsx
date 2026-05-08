import { MessageSquareText } from "lucide-react";
import { Button } from "../ui/button";

interface RegieNotesPanelProps {
  testId?: string;
  onAfterAction?: () => void;
}

export function RegieNotesPanel({ testId, onAfterAction }: RegieNotesPanelProps) {
  return (
    <section data-testid={testId} className="rounded-xl border border-border/50 bg-card/40 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/40">
          <MessageSquareText size={18} className="text-primary" aria-hidden />
        </div>
        <div className="min-w-0 space-y-3">
          <p className="text-sm font-semibold leading-tight text-foreground">Notities en opvolging</p>
          <p className="text-sm text-muted-foreground">
            Vastleggen van werknotities en opvolging volgt in een volgende stap van de regie-rail.
          </p>
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-xl px-3 text-[13px] font-semibold"
            onClick={onAfterAction}
          >
            Notitie toevoegen
          </Button>
        </div>
      </div>
    </section>
  );
}

