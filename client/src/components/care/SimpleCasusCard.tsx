/**
 * SimpleCasusCard - Clean case card for Casussen search/manage page
 * 
 * Purpose: Quick overview without AI intelligence (that belongs in Regiekamer)
 * Shows: ID, client, type, status, urgency, waiting time
 * No: AI insights, recommendations, signals
 */

import { Clock, MapPin, TrendingUp, ArrowRight } from "lucide-react";
import { Button } from "../ui/button";
import { CaseStatusBadge } from "./CaseStatusBadge";
import { UrgencyBadge } from "./UrgencyBadge";
import { RiskBadge } from "./RiskBadge";

interface SimpleCasusCardProps {
  id: string;
  title: string;
  regio: string;
  zorgtype: string;
  wachttijd: number;
  status: "intake" | "beoordeling" | "matching" | "plaatsing" | "afgerond";
  urgency: "critical" | "high" | "medium" | "low";
  risk?: "high" | "medium" | "low";
  onViewDetails: () => void;
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
}

export function SimpleCasusCard({
  id,
  title,
  regio,
  zorgtype,
  wachttijd,
  status,
  urgency,
  risk,
  onViewDetails,
  isSelected = false,
  onSelect
}: SimpleCasusCardProps) {
  return (
    <div 
      className={`
        panel-surface p-4 cursor-pointer
        hover:border-border/80 transition-all
        group
        ${isSelected ? "ring-2 ring-primary" : ""}
      `}
      onClick={onViewDetails}
    >
      {/* Selection Checkbox */}
      {onSelect && (
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onSelect(e.target.checked);
            }}
            className="mt-1 w-4 h-4 rounded border-2 border-border bg-background 
                     checked:bg-primary checked:border-primary cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex-1">
            <CasusCardContent 
              id={id}
              title={title}
              regio={regio}
              zorgtype={zorgtype}
              wachttijd={wachttijd}
              status={status}
              urgency={urgency}
              risk={risk}
            />
          </div>
        </div>
      )}

      {!onSelect && (
        <CasusCardContent 
          id={id}
          title={title}
          regio={regio}
          zorgtype={zorgtype}
          wachttijd={wachttijd}
          status={status}
          urgency={urgency}
          risk={risk}
        />
      )}
    </div>
  );
}

function CasusCardContent({
  id,
  title,
  regio,
  zorgtype,
  wachttijd,
  status,
  urgency,
  risk
}: {
  id: string;
  title: string;
  regio: string;
  zorgtype: string;
  wachttijd: number;
  status: "intake" | "beoordeling" | "matching" | "plaatsing" | "afgerond";
  urgency: "critical" | "high" | "medium" | "low";
  risk?: "high" | "medium" | "low";
}) {
  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-foreground group-hover:text-foreground transition-colors">
              {id}
            </span>
            <div className="flex items-center gap-1.5">
              <CaseStatusBadge status={status} size="sm" />
              <UrgencyBadge urgency={urgency} size="sm" />
              {risk && <RiskBadge risk={risk} size="sm" />}
            </div>
          </div>
          <h3 className="text-sm font-medium text-foreground">
            {title}
          </h3>
        </div>

        {/* Waiting Time */}
        <div className={`
          flex items-center gap-1.5 px-2.5 py-1 rounded-md
          ${wachttijd > 10 ? "bg-red-500/10 text-red-500 border border-red-500/30" : 
            wachttijd > 5 ? "bg-amber-500/10 text-amber-500 border border-amber-500/30" : 
            "bg-muted text-muted-foreground"}
        `}>
          <Clock size={14} />
          <span className="text-xs font-semibold">{wachttijd}d</span>
        </div>
      </div>

      {/* Info Row */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <MapPin size={14} />
          <span>{regio}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingUp size={14} />
          <span>{zorgtype}</span>
        </div>
      </div>
    </>
  );
}
