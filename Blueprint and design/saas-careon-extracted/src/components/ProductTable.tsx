import { MoreVertical, Edit, Archive, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Card } from "./ui/card";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { Product, ProductStatus } from "../lib/stockData";
import { Language, t } from "../lib/i18n";

interface ProductTableProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onArchive: (product: Product) => void;
  onDelete: (product: Product) => void;
  onRowClick: (product: Product) => void;
  onOpenDetailModal?: (product: Product) => void;
  language: Language;
}

const statusConfig: Record<
  ProductStatus,
  { label: string; className: string }
> = {
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

export function ProductTable({
  products,
  onEdit,
  onArchive,
  onDelete,
  onRowClick,
  onOpenDetailModal,
  language,
}: ProductTableProps) {

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
    }).format(date);
  };

  const priceLabel = language === "fr" ? "Prix" : "List";
  const costLabel = language === "fr" ? "Coût" : "Cost";

  // Desktop table view
  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:block">
        <div className="rounded-2xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-20"></TableHead>
                <TableHead>{t(language, "stock.columns.title")}</TableHead>
                <TableHead>{t(language, "stock.columns.sku")}</TableHead>
                <TableHead>{t(language, "stock.columns.category")}</TableHead>
                <TableHead>{t(language, "stock.columns.brand")}</TableHead>
                <TableHead>{t(language, "stock.columns.condition")}</TableHead>
                <TableHead>{t(language, "stock.columns.size")}</TableHead>
                <TableHead>{t(language, "stock.columns.price")}</TableHead>
                <TableHead>{t(language, "stock.columns.purchaseCost")}</TableHead>
                <TableHead>{t(language, "stock.columns.quantity")}</TableHead>
                <TableHead>{t(language, "stock.summary.potentialMargin")}</TableHead>
                <TableHead>{t(language, "stock.columns.updated")}</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow
                  key={product.id}
                  className="cursor-pointer hover:bg-muted/20"
                  onClick={() => onRowClick(product)}
                >
                  <TableCell>
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted">
                      {product.photos[0] && (
                        <ImageWithFallback
                          src={product.photos[0]}
                          alt={product.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-foreground line-clamp-2 text-sm max-w-xs">
                      {product.title}
                    </p>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs text-muted-foreground">
                      {product.sku}
                    </code>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {product.category}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-foreground">
                      {product.brand}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-foreground capitalize">
                      {product.condition.replace("_", " ")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-foreground">
                      {product.size}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-foreground">
                      {formatPrice(product.price)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {product.purchaseCost ? formatPrice(product.purchaseCost) : "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {product.quantity || 1}
                    </span>
                  </TableCell>
                  <TableCell>
                    {product.purchaseCost ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm text-foreground">
                          {formatPrice(product.price - product.purchaseCost)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {(((product.price - product.purchaseCost) / product.price) * 100).toFixed(1)}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(product.updatedAt)}
                    </span>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-2xl">
                        <DropdownMenuItem onClick={() => onEdit(product)}>
                          <Edit className="h-4 w-4 mr-2" />
                          {t(language, "stock.actions.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onArchive(product)}>
                          <Archive className="h-4 w-4 mr-2" />
                          {t(language, "stock.actions.archive")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onDelete(product)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t(language, "stock.actions.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-3">
        {products.map((product) => (
          <Card
            key={product.id}
            className="rounded-2xl border border-border p-4 cursor-pointer hover:border-primary/30 transition-colors"
            onClick={() => onRowClick(product)}
          >
            <div className="flex gap-3">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted shrink-0">
                {product.photos[0] && (
                  <ImageWithFallback
                    src={product.photos[0]}
                    alt={product.title}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-foreground line-clamp-2 text-sm">
                    {product.title}
                  </h3>
                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-2xl">
                        <DropdownMenuItem onClick={() => onEdit(product)}>
                          <Edit className="h-4 w-4 mr-2" />
                          {t(language, "stock.actions.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onArchive(product)}>
                          <Archive className="h-4 w-4 mr-2" />
                          {t(language, "stock.actions.archive")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onDelete(product)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t(language, "stock.actions.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <code>{product.sku}</code>
                    <span>•</span>
                    <span>{product.brand}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-foreground">{priceLabel}: {formatPrice(product.price)}</span>
                      {product.purchaseCost && (
                        <span>{costLabel}: {formatPrice(product.purchaseCost)}</span>
                      )}
                    </div>
                    {product.purchaseCost && (
                      <div className="text-right">
                        <div className="text-xs text-primary">
                          +{formatPrice(product.price - product.purchaseCost)}
                        </div>
                        <div className="text-xs">
                          {(((product.price - product.purchaseCost) / product.price) * 100).toFixed(1)}%
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}