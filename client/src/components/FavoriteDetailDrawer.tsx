import { X, ExternalLink, Share2, Tag } from "lucide-react";
import { Favorite, getTimeAgo } from "../lib/favoritesData";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { ImageWithFallback } from "./figma/ImageWithFallback";

interface FavoriteDetailDrawerProps {
  favorite: Favorite | null;
  onClose: () => void;
}

export function FavoriteDetailDrawer({ favorite, onClose }: FavoriteDetailDrawerProps) {
  if (!favorite) return null;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  // Mock recent favorites for this item
  const recentFavorites = [
    { user: favorite.userHandle, time: getTimeAgo(favorite.timestamp) },
    { user: "@jean_style", time: "2h ago" },
    { user: "@nina_fashion", time: "5h ago" },
  ];

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-[480px] bg-background border-l border-border z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-foreground mb-1">Item Details</h2>
            <p className="text-muted-foreground text-sm">{favorite.itemId}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-xl"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {/* Item Preview */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="mb-4">
                <div className="w-full aspect-square rounded-xl overflow-hidden bg-muted">
                  <ImageWithFallback
                    src={favorite.itemThumbnail}
                    alt={favorite.itemTitle}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-foreground mb-2">
                    {favorite.itemTitle}
                  </p>
                  {favorite.itemSku && (
                    <Badge variant="outline" className="text-[11px] px-2 py-0.5 h-5 mb-2">
                      {favorite.itemSku}
                    </Badge>
                  )}
                  <p className="text-foreground">
                    {formatPrice(favorite.itemPrice)}
                  </p>
                </div>

                {/* Account */}
                <div className="pt-3 border-t border-border">
                  <p className="text-muted-foreground text-sm mb-2">Account</p>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-primary/10 text-primary border border-primary/20">
                      {favorite.accountInitial}
                    </span>
                    <span className="text-foreground">{favorite.accountName}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Latest Favorite */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-muted-foreground text-sm mb-3">Latest Favorite</p>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-fuchsia-500 flex items-center justify-center text-white flex-shrink-0">
                  {favorite.userName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground">{favorite.userName}</p>
                  <p className="text-muted-foreground text-sm">{favorite.userHandle}</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    {getTimeAgo(favorite.timestamp)}
                  </p>
                </div>
              </div>
            </div>

            {/* Recent Favorites */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-muted-foreground text-sm mb-3">
                Recent Favorites ({recentFavorites.length})
              </p>
              <div className="space-y-3">
                {recentFavorites.map((fav, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{fav.user}</span>
                    <span className="text-muted-foreground text-xs">{fav.time}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full rounded-xl gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Open on Vinted
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full rounded-xl gap-2"
              >
                <Share2 className="w-4 h-4" />
                Share Item
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full rounded-xl gap-2"
              >
                <Tag className="w-4 h-4" />
                Make an Offer
              </Button>
            </div>
          </div>
        </ScrollArea>
      </div>
    </>
  );
}
