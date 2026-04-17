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
          className: "dark:bg-[rgba(42,240,122,0.30)] bg-green-500/30 text-green-base text-green-300 border dark:border-[#2AF07A] border-green-400",
          icon: null,
        };
      case "boostActive":
        return {
          label: t(language, "published.status.boostActive"),
          className: "bg-primary/40 bg-primary/40 text-primary-foreground text-primary-foreground border border-primary border-primary",
          icon: Zap,
        };
      case "hidden":
        return {
          label: t(language, "published.status.hidden"),
          className: "bg-muted/35 bg-gray-500/35 text-muted-foreground text-gray-300 border border-border border-gray-400",
          icon: EyeOff,
        };
      case "needsRepost":
        return {
          label: t(language, "published.status.needsRepost"),
          className: "bg-yellow-light/35 bg-orange-500/35 text-yellow-border text-orange-300 border border-yellow-border border-orange-400",
          icon: Clock,
        };
      case "lowPhotos":
        return {
          label: t(language, "published.status.lowPhotos"),
          className: "bg-yellow-light/35 bg-orange-500/35 text-yellow-border text-orange-300 border border-yellow-border border-orange-400",
          icon: ImageIcon,
        };
      case "active":
      default:
        return {
          label: t(language, "published.status.active"),
          className: "dark:bg-[rgba(139,92,246,0.25)] bg-primary/25 text-primary-foreground text-primary-foreground border border-primary/50 border-primary/50",
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
