/**
 * MapRadiusCircle - Visual representation of search radius on map
 */

interface MapRadiusCircleProps {
  radius: number; // in km
  color?: string;
}

export function MapRadiusCircle({ 
  radius, 
  color = "hsl(var(--primary) / 0.15)" 
}: MapRadiusCircleProps) {
  
  return (
    <div className="relative">
      {/* Circle overlay */}
      <div 
        className="absolute rounded-full border-2 border-primary/30 pointer-events-none"
        style={{
          width: `${radius * 10}px`, // Scale for visualization
          height: `${radius * 10}px`,
          background: color,
          transform: "translate(-50%, -50%)"
        }}
      />
      
      {/* Center point (client location) */}
      <div className="absolute w-4 h-4 rounded-full bg-primary border-2 border-white shadow-lg transform -translate-x-1/2 -translate-y-1/2">
        <div className="absolute inset-0 rounded-full bg-primary animate-ping opacity-75" />
      </div>

      {/* Radius label */}
      <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-card/90 backdrop-blur rounded text-xs text-muted-foreground whitespace-nowrap">
        {radius}km radius
      </div>
    </div>
  );
}
