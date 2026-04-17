import { useState } from "react";
import { X, ExternalLink, TrendingUp, RefreshCw, Eye, Heart, DollarSign, TrendingUp as TrendUp } from "lucide-react";
import { PublishedListing, generateInsights, getListingStatuses } from "../lib/publishedListingsData";
import { InsightCard } from "./InsightCard";
import { StatusBadge } from "./StatusBadge";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { Language, t, formatCurrency } from "../lib/i18n";
import { toast } from "sonner@2.0.3";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface ListingDrawerProps {
  listing: PublishedListing | null;
  open: boolean;
  onClose: () => void;
  language: Language;
  onBoost: () => void;
  onRepost: () => void;
  onViewOnVinted: () => void;
  onSave: (updates: Partial<PublishedListing>) => void;
}

export function ListingDrawer({
  listing,
  open,
  onClose,
  language,
  onBoost,
  onRepost,
  onViewOnVinted,
  onSave,
}: ListingDrawerProps) {
  const [activeTab, setActiveTab] = useState("details");
  const [editedListing, setEditedListing] = useState<PublishedListing | null>(listing);
  const [analyticsRange, setAnalyticsRange] = useState<"7d" | "30d" | "90d">("30d");

  // Update edited listing when listing prop changes
  if (listing && listing.id !== editedListing?.id) {
    setEditedListing(listing);
  }

  if (!listing || !editedListing) return null;

  const insights = generateInsights(listing);
  
  const daysOld = Math.floor((Date.now() - listing.publishedDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysAgoText = daysOld === 1
    ? t(language, "published.drawer.postedDaysAgo").replace("{count}", "1")
    : t(language, "published.drawer.postedDaysAgo_plural").replace("{count}", daysOld.toString());

  const handleSave = () => {
    onSave(editedListing);
    toast.success(t(language, "published.toast.saved"));
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
        // Would trigger unhide action (handled by parent)
        onClose();
        break;
      case "boostActive":
        setActiveTab("analytics");
        break;
    }
  };

  // Format analytics data for charts
  const getAnalyticsData = () => {
    const days = analyticsRange === "7d" ? 7 : analyticsRange === "30d" ? 30 : 90;
    return {
      views: listing.analytics.viewsHistory.slice(-days),
      favorites: listing.analytics.favoritesHistory.slice(-days),
      offers: listing.analytics.offersHistory.slice(-days),
    };
  };

  const chartData = getAnalyticsData();

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-2xl p-0 dark:bg-[#0A0A0E] bg-background border-l dark:border-[rgba(168,85,247,0.25)] border-border overflow-y-auto"
      >
        {/* Header */}
        <SheetHeader className="p-6 border-b dark:border-[rgba(168,85,247,0.25)] border-border sticky top-0 dark:bg-[#0A0A0E] bg-background z-10">
          <div className="flex items-start gap-4">
            {/* Thumbnail */}
            <img
              src={listing.photos[0]}
              alt={listing.title}
              className="w-20 h-20 rounded-xl object-cover border dark:border-[rgba(168,85,247,0.25)] border-border flex-shrink-0"
            />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <SheetTitle className="dark:text-[#E7E7F0] text-foreground mb-2">
                {listing.title}
              </SheetTitle>
              
              {/* Status badges */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {getListingStatuses(listing).map((status, index) => (
                  <StatusBadge key={index} status={status.type} language={language} size="md" />
                ))}
                
                <Badge variant="outline" className="text-xs dark:border-[rgba(168,85,247,0.25)] border-border dark:text-[#9CA3AF] text-muted-foreground">
                  {daysAgoText}
                </Badge>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  onClick={onBoost}
                  size="sm"
                  className="rounded-lg dark:bg-[#8B5CF6] bg-primary hover:dark:bg-[#7C3AED] hover:bg-primary/90 gap-2"
                >
                  <TrendingUp className="w-4 h-4" />
                  {t(language, "published.button.boost")}
                </Button>
                <Button
                  onClick={onRepost}
                  size="sm"
                  variant="outline"
                  className="rounded-lg gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  {t(language, "published.button.repost")}
                </Button>
                <Button
                  onClick={onViewOnVinted}
                  size="sm"
                  variant="ghost"
                  className="rounded-lg gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <div className="border-b dark:border-[rgba(168,85,247,0.25)] border-border px-6 sticky top-[180px] dark:bg-[#0A0A0E] bg-background z-10">
            <TabsList className="dark:bg-transparent bg-transparent border-0 h-auto p-0 gap-6">
              <TabsTrigger
                value="details"
                className="rounded-none border-b-2 border-transparent data-[state=active]:dark:border-[#8B5CF6] data-[state=active]:border-primary dark:bg-transparent bg-transparent px-0 pb-3"
              >
                {t(language, "published.drawer.tab.details")}
              </TabsTrigger>
              <TabsTrigger
                value="analytics"
                className="rounded-none border-b-2 border-transparent data-[state=active]:dark:border-[#8B5CF6] data-[state=active]:border-primary dark:bg-transparent bg-transparent px-0 pb-3"
              >
                {t(language, "published.drawer.tab.analytics")}
              </TabsTrigger>
              <TabsTrigger
                value="recommendations"
                className="rounded-none border-b-2 border-transparent data-[state=active]:dark:border-[#8B5CF6] data-[state=active]:border-primary dark:bg-transparent bg-transparent px-0 pb-3"
              >
                {t(language, "published.drawer.tab.recommendations")}
                {insights.length > 0 && (
                  <Badge className="ml-2 text-[10px] px-1.5 py-0 dark:bg-[#8B5CF6] bg-primary dark:text-white text-primary-foreground">
                    {insights.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Details Tab */}
          <TabsContent value="details" className="p-6 space-y-4 mt-0">
            {/* Photo gallery */}
            <div>
              <label className="block text-sm dark:text-[#E7E7F0] text-foreground mb-2">
                {language === "fr" ? "Photos" : "Photos"} ({listing.photos.length})
              </label>
              <div className="grid grid-cols-4 gap-2">
                {listing.photos.map((photo, index) => (
                  <img
                    key={index}
                    src={photo}
                    alt={`${listing.title} ${index + 1}`}
                    className="w-full aspect-square rounded-lg object-cover border dark:border-[rgba(168,85,247,0.20)] border-border"
                  />
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm dark:text-[#E7E7F0] text-foreground mb-2">
                {language === "fr" ? "Titre" : "Title"}
              </label>
              <Input
                value={editedListing.title}
                onChange={(e) => setEditedListing({ ...editedListing, title: e.target.value })}
                className="rounded-xl dark:bg-[rgba(139,92,246,0.05)] bg-background dark:border-[rgba(168,85,247,0.25)] border-border"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm dark:text-[#E7E7F0] text-foreground mb-2">
                {language === "fr" ? "Description" : "Description"}
              </label>
              <Textarea
                value={editedListing.description}
                onChange={(e) => setEditedListing({ ...editedListing, description: e.target.value })}
                rows={4}
                className="rounded-xl dark:bg-[rgba(139,92,246,0.05)] bg-background dark:border-[rgba(168,85,247,0.25)] border-border resize-none"
              />
            </div>

            {/* Price */}
            <div>
              <label className="block text-sm dark:text-[#E7E7F0] text-foreground mb-2">
                {language === "fr" ? "Prix (€)" : "Price (€)"}
              </label>
              <Input
                type="number"
                step="0.01"
                value={editedListing.price}
                onChange={(e) => setEditedListing({ ...editedListing, price: parseFloat(e.target.value) || 0 })}
                className="rounded-xl dark:bg-[rgba(139,92,246,0.05)] bg-background dark:border-[rgba(168,85,247,0.25)] border-border"
              />
            </div>

            {/* Brand */}
            <div>
              <label className="block text-sm dark:text-[#E7E7F0] text-foreground mb-2">
                {language === "fr" ? "Marque" : "Brand"}
              </label>
              <Input
                value={editedListing.brand}
                onChange={(e) => setEditedListing({ ...editedListing, brand: e.target.value })}
                className="rounded-xl dark:bg-[rgba(139,92,246,0.05)] bg-background dark:border-[rgba(168,85,247,0.25)] border-border"
              />
            </div>

            {/* Size */}
            <div>
              <label className="block text-sm dark:text-[#E7E7F0] text-foreground mb-2">
                {language === "fr" ? "Taille" : "Size"}
              </label>
              <Input
                value={editedListing.size}
                onChange={(e) => setEditedListing({ ...editedListing, size: e.target.value })}
                className="rounded-xl dark:bg-[rgba(139,92,246,0.05)] bg-background dark:border-[rgba(168,85,247,0.25)] border-border"
              />
            </div>

            {/* SKU (read-only) */}
            <div>
              <label className="block text-sm dark:text-[#E7E7F0] text-foreground mb-2">
                SKU
              </label>
              <Input
                value={listing.sku}
                disabled
                className="rounded-xl dark:bg-[rgba(139,92,246,0.05)] bg-background dark:border-[rgba(168,85,247,0.25)] border-border opacity-60"
              />
            </div>

            {/* Save button */}
            <div className="sticky bottom-0 pt-4 pb-4 dark:bg-[#0A0A0E] bg-background">
              <Button
                onClick={handleSave}
                className="w-full rounded-xl dark:bg-[#8B5CF6] bg-primary hover:dark:bg-[#7C3AED] hover:bg-primary/90"
                style={{
                  boxShadow: "0 0 16px rgba(139,92,246,0.3)"
                }}
              >
                {t(language, "published.action.saveChanges")}
              </Button>
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="p-6 space-y-6 mt-0">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border dark:border-[rgba(168,85,247,0.25)] border-border dark:bg-[rgba(139,92,246,0.05)] bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="w-4 h-4 dark:text-[#A78BFA] text-primary" />
                  <span className="text-sm dark:text-[#9CA3AF] text-muted-foreground">
                    {t(language, "published.analytics.views")}
                  </span>
                </div>
                <div className="text-2xl dark:text-[#E7E7F0] text-foreground mb-1">
                  {listing.analytics.views}
                </div>
                <div className={`text-xs flex items-center gap-1 ${
                  listing.analytics.viewsTrend > 0 
                    ? "dark:text-[#2AF07A] text-green-600" 
                    : "dark:text-[#FF5C8A] text-red-600"
                }`}>
                  <TrendUp className={`w-3 h-3 ${listing.analytics.viewsTrend < 0 ? "rotate-180" : ""}`} />
                  <span>{Math.abs(listing.analytics.viewsTrend)}% {t(language, "published.analytics.trend")}</span>
                </div>
              </div>

              <div className="p-4 rounded-xl border dark:border-[rgba(168,85,247,0.25)] border-border dark:bg-[rgba(139,92,246,0.05)] bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="w-4 h-4 dark:text-[#A78BFA] text-primary" />
                  <span className="text-sm dark:text-[#9CA3AF] text-muted-foreground">
                    {t(language, "published.analytics.favorites")}
                  </span>
                </div>
                <div className="text-2xl dark:text-[#E7E7F0] text-foreground mb-1">
                  {listing.analytics.favorites}
                </div>
                <div className={`text-xs flex items-center gap-1 ${
                  listing.analytics.favoritesTrend > 0 
                    ? "dark:text-[#2AF07A] text-green-600" 
                    : "dark:text-[#FF5C8A] text-red-600"
                }`}>
                  <TrendUp className={`w-3 h-3 ${listing.analytics.favoritesTrend < 0 ? "rotate-180" : ""}`} />
                  <span>{Math.abs(listing.analytics.favoritesTrend)}% {t(language, "published.analytics.trend")}</span>
                </div>
              </div>

              <div className="p-4 rounded-xl border dark:border-[rgba(168,85,247,0.25)] border-border dark:bg-[rgba(139,92,246,0.05)] bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 dark:text-[#A78BFA] text-primary" />
                  <span className="text-sm dark:text-[#9CA3AF] text-muted-foreground">
                    {t(language, "published.analytics.offers")}
                  </span>
                </div>
                <div className="text-2xl dark:text-[#E7E7F0] text-foreground">
                  {listing.analytics.offers}
                </div>
              </div>

              <div className="p-4 rounded-xl border dark:border-[rgba(168,85,247,0.25)] border-border dark:bg-[rgba(139,92,246,0.05)] bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 dark:text-[#A78BFA] text-primary" />
                  <span className="text-sm dark:text-[#9CA3AF] text-muted-foreground">
                    {t(language, "published.analytics.avgOffer")}
                  </span>
                </div>
                <div className="text-2xl dark:text-[#E7E7F0] text-foreground">
                  {formatCurrency(listing.analytics.avgOfferPrice, language)}
                </div>
              </div>
            </div>

            {/* Range selector */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={analyticsRange === "7d" ? "default" : "outline"}
                onClick={() => setAnalyticsRange("7d")}
                className="rounded-lg"
              >
                {t(language, "published.analytics.last7Days")}
              </Button>
              <Button
                size="sm"
                variant={analyticsRange === "30d" ? "default" : "outline"}
                onClick={() => setAnalyticsRange("30d")}
                className="rounded-lg"
              >
                {t(language, "published.analytics.last30Days")}
              </Button>
              <Button
                size="sm"
                variant={analyticsRange === "90d" ? "default" : "outline"}
                onClick={() => setAnalyticsRange("90d")}
                className="rounded-lg"
              >
                {t(language, "published.analytics.last90Days")}
              </Button>
            </div>

            {/* Views chart */}
            <div>
              <h4 className="text-sm dark:text-[#E7E7F0] text-foreground mb-3">
                {t(language, "published.analytics.viewsOverTime")}
              </h4>
              <div className="h-48 dark:bg-[rgba(139,92,246,0.03)] bg-gray-50 rounded-xl p-4">
                <ResponsiveContainer width="100%" height="100%" minHeight={180}>
                  <LineChart data={chartData.views}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(168,85,247,0.1)" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => new Date(date).toLocaleDateString(language === "fr" ? "fr-FR" : "en-GB", { month: "short", day: "numeric" })}
                      stroke="#9CA3AF"
                      style={{ fontSize: "12px" }}
                    />
                    <YAxis stroke="#9CA3AF" style={{ fontSize: "12px" }} />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "#0E0E14",
                        border: "1px solid rgba(168,85,247,0.25)",
                        borderRadius: "8px",
                        color: "#E7E7F0"
                      }}
                    />
                    <Line type="monotone" dataKey="value" stroke="#8B5CF6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Favorites chart */}
            <div>
              <h4 className="text-sm dark:text-[#E7E7F0] text-foreground mb-3">
                {t(language, "published.analytics.favoritesOverTime")}
              </h4>
              <div className="h-48 dark:bg-[rgba(139,92,246,0.03)] bg-gray-50 rounded-xl p-4">
                <ResponsiveContainer width="100%" height="100%" minHeight={180}>
                  <LineChart data={chartData.favorites}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(168,85,247,0.1)" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => new Date(date).toLocaleDateString(language === "fr" ? "fr-FR" : "en-GB", { month: "short", day: "numeric" })}
                      stroke="#9CA3AF"
                      style={{ fontSize: "12px" }}
                    />
                    <YAxis stroke="#9CA3AF" style={{ fontSize: "12px" }} />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "#0E0E14",
                        border: "1px solid rgba(168,85,247,0.25)",
                        borderRadius: "8px",
                        color: "#E7E7F0"
                      }}
                    />
                    <Line type="monotone" dataKey="value" stroke="#A78BFA" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          {/* Recommendations Tab */}
          <TabsContent value="recommendations" className="p-6 space-y-4 mt-0">
            {insights.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full dark:bg-[rgba(42,240,122,0.15)] bg-green-100 mx-auto mb-4 flex items-center justify-center">
                  <TrendingUp className="w-8 h-8 dark:text-[#2AF07A] text-green-600" />
                </div>
                <p className="dark:text-[#E7E7F0] text-foreground mb-2">
                  {language === "fr" ? "Aucune recommandation" : "No recommendations"}
                </p>
                <p className="text-sm dark:text-[#9CA3AF] text-muted-foreground">
                  {language === "fr" 
                    ? "Votre annonce est optimale !" 
                    : "Your listing is looking great!"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {insights.map((insight) => (
                  <InsightCard
                    key={insight.id}
                    insight={insight}
                    language={language}
                    onAction={() => handleInsightAction(insight)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}