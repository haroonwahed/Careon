import { X, Edit, Archive, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { Product } from "../lib/stockData";
import { Language, t } from "../lib/i18n";

interface ProductDetailPanelProps {
  product: Product;
  onClose: () => void;
  onEdit: () => void;
  onArchive: () => void;
  language: Language;
}

const statusConfig = {
  draft: {
    label: "Draft",
    className: "bg-muted/50 text-muted-foreground border-muted",
  },
  publishing: {
    label: "Publishing",
    className: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  },
  published: {
    label: "Published",
    className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  },
  failed: {
    label: "Failed",
    className: "bg-red-500/20 text-red-400 border-red-500/30",
  },
  archived: {
    label: "Archived",
    className: "bg-muted/30 text-muted-foreground/70 border-muted/50",
  },
};

export function ProductDetailPanel({
  product,
  onClose,
  onEdit,
  onArchive,
  language,
}: ProductDetailPanelProps) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const formatPrice = (price: number) => {
    const locale = language === "fr" ? "fr-FR" : "en-GB";
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  const formatDate = (date: Date) => {
    const locale = language === "fr" ? "fr-FR" : "en-GB";
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const nextPhoto = () => {
    setCurrentPhotoIndex((prev) =>
      prev < product.photos.length - 1 ? prev + 1 : 0
    );
  };

  const prevPhoto = () => {
    setCurrentPhotoIndex((prev) =>
      prev > 0 ? prev - 1 : product.photos.length - 1
    );
  };

  return (
    <div className="fixed right-0 top-0 h-screen w-full sm:w-96 lg:w-[28rem] bg-card border-l border-border z-50 flex flex-col shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="text-foreground">{language === "fr" ? "Détails du produit" : "Product details"}</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="rounded-xl"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Photo carousel */}
          {product.photos.length > 0 && (
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-muted">
              <ImageWithFallback
                src={product.photos[currentPhotoIndex]}
                alt={product.title}
                className="w-full h-full object-cover"
              />
              {product.photos.length > 1 && (
                <>
                  <button
                    onClick={prevPhoto}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={nextPhoto}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {product.photos.map((_, index) => (
                      <div
                        key={index}
                        className={`w-1.5 h-1.5 rounded-full transition-colors ${
                          index === currentPhotoIndex
                            ? "bg-white"
                            : "bg-white/40"
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Title and price */}
          <div>
            <div className="flex items-start justify-between gap-3 mb-2">
              <h2 className="text-foreground">{product.title}</h2>
              <Badge
                variant="outline"
                className={`${statusConfig[product.status].className} rounded-xl shrink-0`}
              >
                {statusConfig[product.status].label}
              </Badge>
            </div>
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <p className="text-foreground">{formatPrice(product.price)}</p>
                <span className="text-xs text-muted-foreground">{language === "fr" ? "Prix de vente" : "List price"}</span>
              </div>
              {product.purchaseCost !== undefined && (
                <div className="flex items-baseline gap-2">
                  <p className="text-muted-foreground">{formatPrice(product.purchaseCost)}</p>
                  <span className="text-xs text-muted-foreground">{t(language, "stock.fields.purchaseCost")}</span>
                </div>
              )}
              {product.purchaseCost !== undefined && (
                <div className="flex items-baseline gap-2">
                  <p className="text-primary">{formatPrice(product.price - product.purchaseCost)}</p>
                  <span className="text-xs text-primary">
                    {t(language, "stock.summary.potentialMargin")} ({(((product.price - product.purchaseCost) / product.price) * 100).toFixed(1)}%)
                  </span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {language === "fr" ? "Frais" : "Fee"}: {formatPrice(product.price * 0.05)} • {language === "fr" ? "Acheteur paie" : "Buyer pays"}:{" "}
              {formatPrice(product.price * 1.05)}
            </p>
          </div>

          <Separator />

          {/* Metadata */}
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-y-3">
              <div>
                <p className="text-muted-foreground text-xs">{t(language, "stock.columns.sku")}</p>
                <code className="text-foreground text-xs">{product.sku}</code>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t(language, "stock.columns.category")}</p>
                <p className="text-foreground">{product.category}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t(language, "stock.columns.brand")}</p>
                <p className="text-foreground">{product.brand}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t(language, "stock.columns.size")}</p>
                <p className="text-foreground">{product.size}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t(language, "stock.columns.condition")}</p>
                <p className="text-foreground capitalize">
                  {product.condition.replace("_", " ")}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t(language, "stock.columns.packageSize")}</p>
                <p className="text-foreground uppercase">
                  {product.packageSize}
                </p>
              </div>
              {product.quantity !== undefined && product.quantity !== 1 && (
                <div>
                  <p className="text-muted-foreground text-xs">{t(language, "stock.columns.quantity")}</p>
                  <p className="text-foreground">{product.quantity}</p>
                </div>
              )}
            </div>

            {product.material.length > 0 && (
              <div>
                <p className="text-muted-foreground text-xs mb-1">{t(language, "stock.columns.material")}</p>
                <p className="text-foreground">{product.material.join(", ")}</p>
              </div>
            )}

            {product.description && (
              <div>
                <p className="text-muted-foreground text-xs mb-1">{t(language, "stock.fields.description")}</p>
                <p className="text-foreground whitespace-pre-wrap">
                  {product.description}
                </p>
              </div>
            )}

            {product.internalNotes && (
              <div>
                <p className="text-muted-foreground text-xs mb-1">
                  {t(language, "stock.fields.notes")}
                </p>
                <p className="text-foreground whitespace-pre-wrap bg-muted/30 p-3 rounded-xl">
                  {product.internalNotes}
                </p>
              </div>
            )}
          </div>

          <Separator />

          {/* Activity */}
          <div className="space-y-3">
            <p className="text-muted-foreground text-xs">{language === "fr" ? "Activité" : "Activity"}</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{language === "fr" ? "Créé" : "Created"}</span>
                <span className="text-foreground">
                  {formatDate(product.createdAt)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{language === "fr" ? "Dernière mise à jour" : "Last updated"}</span>
                <span className="text-foreground">
                  {formatDate(product.updatedAt)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Actions */}
      <div className="p-4 border-t border-border space-y-2">
        <Button
          onClick={onEdit}
          className="w-full rounded-2xl bg-primary hover:bg-primary/90 gap-2"
        >
          <Edit className="h-4 w-4" />
          {t(language, "stock.actions.edit")}
        </Button>
        <Button
          onClick={onArchive}
          variant="outline"
          className="w-full rounded-2xl gap-2"
        >
          <Archive className="h-4 w-4" />
          {t(language, "stock.actions.archive")}
        </Button>
      </div>
    </div>
  );
}
