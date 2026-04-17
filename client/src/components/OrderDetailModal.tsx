import { X } from "lucide-react";
import { Order } from "../lib/ordersData";
import { Language, t, formatCurrency } from "../lib/i18n";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Badge } from "./ui/badge";

interface OrderDetailModalProps {
  order: Order | null;
  onClose: () => void;
  language: Language;
  onMarkProcessed?: (order: Order) => void;
  onGoToChat?: (order: Order) => void;
  onDownloadLabel?: (order: Order) => void;
}

export function OrderDetailModal({
  order,
  onClose,
  language,
  onMarkProcessed,
  onGoToChat,
  onDownloadLabel,
}: OrderDetailModalProps) {
  if (!order) return null;

  const isBundle = order.bundle?.isBundle && order.bundle.items && order.bundle.items.length > 0;
  const netMargin = order.purchaseCost 
    ? order.fees.total - order.purchaseCost 
    : null;
  const netMarginPct = netMargin && order.purchaseCost
    ? ((netMargin / order.purchaseCost) * 100).toFixed(1)
    : null;

  return (
    <Dialog open={!!order} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="max-w-2xl rounded-2xl dark:bg-[#0E0E14] bg-card border dark:border-[rgba(168,85,247,0.25)] border-border overflow-hidden"
        style={{
          boxShadow: "0 0 0 1px rgba(168,85,247,0.25), 0 0 48px rgba(168,85,247,0.15)"
        }}
      >
        <DialogHeader className="border-b dark:border-[rgba(168,85,247,0.25)] border-border pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-xl dark:text-[#E7E7F0] text-foreground">
                {t(language, "orders.modal.title")}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {language === "fr" 
                  ? "Détails de la commande" 
                  : "Order details"}
              </DialogDescription>
              <div className="flex items-center gap-2 mt-2">
                <span className="dark:text-[#9CA3AF] text-muted-foreground text-sm">
                  {order.title}
                </span>
                {order.sku && (
                  <Badge 
                    variant="outline" 
                    className="dark:bg-[rgba(139,92,246,0.10)] bg-primary/10 dark:border-[rgba(168,85,247,0.30)] border-primary/30 dark:text-[#A78BFA] text-primary text-xs"
                  >
                    {order.sku}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 py-6">
          {/* Left: Product Photo */}
          <div className="flex justify-center md:justify-start">
            <img
              src={order.thumbnail}
              alt={order.title}
              className="w-48 h-48 object-cover rounded-2xl border dark:border-[rgba(168,85,247,0.25)] border-border"
            />
          </div>

          {/* Right: Details */}
          <div className="space-y-4">
            {/* Sale Price */}
            <div>
              <div className="text-xs dark:text-[#9CA3AF] text-muted-foreground mb-1">
                {t(language, "orders.modal.salePrice")}
              </div>
              <div className="text-lg dark:text-[#E7E7F0] text-foreground">
                {formatCurrency(order.price, language)}
              </div>
            </div>

            {/* Net Margin */}
            {netMargin !== null && (
              <div>
                <div className="text-xs dark:text-[#9CA3AF] text-muted-foreground mb-1">
                  {t(language, "orders.modal.netMargin")}
                </div>
                <div className="text-lg dark:text-[#2AF07A] text-green-600">
                  {formatCurrency(netMargin, language)}
                  {netMarginPct && (
                    <span className="text-sm ml-2">({netMarginPct}%)</span>
                  )}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div>
              <div className="text-xs dark:text-[#9CA3AF] text-muted-foreground mb-1">
                {t(language, "orders.modal.quantity")}
              </div>
              <div className="text-lg dark:text-[#E7E7F0] text-foreground">
                {order.quantity || 1}
              </div>
            </div>

            {/* Bundle Info */}
            <div>
              <div className="text-xs dark:text-[#9CA3AF] text-muted-foreground mb-1">
                Bundle
              </div>
              {isBundle ? (
                <div className="space-y-2">
                  <div className="text-sm dark:text-[#E7E7F0] text-foreground">
                    {t(language, "orders.modal.bundle.yes").replace("{count}", String(order.bundle!.items!.length))}
                  </div>
                  <div className="space-y-2 mt-2">
                    {order.bundle!.items!.map((item, idx) => (
                      <div 
                        key={idx}
                        className="flex items-center gap-2 p-2 rounded-lg dark:bg-[rgba(139,92,246,0.05)] bg-gray-50 border dark:border-[rgba(168,85,247,0.15)] border-gray-200"
                      >
                        <img 
                          src={item.thumbnail} 
                          alt={item.title}
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs dark:text-[#E7E7F0] text-foreground truncate">
                            {item.title}
                          </div>
                          {item.sku && (
                            <div className="text-xs dark:text-[#9CA3AF] text-muted-foreground">
                              {item.sku}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-sm dark:text-[#9CA3AF] text-muted-foreground">
                  {t(language, "orders.modal.bundle.no")}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t dark:border-[rgba(168,85,247,0.25)] border-border pt-4 flex flex-col sm:flex-row gap-3">
          {/* Mark as Processed */}
          {!order.processed && onMarkProcessed && (
            <Button
              onClick={() => {
                onMarkProcessed(order);
                onClose();
              }}
              className="flex-1 rounded-xl dark:bg-[#8B5CF6] bg-primary hover:dark:bg-[#7C3AED] hover:bg-primary/90 dark:text-white text-primary-foreground"
              style={{
                boxShadow: "0 0 20px rgba(139,92,246,0.4)"
              }}
            >
              {t(language, "orders.action.markProcessed")}
            </Button>
          )}

          {/* Go to Conversation */}
          {onGoToChat && (
            <Button
              variant="ghost"
              onClick={() => {
                onGoToChat(order);
                onClose();
              }}
              className="flex-1 rounded-xl dark:border-[rgba(168,85,247,0.30)] border-border dark:text-[#E7E7F0] text-foreground hover:dark:bg-[rgba(139,92,246,0.10)] hover:bg-gray-100"
            >
              {t(language, "orders.modal.goToChat")}
            </Button>
          )}

          {/* Download Label (if waiting for label) */}
          {order.status === "waiting_label" && onDownloadLabel && (
            <Button
              variant="ghost"
              onClick={() => {
                onDownloadLabel(order);
              }}
              className="flex-1 rounded-xl dark:border-[rgba(168,85,247,0.30)] border-border dark:text-[#E7E7F0] text-foreground hover:dark:bg-[rgba(139,92,246,0.10)] hover:bg-gray-100"
            >
              {t(language, "orders.action.downloadLabel")}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}