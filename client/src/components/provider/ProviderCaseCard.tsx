import { 
  CheckCircle2, 
  XCircle, 
  Eye, 
  Clock,
  User,
  MapPin,
  AlertTriangle
} from "lucide-react";
import { Button } from "../ui/button";
import { StatusBadge } from "./StatusBadge";

type CaseStatus = 
  | "nieuw" 
  | "in-beoordeling" 
  | "geaccepteerd" 
  | "intake-gepland" 
  | "afgewezen"
  | "wacht-op-reactie";

type UrgencyLevel = "high" | "medium" | "low";

interface ProviderCase {
  id: string;
  clientName: string;
  clientAge: number;
  region: string;
  caseType: string;
  urgency: UrgencyLevel;
  status: CaseStatus;
  waitingTime: string;
  problemSummary: string;
  municipality: string;
  placedDate: string;
}

interface ProviderCaseCardProps {
  case: ProviderCase;
  onAccept?: (caseId: string) => void;
  onReject?: (caseId: string) => void;
  onViewDetails?: (caseId: string) => void;
}

export function ProviderCaseCard({ 
  case: caseData, 
  onAccept, 
  onReject,
  onViewDetails 
}: ProviderCaseCardProps) {
  const urgencyConfig = {
    high: {
      label: "Hoge urgentie",
      color: "text-red-300",
      bg: "bg-red-500/15",
      border: "border-red-500/40",
      icon: AlertTriangle
    },
    medium: {
      label: "Gemiddelde urgentie",
      color: "text-amber-300",
      bg: "bg-amber-500/15",
      border: "border-amber-500/40",
      icon: Clock
    },
    low: {
      label: "Lage urgentie",
      color: "text-green-300",
      bg: "bg-green-500/15",
      border: "border-green-500/40",
      icon: CheckCircle2
    }
  };

  const urgency = urgencyConfig[caseData.urgency];
  const UrgencyIcon = urgency.icon;

  const isNew = caseData.status === "nieuw";
  const isActionable = isNew || caseData.status === "wacht-op-reactie";

  return (
    <div 
      className={`
        premium-card p-5 transition-all hover:shadow-lg
        ${isNew ? "border-2 border-blue-500/40 bg-blue-500/5" : ""}
        ${caseData.urgency === "high" ? "border-l-4 border-l-red-500" : ""}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-base font-bold text-foreground">
              {caseData.clientName}
            </h3>
            {isNew && (
              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-xs font-semibold rounded border border-blue-500/40">
                NIEUW
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Casus-ID: {caseData.id} · Geplaatst door {caseData.municipality}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={caseData.status} size="sm" />
          <div className={`
            flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium
            ${urgency.color} ${urgency.bg} ${urgency.border}
          `}>
            <UrgencyIcon size={12} />
            {urgency.label}
          </div>
        </div>
      </div>

      {/* Core Info Grid */}
      <div className="grid grid-cols-4 gap-4 mb-4 pb-4 border-b border-muted-foreground/20">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <User size={14} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Leeftijd</span>
          </div>
          <p className="text-sm font-semibold text-foreground">
            {caseData.clientAge} jaar
          </p>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <MapPin size={14} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Regio</span>
          </div>
          <p className="text-sm font-semibold text-foreground">
            {caseData.region}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-1">Zorgtype</p>
          <p className="text-sm font-semibold text-foreground">
            {caseData.caseType}
          </p>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Clock size={14} className={caseData.urgency === "high" ? "text-red-400" : "text-muted-foreground"} />
            <span className="text-xs text-muted-foreground">Wachttijd</span>
          </div>
          <p className={`text-sm font-semibold ${
            caseData.urgency === "high" ? "text-red-400" : "text-foreground"
          }`}>
            {caseData.waitingTime}
          </p>
        </div>
      </div>

      {/* Problem Summary */}
      <div className="mb-4">
        <p className="text-xs text-muted-foreground mb-2">Probleemschets</p>
        <p className="text-sm text-foreground leading-relaxed">
          {caseData.problemSummary}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {isActionable && onAccept && (
          <Button
            onClick={() => onAccept(caseData.id)}
            className="flex-1 bg-green-500 hover:bg-green-600"
          >
            <CheckCircle2 size={16} className="mr-2" />
            Accepteren
          </Button>
        )}

        {isActionable && onReject && (
          <Button
            onClick={() => onReject(caseData.id)}
            variant="outline"
            className="flex-1 border-red-500/40 text-red-300 hover:bg-red-500/10"
          >
            <XCircle size={16} className="mr-2" />
            Afwijzen
          </Button>
        )}

        {onViewDetails && (
          <Button
            onClick={() => onViewDetails(caseData.id)}
            variant="outline"
            className={isActionable ? "" : "flex-1"}
          >
            <Eye size={16} className="mr-2" />
            Bekijk details
          </Button>
        )}
      </div>

      {/* Time warning for urgent cases */}
      {caseData.urgency === "high" && isActionable && (
        <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-300 leading-relaxed">
              <strong>Let op:</strong> Deze casus heeft hoge urgentie. 
              Reactie binnen 24 uur vereist.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
