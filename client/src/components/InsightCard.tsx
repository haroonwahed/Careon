import { AlertCircle, AlertTriangle, Info, Image as ImageIcon, Clock, TrendingDown, DollarSign, Tag, FileText, EyeOff, Zap } from "lucide-react";
import { ListingInsight } from "../lib/publishedListingsData";
import { Button } from "./ui/button";
import { Language, t } from "../lib/i18n";

interface InsightCardProps {
  insight: ListingInsight;
  language: Language;
  onAction: () => void;
}

export function InsightCard({ insight, language, onAction }: InsightCardProps) {
  const getSeverityStyles = () => {
    switch (insight.severity) {
      case "critical":
        return {
          border: "dark:border-[rgba(255,92,138,0.40)] border-red-300",
          bg: "dark:bg-[rgba(255,92,138,0.08)] bg-red-50",
          icon: "text-red-base text-red-600",
          IconComponent: AlertCircle,
        };
      case "warning":
        return {
          border: "dark:border-[rgba(251,191,36,0.40)] border-yellow-300",
          bg: "dark:bg-[rgba(251,191,36,0.08)] bg-yellow-50",
          icon: "text-yellow-base text-yellow-600",
          IconComponent: AlertTriangle,
        };
      case "info":
      default:
        return {
          border: "border-primary/40",
          bg: "dark:bg-[rgba(139,92,246,0.08)] bg-primary/8",
          icon: "text-primary",
          IconComponent: Info,
        };
    }
  };

  const getInsightIcon = () => {
    switch (insight.type) {
      case "photos":
        return ImageIcon;
      case "oldListing":
        return Clock;
      case "lowEngagement":
        return TrendingDown;
      case "offersLow":
        return DollarSign;
      case "missingBrand":
        return Tag;
      case "shortDescription":
        return FileText;
      case "hidden":
        return EyeOff;
      case "boostActive":
        return Zap;
      default:
        return Info;
    }
  };

  const getTitle = () => {
    return t(language, `published.insight.${insight.type}.title`);
  };

  const getDescription = () => {
    let desc = t(language, `published.insight.${insight.type}.description`);
    
    // Replace placeholders with data
    if (insight.data) {
      Object.keys(insight.data).forEach(key => {
        desc = desc.replace(`{${key}}`, insight.data![key].toString());
      });
    }
    
    return desc;
  };

  const getCTA = () => {
    return t(language, `published.insight.${insight.type}.cta`);
  };

  const styles = getSeverityStyles();
  const InsightIcon = getInsightIcon();
  const { IconComponent: SeverityIcon } = styles;

  return (
    <div
      className={`p-4 rounded-xl border ${styles.border} ${styles.bg}`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`flex-shrink-0 ${styles.icon}`}>
          <InsightIcon className="w-5 h-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title with severity badge */}
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-foreground">
              {getTitle()}
            </h4>
            <div className={`flex items-center gap-1 ${styles.icon}`}>
              <SeverityIcon className="w-3 h-3" />
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground mb-3">
            {getDescription()}
          </p>

          {/* CTA button */}
          <Button
            onClick={onAction}
            size="sm"
            variant="outline"
            className="rounded-lg border-primary/30 text-primary hover:bg-primary/10 hover:bg-primary/10"
          >
            {getCTA()}
          </Button>
        </div>
      </div>
    </div>
  );
}
