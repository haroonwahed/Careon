import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import Map, { Marker, NavigationControl, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { SpaProvider } from "../../hooks/useProviders";

interface ProviderNetworkMapProps {
  providers: SpaProvider[];
  selectedProviderId: string | null;
  hoveredProviderId: string | null;
  onSelectProvider: (providerId: string) => void;
  theme: "light" | "dark";
}

const NETHERLANDS_CENTER = { longitude: 5.2913, latitude: 52.1326, zoom: 7 };

const LIGHT_MAP_STYLE = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";
const DARK_MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const CITY_COORDINATES: Record<string, [number, number]> = {
  amsterdam: [52.3676, 4.9041],
  rotterdam: [51.9244, 4.4777],
  utrecht: [52.0907, 5.1214],
  "den haag": [52.0705, 4.3007],
  denhaag: [52.0705, 4.3007],
  eindhoven: [51.4416, 5.4697],
  groningen: [53.2194, 6.5665],
  breda: [51.5719, 4.7683],
  arnhem: [51.9851, 5.8987],
  nijmegen: [51.8126, 5.8372],
  haarlem: [52.3874, 4.6462],
  maastricht: [50.8514, 5.6909],
  leiden: [52.1601, 4.497],
  delft: [52.0116, 4.3571],
  almere: [52.3508, 5.2647],
  tilburg: [51.5555, 5.0913],
  enschede: [52.2215, 6.8937],
  apeldoorn: [52.2112, 5.9699],
  zwolle: [52.5168, 6.083],
  amersfoort: [52.1561, 5.3878],
};

function normalizeCity(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function stableOffset(seed: string): [number, number] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return [(((hash & 0xff) / 255) - 0.5) * 0.08, ((((hash >> 8) & 0xff) / 255) - 0.5) * 0.12];
}

function capacityColor(spots: number): string {
  if (spots > 2) return "#16a34a";
  if (spots > 0) return "#d97706";
  return "#dc2626";
}

function capacityLabel(spots: number): string {
  if (spots > 0) return `${spots} plek${spots > 1 ? "ken" : ""}`;
  return "Vol";
}

type MappedProvider = {
  provider: SpaProvider;
  lng: number;
  lat: number;
};

export function ProviderNetworkMap({
  providers,
  selectedProviderId,
  hoveredProviderId,
  onSelectProvider,
  theme,
}: ProviderNetworkMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapRef>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const isDark = theme === "dark";

  const mappedProviders = useMemo<MappedProvider[]>(() => {
    return providers
      .map((provider): MappedProvider | null => {
        if (provider.hasCoordinates && provider.latitude !== null && provider.longitude !== null) {
          return { provider, lat: provider.latitude, lng: provider.longitude };
        }
        const key = normalizeCity(provider.city || provider.region || "");
        const coords = CITY_COORDINATES[key];
        if (!coords) return null;
        const [dLat, dLng] = stableOffset(provider.id);
        return { provider, lat: coords[0] + dLat, lng: coords[1] + dLng };
      })
      .filter((item): item is MappedProvider => item !== null);
  }, [providers]);

  const initialViewState = useMemo(() => {
    if (mappedProviders.length === 0) return NETHERLANDS_CENTER;
    if (mappedProviders.length === 1) {
      return { longitude: mappedProviders[0].lng, latitude: mappedProviders[0].lat, zoom: 10 };
    }
    const lats = mappedProviders.map((p) => p.lat);
    const lngs = mappedProviders.map((p) => p.lng);
    return {
      longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
      latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
      zoom: 7,
    };
  }, [mappedProviders]);

  const mapStyle = isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE;

  const syncMapViewport = useCallback(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    map.resize();

    if (mappedProviders.length === 0) {
      map.easeTo({ center: [NETHERLANDS_CENTER.longitude, NETHERLANDS_CENTER.latitude], zoom: NETHERLANDS_CENTER.zoom, duration: 0 });
      return;
    }

    if (mappedProviders.length === 1) {
      map.easeTo({
        center: [mappedProviders[0].lng, mappedProviders[0].lat],
        zoom: 10,
        duration: 0,
      });
      return;
    }

    const bounds = mappedProviders.reduce(
      (acc, provider) => acc.extend([provider.lng, provider.lat]),
      new maplibregl.LngLatBounds(
        [mappedProviders[0].lng, mappedProviders[0].lat],
        [mappedProviders[0].lng, mappedProviders[0].lat],
      ),
    );

    map.fitBounds(bounds, {
      padding: { top: 72, right: 48, bottom: 72, left: 48 },
      duration: 0,
      maxZoom: 9.5,
    });
  }, [isMapLoaded, mappedProviders]);

  useEffect(() => {
    if (!isMapLoaded) return;

    let frameId = 0;
    let secondFrameId = 0;

    frameId = window.requestAnimationFrame(() => {
      secondFrameId = window.requestAnimationFrame(() => {
        syncMapViewport();
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      window.cancelAnimationFrame(secondFrameId);
    };
  }, [isMapLoaded, syncMapViewport]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isMapLoaded) return;

    const triggerResize = () => {
      window.requestAnimationFrame(() => {
        syncMapViewport();
      });
    };

    const resizeObserver = new ResizeObserver(() => {
      triggerResize();
    });
    resizeObserver.observe(container);

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          triggerResize();
        }
      },
      { threshold: 0.15 },
    );
    intersectionObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
    };
  }, [isMapLoaded, syncMapViewport]);

  // Fly to selected provider whenever selection changes (e.g. card click from the list)
  useEffect(() => {
    if (!isMapLoaded || !selectedProviderId) return;
    const found = mappedProviders.find((m) => m.provider.id === selectedProviderId);
    if (!found) return;
    mapRef.current?.flyTo({ center: [found.lng, found.lat], zoom: 12, duration: 700 });
  }, [selectedProviderId, isMapLoaded, mappedProviders]);

  const handleMarkerClick = useCallback(
    (providerId: string, lng: number, lat: number) => {
      onSelectProvider(providerId);
      mapRef.current?.flyTo({ center: [lng, lat], zoom: 12, duration: 700 });
    },
    [onSelectProvider],
  );

  return (
    <div
      ref={containerRef}
      className={`provider-network-map relative h-full min-h-[27rem] w-full lg:min-h-[30rem] ${
        isDark ? "provider-network-map-dark" : "provider-network-map-light"
      }`}
    >
      <style>{`
        .provider-network-map .maplibregl-ctrl-group {
          border: 1px solid rgba(148, 163, 184, 0.28);
          box-shadow: 0 16px 32px -22px rgba(15, 23, 42, 0.42);
          overflow: hidden;
        }

        .provider-network-map .maplibregl-ctrl-group button {
          width: 34px;
          height: 34px;
          transition: background-color 0.15s ease;
        }

        .provider-network-map-light .maplibregl-ctrl-group {
          background: rgba(255, 255, 255, 0.94);
        }

        .provider-network-map-light .maplibregl-ctrl-group button {
          background: rgba(255, 255, 255, 0.94);
        }

        .provider-network-map-light .maplibregl-ctrl-group button:hover {
          background: rgba(241, 245, 249, 0.96);
        }

        .provider-network-map-light .maplibregl-ctrl button .maplibregl-ctrl-icon {
          filter: none;
        }

        .provider-network-map-dark .maplibregl-ctrl-group {
          background: rgba(30, 41, 59, 0.9);
          border-color: rgba(71, 85, 105, 0.82);
          box-shadow: 0 20px 36px -22px rgba(2, 6, 23, 0.82);
        }

        .provider-network-map-dark .maplibregl-ctrl-group button {
          background: rgba(30, 41, 59, 0.9);
        }

        .provider-network-map-dark .maplibregl-ctrl-group button:hover {
          background: rgba(51, 65, 85, 0.98);
        }

        .provider-network-map-dark .maplibregl-ctrl button .maplibregl-ctrl-icon {
          filter: brightness(0) saturate(100%) invert(92%) sepia(11%) saturate(218%) hue-rotate(184deg) brightness(94%) contrast(89%);
        }

        .provider-network-map-dark .maplibregl-ctrl-attrib {
          background: rgba(15, 23, 42, 0.74);
          color: rgba(203, 213, 225, 0.88);
        }

        .provider-network-map-dark .maplibregl-ctrl-attrib a {
          color: rgba(226, 232, 240, 0.92);
        }

        .provider-network-map-dark .maplibregl-canvas {
          filter: brightness(1.14) contrast(0.9) saturate(0.88);
        }
      `}</style>
      <Map
        ref={mapRef}
        initialViewState={initialViewState}
        style={{ width: "100%", height: "100%" }}
        mapStyle={mapStyle}
        minZoom={5}
        maxZoom={15}
        attributionControl={false}
        onLoad={() => {
          setIsMapLoaded(true);
        }}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {mappedProviders.map(({ provider, lat, lng }) => {
          const isSelected = provider.id === selectedProviderId;
          const isHovered = provider.id === hoveredProviderId;
          const color = capacityColor(provider.availableSpots);
          const scale = isSelected ? 1.06 : isHovered ? 1.03 : 1;

          return (
            <Marker
              key={provider.id}
              longitude={lng}
              latitude={lat}
              anchor="center"
              onClick={() => handleMarkerClick(provider.id, lng, lat)}
            >
              <span
                title={provider.name}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 34,
                  padding: "0 12px",
                  borderRadius: 9999,
                  background: isDark ? "rgba(15, 23, 42, 0.92)" : "rgba(255, 255, 255, 0.94)",
                  color: isDark ? "#e2e8f0" : "#0f172a",
                  border: `1px solid ${
                    isSelected
                      ? isDark
                        ? "rgba(139,92,246,0.68)"
                        : "rgba(124,92,255,0.58)"
                      : isDark
                        ? "rgba(71,85,105,0.9)"
                        : "rgba(148,163,184,0.5)"
                  }`,
                  boxShadow: isSelected
                    ? isDark
                      ? "0 16px 30px rgba(2,6,23,.5), 0 0 0 4px rgba(139,92,246,.22)"
                      : "0 14px 28px rgba(15,23,42,.24), 0 0 0 4px rgba(124,92,255,.2)"
                    : isDark
                      ? "0 12px 24px rgba(2,6,23,.46)"
                      : "0 10px 20px rgba(15,23,42,.16)",
                  cursor: "pointer",
                  transform: `translateZ(0) scale(${scale})`,
                  transition: "transform .15s ease, box-shadow .15s ease, border-color .15s ease",
                  whiteSpace: "nowrap",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: ".01em",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: 9999,
                    background: color,
                    marginRight: 8,
                    boxShadow: `0 0 0 3px ${color}22`,
                  }}
                />
                {capacityLabel(provider.availableSpots)}
              </span>
            </Marker>
          );
        })}
      </Map>

      {isDark && (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.16),transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.06),rgba(30,41,59,0.14))]" />
      )}

      <div className="pointer-events-none absolute left-4 top-4 rounded-2xl border border-slate-200 bg-white/94 px-4 py-3 shadow-[0_14px_32px_-20px_rgba(15,23,42,0.35)] backdrop-blur-sm dark:border-slate-600/70 dark:bg-slate-800/86 dark:shadow-[0_18px_34px_-22px_rgba(2,6,23,0.68)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Kaartweergave</p>
        <p className="text-[11px] text-slate-600 dark:text-slate-300">
          {mappedProviders.length} van {providers.length} aanbieders zichtbaar
        </p>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 rounded-full border border-slate-200 bg-white/94 px-4 py-2 text-[11px] font-medium text-slate-600 shadow-[0_10px_26px_-20px_rgba(15,23,42,0.42)] backdrop-blur-sm dark:border-slate-600/70 dark:bg-slate-800/86 dark:text-slate-300 dark:shadow-[0_16px_28px_-20px_rgba(2,6,23,0.66)]">
        Klik op een marker voor aanbiederdetails
      </div>
    </div>
  );
}
