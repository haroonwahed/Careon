import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Card } from "./ui/card";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { MOCK_PRODUCTS, PackageSize, PACKAGE_SIZES } from "../lib/stockData";
import { Listing } from "../lib/listingsData";
import { toast } from "sonner@2.0.3";
import { Language, t } from "../lib/i18n";

interface PublishFormProps {
  accounts: string[];
  onPublish: (listing: Listing) => void;
  language: Language;
}

export function PublishForm({ accounts, onPublish, language }: PublishFormProps) {
  const [skuQuery, setSkuQuery] = useState("");
  const [selectedSKU, setSelectedSKU] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [price, setPrice] = useState("");
  const [packageSize, setPackageSize] = useState<PackageSize | "">("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Find matching products
  const matchingProducts = MOCK_PRODUCTS.filter(
    (p) =>
      p.sku.toLowerCase().includes(skuQuery.toLowerCase()) ||
      p.title.toLowerCase().includes(skuQuery.toLowerCase())
  ).slice(0, 5);

  const selectedProduct = MOCK_PRODUCTS.find((p) => p.sku === selectedSKU);

  const handleSelectSKU = (sku: string) => {
    const product = MOCK_PRODUCTS.find((p) => p.sku === sku);
    if (product) {
      setSelectedSKU(sku);
      setSkuQuery(sku);
      setPrice(product.price.toString());
      setPackageSize(product.packageSize);
      setShowSuggestions(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedSKU || !selectedAccount) {
      toast.error(t(language, "publisher.toast.selectRequired"));
      return;
    }

    if (!price || parseFloat(price) <= 0) {
      toast.error(t(language, "publisher.errors.validPrice"));
      return;
    }

    setIsPublishing(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const product = MOCK_PRODUCTS.find((p) => p.sku === selectedSKU);
    if (product) {
      const newListing: Listing = {
        id: `list-${Date.now()}`,
        listingId: `VT-${Math.floor(Math.random() * 9000000000) + 1000000000}`,
        sku: selectedSKU,
        title: product.title,
        photoUrl: product.photos[0] || "",
        accountName: selectedAccount,
        price: parseFloat(price),
        status: "active",
        createdAt: new Date(),
        lastSync: new Date(),
      };

      onPublish(newListing);
      toast.success(
        t(language, "publisher.toast.publishSuccess").replace("{account}", selectedAccount)
      );

      // Reset form
      setSkuQuery("");
      setSelectedSKU(null);
      setSelectedAccount("");
      setPrice("");
      setPackageSize("");
    }

    setIsPublishing(false);
  };

  const formatPrice = (price: number) => {
    const locale = language === "fr" ? "fr-FR" : "en-GB";
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  return (
    <Card className="rounded-2xl border border-border p-6">
      <h3 className="text-foreground mb-4">{t(language, "publisher.form.title")}</h3>

      <div className="space-y-4">
        {/* SKU Search */}
        <div className="space-y-2">
          <Label htmlFor="sku">
            {t(language, "publisher.form.sku")} <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="sku"
              value={skuQuery}
              onChange={(e) => {
                setSkuQuery(e.target.value);
                setShowSuggestions(true);
                setSelectedSKU(null);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder={t(language, "publisher.form.searchSKU")}
              className="pl-9 rounded-2xl"
              disabled={isPublishing}
            />
            {showSuggestions && skuQuery && matchingProducts.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-2xl shadow-lg z-10 max-h-64 overflow-auto">
                {matchingProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => handleSelectSKU(product.sku)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-muted transition-colors text-left"
                  >
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted shrink-0">
                      {product.photos[0] && (
                        <ImageWithFallback
                          src={product.photos[0]}
                          alt={product.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground line-clamp-1">
                        {product.title}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <code>{product.sku}</code>
                        <span>•</span>
                        <span>{formatPrice(product.price)}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedProduct && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted shrink-0">
                {selectedProduct.photos[0] && (
                  <ImageWithFallback
                    src={selectedProduct.photos[0]}
                    alt={selectedProduct.title}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground line-clamp-1">
                  {selectedProduct.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedProduct.sku}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Account */}
        <div className="space-y-2">
          <Label htmlFor="account">
            {t(language, "publisher.form.account")} <span className="text-red-500">*</span>
          </Label>
          <Select
            value={selectedAccount}
            onValueChange={setSelectedAccount}
            disabled={isPublishing}
          >
            <SelectTrigger className="rounded-2xl">
              <SelectValue placeholder={t(language, "publisher.form.selectAccount")} />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              {accounts.map((account) => (
                <SelectItem key={account} value={account}>
                  {account}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Optional overrides */}
        {selectedSKU && (
          <div className="grid grid-cols-2 gap-4">
            {/* Price */}
            <div className="space-y-2">
              <Label htmlFor="price">{t(language, "publisher.form.priceOverride")}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  €
                </span>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="rounded-2xl pl-7"
                  disabled={isPublishing}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t(language, "publisher.helpers.priceOverride")}
              </p>
            </div>

            {/* Package size */}
            <div className="space-y-2">
              <Label htmlFor="package">{t(language, "publisher.form.packageSizeOverride")}</Label>
              <Select
                value={packageSize}
                onValueChange={(value) => setPackageSize(value as PackageSize)}
                disabled={isPublishing}
              >
                <SelectTrigger className="rounded-2xl">
                  <SelectValue placeholder={t(language, "stock.placeholders.selectCategory")} />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {PACKAGE_SIZES.map((ps) => (
                    <SelectItem key={ps.value} value={ps.value}>
                      {ps.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t(language, "publisher.helpers.packageSizeOverride")}
              </p>
            </div>
          </div>
        )}

        {/* Submit */}
        <Button
          onClick={handlePublish}
          disabled={!selectedSKU || !selectedAccount || isPublishing}
          className="w-full rounded-2xl bg-primary hover:bg-primary/90"
        >
          {isPublishing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t(language, "publisher.form.publishing")}
            </>
          ) : (
            t(language, "publisher.form.publish")
          )}
        </Button>
      </div>
    </Card>
  );
}
