import { LucideIcon } from "lucide-react";

interface WorkflowPlaceholderProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  description?: string;
}

export function WorkflowPlaceholder({ 
  title, 
  subtitle, 
  icon: Icon,
  description 
}: WorkflowPlaceholderProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold text-foreground mb-2">
          {title}
        </h1>
        <p className="text-muted-foreground">
          {subtitle}
        </p>
      </div>

      {/* Main Content */}
      <div className="premium-card p-12 text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <div 
            className="w-24 h-24 rounded-2xl mx-auto flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%)",
              border: "2px solid rgba(139, 92, 246, 0.2)"
            }}
          >
            <Icon size={48} className="text-primary" />
          </div>
          
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold text-foreground">
              Pagina in ontwikkeling
            </h2>
            {description && (
              <p className="text-muted-foreground max-w-lg mx-auto">
                {description}
              </p>
            )}
          </div>

          <div className="pt-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/30 text-sm text-muted-foreground">
              Deze functionaliteit wordt binnenkort beschikbaar
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
