/**
 * CapacityIndicator - Visual capacity status display
 * 
 * Shows provider capacity in a clear, scannable format
 */

import { Users } from "lucide-react";

interface CapacityIndicatorProps {
  available: number;
  total: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function CapacityIndicator({ 
  available, 
  total,
  size = "md",
  showLabel = true
}: CapacityIndicatorProps) {
  
  const percentage = (available / total) * 100;
  
  const status: "available" | "limited" | "full" = 
    percentage > 30 ? "available" : 
    percentage > 0 ? "limited" : "full";

  const sizeClasses = {
    sm: "h-1.5",
    md: "h-2",
    lg: "h-3"
  };

  const textSizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base"
  };

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Users 
              size={size === "sm" ? 12 : size === "md" ? 14 : 16} 
              className={status === "available" ? "text-green-400" : 
                        status === "limited" ? "text-amber-400" : 
                        "text-red-400"}
            />
            <span className={`${textSizes[size]} font-semibold ${
              status === "available" ? "text-green-400" : 
              status === "limited" ? "text-amber-400" : 
              "text-red-400"
            }`}>
              {available} van {total} plekken
            </span>
          </div>
          <span className={`${textSizes[size]} text-muted-foreground`}>
            {percentage.toFixed(0)}%
          </span>
        </div>
      )}

      {/* Progress Bar */}
      <div className={`w-full bg-muted/30 rounded-full overflow-hidden ${sizeClasses[size]}`}>
        <div
          className={`${sizeClasses[size]} rounded-full transition-all duration-500 ${
            status === "available" ? "bg-green-400" : 
            status === "limited" ? "bg-amber-400" : 
            "bg-red-400"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {!showLabel && (
        <p className={`${textSizes[size]} text-muted-foreground mt-1`}>
          {available}/{total} beschikbaar
        </p>
      )}
    </div>
  );
}
