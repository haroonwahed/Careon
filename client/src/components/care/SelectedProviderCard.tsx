import { 
  CheckCircle2, 
  MapPin, 
  Users, 
  Star, 
  Clock, 
  TrendingUp,
  Shield,
  AlertCircle
} from "lucide-react";
import { CarePanel } from "./CareDesignPrimitives";

interface Provider {
  id: string;
  name: string;
  type: string;
  region: string;
  rating: number;
  availableSpots: number;
  capacity: number;
  responseTime: number;
  specializations: string[];
}

interface SelectedProviderCardProps {
  provider: Provider;
  /** Optional — only render when a real fitScore/matchScore is available. */
  matchScore?: number | null;
  /** Optional — only render when real, evidence-backed reasons exist. */
  reasons?: Array<{ text: string; positive: boolean }>;
  tradeOffs?: {
    pros: string[];
    cons: string[];
  };
}

export function SelectedProviderCard({
  provider,
  matchScore,
  reasons,
  tradeOffs
}: SelectedProviderCardProps) {
  const hasMatchScore = typeof matchScore === "number" && Number.isFinite(matchScore);
  const hasReasons = Array.isArray(reasons) && reasons.length > 0;
  const hasCapacity = provider.availableSpots > 0;
  const fastResponse = provider.responseTime <= 6;

  return (
    <CarePanel className="border border-border/70 bg-card/90 p-4 ring-1 ring-primary/20">
      {/* Selected Badge */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-3 h-3 rounded-full bg-primary" />
        <span className="text-sm font-semibold text-primary uppercase tracking-wide">
          Geselecteerde aanbieder
        </span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            {provider.name}
          </h2>
          <p className="text-sm text-muted-foreground">{provider.type}</p>
        </div>
        
        {/* Match Score Badge — only render when a real score exists */}
        {hasMatchScore ? (
          <div className="text-center">
            <div className="px-4 py-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-emerald-300">{matchScore}</span>
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Matchscore</p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <MapPin size={14} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Regio</span>
          </div>
          <p className="font-semibold text-sm text-foreground">{provider.region}</p>
        </div>
        
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Users size={14} className={hasCapacity ? "text-emerald-300" : "text-destructive"} />
            <span className="text-xs text-muted-foreground">Capaciteit</span>
          </div>
          <p className={`font-semibold text-sm ${
            hasCapacity ? "text-emerald-300" : "text-destructive"
          }`}>
            {provider.availableSpots}/{provider.capacity}
          </p>
        </div>
        
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Star size={14} className="text-emerald-300" />
            <span className="text-xs text-muted-foreground">Rating</span>
          </div>
          <p className="font-semibold text-sm text-emerald-300">{provider.rating.toFixed(1)}</p>
        </div>
        
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Clock size={14} className={fastResponse ? "text-emerald-300" : "text-amber-300"} />
            <span className="text-xs text-muted-foreground">Reactietijd</span>
          </div>
          <p className={`font-semibold text-sm ${
            fastResponse ? "text-emerald-300" : "text-amber-300"
          }`}>
            {provider.responseTime}u
          </p>
        </div>
      </div>

      {/* Specializations */}
      <div className="mb-5">
        <p className="text-xs text-muted-foreground mb-2">Specialisaties</p>
        <div className="flex flex-wrap gap-2">
          {provider.specializations.map((spec, idx) => (
            <span 
              key={idx}
              className="px-3 py-1.5 bg-muted/35 border border-border/70 text-foreground text-xs rounded-md font-medium"
            >
              {spec}
            </span>
          ))}
        </div>
      </div>

      {/* Why This Provider — only render when evidence-backed reasons exist */}
      {hasReasons ? (
        <div className="mb-5 p-4 rounded-lg border border-cyan-500/40 bg-cyan-500/15">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <TrendingUp size={16} className="text-cyan-300" />
            Waarom deze aanbieder?
          </h3>
          <ul className="space-y-2">
            {reasons!.slice(0, 3).map((reason, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                {reason.positive ? (
                  <CheckCircle2 size={14} className="mt-0.5 text-emerald-300 flex-shrink-0" />
                ) : (
                  <AlertCircle size={14} className="mt-0.5 text-amber-300 flex-shrink-0" />
                )}
                <span className="text-xs text-muted-foreground leading-relaxed break-words">
                  {reason.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Trade-offs */}
      {tradeOffs && (
        <div className="p-4 rounded-lg bg-muted/30 border border-muted-foreground/20">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Shield size={16} className="text-muted-foreground" />
            Overwegingen
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {tradeOffs.pros.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-emerald-300 mb-2">+ Voordelen</p>
                <ul className="space-y-1.5">
                  {tradeOffs.pros.map((pro, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-emerald-300 text-xs">•</span>
                      <span className="text-xs text-muted-foreground leading-relaxed break-words">{pro}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {tradeOffs.cons.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-destructive mb-2">− Aandachtspunten</p>
                <ul className="space-y-1.5">
                  {tradeOffs.cons.map((con, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-destructive text-xs">•</span>
                      <span className="text-xs text-muted-foreground leading-relaxed break-words">{con}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </CarePanel>
  );
}
