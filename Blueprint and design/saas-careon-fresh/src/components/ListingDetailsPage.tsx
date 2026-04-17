import { useState } from "react";
import { ArrowLeft, TrendingUp, RefreshCw, Eye, Heart, DollarSign, TrendingUp as TrendUp, X, Plus, AlertCircle } from "lucide-react";
import { PublishedListing, generateInsights, getListingStatuses } from "../lib/publishedListingsData";
import { StatusBadge } from "./StatusBadge";
import { InsightCard } from "./InsightCard";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Label } from "./ui/label";
import { Language, t, formatCurrency, formatDateTime } from "../lib/i18n";
import { toast } from "sonner@2.0.3";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface ListingDetailsPageProps {
  listing: PublishedListing;
  language: Language;
  onBack: () => void;
  onBoost: () => void;
  onRepost: () => void;
  onViewOnVinted: () => void;
  onSave: (updates: Partial<PublishedListing>) => void;
}

export function ListingDetailsPage({
  listing,
  language,
  onBack,
  onBoost,
  onRepost,
  onViewOnVinted,
  onSave,
}: ListingDetailsPageProps) {
  const [activeTab, setActiveTab] = useState<"details" | "analytics" | "recommendations">("details");
  const [analyticsRange, setAnalyticsRange] = useState<"24h" | "7d">("7d");
  const [isSaving, setIsSaving] = useState(false);
  
  // Editable state
  const [title, setTitle] = useState(listing.title);
  const [description, setDescription] = useState(listing.description);
  const [category, setCategory] = useState(listing.category);
  const [brand, setBrand] = useState(listing.brand);
  const [condition, setCondition] = useState(listing.condition);
  const [material, setMaterial] = useState(listing.material);
  const [size, setSize] = useState(listing.size);
  const [color, setColor] = useState("Marron");
  const [width, setWidth] = useState("30");
  const [length, setLength] = useState("10");
  const [price, setPrice] = useState(listing.price.toString());
  const [packageSize, setPackageSize] = useState(listing.packageSize);

  const insights = generateInsights(listing);
  const statuses = getListingStatuses(listing);

  const handleSave = () => {
    setIsSaving(true);
    
    setTimeout(() => {
      onSave({
        title,
        description,
        category,
        brand,
        condition,
        material,
        size,
        price: parseFloat(price),
        packageSize,
      });
      
      setIsSaving(false);
      toast.success(t(language, "published.toast.saved"));
    }, 800);
  };

  const handleCancel = () => {
    setTitle(listing.title);
    setDescription(listing.description);
    setCategory(listing.category);
    setBrand(listing.brand);
    setCondition(listing.condition);
    setMaterial(listing.material);
    setSize(listing.size);
    setPrice(listing.price.toString());
    setPackageSize(listing.packageSize);
    toast.success(language === "fr" ? "Modifications annulées" : "Changes cancelled");
  };

  const handleInsightAction = (insight: typeof insights[0]) => {
    switch (insight.type) {
      case "photos":
      case "lowEngagement":
      case "missingBrand":
      case "shortDescription":
        setActiveTab("details");
        break;
      case "oldListing":
        onRepost();
        break;
      case "offersLow":
        setActiveTab("details");
        break;
      case "hidden":
        onBack();
        break;
      case "boostActive":
        setActiveTab("analytics");
        break;
    }
  };

  // Format analytics data for charts
  const getAnalyticsData = () => {
    const days = analyticsRange === "7d" ? 7 : 1;
    return {
      views: listing.analytics.viewsHistory.slice(-days),
      favorites: listing.analytics.favoritesHistory.slice(-days),
      offers: listing.analytics.offersHistory.slice(-days),
    };
  };

  const analyticsData = getAnalyticsData();
  const daysOld = Math.floor((Date.now() - listing.publishedDate.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="h-screen flex flex-col dark:bg-[#0A0A0E] bg-background">
      {/* Header */}
      <div className="border-b dark:border-[rgba(168,85,247,0.25)] border-border dark:bg-[#0E0E14] bg-card sticky top-0 z-10">
        <div className="px-6 py-4">
          {/* Back button + Actions row */}
          <div className="flex items-center justify-between mb-4">
            <Button
              onClick={onBack}
              variant="ghost"
              className="gap-2 dark:text-[#9CA3AF] text-muted-foreground hover:dark:text-[#E7E7F0] hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
              {language === "fr" ? "Retour aux annonces" : "Back to listings"}
            </Button>

            <div className="flex gap-2">
              <Button
                onClick={onBoost}
                size="sm"
                className={`rounded-xl gap-2 ${
                  listing.boostActive
                    ? "dark:bg-[rgba(139,92,246,0.20)] bg-primary/20 dark:text-[#A78BFA] text-primary dark:border-[rgba(168,85,247,0.40)] border-primary/40 border hover:dark:bg-[rgba(139,92,246,0.30)] hover:bg-primary/30"
                    : "dark:bg-[#8B5CF6] bg-primary hover:dark:bg-[#7C3AED] hover:bg-primary/90"
                }`}
                style={!listing.boostActive ? {
                  boxShadow: "0 0 16px rgba(139,92,246,0.3)"
                } : undefined}
              >
                <TrendingUp className="w-4 h-4" />
                {language === "fr" ? "Booster" : "Boost"}
              </Button>
              <Button
                onClick={onRepost}
                size="sm"
                variant="outline"
                className="rounded-xl gap-2 dark:border-primary/30 dark:hover:bg-primary/10"
              >
                <RefreshCw className="w-4 h-4" />
                {language === "fr" ? "Reposter" : "Repost"}
              </Button>
            </div>
          </div>

          {/* Title + Thumbnail + Badges */}
          <div className="flex items-start gap-4">
            <img
              src={listing.photos[0]}
              alt={listing.title}
              className="w-12 h-12 rounded-xl object-cover border dark:border-[rgba(168,85,247,0.25)] border-border flex-shrink-0"
            />
            
            <div className="flex-1 min-w-0">
              <h1 className="dark:text-[#E7E7F0] text-foreground mb-2">{listing.title}</h1>
              
              {/* Status badges + SKU + Published date */}
              <div className="flex flex-wrap items-center gap-2 mb-0">
                {statuses.map((status, index) => (
                  <StatusBadge key={index} status={status.type} language={language} size="md" />
                ))}
                
                <span className="text-xs px-3 py-1.5 rounded-lg dark:bg-[rgba(139,92,246,0.10)] bg-primary/10 dark:text-[#A78BFA] text-primary border dark:border-[rgba(168,85,247,0.25)] border-border">
                  {listing.sku}
                </span>

                <span className="text-xs dark:text-[#6B7280] text-muted-foreground">
                  {formatDateTime(listing.publishedDate, language)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs - Fixed style */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <div className="px-6">
            <TabsList className="dark:bg-transparent bg-transparent border-0 h-auto p-0 gap-6">
              <TabsTrigger
                value="details"
                className="rounded-xl px-4 py-2 data-[state=active]:dark:bg-primary/20 data-[state=active]:bg-primary/10 data-[state=active]:dark:text-primary data-[state=active]:text-primary dark:text-muted-foreground text-muted-foreground hover:dark:text-foreground hover:text-foreground data-[state=active]:shadow-[0_0_12px_rgba(139,92,246,0.3)]"
              >
                {language === "fr" ? "Détails" : "Details"}
              </TabsTrigger>
              <TabsTrigger
                value="analytics"
                className="rounded-xl px-4 py-2 data-[state=active]:dark:bg-primary/20 data-[state=active]:bg-primary/10 data-[state=active]:dark:text-primary data-[state=active]:text-primary dark:text-muted-foreground text-muted-foreground hover:dark:text-foreground hover:text-foreground data-[state=active]:shadow-[0_0_12px_rgba(139,92,246,0.3)]"
              >
                Analytics
              </TabsTrigger>
              <TabsTrigger
                value="recommendations"
                className="rounded-xl px-4 py-2 data-[state=active]:dark:bg-primary/20 data-[state=active]:bg-primary/10 data-[state=active]:dark:text-primary data-[state=active]:text-primary dark:text-muted-foreground text-muted-foreground hover:dark:text-foreground hover:text-foreground data-[state=active]:shadow-[0_0_12px_rgba(139,92,246,0.3)]"
              >
                Recommendations
              </TabsTrigger>
            </TabsList>
          </div>
        </Tabs>
      </div>

      {/* Content */}
      <div className="flex-1">
        <Tabs value={activeTab}>
          {/* Details Tab - New 2-column layout */}
          <TabsContent value="details" className="mt-0">
            <div className="p-6 max-w-4xl mx-auto">
              {/* Left Column: Vinted-like editing form */}
              <div className="space-y-6">
                {/* Photos */}
                <div>
                  <Label className="text-sm dark:text-[#9CA3AF] text-muted-foreground mb-3 block">
                    Photos
                  </Label>
                  <div className="grid grid-cols-4 gap-3">
                    {listing.photos.map((photo, index) => (
                      <div key={index} className="relative aspect-square rounded-xl overflow-hidden border dark:border-[rgba(168,85,247,0.25)] border-border group">
                        <img src={photo} alt={`${listing.title} ${index + 1}`} className="w-full h-full object-cover" />
                        {index === 0 && (
                          <div className="absolute top-2 left-2 bg-primary text-white text-xs px-2 py-1 rounded">
                            {language === "fr" ? "Principale" : "Main"}
                          </div>
                        )}
                        <button className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    ))}
                    <button className="aspect-square rounded-xl border-2 border-dashed dark:border-[rgba(168,85,247,0.25)] border-border flex items-center justify-center hover:dark:bg-primary/5 hover:bg-muted transition-colors">
                      <Plus className="w-6 h-6 dark:text-[#9CA3AF] text-muted-foreground" />
                    </button>
                  </div>
                  <p className="text-xs dark:text-[#6B7280] text-muted-foreground mt-2">
                    {listing.photoCount} / 20 {language === "fr" ? "photos" : "photos"}
                  </p>
                </div>

                {/* Title */}
                <div>
                  <Label className="text-sm dark:text-[#9CA3AF] text-muted-foreground mb-2 block">
                    {language === "fr" ? "Titre" : "Title"}
                  </Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="rounded-xl dark:bg-[rgba(139,92,246,0.05)] bg-background dark:border-[rgba(168,85,247,0.25)] border-border"
                    placeholder={language === "fr" ? "Ex: Sac à main marron chocolat" : "Ex: Brown leather handbag"}
                  />
                </div>

                {/* Description */}
                <div>
                  <Label className="text-sm dark:text-[#9CA3AF] text-muted-foreground mb-2 block">
                    {language === "fr" ? "Décris ton article" : "Describe your item"}
                  </Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={5}
                    className="rounded-xl dark:bg-[rgba(139,92,246,0.05)] bg-background dark:border-[rgba(168,85,247,0.25)] border-border"
                    placeholder={language === "fr" ? "Ex: Magnifique sac à main en simili-cuir marron chocolat..." : "Ex: Beautiful brown faux leather handbag..."}
                  />
                </div>

                {/* Attributes Section */}
                <div className="space-y-4">
                  {/* Category */}
                  <div>
                    <Label className="text-sm dark:text-[#9CA3AF] text-muted-foreground mb-2 block">
                      {language === "fr" ? "Catégorie" : "Category"}
                    </Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="rounded-xl dark:bg-[rgba(139,92,246,0.05)] bg-background dark:border-[rgba(168,85,247,0.25)] border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl dark:bg-[#0E0E14] bg-popover border dark:border-[rgba(168,85,247,0.25)] border-border">
                        <SelectItem value="Sacs à main">{language === "fr" ? "Sacs à main" : "Handbags"}</SelectItem>
                        <SelectItem value="Vêtements">{language === "fr" ? "Vêtements" : "Clothing"}</SelectItem>
                        <SelectItem value="Chaussures">{language === "fr" ? "Chaussures" : "Shoes"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Brand */}
                  <div>
                    <Label className="text-sm dark:text-[#9CA3AF] text-muted-foreground mb-2 block">
                      {language === "fr" ? "Marque" : "Brand"}
                    </Label>
                    <Input
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      placeholder={language === "fr" ? "Ex: Zara, H&M..." : "Ex: Zara, H&M..."}
                      className="rounded-xl dark:bg-[rgba(139,92,246,0.05)] bg-background dark:border-[rgba(168,85,247,0.25)] border-border"
                    />
                  </div>

                  {/* Taille */}
                  <div>
                    <Label className="text-sm dark:text-[#9CA3AF] text-muted-foreground mb-2 block">
                      {language === "fr" ? "Taille" : "Size"}
                    </Label>
                    <Select value={size} onValueChange={setSize}>
                      <SelectTrigger className="rounded-xl dark:bg-[rgba(139,92,246,0.05)] bg-background dark:border-[rgba(168,85,247,0.25)] border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl dark:bg-[#0E0E14] bg-popover border dark:border-[rgba(168,85,247,0.25)] border-border">
                        <SelectItem value="S">S</SelectItem>
                        <SelectItem value="M">M</SelectItem>
                        <SelectItem value="L">L</SelectItem>
                        <SelectItem value="XL">XL</SelectItem>
                        <SelectItem value="Taille unique">{language === "fr" ? "Taille unique" : "One size"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* État */}
                  <div>
                    <Label className="text-sm dark:text-[#9CA3AF] text-muted-foreground mb-2 block">
                      {language === "fr" ? "État" : "Condition"}
                    </Label>
                    <Select value={condition} onValueChange={setCondition}>
                      <SelectTrigger className="rounded-xl dark:bg-[rgba(139,92,246,0.05)] bg-background dark:border-[rgba(168,85,247,0.25)] border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl dark:bg-[#0E0E14] bg-popover border dark:border-[rgba(168,85,247,0.25)] border-border">
                        <SelectItem value="new">{language === "fr" ? "Neuf avec étiquette" : "New with tags"}</SelectItem>
                        <SelectItem value="veryGood">{language === "fr" ? "Très bon état" : "Very good"}</SelectItem>
                        <SelectItem value="good">{language === "fr" ? "Bon état" : "Good"}</SelectItem>
                        <SelectItem value="satisfactory">{language === "fr" ? "Satisfaisant" : "Satisfactory"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Couleur */}
                  <div>
                    <Label className="text-sm dark:text-[#9CA3AF] text-muted-foreground mb-2 block">
                      {language === "fr" ? "Couleur" : "Color"}
                    </Label>
                    <Select value={color} onValueChange={setColor}>
                      <SelectTrigger className="rounded-xl dark:bg-[rgba(139,92,246,0.05)] bg-background dark:border-[rgba(168,85,247,0.25)] border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl dark:bg-[#0E0E14] bg-popover border dark:border-[rgba(168,85,247,0.25)] border-border">
                        <SelectItem value="Noir">{language === "fr" ? "Noir" : "Black"}</SelectItem>
                        <SelectItem value="Blanc">{language === "fr" ? "Blanc" : "White"}</SelectItem>
                        <SelectItem value="Marron">{language === "fr" ? "Marron" : "Brown"}</SelectItem>
                        <SelectItem value="Bleu">{language === "fr" ? "Bleu" : "Blue"}</SelectItem>
                        <SelectItem value="Rouge">{language === "fr" ? "Rouge" : "Red"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Matière (recommandé) */}
                  <div>
                    <Label className="text-sm dark:text-[#9CA3AF] text-muted-foreground mb-2 flex items-center gap-2">
                      {language === "fr" ? "Matière" : "Material"}
                      <span className="text-xs text-muted-foreground/60">({language === "fr" ? "recommandé" : "recommended"})</span>
                    </Label>
                    <Input
                      value={material}
                      onChange={(e) => setMaterial(e.target.value)}
                      placeholder={language === "fr" ? "Ex: Cuir, Coton..." : "Ex: Leather, Cotton..."}
                      className="rounded-xl dark:bg-[rgba(139,92,246,0.05)] bg-background dark:border-[rgba(168,85,247,0.25)] border-border"
                    />
                  </div>
                </div>

                {/* Prix avec info card */}
                <div>
                  <Label className="text-sm dark:text-[#9CA3AF] text-muted-foreground mb-2 block">
                    {language === "fr" ? "Prix" : "Price"}
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="rounded-xl dark:bg-[rgba(139,92,246,0.05)] bg-background dark:border-[rgba(168,85,247,0.25)] border-border"
                    placeholder="0.00"
                  />
                </div>

                {/* Format du colis */}
                <div>
                  <Label className="text-sm dark:text-[#9CA3AF] text-muted-foreground mb-3 block">
                    {language === "fr" ? "Format du colis" : "Package size"}
                  </Label>
                  <RadioGroup value={packageSize} onValueChange={(v) => setPackageSize(v as typeof packageSize)} className="space-y-3">
                    <div className={`relative flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      packageSize === "small"
                        ? "dark:border-primary border-primary dark:bg-primary/5 bg-primary/5"
                        : "dark:border-[rgba(168,85,247,0.25)] border-border hover:dark:border-primary/50 hover:border-primary/50"
                    }`}>
                      <RadioGroupItem value="small" id="small" className="border-primary" />
                      <Label htmlFor="small" className="flex-1 cursor-pointer">
                        <div className="dark:text-foreground text-foreground">
                          {language === "fr" ? "Petit" : "Small"}
                        </div>
                        <div className="text-xs dark:text-muted-foreground text-muted-foreground">
                          {language === "fr" ? "Jusqu'à 1 kg" : "Up to 1 kg"}
                        </div>
                      </Label>
                      {packageSize === "small" && (
                        <span className="absolute top-2 right-2 text-xs px-2 py-1 rounded bg-primary text-white">
                          {language === "fr" ? "Recommandé" : "Recommended"}
                        </span>
                      )}
                    </div>
                    
                    <div className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      packageSize === "medium"
                        ? "dark:border-primary border-primary dark:bg-primary/5 bg-primary/5"
                        : "dark:border-[rgba(168,85,247,0.25)] border-border hover:dark:border-primary/50 hover:border-primary/50"
                    }`}>
                      <RadioGroupItem value="medium" id="medium" className="border-primary" />
                      <Label htmlFor="medium" className="flex-1 cursor-pointer">
                        <div className="dark:text-foreground text-foreground">
                          {language === "fr" ? "Moyen" : "Medium"}
                        </div>
                        <div className="text-xs dark:text-muted-foreground text-muted-foreground">
                          {language === "fr" ? "Jusqu'à 5 kg" : "Up to 5 kg"}
                        </div>
                      </Label>
                    </div>
                    
                    <div className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      packageSize === "large"
                        ? "dark:border-primary border-primary dark:bg-primary/5 bg-primary/5"
                        : "dark:border-[rgba(168,85,247,0.25)] border-border hover:dark:border-primary/50 hover:border-primary/50"
                    }`}>
                      <RadioGroupItem value="large" id="large" className="border-primary" />
                      <Label htmlFor="large" className="flex-1 cursor-pointer">
                        <div className="dark:text-foreground text-foreground">
                          {language === "fr" ? "Grand" : "Large"}
                        </div>
                        <div className="text-xs dark:text-muted-foreground text-muted-foreground">
                          {language === "fr" ? "Plus de 5 kg" : "Over 5 kg"}
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* SKU (read-only) */}
                <div>
                  <Label className="text-sm dark:text-[#9CA3AF] text-muted-foreground mb-2 block">
                    SKU
                  </Label>
                  <Input
                    value={listing.sku}
                    disabled
                    className="rounded-xl dark:bg-[rgba(139,92,246,0.05)] bg-background dark:border-[rgba(168,85,247,0.25)] border-border opacity-60"
                  />
                </div>

                {/* Actions bar */}
                <div className="flex gap-3 pt-4 border-t dark:border-[rgba(168,85,247,0.25)] border-border">
                  <Button
                    onClick={handleCancel}
                    variant="ghost"
                    className="rounded-xl dark:text-muted-foreground text-muted-foreground hover:dark:text-foreground hover:text-foreground"
                  >
                    {language === "fr" ? "Annuler" : "Cancel"}
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1 rounded-xl dark:bg-[#8B5CF6] bg-primary hover:dark:bg-[#7C3AED] hover:bg-primary/90"
                    style={{
                      boxShadow: "0 0 16px rgba(139,92,246,0.3)"
                    }}
                  >
                    {isSaving
                      ? (language === "fr" ? "Enregistrement..." : "Saving...")
                      : (language === "fr" ? "Enregistrer" : "Save")
                    }
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="mt-0 p-6 space-y-6">
            {/* Timeframe Selector */}
            <div className="flex gap-3">
              <button
                onClick={() => setAnalyticsRange("24h")}
                className={`px-4 py-2 rounded-full text-sm transition-all ${
                  analyticsRange === "24h"
                    ? "dark:bg-primary bg-primary text-white shadow-[0_0_12px_rgba(139,92,246,0.3)]"
                    : "dark:border-primary/30 border-primary/40 border dark:bg-transparent bg-transparent dark:text-[#9CA3AF] text-muted-foreground dark:hover:bg-primary/10 hover:bg-primary/5 dark:hover:text-primary hover:text-primary"
                }`}
              >
                {language === "fr" ? "Dernières 24 heures" : "Last 24 hours"}
              </button>
              <button
                onClick={() => setAnalyticsRange("7d")}
                className={`px-4 py-2 rounded-full text-sm transition-all ${
                  analyticsRange === "7d"
                    ? "dark:bg-primary bg-primary text-white shadow-[0_0_12px_rgba(139,92,246,0.3)]"
                    : "dark:border-primary/30 border-primary/40 border dark:bg-transparent bg-transparent dark:text-[#9CA3AF] text-muted-foreground dark:hover:bg-primary/10 hover:bg-primary/5 dark:hover:text-primary hover:text-primary"
                }`}
              >
                {language === "fr" ? "7 derniers jours" : "Last 7 days"}
              </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Views KPI */}
              <div className="rounded-2xl border dark:border-[rgba(168,85,247,0.25)] border-border dark:bg-[rgba(139,92,246,0.05)] bg-card p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl dark:bg-[rgba(139,92,246,0.15)] bg-primary/10 flex items-center justify-center">
                    <Eye className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-sm dark:text-[#9CA3AF] text-muted-foreground">
                    {language === "fr" ? "Vues" : "Views"}
                  </p>
                </div>
                <p className="dark:text-[#E7E7F0] text-foreground">61</p>
              </div>

              {/* Favorites KPI */}
              <div className="rounded-2xl border dark:border-[rgba(168,85,247,0.25)] border-border dark:bg-[rgba(139,92,246,0.05)] bg-card p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl dark:bg-[rgba(139,92,246,0.15)] bg-primary/10 flex items-center justify-center">
                    <Heart className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-sm dark:text-[#9CA3AF] text-muted-foreground">
                    {language === "fr" ? "Favoris" : "Favorites"}
                  </p>
                </div>
                <p className="dark:text-[#E7E7F0] text-foreground">25</p>
              </div>

              {/* Offers KPI */}
              <div className="rounded-2xl border dark:border-[rgba(168,85,247,0.25)] border-border dark:bg-[rgba(139,92,246,0.05)] bg-card p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl dark:bg-[rgba(139,92,246,0.15)] bg-primary/10 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-sm dark:text-[#9CA3AF] text-muted-foreground">
                    {language === "fr" ? "Offres" : "Offers"}
                  </p>
                </div>
                <p className="dark:text-[#E7E7F0] text-foreground">3</p>
              </div>

              {/* Average Offer KPI */}
              <div className="rounded-2xl border dark:border-[rgba(168,85,247,0.25)] border-border dark:bg-[rgba(139,92,246,0.05)] bg-card p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl dark:bg-[rgba(139,92,246,0.15)] bg-primary/10 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-sm dark:text-[#9CA3AF] text-muted-foreground">
                    {language === "fr" ? "Offre moyenne" : "Average offer"}
                  </p>
                </div>
                <p className="dark:text-[#E7E7F0] text-foreground mb-1">30,00 €</p>
                <p className="text-xs dark:text-[#6B7280] text-muted-foreground">
                  {language === "fr" ? "Meilleure : 32,00 €" : "Best: €32.00"}
                </p>
              </div>
            </div>

            {/* Charts - Only Favorites and Offers */}
            <div className="space-y-6">
              {/* Favorites over time */}
              <div className="rounded-2xl border dark:border-[rgba(168,85,247,0.25)] border-border dark:bg-[rgba(139,92,246,0.05)] bg-card p-6">
                <div className="mb-6">
                  <h3 className="dark:text-[#E7E7F0] text-foreground mb-1">
                    {language === "fr" ? "Favoris" : "Favorites"}
                  </h3>
                  <p className="text-sm dark:text-[#6B7280] text-muted-foreground">
                    {language === "fr" ? "Évolution sur la période sélectionnée" : "Evolution over selected period"}
                  </p>
                </div>
                <ResponsiveContainer width="100%" height={300} minHeight={300}>
                  <LineChart 
                    data={analyticsData.favorites} 
                    margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(168,85,247,0.05)" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      stroke="#6B7280" 
                      style={{ fontSize: "11px" }}
                      tickMargin={12}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => {
                        if (analyticsRange === "24h") {
                          const date = new Date(value);
                          return `${date.getHours().toString().padStart(2, '0')}:00`;
                        }
                        const date = new Date(value);
                        const day = date.getDate().toString().padStart(2, '0');
                        const month = (date.getMonth() + 1).toString().padStart(2, '0');
                        return `${day}/${month}`;
                      }}
                    />
                    <YAxis 
                      stroke="#6B7280" 
                      style={{ fontSize: "11px" }}
                      tickMargin={8}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0E0E14",
                        border: "1px solid rgba(168,85,247,0.3)",
                        borderRadius: "12px",
                        color: "#E7E7F0",
                        padding: "12px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                      }}
                      itemStyle={{ color: "#8B5CF6" }}
                      labelStyle={{ color: "#9CA3AF", marginBottom: "4px" }}
                      formatter={(value: number) => [value, language === "fr" ? "Favoris" : "Favorites"]}
                      labelFormatter={(label) => {
                        if (analyticsRange === "24h") {
                          const date = new Date(label);
                          return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
                        }
                        const date = new Date(label);
                        const day = date.getDate().toString().padStart(2, '0');
                        const monthNames = language === "fr" 
                          ? ["jan.", "fév.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
                          : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                        return `${day} ${monthNames[date.getMonth()]}`;
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#8B5CF6" 
                      strokeWidth={2} 
                      dot={false}
                      activeDot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Offers over time */}
              <div className="rounded-2xl border dark:border-[rgba(168,85,247,0.25)] border-border dark:bg-[rgba(139,92,246,0.05)] bg-card p-6">
                <div className="mb-6">
                  <h3 className="dark:text-[#E7E7F0] text-foreground mb-1">
                    {language === "fr" ? "Offres" : "Offers"}
                  </h3>
                  <p className="text-sm dark:text-[#6B7280] text-muted-foreground">
                    {language === "fr" ? "Évolution sur la période sélectionnée" : "Evolution over selected period"}
                  </p>
                </div>
                <ResponsiveContainer width="100%" height={300} minHeight={300}>
                  <LineChart 
                    data={analyticsData.offers} 
                    margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(168,85,247,0.05)" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      stroke="#6B7280" 
                      style={{ fontSize: "11px" }}
                      tickMargin={12}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => {
                        if (analyticsRange === "24h") {
                          const date = new Date(value);
                          return `${date.getHours().toString().padStart(2, '0')}:00`;
                        }
                        const date = new Date(value);
                        const day = date.getDate().toString().padStart(2, '0');
                        const month = (date.getMonth() + 1).toString().padStart(2, '0');
                        return `${day}/${month}`;
                      }}
                    />
                    <YAxis 
                      stroke="#6B7280" 
                      style={{ fontSize: "11px" }}
                      tickMargin={8}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0E0E14",
                        border: "1px solid rgba(168,85,247,0.3)",
                        borderRadius: "12px",
                        color: "#E7E7F0",
                        padding: "12px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                      }}
                      itemStyle={{ color: "#8B5CF6" }}
                      labelStyle={{ color: "#9CA3AF", marginBottom: "4px" }}
                      formatter={(value: number) => [value, language === "fr" ? "Offres" : "Offers"]}
                      labelFormatter={(label) => {
                        if (analyticsRange === "24h") {
                          const date = new Date(label);
                          return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
                        }
                        const date = new Date(label);
                        const day = date.getDate().toString().padStart(2, '0');
                        const monthNames = language === "fr" 
                          ? ["jan.", "fév.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
                          : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                        return `${day} ${monthNames[date.getMonth()]}`;
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#8B5CF6" 
                      strokeWidth={2} 
                      dot={false}
                      activeDot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          {/* Recommendations Tab - UNCHANGED */}
          <TabsContent value="recommendations" className="mt-0">
            <div className="p-6 max-w-5xl mx-auto">
              <h2 className="dark:text-[#E7E7F0] text-foreground mb-6">{t(language, "published.drawer.tab.recommendations")}</h2>
              
              <div className="space-y-4">
                {insights.map((insight) => (
                  <InsightCard
                    key={insight.id}
                    insight={insight}
                    language={language}
                    onAction={() => handleInsightAction(insight)}
                  />
                ))}
              </div>

              {insights.length === 0 && (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full dark:bg-[rgba(139,92,246,0.10)] bg-primary/10 mb-4">
                    <TrendingUp className="w-8 h-8 dark:text-primary text-primary" />
                  </div>
                  <h3 className="dark:text-[#E7E7F0] text-foreground mb-2">
                    {language === "fr" ? "Aucune recommandation" : "No recommendations"}
                  </h3>
                  <p className="dark:text-[#9CA3AF] text-muted-foreground">
                    {language === "fr"
                      ? "Votre annonce est optimale !"
                      : "Your listing is optimal!"}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}