import { useState } from 'react';
import type { SpaProvider } from '../../hooks/useProviders';
import { isGoogleMapsConfigured, resolveDefaultMapBasemap, type MapBasemap } from '../../lib/mapConfig';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import { ProviderNetworkMap } from './ProviderNetworkMap';
import { ProviderNetworkMapGoogle } from './ProviderNetworkMapGoogle';

export interface ProviderMapSurfaceProps {
  providers: SpaProvider[];
  selectedProviderId: string | null;
  hoveredProviderId: string | null;
  onSelectProvider: (providerId: string) => void;
  onNavigateToMatching?: () => void;
  theme: 'light' | 'dark';
  showBasemapToggle?: boolean;
}

export function ProviderMapSurface({
  providers,
  selectedProviderId,
  hoveredProviderId,
  onSelectProvider,
  onNavigateToMatching,
  theme,
  showBasemapToggle = true,
}: ProviderMapSurfaceProps) {
  const [basemap, setBasemap] = useState<MapBasemap>(resolveDefaultMapBasemap);
  const canUseGoogle = isGoogleMapsConfigured();

  return (
    <div className="relative h-full w-full">
      {showBasemapToggle && canUseGoogle && (
        <div className="absolute right-4 top-4 z-20 flex gap-1 rounded-full border border-border bg-card/95 p-1 shadow-md backdrop-blur-sm">
          <Button
            type="button"
            size="sm"
            variant={basemap === 'maplibre' ? 'default' : 'ghost'}
            className={cn('h-8 rounded-full px-3 text-xs')}
            onClick={() => setBasemap('maplibre')}
            data-testid="map-basemap-maplibre"
          >
            MapLibre
          </Button>
          <Button
            type="button"
            size="sm"
            variant={basemap === 'google' ? 'default' : 'ghost'}
            className={cn('h-8 rounded-full px-3 text-xs')}
            onClick={() => setBasemap('google')}
            data-testid="map-basemap-google"
          >
            Google
          </Button>
        </div>
      )}

      {basemap === 'google' && canUseGoogle ? (
        <ProviderNetworkMapGoogle
          providers={providers}
          selectedProviderId={selectedProviderId}
          hoveredProviderId={hoveredProviderId}
          onSelectProvider={onSelectProvider}
          onNavigateToMatching={onNavigateToMatching}
          theme={theme}
        />
      ) : (
        <ProviderNetworkMap
          providers={providers}
          selectedProviderId={selectedProviderId}
          hoveredProviderId={hoveredProviderId}
          onSelectProvider={onSelectProvider}
          onNavigateToMatching={onNavigateToMatching}
          theme={theme}
        />
      )}
    </div>
  );
}
