import { ChevronRight } from "lucide-react";
import { Favorite, getTimeAgo } from "../lib/favoritesData";
import { Badge } from "./ui/badge";
import { ImageWithFallback } from "./figma/ImageWithFallback";

interface FavoriteRowProps {
  favorite: Favorite;
  showAccountChip: boolean;
  onClick: () => void;
}

export function FavoriteRow({ favorite, showAccountChip, onClick }: FavoriteRowProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-4 p-4 hover:bg-muted/50 transition-colors border-b border-border last:border-b-0 text-left"
    >
      {/* Thumbnail */}
      <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-muted">
        <ImageWithFallback
          src={favorite.itemThumbnail}
          alt={favorite.itemTitle}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1.5">
        {/* Ligne 1: User handle + action */}
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-foreground font-medium break-all">
            {favorite.userHandle}
          </span>
          <span className="text-muted-foreground text-sm whitespace-nowrap">
            a ajouté en favoris
          </span>
        </div>

        {/* Ligne 2: Item title (1 line max with ellipsis) */}
        <p className="text-foreground line-clamp-1 text-sm">
          {favorite.itemTitle}
        </p>

        {/* Ligne 3: Price + SKU badge + Account name chip */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Price */}
          <span className="text-muted-foreground text-xs font-medium">
            {formatPrice(favorite.itemPrice)}
          </span>
          
          {/* SKU Badge - Highly visible violet */}
          {favorite.itemSku && (
            <Badge 
              variant="outline" 
              className="px-2 py-0.5 h-5 text-xs font-medium border-primary/40 bg-primary/10 text-primary dark:border-primary/50 dark:bg-primary/15 dark:text-primary/90"
              style={{
                boxShadow: "0 0 8px rgba(139, 92, 246, 0.15)"
              }}
            >
              SKU: {favorite.itemSku}
            </Badge>
          )}
          
          {/* Account name chip - Subtle neutral */}
          {showAccountChip && (
            <Badge 
              variant="outline"
              className="px-2 py-0.5 h-5 text-xs font-medium border-border/60 bg-muted/30 text-muted-foreground dark:border-border/40 dark:bg-muted/20 dark:text-muted-foreground max-w-[180px] truncate"
            >
              {favorite.accountName}
            </Badge>
          )}
        </div>
      </div>

      {/* Timestamp + Chevron */}
      <div className="flex flex-col items-end gap-2 flex-shrink-0 pt-0.5">
        <span className="text-muted-foreground text-xs whitespace-nowrap">
          {getTimeAgo(favorite.timestamp)}
        </span>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </div>
    </button>
  );
}