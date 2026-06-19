import { Zap, EyeOff, Clock, ImageIcon } from "lucide-react";
import { Badge } from "./ui/badge";
import { ListingStatusType } from "../lib/publishedListingsData";
import { Language, t } from "../lib/i18n";

interface StatusBadgeProps {
  status: ListingStatusType;
  language: Language;
  size?: "sm" | "md";
}

export function StatusBadge({ status, language, size = "sm" }: StatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case "sold":
        return {
          label: t(language, "published.status.sold"),
          className: "bg-care-success-bg text-care-success-text border border-care-success-border",
          icon: null,
        };
      case "boostActive":
        return {
          label: t(language, "published.status.boostActive"),
          className: "bg-primary/40 text-primary-foreground border border-primary",
          icon: Zap,
        };
      case "hidden":
        return {
          label: t(language, "published.status.hidden"),
          className: "bg-muted/35 text-muted-foreground border border-border",
          icon: EyeOff,
        };
      case "needsRepost":
        return {
          label: t(language, "published.status.needsRepost"),
          className: "bg-care-warning-bg text-care-warning-text border border-care-warning-border",
          icon: Clock,
        };
      case "lowPhotos":
        return {
          label: t(language, "published.status.lowPhotos"),
          className: "bg-care-warning-bg text-care-warning-text border border-care-warning-border",
          icon: ImageIcon,
        };
      case "active":
      default:
        return {
          label: t(language, "published.status.active"),
          className: "bg-primary/25 text-primary-foreground border border-primary/50",
          icon: null,
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;
  const textSize = size === "sm" ? "text-[10px]" : "text-[11px]";
  const padding = size === "sm" ? "px-2.5 py-1.5" : "px-3 py-1.5";
  const height = size === "sm" ? "h-6" : "h-7";

  return (
    <Badge className={`${textSize} ${padding} ${height} ${config.className} flex items-center gap-1.5 backdrop-blur-sm shadow-lg`}>
      {Icon && <Icon className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />}
      <span className="font-medium">{config.label}</span>
    </Badge>
  );
}
