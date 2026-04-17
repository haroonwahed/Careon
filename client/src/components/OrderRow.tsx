import { ChevronRight, Download, Package, Truck } from "lucide-react";
import { Order, getStatusLabel } from "../lib/ordersData";
import { Badge } from "./ui/badge";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { Button } from "./ui/button";
import { Language, t } from "../lib/i18n";

interface OrderRowProps {
  order: Order;
  showAccountChip: boolean;
  language: Language;
  onClick: () => void;
  onDownloadLabel?: () => void;
  onAddToStock?: () => void;
  onTracking?: () => void;
  onAddTracking?: () => void;
  isPurchase?: boolean;
}

export function OrderRow({ 
  order, 
  showAccountChip, 
  language,
  onClick,
  onDownloadLabel,
  onAddToStock,
  onTracking,
  onAddTracking,
  isPurchase = false,
}: OrderRowProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(language === "fr" ? "fr-FR" : "en-US", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = () => {
    if (order.category === "finished") return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    if (order.category === "cancelled") return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
    if (order.status === "return_initiated") return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    return "bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/20";
  };

  // Determine if we should show action buttons
  const showDownloadLabel = order.type === "sale" && order.status === "waiting_label" && onDownloadLabel;
  const showAddToStock = isPurchase && 
    (order.status === "shipped" || order.status === "in_transit") && 
    onAddToStock;
  
  // Tracking buttons for purchases
  const hasTracking = !!order.timeline && order.timeline.length > 0;
  const showTrackingButton = isPurchase && hasTracking && onTracking;
  const showAddTrackingButton = isPurchase && !hasTracking && order.status !== "delivered" && onAddTracking;

  // Get the appropriate date label
  const getDateLabel = () => {
    if (order.status === "delivered") {
      return language === "fr" ? `Livré le ${formatDate(order.updatedAt)}` : `Delivered on ${formatDate(order.updatedAt)}`;
    } else if (order.status === "shipped" || order.status === "in_transit") {
      return language === "fr" ? `Expédié le ${formatDate(order.updatedAt)}` : `Shipped on ${formatDate(order.updatedAt)}`;
    } else {
      return language === "fr" ? `Acheté le ${formatDate(order.createdAt)}` : `Purchased on ${formatDate(order.createdAt)}`;
    }
  };

  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  return (
    <div className="w-full flex items-center gap-4 p-4 hover:bg-primary/5 hover:bg-muted/50 transition-colors border-b border-border last:border-b-0">
      {/* Main clickable area */}
      <button
        onClick={onClick}
        className="flex items-center gap-4 flex-1 min-w-0 text-left"
      >
        {/* Thumbnail */}
        <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-muted">
          <ImageWithFallback
            src={order.thumbnail}
            alt={order.title}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title + SKU */}
          <div className="flex items-start gap-2 mb-1">
            <p className="text-foreground line-clamp-1">
              {order.title}
            </p>
            {order.sku && (
              <Badge 
                variant="outline" 
                className="text-[11px] px-1.5 py-0 h-5 flex-shrink-0 bg-primary/10 border-primary/30 text-primary"
              >
                {order.sku}
              </Badge>
            )}
          </div>

          {/* Price */}
          <p className="text-foreground mb-1">
            {formatPrice(order.price)}
          </p>

          {/* Seller/Buyer + Account + Status */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Seller (for purchases) or Buyer (for sales) */}
            {isPurchase && order.seller ? (
              <span className="text-[11px] text-muted-foreground">
                {language === "fr" ? "Vendeur :" : "Seller:"} {order.seller.name}
              </span>
            ) : !isPurchase && order.buyer ? (
              <span className="text-[11px] text-muted-foreground">
                {language === "fr" ? "Acheteur :" : "Buyer:"} {order.buyer.name}
              </span>
            ) : null}

            {/* Account chip with full name */}
            {showAccountChip && (
              <Badge 
                variant="outline"
                className="text-[11px] px-2 py-0.5 h-5 bg-primary/5 border-primary/20 border-primary/20 text-primary"
              >
                {order.accountName}
              </Badge>
            )}
            
            {/* Status */}
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[11px] ${getStatusColor()}`}>
              {getStatusLabel(order.status, language)}
            </span>
          </div>

          {/* Date */}
          {isPurchase && (
            <div className="mt-1">
              <span className="text-[10px] text-muted-foreground">
                {getDateLabel()}
              </span>
            </div>
          )}
        </div>
      </button>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Tracking Button (for purchases with tracking) */}
        {showTrackingButton && (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => handleActionClick(e, onTracking!)}
            className="h-9 px-3 gap-2 rounded-xl border-border text-foreground hover:bg-primary/10 hover:bg-gray-100 transition-all duration-200"
          >
            <Truck className="w-4 h-4" />
            <span className="hidden sm:inline">
              {language === "fr" ? "Suivi" : "Tracking"}
            </span>
          </Button>
        )}

        {/* Add Tracking Button (for purchases without tracking) */}
        {showAddTrackingButton && (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => handleActionClick(e, onAddTracking!)}
            className="h-9 px-3 gap-2 rounded-xl border-border text-foreground hover:bg-primary/10 hover:bg-gray-100 transition-all duration-200"
          >
            <Truck className="w-4 h-4" />
            <span className="hidden sm:inline">
              {language === "fr" ? "Ajouter le suivi" : "Add tracking"}
            </span>
          </Button>
        )}

        {/* Download Label Button (Sales with "waiting_label" status) */}
        {showDownloadLabel && (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => handleActionClick(e, onDownloadLabel!)}
            className="h-9 px-3 gap-2 rounded-xl border-border text-foreground hover:bg-primary/10 hover:bg-gray-100 transition-all duration-200"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">
              {t(language, "orders.sales.action.downloadLabel")}
            </span>
          </Button>
        )}

        {/* Add to Stock Button (Purchases shipped/in_transit) */}
        {showAddToStock && (
          <Button
            onClick={(e) => handleActionClick(e, onAddToStock!)}
            className="h-9 px-4 gap-2 rounded-xl dark:bg-primary dark:hover:bg-primary/90 text-white shadow-md dark:shadow-[0_2px_12px_rgba(124,58,237,0.25)] shadow-primary/20 hover:shadow-lg dark:hover:shadow-[0_4px_16px_rgba(124,58,237,0.35)] hover:shadow-primary/30 transition-all duration-200 hover:-translate-y-0.5"
          >
            <Package className="w-4 h-4" />
            <span className="hidden sm:inline">
              {language === "fr" ? "Ajouter au stock" : "Add to stock"}
            </span>
          </Button>
        )}

        {/* Chevron - always visible */}
        <ChevronRight className="w-5 h-5 text-muted-foreground" />
      </div>
    </div>
  );
}
