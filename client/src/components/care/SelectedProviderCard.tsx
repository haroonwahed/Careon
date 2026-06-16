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
import { advisoryQualitativeFromNumericScore } from "../../lib/matchingAdvisory";

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
  /** @deprecated Use `advisoryLabel` — numeric scores are not shown as percentages. */
  matchScore?: number | null;
  /** Operational advisory label for the selected provider. */
  advisoryLabel?: string | null;
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
  advisoryLabel: advisoryLabelProp,
  reasons,
  tradeOffs
}: SelectedProviderCardProps) {
  const advisoryLabel =
    advisoryLabelProp ??
    (typeof matchScore === "number" && Number.isFinite(matchScore)
      ? advisoryQualitativeFromNumericScore(matchScore)
      : null);
  const displayAdvisory = advisoryLabel?.trim() || null;
  const hasReasons = Array.isArray(reasons) && reasons.length > 0;
  const hasCapacity = provider.availableSpots > 0;
  const fastResponse = provider.responseTime <= 6;

  return (
    <CarePanel className="border border-border/70 bg-card/90 p-4 ring-1 ring-primary/20">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-3 h-3 rounded-full bg-primary" />
        <span className="text-sm font-semibold text-primary uppercase tracking-wide">
          Geselecteerde aanbieder
        </span>
      </div>

      <div className="flex items-start justify-between mb-5">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            {provider.name}
          </h2>
          <p className="text-sm text-muted-foreground">{provider.type}</p>
        </div>
        
        {displayAdvisory ? (
          <div className="max-w-[9rem] text-center shrink-0">
            <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
              <span className="text-[12px] font-semibold leading-snug text-foreground">{displayAdvisory}</span>
              <p className="text-[10px] text-muted-foreground mt-1">Matchadvies</p>
            </div>
          </div>
        ) : null}
      </div>

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
            <Users size={14} className={hasCapacity ? "text-care-success-solid" : "text-destructive"} />
            <span className="text-xs text-muted-foreground">Capaciteit</span>
          </div>
          <p className={`font-semibold text-sm ${
            hasCapacity ? "text-care-success-solid" : "text-destructive"
          }`}>
            {provider.availableSpots}/{provider.capacity}
          </p>
        </div>
        
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Star size={14} className="text-care-success-solid" />
            <span className="text-xs text-muted-foreground">Rating</span>
          </div>
          <p className="font-semibold text-sm text-care-success-solid">{provider.rating.toFixed(1)}</p>
        </div>
        
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Clock size={14} className={fastResponse ? "text-care-success-solid" : "text-care-warning-solid"} />
            <span className="text-xs text-muted-foreground">Reactietijd</span>
          </div>
          <p className={`font-semibold text-sm ${
            fastResponse ? "text-care-success-solid" : "text-care-warning-solid"
          }`}>
            {provider.responseTime}u
          </p>
        </div>
      </div>

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

      {hasReasons ? (
        <div className="mb-5 p-4 rounded-lg border border-cyan-500/40 bg-cyan-500/15">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <TrendingUp size={16} className="text-care-info-solid" />
            Waarom deze aanbieder?
          </h3>
          <ul className="space-y-2">
            {reasons!.slice(0, 3).map((reason, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                {reason.positive ? (
                  <CheckCircle2 size={14} className="mt-0.5 text-care-success-solid flex-shrink-0" />
                ) : (
                  <AlertCircle size={14} className="mt-0.5 text-care-warning-solid flex-shrink-0" />
                )}
                <span className="text-xs text-muted-foreground leading-relaxed break-words">
                  {reason.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tradeOffs && (
        <div className="p-4 rounded-lg bg-muted/30 border border-muted-foreground/20">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Shield size={16} className="text-muted-foreground" />
            Overwegingen
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {tradeOffs.pros.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-care-success-solid mb-2">+ Voordelen</p>
                <ul className="space-y-1.5">
                  {tradeOffs.pros.map((pro, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-care-success-solid text-xs">•</span>
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
