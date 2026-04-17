/**
 * ProviderMiniMap - Small contextual map for provider location
 * 
 * Not a primary map interface, just location context
 */

import { MapPin, Navigation } from "lucide-react";

interface ProviderMiniMapProps {
  region: string;
  address?: string;
  distance?: number;
  showDirections?: boolean;
}

export function ProviderMiniMap({ 
  region, 
  address,
  distance,
  showDirections = false
}: ProviderMiniMapProps) {
  
  return (
    <div className="space-y-3">
      {/* Map Placeholder */}
      <div className="w-full h-48 bg-muted/20 rounded-lg border border-border relative overflow-hidden">
        {/* Gradient overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-br from-muted/5 to-muted/30" />
        
        {/* Center pin */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="relative">
            <MapPin 
              size={48} 
              className="text-primary drop-shadow-lg" 
              fill="currentColor"
            />
            <div className="absolute inset-0 animate-ping">
              <MapPin 
                size={48} 
                className="text-primary opacity-30" 
              />
            </div>
          </div>
        </div>

        {/* Region label */}
        <div className="absolute bottom-3 left-3 right-3 bg-card/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-border">
          <p className="text-xs text-muted-foreground">Locatie</p>
          <p className="text-sm font-semibold text-foreground">{region}</p>
        </div>

        {/* Distance badge (if provided) */}
        {distance !== undefined && (
          <div className="absolute top-3 right-3 bg-primary/90 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-primary/30">
            <p className="text-xs font-bold text-white">{distance}km</p>
          </div>
        )}
      </div>

      {/* Address details */}
      {address && (
        <div className="space-y-2">
          <div>
            <p className="text-xs text-muted-foreground">Adres</p>
            <p className="text-sm text-foreground">{address}</p>
          </div>
        </div>
      )}

      {/* Get Directions Button */}
      {showDirections && (
        <button className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted/30 transition-colors">
          <Navigation size={14} className="text-primary" />
          <span className="text-sm font-semibold text-foreground">
            Toon routebeschrijving
          </span>
        </button>
      )}
    </div>
  );
}
