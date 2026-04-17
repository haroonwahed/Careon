import { Brain, Sparkles } from "lucide-react";
import { ReactNode } from "react";

interface AIInsightPanelProps {
  title?: string;
  children: ReactNode;
  variant?: "default" | "compact";
}

/**
 * Container for AI insights - provides consistent styling for AI-powered components
 */
export function AIInsightPanel({ 
  title = "Beslissingsondersteuning", 
  children,
  variant = "default" 
}: AIInsightPanelProps) {
  const isCompact = variant === "compact";

  return (
    <div className="space-y-4">
      {/* Header (optional) */}
      {!isCompact && title && (
        <div className="flex items-center gap-2">
          <Brain size={18} className="text-primary" />
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {title}
          </h2>
        </div>
      )}

      {/* Content */}
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}
