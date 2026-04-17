import { useState } from "react";
import { X, Archive, Edit } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Product } from "../lib/stockData";
import { Language, formatCurrency } from "../lib/i18n";

interface ProductDetailsModalProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (product: Product) => void;
  onArchive?: (product: Product) => void;
  language: Language;
}

export function ProductDetailsModal({
  product,
  open,
  onOpenChange,
  onEdit,
  onArchive,
  language,
}: ProductDetailsModalProps) {
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  if (!product) return null;

  const getStatusColor = (status: Product["status"]) => {
    switch (status) {
      case "published":
        return "dark:bg-green-500/20 bg-green-500/10 dark:text-green-400 text-green-600 border-0";
      case "draft":
        return "dark:bg-[#9CA3AF]/20 bg-neutral-200 dark:text-[#9CA3AF] text-neutral-600 border-0";
      case "publishing":
        return "dark:bg-primary/20 bg-primary/10 dark:text-primary text-primary border-0";
      case "failed":
        return "dark:bg-red-500/20 bg-red-500/10 dark:text-red-400 text-red-600 border-0";
      case "archived":
        return "dark:bg-[#9CA3AF]/20 bg-neutral-200 dark:text-[#9CA3AF] text-neutral-500 border-0";
      default:
        return "";
    }
  };

  const getConditionLabel = (condition: Product["condition"]) => {
    switch (condition) {
      case "new_with_tags":
        return language === "fr" ? "Neuf avec étiquettes" : "New with tags";
      case "new":
        return language === "fr" ? "Neuf" : "New";
      case "excellent":
        return language === "fr" ? "Excellent" : "Excellent";
      case "good":
        return language === "fr" ? "Bon" : "Good";
      case "fair":
        return language === "fr" ? "Correct" : "Fair";
      default:
        return condition;
    }
  };

  // Prendre les 3 premières photos
  const displayPhotos = product.photos.slice(0, 3);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
          className="max-h-[88vh] w-[min(720px,92vw)] overflow-hidden p-0 [&>button]:hidden"
          style={{
            boxShadow: "0 0 0 1px rgba(139,92,246,0.25), 0 20px 60px rgba(0,0,0,0.6)",
          }}
        >
          {/* Accessible title (visually hidden) */}
          <DialogTitle className="sr-only">
            {language === "fr" ? "Détails du produit" : "Product details"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {language === "fr" 
              ? `Fiche détaillée du produit ${product.title}`
              : `Detailed information for ${product.title}`}
          </DialogDescription>

          <div className="flex h-full flex-col dark:bg-[#0A0A10] bg-background dark:border-[rgba(168,85,247,0.25)] border-border rounded-xl">
            {/* Header - Fixed */}
            <div className="flex-shrink-0 border-b dark:border-[rgba(168,85,247,0.15)] border-border px-4 py-3">
              <div className="flex items-center justify-between gap-4 mb-2">
                <h2 className="flex-1 pr-4 text-[15px] leading-tight truncate dark:text-[#E7E7F0] text-foreground font-semibold">
                  {product.title}
                </h2>
                <button
                  onClick={() => onOpenChange(false)}
                  className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center dark:text-[#9CA3AF] text-muted-foreground dark:hover:bg-[rgba(139,92,246,0.15)] hover:bg-primary/10 dark:hover:text-primary hover:text-primary transition-all duration-200"
                  style={{
                    boxShadow: "0 0 0 0 rgba(139,92,246,0)"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = "0 0 12px rgba(139,92,246,0.4)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "0 0 0 0 rgba(139,92,246,0)";
                  }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] font-medium rounded-md dark:bg-primary/20 bg-primary/10 dark:text-primary text-primary border dark:border-primary/30 border-primary/20">
                  SKU: {product.sku}
                </span>
                <span className={`px-2 py-0.5 text-[10px] font-medium rounded-md ${getStatusColor(product.status)}`}>
                  {product.status}
                </span>
              </div>
            </div>

            {/* Body - Compressible but NO SCROLL */}
            <div className="flex-1 overflow-hidden px-4 py-3 space-y-3">
              {/* Galerie photos - 3 carrés compacts */}
              <div className="grid grid-cols-3 gap-2">
                {displayPhotos.map((photo, idx) => (
                  <button
                    key={idx}
                    onClick={() => setLightboxImage(photo)}
                    className="aspect-square rounded-lg overflow-hidden dark:bg-[#1A1A24] bg-muted border dark:border-[rgba(168,85,247,0.25)] border-border transition-all duration-200 hover:scale-[1.02] group relative"
                    style={{
                      boxShadow: "0 0 0 1px rgba(168,85,247,0.15)"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = "0 0 15px rgba(139,92,246,0.4)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = "0 0 0 1px rgba(168,85,247,0.15)";
                    }}
                  >
                    <img
                      src={photo}
                      alt={`${product.title} - Photo ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 dark:bg-primary/0 bg-primary/0 group-hover:dark:bg-primary/10 group-hover:bg-primary/5 transition-colors duration-200" />
                  </button>
                ))}
              </div>

              {/* KPI Row - Compact */}
              <div className="grid grid-cols-3 gap-2">
                <div
                  className="rounded-lg dark:bg-[#0E0E14] bg-card border dark:border-[rgba(168,85,247,0.20)] border-border p-2"
                  style={{ boxShadow: "0 0 0 1px rgba(168,85,247,0.10)" }}
                >
                  <div className="text-[9px] dark:text-[#9CA3AF] text-muted-foreground mb-1 uppercase tracking-wide font-semibold">
                    {language === "fr" ? "Prix de vente" : "Sale price"}
                  </div>
                  <div className="text-[13px] dark:text-primary text-primary font-semibold tabular-nums">
                    {formatCurrency(product.price, language)}
                  </div>
                </div>

                <div
                  className="rounded-lg dark:bg-[#0E0E14] bg-card border dark:border-[rgba(168,85,247,0.20)] border-border p-2"
                  style={{ boxShadow: "0 0 0 1px rgba(168,85,247,0.10)" }}
                >
                  <div className="text-[9px] dark:text-[#9CA3AF] text-muted-foreground mb-1 uppercase tracking-wide font-semibold">
                    {language === "fr" ? "Coût d'achat" : "Purchase cost"}
                  </div>
                  <div className="text-[13px] dark:text-[#E7E7F0] text-foreground font-semibold tabular-nums">
                    {product.purchaseCost ? formatCurrency(product.purchaseCost, language) : "—"}
                  </div>
                </div>

                <div
                  className="rounded-lg dark:bg-[#0E0E14] bg-card border dark:border-[rgba(168,85,247,0.20)] border-border p-2"
                  style={{ boxShadow: "0 0 0 1px rgba(168,85,247,0.10)" }}
                >
                  <div className="text-[9px] dark:text-[#9CA3AF] text-muted-foreground mb-1 uppercase tracking-wide font-semibold">
                    {language === "fr" ? "Dernier prix" : "Last price"}
                  </div>
                  <div className="text-[13px] dark:text-purple-400 text-purple-600 font-semibold tabular-nums">
                    {product.lastPrice ? formatCurrency(product.lastPrice, language) : "—"}
                  </div>
                </div>
              </div>

              {/* 2 Columns Layout - Compact */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                {/* Left Column */}
                <div className="space-y-2.5">
                  {/* Titre Bloc */}
                  <div
                    className="rounded-lg dark:bg-[#0E0E14] bg-card border dark:border-[rgba(168,85,247,0.20)] border-border p-2.5"
                    style={{ boxShadow: "0 0 0 1px rgba(168,85,247,0.10)" }}
                  >
                    <h3 className="text-[9px] font-semibold dark:text-[#9CA3AF] text-muted-foreground uppercase tracking-wider mb-1.5">
                      {language === "fr" ? "Titre" : "Title"}
                    </h3>
                    <p className="text-[12px] dark:text-[#E7E7F0] text-foreground leading-relaxed line-clamp-2">
                      {product.title}
                    </p>
                  </div>

                  {/* Description Bloc - Limited to 3 lines */}
                  <div
                    className="rounded-lg dark:bg-[#0E0E14] bg-card border dark:border-[rgba(168,85,247,0.20)] border-border p-2.5"
                    style={{ boxShadow: "0 0 0 1px rgba(168,85,247,0.10)" }}
                  >
                    <h3 className="text-[9px] font-semibold dark:text-[#9CA3AF] text-muted-foreground uppercase tracking-wider mb-1.5">
                      {language === "fr" ? "Description" : "Description"}
                    </h3>
                    <p className="text-[12px] dark:text-[#E7E7F0] text-foreground leading-relaxed line-clamp-3">
                      {product.description}
                    </p>
                    {product.description.length > 120 && (
                      <button
                        onClick={() => setShowFullDescription(true)}
                        className="mt-1 text-[10px] dark:text-primary text-primary hover:underline font-medium"
                      >
                        {language === "fr" ? "Voir plus" : "See more"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Right Column - Product Details */}
                <div
                  className="rounded-lg dark:bg-[#0E0E14] bg-card border dark:border-[rgba(168,85,247,0.20)] border-border p-2.5"
                  style={{ boxShadow: "0 0 0 1px rgba(168,85,247,0.10)" }}
                >
                  <h3 className="text-[9px] font-semibold dark:text-[#9CA3AF] text-muted-foreground uppercase tracking-wider mb-2">
                    {language === "fr" ? "Détails produit" : "Product details"}
                  </h3>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                    <DetailItemCompact
                      label={language === "fr" ? "Catégorie" : "Category"}
                      value={product.category}
                    />
                    <DetailItemCompact
                      label={language === "fr" ? "Marque" : "Brand"}
                      value={product.brand}
                    />
                    <DetailItemCompact
                      label={language === "fr" ? "Taille" : "Size"}
                      value={product.size}
                    />
                    <DetailItemCompact
                      label={language === "fr" ? "État" : "Condition"}
                      value={getConditionLabel(product.condition)}
                    />
                    <DetailItemCompact
                      label={language === "fr" ? "Matière" : "Material"}
                      value={product.material.slice(0, 2).join(", ")}
                    />
                    <div>
                      <div className="text-[9px] dark:text-[#9CA3AF] text-muted-foreground uppercase tracking-wider mb-1 font-semibold">
                        {language === "fr" ? "Couleurs" : "Colors"}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {product.colors.slice(0, 2).map((color, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 text-[9px] rounded dark:bg-primary/20 bg-primary/10 dark:text-primary text-primary font-medium"
                          >
                            {color}
                          </span>
                        ))}
                        {product.colors.length > 2 && (
                          <span className="px-1.5 py-0.5 text-[9px] rounded dark:bg-[#1A1A24] bg-muted dark:text-[#9CA3AF] text-muted-foreground font-medium">
                            +{product.colors.length - 2}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Internal Notes (if exists) - Compact */}
              {product.internalNotes && (
                <div
                  className="rounded-lg dark:bg-[#0E0E14] bg-card border dark:border-[rgba(168,85,247,0.20)] border-border p-2.5"
                  style={{ boxShadow: "0 0 0 1px rgba(168,85,247,0.10)" }}
                >
                  <h3 className="text-[9px] font-semibold dark:text-[#9CA3AF] text-muted-foreground uppercase tracking-wider mb-1.5">
                    {language === "fr" ? "Notes internes" : "Internal notes"}
                  </h3>
                  <p className="text-[12px] dark:text-[#E7E7F0] text-foreground leading-relaxed line-clamp-2">
                    {product.internalNotes}
                  </p>
                </div>
              )}
            </div>

            {/* Footer - Fixed, Always Visible */}
            <div className="flex-shrink-0 border-t dark:border-[rgba(168,85,247,0.15)] border-border px-4 py-2.5 dark:bg-[#08080C] bg-background">
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => onOpenChange(false)}
                  className="px-3.5 py-1.5 text-[12px] font-medium dark:text-[#E7E7F0] text-foreground hover:dark:bg-[#1A1A24] hover:bg-muted/50 rounded-lg transition-colors"
                >
                  {language === "fr" ? "Annuler" : "Cancel"}
                </button>
                {onArchive && product.status !== "archived" && (
                  <button
                    onClick={() => {
                      onArchive(product);
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-medium rounded-lg dark:bg-[#1A1A24] bg-muted border dark:border-[rgba(168,85,247,0.20)] border-border dark:text-[#E7E7F0] text-foreground transition-all duration-200 hover:dark:bg-[#242430] hover:bg-muted/70"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    {language === "fr" ? "Archiver" : "Archive"}
                  </button>
                )}
                {onEdit && (
                  <button
                    onClick={() => {
                      onEdit(product);
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-[12px] rounded-lg dark:bg-primary bg-primary dark:text-white text-white font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      boxShadow: "0 0 20px rgba(139,92,246,0.3)",
                    }}
                  >
                    <Edit className="w-3.5 h-3.5" />
                    {language === "fr" ? "Modifier" : "Edit"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox pour afficher une photo en grand */}
      {lightboxImage && (
        <Dialog open={!!lightboxImage} onOpenChange={() => setLightboxImage(null)}>
          <DialogContent 
            className="max-w-4xl max-h-[90vh] p-0 dark:bg-[#0A0A10] bg-background dark:border-[rgba(168,85,247,0.25)] border-border [&>button]:hidden"
            style={{
              boxShadow: "0 0 0 1px rgba(139,92,246,0.25), 0 20px 60px rgba(0,0,0,0.6)",
            }}
          >
            <DialogTitle className="sr-only">
              {language === "fr" ? "Photo du produit" : "Product photo"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {language === "fr" ? "Vue agrandie de la photo" : "Enlarged photo view"}
            </DialogDescription>

            <div className="relative rounded-xl overflow-hidden">
              <img
                src={lightboxImage}
                alt={product.title}
                className="w-full h-auto max-h-[85vh] object-contain"
              />
              <button
                onClick={() => setLightboxImage(null)}
                className="absolute top-4 right-4 w-10 h-10 rounded-lg flex items-center justify-center dark:bg-black/60 bg-white/90 dark:text-white text-foreground backdrop-blur-sm hover:dark:bg-primary hover:bg-primary transition-all duration-200"
                style={{
                  boxShadow: "0 0 20px rgba(139,92,246,0.4)"
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Secondary Modal for Full Description */}
      {showFullDescription && (
        <Dialog open={showFullDescription} onOpenChange={setShowFullDescription}>
          <DialogContent 
            className="max-w-2xl dark:bg-[#0A0A10] bg-background dark:border-[rgba(168,85,247,0.25)] border-border [&>button]:hidden"
            style={{
              boxShadow: "0 0 0 1px rgba(139,92,246,0.25), 0 20px 60px rgba(0,0,0,0.6)",
            }}
          >
            <DialogTitle className="sr-only">
              {language === "fr" ? "Description complète" : "Full description"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {language === "fr" 
                ? "Description complète du produit"
                : "Full product description"}
            </DialogDescription>

            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="dark:text-[#E7E7F0] text-foreground">
                  {language === "fr" ? "Description complète" : "Full description"}
                </h3>
                <button
                  onClick={() => setShowFullDescription(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center dark:text-[#9CA3AF] text-muted-foreground dark:hover:bg-[#1A1A24] hover:bg-muted/50 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[13px] dark:text-[#E7E7F0] text-foreground leading-relaxed whitespace-pre-wrap">
                {product.description}
              </p>
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowFullDescription(false)}
                  className="px-5 py-2 text-[13px] rounded-lg dark:bg-primary bg-primary dark:text-white text-white font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    boxShadow: "0 0 20px rgba(139,92,246,0.3)",
                  }}
                >
                  {language === "fr" ? "Fermer" : "Close"}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function DetailItemCompact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] dark:text-[#9CA3AF] text-muted-foreground uppercase tracking-wider mb-1 font-semibold">
        {label}
      </div>
      <div className="text-[12px] dark:text-[#E7E7F0] text-foreground leading-relaxed">
        {value}
      </div>
    </div>
  );
}