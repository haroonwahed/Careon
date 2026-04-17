import { X, ExternalLink, Printer, User, MapPin, Package, Truck, CheckCircle, Clock, Mail, XCircle, RotateCcw } from "lucide-react";
import { Order, getStatusLabel } from "../lib/ordersData";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { ImageWithFallback } from "./figma/ImageWithFallback";

interface OrderDetailDrawerProps {
  order: Order | null;
  onClose: () => void;
}

export function OrderDetailDrawer({ order, onClose }: OrderDetailDrawerProps) {
  if (!order) return null;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const getTimelineIcon = (iconName: string) => {
    const iconMap: Record<string, any> = {
      check: CheckCircle,
      mail: Mail,
      package: Package,
      truck: Truck,
      "check-circle": CheckCircle,
      "x-circle": XCircle,
      "rotate-ccw": RotateCcw,
    };
    return iconMap[iconName] || Clock;
  };

  const getStatusColor = () => {
    if (order.category === "finished") return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    if (order.category === "cancelled") return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
    if (order.status === "return_initiated") return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    return "bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/20";
  };

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
            <h2 className="text-foreground mb-1">Order Details</h2>
            <p className="text-muted-foreground text-sm">{order.orderId}</p>
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
              <div className="flex gap-4 mb-4">
                <div className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-muted">
                  <ImageWithFallback
                    src={order.thumbnail}
                    alt={order.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground mb-2 line-clamp-2">
                    {order.title}
                  </p>
                  {order.sku && (
                    <Badge variant="outline" className="text-[11px] px-2 py-0.5 h-5 mb-2">
                      {order.sku}
                    </Badge>
                  )}
                  <p className="text-foreground">
                    {formatPrice(order.price)}
                  </p>
                </div>
              </div>

              {/* Status */}
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${getStatusColor()}`}>
                {getStatusLabel(order.status)}
              </div>
            </div>

            {/* Account */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-muted-foreground text-sm mb-2">Account</p>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-primary/10 text-primary border border-primary/20">
                  {order.accountInitial}
                </span>
                <span className="text-foreground">{order.accountName}</span>
              </div>
            </div>

            {/* Buyer Info */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-muted-foreground text-sm mb-3">Buyer</p>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-fuchsia-500 flex items-center justify-center text-white">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-foreground">{order.buyer.name}</p>
                  <p className="text-muted-foreground text-sm">{order.buyer.username}</p>
                </div>
              </div>

              {/* Shipping Address */}
              {order.shippingAddress && (
                <div className="pt-3 border-t border-border">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="text-foreground">{order.shippingAddress.street}</p>
                      <p className="text-foreground">
                        {order.shippingAddress.postalCode} {order.shippingAddress.city}
                      </p>
                      <p className="text-muted-foreground">{order.shippingAddress.country}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Timeline */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-muted-foreground text-sm mb-4">Status Timeline</p>
              <div className="space-y-4">
                {order.timeline.map((event, index) => {
                  const Icon = getTimelineIcon(event.icon);
                  const isLast = index === order.timeline.length - 1;
                  
                  return (
                    <div key={index} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isLast 
                            ? "bg-primary/10 text-primary border border-primary/20" 
                            : "bg-muted text-muted-foreground border border-border"
                        }`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        {index < order.timeline.length - 1 && (
                          <div className="w-px h-full bg-border mt-1" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <p className={`text-sm mb-1 ${isLast ? "text-foreground" : "text-muted-foreground"}`}>
                          {event.status}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {formatDate(event.timestamp)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Order Totals */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-muted-foreground text-sm mb-3">Order Summary</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Item price</span>
                  <span className="text-foreground">{formatPrice(order.fees.itemPrice)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping fee</span>
                  <span className="text-foreground">{formatPrice(order.fees.shippingFee)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Service fee</span>
                  <span className="text-foreground">-{formatPrice(order.fees.serviceFee)}</span>
                </div>
                <div className="pt-2 border-t border-border flex justify-between">
                  <span className="text-foreground">Your earnings</span>
                  <span className="text-foreground">{formatPrice(order.fees.total)}</span>
                </div>
              </div>
            </div>

            {/* Timestamps */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span className="text-foreground">{formatDate(order.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last updated</span>
                  <span className="text-foreground">{formatDate(order.updatedAt)}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full rounded-xl gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Open in Vinted
              </Button>
              
              {order.status !== "waiting_label" && order.category !== "cancelled" && (
                <Button 
                  variant="outline" 
                  className="w-full rounded-xl gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Print Label
                </Button>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>
    </>
  );
}
