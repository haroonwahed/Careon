/**
 * MapProviderPin - Interactive map pin for provider locations
 * 
 * Color-coded by match type with selection states
 */

import { MapPin } from "lucide-react";

interface MapProviderPinProps {
  matchType: "best" | "alternative" | "risky";
  isSelected: boolean;
  isHovered: boolean;
  onClick: () => void;
  onHover: (hovered: boolean) => void;
}

export function MapProviderPin({ 
  matchType, 
  isSelected, 
  isHovered,
  onClick,
  onHover
}: MapProviderPinProps) {
  
  const colorConfig = {
    best: {
      bg: "bg-green-500",
      glow: "shadow-green-500/50"
    },
    alternative: {
      bg: "bg-amber-500",
      glow: "shadow-amber-500/50"
    },
    risky: {
      bg: "bg-red-500",
      glow: "shadow-red-500/50"
    }
  };

  const config = colorConfig[matchType];

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={`relative transform transition-all duration-200 ${
        isSelected 
          ? "scale-125 z-20" 
          : isHovered
          ? "scale-110 z-10"
          : "scale-100 z-0"
      }`}
    >
      {/* Glow effect when selected */}
      {isSelected && (
        <div 
          className={`absolute inset-0 rounded-full blur-md ${config.bg} ${config.glow}`}
        />
      )}

      {/* Pin */}
      <div 
        className={`relative w-10 h-10 rounded-full flex items-center justify-center ${config.bg} ${
          isSelected ? "shadow-lg ring-4 ring-purple-500/40" : "shadow"
        }`}
      >
        <MapPin 
          size={20} 
          className="text-white fill-white" 
        />
      </div>

      {/* Subtle pulse when hovered */}
      {isHovered && !isSelected && (
        <div 
          className={`absolute inset-0 rounded-full ${config.bg} opacity-50 animate-ping`}
        />
      )}
    </button>
  );
}
