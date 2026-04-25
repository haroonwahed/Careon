import { CaseStatus } from "../../lib/casesData";
import { 
  FileText, 
  ClipboardList, 
  Search, 
  MapPin, 
  CheckCircle2, 
  XCircle,
  Activity
} from "lucide-react";

interface CaseStatusBadgeProps {
  status: CaseStatus;
  showIcon?: boolean;
  size?: "sm" | "md";
}

export function CaseStatusBadge({ status, showIcon = true, size = "md" }: CaseStatusBadgeProps) {
  const configs: Record<CaseStatus, {
    label: string;
    color: string;
    bg: string;
    border: string;
    icon: any;
  }> = {
    intake: {
      label: "Casus",
      color: "text-[#8B5CF6]",
      bg: "bg-primary/10",
      border: "border-primary/30",
      icon: FileText
    },
    assessment: {
      label: "Aanbieder Beoordeling",
      color: "text-[#3B82F6]",
      bg: "bg-[rgba(59,130,246,0.1)]",
      border: "border-[rgba(59,130,246,0.3)]",
      icon: ClipboardList
    },
    matching: {
      label: "Matching",
      color: "text-[#F59E0B]",
      bg: "bg-[rgba(245,158,11,0.1)]",
      border: "border-[rgba(245,158,11,0.3)]",
      icon: Search
    },
    placement: {
      label: "Plaatsing",
      color: "text-[#22D3EE]",
      bg: "bg-[rgba(34,211,238,0.1)]",
      border: "border-[rgba(34,211,238,0.3)]",
      icon: MapPin
    },
    active: {
      label: "Actief",
      color: "text-[#10B981]",
      bg: "bg-[rgba(16,185,129,0.1)]",
      border: "border-[rgba(16,185,129,0.3)]",
      icon: Activity
    },
    completed: {
      label: "Afgerond",
      color: "text-[#10B981]",
      bg: "bg-[rgba(16,185,129,0.1)]",
      border: "border-[rgba(16,185,129,0.3)]",
      icon: CheckCircle2
    },
    blocked: {
      label: "Geblokkeerd",
      color: "text-[#EF4444]",
      bg: "bg-[rgba(239,68,68,0.1)]",
      border: "border-[rgba(239,68,68,0.3)]",
      icon: XCircle
    }
  };

  const config = configs[status];
  const Icon = config.icon;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs gap-1",
    md: "px-2.5 py-1 text-sm gap-1.5"
  };

  const iconSizes = {
    sm: 12,
    md: 14
  };

  return (
    <div 
      className={`
        inline-flex items-center rounded-md border font-medium
        ${config.bg} ${config.border} ${config.color}
        ${sizeClasses[size]}
      `}
    >
      {showIcon && <Icon size={iconSizes[size]} />}
      <span>{config.label}</span>
    </div>
  );
}
