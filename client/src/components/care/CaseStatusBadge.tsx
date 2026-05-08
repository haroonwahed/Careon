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
import { workflowStatusChipClasses } from "./careSemanticTones";
import { cn } from "../ui/utils";

interface CaseStatusBadgeProps {
  status: CaseStatus;
  showIcon?: boolean;
  size?: "sm" | "md";
}

export function CaseStatusBadge({ status, showIcon = true, size = "md" }: CaseStatusBadgeProps) {
  const configs: Record<CaseStatus, {
    label: string;
    icon: any;
  }> = {
    intake: {
      label: "Casus",
      icon: FileText
    },
    assessment: {
      label: "Aanbieder beoordeling",
      icon: ClipboardList
    },
    matching: {
      label: "Matching",
      icon: Search
    },
    placement: {
      label: "Plaatsing",
      icon: MapPin
    },
    active: {
      label: "Actief",
      icon: Activity
    },
    completed: {
      label: "Afgerond",
      icon: CheckCircle2
    },
    blocked: {
      label: "Geblokkeerd",
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
    <div className={cn("inline-flex items-center rounded-md border font-medium", workflowStatusChipClasses(status), sizeClasses[size])}>
      {showIcon && <Icon size={iconSizes[size]} />}
      <span>{config.label}</span>
    </div>
  );
}
