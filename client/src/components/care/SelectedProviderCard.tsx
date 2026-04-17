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
  matchScore: number;
  reasons: Array<{ text: string; positive: boolean }>;
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
  const hasCapacity = provider.availableSpots > 0;
  const fastResponse = provider.responseTime <= 6;

  return (
    <div className="premium-card p-6 border careon-alert-primary">
      {/* Selected Badge */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
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
        
        {/* Match Score Badge */}
        <div className="text-center">
          <div className="px-4 py-2 rounded-xl border careon-alert-success">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-green-base">{matchScore}</span>
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Match score</p>
          </div>
        </div>
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
            <Users size={14} className={hasCapacity ? "text-green-base" : "text-red-base"} />
            <span className="text-xs text-muted-foreground">Capaciteit</span>
          </div>
          <p className={`font-semibold text-sm ${
            hasCapacity ? "text-green-base" : "text-red-base"
          }`}>
            {provider.availableSpots}/{provider.capacity}
          </p>
        </div>
        
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Star size={14} className="text-green-base" />
            <span className="text-xs text-muted-foreground">Rating</span>
          </div>
          <p className="font-semibold text-sm text-green-base">{provider.rating.toFixed(1)}</p>
        </div>
        
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Clock size={14} className={fastResponse ? "text-green-base" : "text-yellow-base"} />
            <span className="text-xs text-muted-foreground">Reactietijd</span>
          </div>
          <p className={`font-semibold text-sm ${
            fastResponse ? "text-green-base" : "text-yellow-base"
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
              className="px-3 py-1.5 bg-primary/10 border border-primary/30 text-primary text-xs rounded-md font-medium"
            >
              {spec}
            </span>
          ))}
        </div>
      </div>

      {/* Why This Provider */}
      <div className="mb-5 p-4 rounded-lg border careon-alert-info">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <TrendingUp size={16} className="text-blue-base" />
          Waarom deze aanbieder?
        </h3>
        <ul className="space-y-2">
          {reasons.slice(0, 3).map((reason, idx) => (
            <li key={idx} className="flex items-start gap-2.5">
              {reason.positive ? (
                <CheckCircle2 size={14} className="mt-0.5 text-green-base flex-shrink-0" />
              ) : (
                <AlertCircle size={14} className="mt-0.5 text-yellow-base flex-shrink-0" />
              )}
              <span className="text-xs text-muted-foreground leading-relaxed break-words">
                {reason.text}
              </span>
            </li>
          ))}
        </ul>
      </div>

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
                <p className="text-xs font-semibold text-green-base mb-2">+ Voordelen</p>
                <ul className="space-y-1.5">
                  {tradeOffs.pros.map((pro, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-green-base text-xs">•</span>
                      <span className="text-xs text-muted-foreground leading-relaxed break-words">{pro}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {tradeOffs.cons.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-base mb-2">− Aandachtspunten</p>
                <ul className="space-y-1.5">
                  {tradeOffs.cons.map((con, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-red-base text-xs">•</span>
                      <span className="text-xs text-muted-foreground leading-relaxed break-words">{con}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}