import { ExternalLink } from 'lucide-react';
import { buildGoogleMapsDirectionsUrl } from '../../lib/mapDirections';
import type { SpaProvider } from '../../hooks/useProviders';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';

interface ProviderSelectedMarkerActionsProps {
  provider: SpaProvider;
  lat: number;
  lng: number;
  onNavigateToMatching?: () => void;
  className?: string;
}

export function ProviderSelectedMarkerActions({
  provider,
  lat,
  lng,
  onNavigateToMatching,
  className,
}: ProviderSelectedMarkerActionsProps) {
  const directionsUrl = buildGoogleMapsDirectionsUrl({
    latitude: lat,
    longitude: lng,
    label: provider.name,
  });

  return (
    <div className={cn('pointer-events-auto flex flex-col gap-1.5', className)}>
      {onNavigateToMatching && (
        <Button
          type="button"
          size="sm"
          data-testid="zorgaanbieders-map-naar-matching"
          className="h-8 shrink-0 border border-primary/40 bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-md hover:bg-primary/90"
          onClick={(event) => {
            event.stopPropagation();
            onNavigateToMatching();
          }}
        >
          Naar Matching
        </Button>
      )}
      <Button
        type="button"
        size="sm"
        variant="outline"
        data-testid="provider-map-open-directions"
        className="h-8 border-border bg-card px-3 text-xs font-semibold text-foreground shadow-md"
        asChild
      >
        <a href={directionsUrl} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}>
          <ExternalLink size={14} className="mr-1.5" />
          Open in Google Maps
        </a>
      </Button>
    </div>
  );
}
