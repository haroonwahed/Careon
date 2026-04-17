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
          className: "dark:bg-[rgba(42,240,122,0.30)] bg-green-500/30 dark:text-[#2AF07A] text-green-300 border dark:border-[#2AF07A] border-green-400",
          icon: null,
        };
      case "boostActive":
        return {
          label: t(language, "published.status.boostActive"),
          className: "dark:bg-[rgba(139,92,246,0.40)] bg-primary/40 dark:text-[#E9D5FF] text-primary-foreground border dark:border-[#8B5CF6] border-primary",
          icon: Zap,
        };
      case "hidden":
        return {
          label: t(language, "published.status.hidden"),
          className: "dark:bg-[rgba(156,163,175,0.35)] bg-gray-500/35 dark:text-[#D1D5DB] text-gray-300 border dark:border-[#9CA3AF] border-gray-400",
          icon: EyeOff,
        };
      case "needsRepost":
        return {
          label: t(language, "published.status.needsRepost"),
          className: "dark:bg-[rgba(251,191,36,0.35)] bg-orange-500/35 dark:text-[#FDE68A] text-orange-300 border dark:border-[#FBBF24] border-orange-400",
          icon: Clock,
        };
      case "lowPhotos":
        return {
          label: t(language, "published.status.lowPhotos"),
          className: "dark:bg-[rgba(251,191,36,0.35)] bg-orange-500/35 dark:text-[#FDE68A] text-orange-300 border dark:border-[#FBBF24] border-orange-400",
          icon: ImageIcon,
        };
      case "active":
      default:
        return {
          label: t(language, "published.status.active"),
          className: "dark:bg-[rgba(139,92,246,0.25)] bg-primary/25 dark:text-[#E9D5FF] text-primary-foreground border dark:border-[rgba(168,85,247,0.50)] border-primary/50",
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
