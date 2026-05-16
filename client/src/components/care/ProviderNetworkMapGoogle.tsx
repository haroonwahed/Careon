import { useCallback, useEffect, useMemo, useState } from 'react';
import { APIProvider, Map, Marker, useMap } from '@vis.gl/react-google-maps';
import type { SpaProvider } from '../../hooks/useProviders';
import { countEstimatedMarkers, useProviderMapMarkers, type ProviderMapMarker } from '../../hooks/useProviderMapMarkers';
import { isGoogleMapsConfigured } from '../../lib/mapConfig';
import { MapCoordinateLegend } from './MapCoordinateLegend';
import { ProviderSelectedMarkerActions } from './ProviderSelectedMarkerActions';
import { cn } from '../ui/utils';

const NETHERLANDS_CENTER = { lat: 52.1326, lng: 5.2913 };

interface ProviderNetworkMapGoogleProps {
  providers: SpaProvider[];
  selectedProviderId: string | null;
  hoveredProviderId: string | null;
  onSelectProvider: (providerId: string) => void;
  onNavigateToMatching?: () => void;
  theme: 'light' | 'dark';
}

function capacityToneClasses(spots: number): string {
  if (spots > 2) return 'bg-emerald-600 ring-emerald-500/30';
  if (spots > 0) return 'bg-amber-600 ring-amber-500/30';
  return 'bg-destructive ring-destructive/30';
}

function capacityLabel(spots: number): string {
  if (spots > 0) return `${spots} plek${spots > 1 ? 'ken' : ''}`;
  return 'Vol';
}

function MapViewportSync({
  markers,
  selectedProviderId,
}: {
  markers: ProviderMapMarker[];
  selectedProviderId: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || markers.length === 0) return;
    if (markers.length === 1) {
      map.setCenter({ lat: markers[0].lat, lng: markers[0].lng });
      map.setZoom(10);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    markers.forEach((marker) => bounds.extend({ lat: marker.lat, lng: marker.lng }));
    map.fitBounds(bounds, 72);
  }, [map, markers]);

  useEffect(() => {
    if (!map || !selectedProviderId) return;
    const found = markers.find((marker) => marker.provider.id === selectedProviderId);
    if (!found) return;
    map.panTo({ lat: found.lat, lng: found.lng });
    map.setZoom(12);
  }, [map, markers, selectedProviderId]);

  return null;
}

export function ProviderNetworkMapGoogle({
  providers,
  selectedProviderId,
  hoveredProviderId,
  onSelectProvider,
  onNavigateToMatching,
  theme,
}: ProviderNetworkMapGoogleProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? '';
  const markers = useProviderMapMarkers(providers);
  const estimatedCount = countEstimatedMarkers(markers);
  const [mapReady, setMapReady] = useState(false);

  const defaultCenter = useMemo(() => {
    if (markers.length === 0) return NETHERLANDS_CENTER;
    return { lat: markers[0].lat, lng: markers[0].lng };
  }, [markers]);

  const handleMarkerClick = useCallback(
    (providerId: string) => {
      onSelectProvider(providerId);
    },
    [onSelectProvider],
  );

  if (!isGoogleMapsConfigured() || !apiKey) {
    return (
      <div className="flex h-full min-h-[27rem] items-center justify-center rounded-xl border border-border bg-muted/20 p-6 text-sm text-muted-foreground">
        Google Maps is niet geconfigureerd. Stel <code className="mx-1">VITE_GOOGLE_MAPS_API_KEY</code> in of gebruik MapLibre.
      </div>
    );
  }

  return (
    <div
      className={cn(
        'provider-network-map-google relative h-full min-h-[27rem] w-full lg:min-h-[30rem]',
        theme === 'dark' && 'provider-network-map-dark',
      )}
    >
      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={defaultCenter}
          defaultZoom={markers.length <= 1 ? 10 : 7}
          gestureHandling="greedy"
          disableDefaultUI
          colorScheme={theme === 'dark' ? 'DARK' : 'LIGHT'}
          onTilesLoaded={() => setMapReady(true)}
          style={{ width: '100%', height: '100%' }}
        >
          {mapReady && <MapViewportSync markers={markers} selectedProviderId={selectedProviderId} />}
          {markers.map((marker) => {
            const isSelected = marker.provider.id === selectedProviderId;
            const isHovered = marker.provider.id === hoveredProviderId;
            const scale = isSelected ? 1.06 : isHovered ? 1.03 : 1;
            return (
              <Marker
                key={marker.provider.id}
                position={{ lat: marker.lat, lng: marker.lng }}
                onClick={() => handleMarkerClick(marker.provider.id)}
              >
                <div className="flex flex-col items-center" style={{ transform: `scale(${scale})` }}>
                  <span
                    title={marker.provider.name}
                    className={cn(
                      'inline-flex min-h-[34px] items-center justify-center whitespace-nowrap rounded-full border px-3 text-xs font-bold tracking-[0.01em] text-foreground',
                      'bg-card',
                      marker.isEstimated && 'border-dashed border-amber-500/60',
                      isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border',
                    )}
                  >
                    <span
                      className={cn(
                        'mr-2 inline-block size-2 rounded-full ring-4',
                        capacityToneClasses(marker.provider.availableSpots),
                      )}
                    />
                    {capacityLabel(marker.provider.availableSpots)}
                  </span>
                  {isSelected && (
                    <ProviderSelectedMarkerActions
                      provider={marker.provider}
                      lat={marker.lat}
                      lng={marker.lng}
                      onNavigateToMatching={onNavigateToMatching}
                      className="mt-2"
                    />
                  )}
                </div>
              </Marker>
            );
          })}
        </Map>
      </APIProvider>

      <MapCoordinateLegend
        visibleCount={markers.length}
        totalCount={providers.length}
        estimatedCount={estimatedCount}
      />

      <div className="pointer-events-none absolute bottom-4 left-4 rounded-full border border-border bg-card px-4 py-2 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
        Google Maps · klik op een marker voor details
      </div>
    </div>
  );
}
