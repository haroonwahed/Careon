import { useState } from "react";
import { Plus, Search, Package as PackageIcon } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { ProductTable } from "./ProductTable";
import { ProductFormDialog } from "./ProductFormDialog";
import { ProductDetailsModal } from "./ProductDetailsModal";
import { EmptyState } from "./EmptyState";
import { InventorySummary } from "./InventorySummary";
import { MOCK_PRODUCTS, Product, ProductStatus } from "../lib/stockData";
import { toast } from "sonner@2.0.3";
import { Language, t } from "../lib/i18n";

interface StockManagerPageProps {
  language: Language;
}

export function StockManagerPage({ language }: StockManagerPageProps) {
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProductStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("updated");
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [detailModalProduct, setDetailModalProduct] = useState<Product | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Filter products
  const filteredProducts = products.filter((product) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !product.title.toLowerCase().includes(query) &&
        !product.sku.toLowerCase().includes(query)
      ) {
        return false;
      }
    }

    // Status filter
    if (statusFilter !== "all") {
      if (product.status !== statusFilter) {
        return false;
      }
    }

    // Category filter
    if (categoryFilter !== "all") {
      if (product.category !== categoryFilter) {
        return false;
      }
    }

    return true;
  });

  // Sort products
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case "updated":
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      case "price":
        return b.price - a.price;
      case "cost":
        return (b.purchaseCost || 0) - (a.purchaseCost || 0);
      case "margin":
        const marginA = a.purchaseCost ? ((a.price - a.purchaseCost) / a.price) * 100 : 0;
        const marginB = b.purchaseCost ? ((b.price - b.purchaseCost) / b.price) * 100 : 0;
        return marginB - marginA;
      case "title":
        return a.title.localeCompare(b.title);
      case "sku":
        return a.sku.localeCompare(b.sku);
      default:
        return 0;
    }
  });

  const handleAddProduct = () => {
    setEditingProduct(null);
    setProductFormOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductFormOpen(true);
  };

  const handleSaveProduct = (product: Product) => {
    if (editingProduct) {
      // Update existing
      setProducts(
        products.map((p) => (p.id === product.id ? product : p))
      );
      toast.success(t(language, "toast.productUpdated"));
    } else {
      // Add new
      setProducts([product, ...products]);
      toast.success(t(language, "toast.productAdded"));
    }
    setProductFormOpen(false);
    setEditingProduct(null);
  };

  const handleArchiveProduct = (product: Product) => {
    setProducts(
      products.map((p) =>
        p.id === product.id
          ? { ...p, status: "archived" as ProductStatus, updatedAt: new Date() }
          : p
      )
    );
    toast.success(t(language, "toast.productUpdated"));
  };

  const handleDeleteProduct = (product: Product) => {
    setProducts(products.filter((p) => p.id !== product.id));
    toast.success(t(language, "toast.productDeleted"));
  };

  const handleRowClick = (product: Product) => {
    setDetailModalProduct(product);
    setDetailModalOpen(true);
  };

  const handleOpenDetailModal = (product: Product) => {
    setDetailModalProduct(product);
    setDetailModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    setDetailModalProduct(null);
    setDetailModalOpen(false);
  };

  return (
    <>
      {/* Header */}
      <div className="border-b border-border bg-background pb-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-foreground mb-2">{t(language, "stock.title")}</h1>
            <p className="text-muted-foreground">
              {t(language, "stock.empty.description")}
            </p>
          </div>

          <Button
            onClick={handleAddProduct}
            className="rounded-2xl bg-primary hover:bg-primary/90 gap-2"
          >
            <Plus className="h-4 w-4" />
            {t(language, "stock.addProduct")}
          </Button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t(language, "stock.search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-2xl"
            />
          </div>

          {/* Category filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="rounded-2xl">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="all">All categories</SelectItem>
              <SelectItem value="Men's Clothing > Jeans">{"Men's Clothing > Jeans"}</SelectItem>
              <SelectItem value="Men's Clothing > Sweaters">{"Men's Clothing > Sweaters"}</SelectItem>
              <SelectItem value="Men's Clothing > Jackets">{"Men's Clothing > Jackets"}</SelectItem>
            </SelectContent>
          </Select>

          {/* Status filter */}
          <Select
            value={statusFilter}
            onValueChange={(value) =>
              setStatusFilter(value as ProductStatus | "all")
            }
          >
            <SelectTrigger className="rounded-2xl">
              <SelectValue placeholder={t(language, "stock.filter.status")} />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="all">{t(language, "common.all")} {t(language, "stock.filter.status").toLowerCase()}</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort */}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="rounded-2xl">
              <SelectValue placeholder={t(language, "common.sort")} />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="updated">{t(language, "stock.filter.updated")} ({t(language, "common.newest")})</SelectItem>
              <SelectItem value="price">{t(language, "stock.columns.price")} ({t(language, "common.priceDesc")})</SelectItem>
              <SelectItem value="cost">{t(language, "stock.columns.cost")} ({t(language, "common.priceDesc")})</SelectItem>
              <SelectItem value="margin">{t(language, "stock.columns.margin")} % (highest)</SelectItem>
              <SelectItem value="title">{t(language, "stock.columns.title")} (A-Z)</SelectItem>
              <SelectItem value="sku">SKU</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Inventory Summary */}
      {products.length > 0 && (
        <InventorySummary products={filteredProducts} language={language} />
      )}

      {/* Content */}
      {sortedProducts.length === 0 && !searchQuery && statusFilter === "all" ? (
        <EmptyState
          icon={PackageIcon}
          title={t(language, "stock.empty.title")}
          description={t(language, "stock.empty.description")}
          action={
            <Button
              onClick={handleAddProduct}
              className="rounded-2xl bg-primary hover:bg-primary/90"
            >
              {t(language, "stock.addProduct")}
            </Button>
          }
        />
      ) : sortedProducts.length === 0 ? (
        <EmptyState
          icon={Search}
          title={t(language, "common.noResults")}
          description={t(language, "stock.empty.description")}
        />
      ) : (
        <ProductTable
          products={sortedProducts}
          onEdit={handleEditProduct}
          onArchive={handleArchiveProduct}
          onDelete={handleDeleteProduct}
          onRowClick={handleRowClick}
          onOpenDetailModal={handleOpenDetailModal}
          language={language}
        />
      )}

      {/* Add/Edit Product Dialog */}
      <ProductFormDialog
        open={productFormOpen}
        onOpenChange={setProductFormOpen}
        product={editingProduct}
        onSave={handleSaveProduct}
        language={language}
      />

      {/* Product Details Modal */}
      <ProductDetailsModal
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        product={detailModalProduct}
        onEdit={(product) => {
          handleEditProduct(product);
          setDetailModalOpen(false);
        }}
        onArchive={(product) => {
          handleArchiveProduct(product);
          setDetailModalOpen(false);
        }}
        language={language}
      />
    </>
  );
}