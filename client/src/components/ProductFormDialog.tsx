import { useState, useEffect } from "react";
import { Loader2, X, Upload, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Checkbox } from "./ui/checkbox";
import { ScrollArea } from "./ui/scroll-area";
import {
  Product,
  ProductCondition,
  PackageSize,
  SKUMode,
  generateSKU,
  CATEGORIES,
  BRANDS,
  CONDITIONS,
  PACKAGE_SIZES,
} from "../lib/stockData";
import { Language, t } from "../lib/i18n";

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onSave: (product: Product) => void;
  language: Language;
}

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
  onSave,
  language,
}: ProductFormDialogProps) {
  const [title, setTitle] = useState("");
  const [skuMode, setSkuMode] = useState<SKUMode>("auto");
  const [sku, setSku] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [condition, setCondition] = useState<ProductCondition>("good");
  const [material, setMaterial] = useState("");
  const [colors, setColors] = useState("");
  const [size, setSize] = useState("");
  const [price, setPrice] = useState("");
  const [purchaseCost, setPurchaseCost] = useState("");
  const [lastPrice, setLastPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [packageSize, setPackageSize] = useState<PackageSize>("medium");
  const [internalNotes, setInternalNotes] = useState("");
  const [autoSuggestCategory, setAutoSuggestCategory] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Initialize form with product data
  useEffect(() => {
    if (product) {
      setTitle(product.title);
      setSku(product.sku);
      // Detect if SKU is auto-generated or manual
      if (product.sku.startsWith("VM-")) {
        setSkuMode("auto");
      } else {
        setSkuMode("manual");
      }
      setDescription(product.description);
      setPhotos(product.photos);
      setCategory(product.category);
      setBrand(product.brand);
      setCondition(product.condition);
      setMaterial(product.material.join(", "));
      setColors(product.colors.join(", "));
      setSize(product.size);
      setPrice(product.price.toString());
      setPurchaseCost(product.purchaseCost?.toString() || "");
      setLastPrice(product.lastPrice?.toString() || "");
      setQuantity(product.quantity?.toString() || "1");
      setPackageSize(product.packageSize);
      setInternalNotes(product.internalNotes || "");
    } else {
      // Reset form
      setTitle("");
      setSkuMode("auto");
      setSku(generateSKU());
      setDescription("");
      setPhotos([]);
      setCategory("");
      setBrand("");
      setCondition("good");
      setMaterial("");
      setColors("");
      setSize("");
      setPrice("");
      setPurchaseCost("");
      setLastPrice("");
      setQuantity("1");
      setPackageSize("medium");
      setInternalNotes("");
    }
    setErrors({});
  }, [product, open]);

  // Auto-generate SKU when mode changes to auto
  useEffect(() => {
    if (skuMode === "auto" && !product) {
      setSku(generateSKU());
    }
  }, [skuMode, product]);

  const handleRegenerateSKU = () => {
    setSku(generateSKU());
  };

  const handlePhotoUpload = () => {
    // Mock photo upload - in real app would use file input
    const mockPhoto = `https://images.unsplash.com/photo-${Math.random() > 0.5 ? "1542291026-7eec264c27ff" : "1434389677669-e08b4cac3105"}?w=400`;
    setPhotos([...photos, mockPhoto]);
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const validateSKU = (value: string): boolean => {
    if (!value.trim()) {
      return false;
    }
    // Basic validation: alphanumeric, dash, underscore
    const skuPattern = /^[A-Za-z0-9_-]+$/;
    return skuPattern.test(value);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = t(language, "stock.errors.titleRequired");
    }

    if (skuMode === "manual") {
      if (!sku.trim()) {
        newErrors.sku = t(language, "stock.errors.skuRequired");
      } else if (!validateSKU(sku)) {
        newErrors.sku = t(language, "stock.errors.skuInvalid");
      }
    }

    if (!category) {
      newErrors.category = language === "fr" ? "La catégorie est obligatoire" : "Category is required";
    }

    if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
      newErrors.price = t(language, "stock.errors.pricePositive");
    }

    if (purchaseCost && (isNaN(parseFloat(purchaseCost)) || parseFloat(purchaseCost) < 0)) {
      newErrors.purchaseCost = t(language, "stock.errors.purchaseCostPositive");
    }

    if (lastPrice && (isNaN(parseFloat(lastPrice)) || parseFloat(lastPrice) < 0)) {
      newErrors.lastPrice = language === "fr" ? "Le dernier prix doit être ≥ 0" : "Last price must be ≥ 0";
    }

    if (quantity && (isNaN(parseInt(quantity)) || parseInt(quantity) < 0)) {
      newErrors.quantity = language === "fr" ? "La quantité doit être ≥ 0" : "Quantity must be ≥ 0";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) {
      return;
    }

    setIsLoading(true);

    // Simulate save
    setTimeout(() => {
      const newProduct: Product = {
        id: product?.id || `prod-${Date.now()}`,
        sku,
        title,
        description,
        photos,
        category,
        brand,
        condition,
        material: material.split(",").map((m) => m.trim()).filter(Boolean),
        colors: colors.split(",").map((c) => c.trim()).filter(Boolean),
        size,
        price: parseFloat(price),
        purchaseCost: purchaseCost ? parseFloat(purchaseCost) : undefined,
        lastPrice: lastPrice ? parseFloat(lastPrice) : undefined,
        quantity: quantity ? parseInt(quantity) : 1,
        packageSize,
        status: product?.status || "draft",
        publishedTo: product?.publishedTo || [],
        internalNotes,
        createdAt: product?.createdAt || new Date(),
        updatedAt: new Date(),
        publishHistory: product?.publishHistory || [],
      };

      onSave(newProduct);
      setIsLoading(false);
    }, 1000);
  };

  const getPackageSizeLabel = (size: PackageSize) => {
    return t(language, `stock.packageSizes.${size}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {product ? t(language, "stock.modal.editTitle") : t(language, "stock.modal.addTitle")}
          </DialogTitle>
          <DialogDescription>
            {product
              ? t(language, "stock.modal.editSubtitle")
              : t(language, "stock.modal.addSubtitle")}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6 py-4">
            {/* SKU Section with Mode Selector */}
            <div className="space-y-3">
              <Label>{t(language, "stock.fields.sku")}</Label>
              <RadioGroup
                value={skuMode}
                onValueChange={(value) => setSkuMode(value as SKUMode)}
                className="flex gap-4"
                disabled={isLoading}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="auto" id="sku-auto" />
                  <Label htmlFor="sku-auto" className="cursor-pointer">
                    {t(language, "stock.skuMode.auto")}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="manual" id="sku-manual" />
                  <Label htmlFor="sku-manual" className="cursor-pointer">
                    {t(language, "stock.skuMode.manual")}
                  </Label>
                </div>
              </RadioGroup>

              {skuMode === "auto" ? (
                <>
                  <div className="flex gap-2">
                    <Input
                      value={sku}
                      readOnly
                      className="rounded-2xl bg-muted"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleRegenerateSKU}
                      className="rounded-2xl shrink-0"
                      disabled={isLoading}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t(language, "stock.helpers.skuAuto")}
                  </p>
                </>
              ) : (
                <>
                  <Input
                    value={sku}
                    onChange={(e) => {
                      setSku(e.target.value);
                      if (errors.sku) setErrors({ ...errors, sku: undefined });
                    }}
                    placeholder={t(language, "stock.placeholders.skuManual")}
                    className={`rounded-2xl ${errors.sku ? "border-red-500" : ""}`}
                    disabled={isLoading}
                  />
                  {errors.sku && (
                    <p className="text-red-500 text-sm">{errors.sku}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {t(language, "stock.helpers.skuManual")}
                  </p>
                </>
              )}
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">
                {t(language, "stock.fields.title")} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errors.title) setErrors({ ...errors, title: undefined });
                }}
                placeholder={t(language, "stock.placeholders.title")}
                className={`rounded-2xl ${errors.title ? "border-red-500" : ""}`}
                disabled={isLoading}
              />
              {errors.title && (
                <p className="text-red-500 text-sm">{errors.title}</p>
              )}
            </div>

            {/* Photos */}
            <div className="space-y-2">
              <Label>{t(language, "stock.fields.photos")}</Label>
              <div className="grid grid-cols-4 gap-3">
                {photos.map((photo, index) => (
                  <div
                    key={index}
                    className="relative aspect-square rounded-xl overflow-hidden bg-muted group"
                  >
                    <img
                      src={photo}
                      alt={`Photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => handleRemovePhoto(index)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={handlePhotoUpload}
                  className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center transition-colors"
                  disabled={isLoading}
                >
                  <Upload className="h-6 w-6 text-muted-foreground" />
                </button>
              </div>
              <div className="flex items-center space-x-2 mt-3">
                <Checkbox
                  id="autoSuggestCategory"
                  checked={autoSuggestCategory}
                  onCheckedChange={(checked) => setAutoSuggestCategory(checked === true)}
                  disabled={isLoading}
                />
                <Label htmlFor="autoSuggestCategory" className="cursor-pointer text-sm">
                  {language === "fr" 
                    ? "Proposer automatiquement la catégorie avec la première photo" 
                    : "Automatically suggest category with the first photo"}
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                {t(language, "stock.helpers.photos")}
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">{t(language, "stock.fields.description")}</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t(language, "stock.placeholders.description")}
                className="rounded-2xl resize-none"
                rows={4}
                disabled={isLoading}
              />
            </div>

            {/* Category & Brand */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">
                  {t(language, "stock.fields.category")} <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={category}
                  onValueChange={(value) => {
                    setCategory(value);
                    if (errors.category) setErrors({ ...errors, category: undefined });
                  }}
                  disabled={isLoading}
                >
                  <SelectTrigger className={`rounded-2xl ${errors.category ? "border-red-500" : ""}`}>
                    <SelectValue placeholder={t(language, "stock.placeholders.selectCategory")} />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && (
                  <p className="text-red-500 text-sm">{errors.category}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="brand">{t(language, "stock.fields.brand")}</Label>
                <Select
                  value={brand}
                  onValueChange={setBrand}
                  disabled={isLoading}
                >
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue placeholder={t(language, "stock.placeholders.selectBrand")} />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    {BRANDS.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Condition & Material */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="condition">{t(language, "stock.fields.condition")}</Label>
                <Select
                  value={condition}
                  onValueChange={(value) => setCondition(value as ProductCondition)}
                  disabled={isLoading}
                >
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    {CONDITIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="material">{t(language, "stock.fields.material")}</Label>
                <Input
                  id="material"
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                  placeholder={t(language, "stock.placeholders.material")}
                  className="rounded-2xl"
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  {language === "fr" ? "Séparez par des virgules (max 3)" : "Separate with commas (max 3)"}
                </p>
              </div>
            </div>

            {/* Colours */}
            <div className="space-y-2">
              <Label htmlFor="colors">
                {language === "fr" ? "Couleurs" : "Colors"}
              </Label>
              <Input
                id="colors"
                value={colors}
                onChange={(e) => setColors(e.target.value)}
                placeholder={language === "fr" ? "Ex: Noir, Blanc, Gris..." : "Ex: Black, White, Grey..."}
                className="rounded-2xl"
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                {language === "fr" ? "Séparez par des virgules (max 3)" : "Separate with commas (max 3)"}
              </p>
            </div>

            {/* Size */}
            <div className="space-y-2">
              <Label htmlFor="size">{t(language, "stock.fields.size")}</Label>
              <Input
                id="size"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder={t(language, "stock.placeholders.size")}
                className="rounded-2xl"
                disabled={isLoading}
              />
            </div>

            {/* Pricing Section - 3 prix groupés */}
            <div className="space-y-3 p-5 rounded-2xl dark:bg-card/50 bg-gray-50/50 border dark:border-primary/20 border-border">
              <h4 className="text-sm font-semibold uppercase tracking-wide dark:text-muted-foreground/90 text-muted-foreground">
                {language === "fr" ? "Prix & Coûts" : "Pricing & Costs"}
              </h4>
              
              <div className="grid grid-cols-3 gap-4">
                {/* Sale Price */}
                <div className="space-y-2">
                  <Label htmlFor="price" className="text-sm">
                    {t(language, "stock.fields.price")} <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      €
                    </span>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={price}
                      onChange={(e) => {
                        setPrice(e.target.value);
                        if (errors.price)
                          setErrors({ ...errors, price: undefined });
                      }}
                      placeholder="0.00"
                      className={`rounded-xl pl-7 h-11 ${errors.price ? "border-red-500" : ""}`}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.price && (
                    <p className="text-red-500 text-xs">{errors.price}</p>
                  )}
                </div>

                {/* Purchase Cost */}
                <div className="space-y-2">
                  <Label htmlFor="purchaseCost" className="text-sm">{t(language, "stock.fields.purchaseCost")}</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      €
                    </span>
                    <Input
                      id="purchaseCost"
                      type="number"
                      step="0.01"
                      value={purchaseCost}
                      onChange={(e) => {
                        setPurchaseCost(e.target.value);
                        if (errors.purchaseCost)
                          setErrors({ ...errors, purchaseCost: undefined });
                      }}
                      placeholder="0.00"
                      className={`rounded-xl pl-7 h-11 ${errors.purchaseCost ? "border-red-500" : ""}`}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.purchaseCost && (
                    <p className="text-red-500 text-xs">{errors.purchaseCost}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {t(language, "stock.fields.purchaseCostHelper")}
                  </p>
                </div>

                {/* Last Price (for bots) */}
                <div className="space-y-2">
                  <Label htmlFor="lastPrice" className="flex items-center gap-1.5 text-sm">
                    {language === "fr" ? "Dernier prix" : "Last price"}
                    <span className="text-xs text-muted-foreground font-normal">
                      ({language === "fr" ? "opt." : "opt."})
                    </span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      €
                    </span>
                    <Input
                      id="lastPrice"
                      type="number"
                      step="0.01"
                      value={lastPrice}
                      onChange={(e) => {
                        setLastPrice(e.target.value);
                        if (errors.lastPrice)
                          setErrors({ ...errors, lastPrice: undefined });
                      }}
                      placeholder="0.00"
                      className={`rounded-xl pl-7 h-11 ${errors.lastPrice ? "border-red-500" : ""}`}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.lastPrice && (
                    <p className="text-red-500 text-xs">{errors.lastPrice}</p>
                  )}
                  <p className="text-xs text-muted-foreground leading-snug">
                    {language === "fr" 
                      ? "Pour offres auto"
                      : "For auto offers"}
                  </p>
                </div>
              </div>
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <Label htmlFor="quantity">{t(language, "stock.fields.quantity")}</Label>
              <Input
                id="quantity"
                type="number"
                min="0"
                step="1"
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  if (errors.quantity)
                    setErrors({ ...errors, quantity: undefined });
                }}
                placeholder="1"
                className={`rounded-2xl ${errors.quantity ? "border-red-500" : ""}`}
                disabled={isLoading}
              />
              {errors.quantity && (
                <p className="text-red-500 text-sm">{errors.quantity}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {t(language, "stock.helpers.quantity")}
              </p>
            </div>

            {/* Vinted Package Size */}
            <div className="space-y-2">
              <Label htmlFor="packageSize">{t(language, "stock.fields.packageSize")}</Label>
              <Select
                value={packageSize}
                onValueChange={(value) => setPackageSize(value as PackageSize)}
                disabled={isLoading}
              >
                <SelectTrigger className="rounded-2xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {PACKAGE_SIZES.map((ps) => (
                    <SelectItem key={ps.value} value={ps.value}>
                      {getPackageSizeLabel(ps.value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t(language, "stock.helpers.vintedParcelSize")}
              </p>
            </div>

            {/* Internal Notes */}
            <div className="space-y-2">
              <Label htmlFor="internalNotes">{t(language, "stock.fields.notes")}</Label>
              <Textarea
                id="internalNotes"
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder={t(language, "stock.placeholders.notes")}
                className="rounded-2xl resize-none"
                rows={2}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                {t(language, "stock.helpers.notesPrivate")}
              </p>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="rounded-2xl flex-1"
            disabled={isLoading}
          >
            {t(language, "stock.actions.cancel")}
          </Button>
          <Button
            onClick={handleSave}
            className="rounded-2xl bg-primary hover:bg-primary/90 flex-1"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t(language, "stock.buttons.saving")}
              </>
            ) : (
              t(language, "stock.actions.saveDraft")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}