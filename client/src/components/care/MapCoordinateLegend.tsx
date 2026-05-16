import { tokens } from '../../design/tokens';

interface MapCoordinateLegendProps {
  visibleCount: number;
  totalCount: number;
  estimatedCount: number;
}

export function MapCoordinateLegend({ visibleCount, totalCount, estimatedCount }: MapCoordinateLegendProps) {
  return (
    <div className="pointer-events-none absolute left-4 space-y-2" style={{ top: tokens.layout.edgeZero }}>
      <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-md backdrop-blur-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Kaartweergave</p>
        <p className="text-[11px] text-muted-foreground">
          {visibleCount} van {totalCount} aanbieders zichtbaar
        </p>
      </div>
      {estimatedCount > 0 && (
        <div className="rounded-2xl border border-amber-500/35 bg-card/95 px-4 py-2 shadow-md backdrop-blur-sm">
          <p className="text-[11px] font-medium text-foreground">
            {estimatedCount} geschatte positie{estimatedCount > 1 ? 's' : ''} (plaats/regio)
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Gestippelde ring = geen exacte coördinaten</p>
        </div>
      )}
    </div>
  );
}
