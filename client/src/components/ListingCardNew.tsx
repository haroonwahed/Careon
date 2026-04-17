import { MoreVertical, RefreshCw, TrendingUp, Heart, Eye } from "lucide-react";
import { PublishedListing, getPrimaryStatus, getListingStatuses } from "../lib/publishedListingsData";
import { StatusBadge } from "./StatusBadge";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import { Language, t, formatCurrency, formatDateTime } from "../lib/i18n";

interface ListingCardNewProps {
  listing: PublishedListing;
  language: Language;
  onClick: () => void;
  onBoost: () => void;
  onRepost: () => void;
  onViewOnVinted: () => void;
  onCopyLink: () => void;
  onHideToggle: () => void;
}

export function ListingCardNew({
  listing,
  language,
  onClick,
  onBoost,
  onRepost,
  onViewOnVinted,
  onCopyLink,
  onHideToggle,
}: ListingCardNewProps) {
  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger if clicking on buttons
    if ((e.target as HTMLElement).closest("button")) {
      return;
    }
    onClick();
  };

  const primaryStatus = getPrimaryStatus(listing);
  const allStatuses = getListingStatuses(listing);

  return (
    <div
      onClick={handleCardClick}
      className="group rounded-2xl overflow-hidden border dark:border-[rgba(168,85,247,0.25)] border-border dark:bg-[#0E0E14] bg-card cursor-pointer transition-all hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(139,92,246,0.3)]"
    >
      {/* Image area */}
      <div className="relative aspect-square overflow-hidden">
        <img
          src={listing.photos[0]}
          alt={listing.title}
          className={`w-full h-full object-cover ${listing.isHidden ? "opacity-50" : ""}`}
        />
        
        {/* Dark gradient overlay for badge visibility */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-transparent to-transparent pointer-events-none" />
        
        {/* Gradient overlay at bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
        
        {/* Status badges + SKU - top left */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          {allStatuses.slice(0, 2).map((status, index) => (
            <StatusBadge key={index} status={status.type} language={language} size="md" />
          ))}
          
          {/* SKU badge */}
          <Badge className="text-[11px] px-3 py-1.5 h-7 dark:bg-[rgba(14,14,20,0.95)] bg-black/90 dark:text-[#9CA3AF] text-gray-200 border dark:border-[rgba(168,85,247,0.30)] border-white/20 backdrop-blur-sm">
            {listing.sku}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Title */}
        <h3 className={`dark:text-[#E7E7F0] text-foreground truncate mb-3 ${listing.isHidden ? "opacity-60" : ""}`}>
          {listing.title}
        </h3>

        {/* Stats row */}
        <div className="flex items-center gap-4 mb-2 text-sm">
          <div className="flex items-center gap-1.5 dark:text-[#9CA3AF] text-muted-foreground">
            <Eye className="w-4 h-4" />
            <span>{listing.analytics.views}</span>
          </div>
          <div className="flex items-center gap-1.5 dark:text-[#9CA3AF] text-muted-foreground">
            <Heart className="w-4 h-4" />
            <span>{listing.analytics.favorites}</span>
          </div>
          <div className="ml-auto dark:text-[#A78BFA] text-primary">
            {formatCurrency(listing.price, language)}
          </div>
        </div>

        {/* Published date */}
        <div className="text-xs dark:text-[#6B7280] text-muted-foreground mb-4">
          {formatDateTime(listing.publishedDate, language)}
        </div>

        {/* Actions row */}
        <div className="flex items-center gap-2">
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onBoost();
            }}
            size="sm"
            className={`flex-1 rounded-xl gap-2 ${
              listing.boostActive
                ? "dark:bg-[rgba(139,92,246,0.20)] bg-primary/20 dark:text-[#A78BFA] text-primary dark:border-[rgba(168,85,247,0.40)] border-primary/40 border hover:dark:bg-[rgba(139,92,246,0.30)] hover:bg-primary/30"
                : "dark:bg-[#8B5CF6] bg-primary hover:dark:bg-[#7C3AED] hover:bg-primary/90"
            }`}
            style={!listing.boostActive ? {
              boxShadow: "0 0 16px rgba(139,92,246,0.3)"
            } : undefined}
          >
            <TrendingUp className="w-4 h-4" />
            <span>{t(language, "published.button.boost")}</span>
          </Button>

          <Button
            onClick={(e) => {
              e.stopPropagation();
              onRepost();
            }}
            size="sm"
            variant="outline"
            className="flex-1 rounded-xl dark:border-[rgba(168,85,247,0.40)] border-primary dark:text-[#A78BFA] text-primary hover:dark:bg-[rgba(139,92,246,0.10)] hover:bg-primary/10 gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>{t(language, "published.button.repost")}</span>
          </Button>

          {/* Overflow menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                onClick={(e) => e.stopPropagation()}
                size="sm"
                variant="ghost"
                className="rounded-xl dark:text-[#9CA3AF] text-muted-foreground"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="end" 
              className="rounded-xl dark:bg-[#0E0E14] bg-popover border dark:border-[rgba(168,85,247,0.25)] border-border"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onViewOnVinted();
                }}
                className="rounded-lg cursor-pointer"
              >
                {t(language, "published.action.viewOnVinted")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onCopyLink();
                }}
                className="rounded-lg cursor-pointer"
              >
                {t(language, "published.action.copyLink")}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="dark:bg-[rgba(168,85,247,0.15)] bg-border" />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onHideToggle();
                }}
                className="rounded-lg cursor-pointer dark:text-[#9CA3AF] text-muted-foreground"
              >
                {listing.isHidden 
                  ? (language === "fr" ? "Afficher" : "Unhide")
                  : t(language, "published.action.hide")
                }
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
