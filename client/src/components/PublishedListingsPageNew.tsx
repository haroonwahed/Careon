import { useState, useMemo } from "react";
import { Search, RefreshCw } from "lucide-react";
import { mockPublishedListings, PublishedListing } from "../lib/publishedListingsData";
import { ListingCardNew } from "./ListingCardNew";
import { ListingDetailsPage } from "./ListingDetailsPage";
import { RepostModal } from "./RepostModal";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { EmptyState } from "./EmptyState";
import { AccountFilter, ACCOUNTS } from "./AccountFilter";
import { RefreshButton } from "./RefreshButton";
import { Language, t } from "../lib/i18n";
import { toast } from "sonner@2.0.3";

interface PublishedListingsPageNewProps {
  language: Language;
}

type SortFilter = "newest" | "views" | "favorites" | "hidden" | "boostActive";

export function PublishedListingsPageNew({ language }: PublishedListingsPageNewProps) {
  const [selectedAccount, setSelectedAccount] = useState<string>("acc_001");
  const [activeTab, setActiveTab] = useState<"active" | "sold">("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortFilter, setSortFilter] = useState<SortFilter>("newest");
  const [selectedListing, setSelectedListing] = useState<PublishedListing | null>(null);
  const [repostModalOpen, setRepostModalOpen] = useState(false);
  const [listingToRepost, setListingToRepost] = useState<PublishedListing | null>(null);
  const [listings, setListings] = useState<PublishedListing[]>(mockPublishedListings);

  // Filter and sort listings
  const filteredListings = useMemo(() => {
    let filtered = [...listings];

    // Account filter
    filtered = filtered.filter(listing => listing.accountId === selectedAccount);

    // Tab filter
    filtered = filtered.filter(listing => 
      activeTab === "active" ? listing.status === "active" : listing.status === "sold"
    );

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        listing =>
          listing.title.toLowerCase().includes(query) ||
          listing.sku.toLowerCase().includes(query)
      );
    }

    // Sort/Filter based on dropdown selection
    switch (sortFilter) {
      case "newest":
        filtered.sort((a, b) => b.publishedDate.getTime() - a.publishedDate.getTime());
        break;
      case "views":
        filtered.sort((a, b) => b.analytics.views - a.analytics.views);
        break;
      case "favorites":
        filtered.sort((a, b) => b.analytics.favorites - a.analytics.favorites);
        break;
      case "hidden":
        filtered = filtered.filter(listing => listing.isHidden);
        break;
      case "boostActive":
        filtered = filtered.filter(listing => listing.boostActive);
        break;
    }

    return filtered;
  }, [selectedAccount, activeTab, searchQuery, sortFilter, listings]);

  const handleListingClick = (listing: PublishedListing) => {
    setSelectedListing(listing);
  };

  const handleBackToListings = () => {
    setSelectedListing(null);
  };

  const handleBoost = (listing: PublishedListing) => {
    // Toggle boost
    setListings(listings.map(l =>
      l.id === listing.id ? { ...l, boostActive: !l.boostActive } : l
    ));
    
    toast.success(
      listing.boostActive 
        ? (language === "fr" ? "Boost désactivé" : "Boost deactivated")
        : t(language, "published.toast.boosted")
    );
  };

  const handleRepost = (listing: PublishedListing) => {
    setListingToRepost(listing);
    setRepostModalOpen(true);
  };

  const handleConfirmRepost = () => {
    if (!listingToRepost) return;
    
    // Update listing with new published date
    setListings(listings.map(l =>
      l.id === listingToRepost.id
        ? { ...l, publishedDate: new Date(), lastSyncDate: new Date() }
        : l
    ));
    
    toast.success(t(language, "published.toast.reposted"));
    setRepostModalOpen(false);
    setListingToRepost(null);
  };

  const handleViewOnVinted = (listing: PublishedListing) => {
    window.open(listing.vintedUrl, "_blank");
  };

  const handleCopyLink = (listing: PublishedListing) => {
    navigator.clipboard.writeText(listing.vintedUrl);
    toast.success(t(language, "published.toast.linkCopied"));
  };

  const handleHideToggle = (listing: PublishedListing) => {
    setListings(listings.map(l =>
      l.id === listing.id ? { ...l, isHidden: !l.isHidden } : l
    ));
    
    toast.success(
      listing.isHidden
        ? (language === "fr" ? "Annonce visible" : "Listing visible")
        : t(language, "published.toast.hidden")
    );
  };

  const handleSaveListing = (updates: Partial<PublishedListing>) => {
    if (!selectedListing) return;
    
    setListings(listings.map(l =>
      l.id === selectedListing.id ? { ...l, ...updates, lastSyncDate: new Date() } : l
    ));
    
    setSelectedListing({ ...selectedListing, ...updates } as PublishedListing);
  };

  const handleRefresh = () => {
    toast.success(
      language === "fr" ? "Actualisation en cours..." : "Refreshing..."
    );
  };

  // If a listing is selected, show the details page
  if (selectedListing) {
    return (
      <ListingDetailsPage
        listing={selectedListing}
        language={language}
        onBack={handleBackToListings}
        onBoost={() => handleBoost(selectedListing)}
        onRepost={() => handleRepost(selectedListing)}
        onViewOnVinted={() => handleViewOnVinted(selectedListing)}
        onSave={handleSaveListing}
      />
    );
  }

  return (
    <>
      {/* Header - Standardized like Notifications */}
      <div className="border-b border-border bg-background pb-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 sm:gap-6 mb-4">
          <div>
            <h1 className="text-foreground mb-2">{t(language, "published.title")}</h1>
            <p className="text-muted-foreground">
              {language === "fr" ? "Analysez les performances et optimisez vos annonces." : "Analyze performance and optimize your listings."}
            </p>
          </div>
        </div>

        {/* Controls - Standardized filter bar */}
        <div className="flex flex-wrap items-center gap-3 mt-4">
          {/* Account selector */}
          <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger className="w-[200px] rounded-xl">
              <SelectValue placeholder="Boutique Alice" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="acc_001">Boutique Alice</SelectItem>
            </SelectContent>
          </Select>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-[400px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t(language, "common.search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>

          {/* Refresh Button */}
          <RefreshButton
            onRefresh={async () => {
              await new Promise(resolve => setTimeout(resolve, 800));
              toast.success(
                language === "fr" 
                  ? "Annonces actualisées" 
                  : "Listings refreshed"
              );
            }}
            language={language}
          />

          {/* Sort/Filter dropdown */}
          <Select value={sortFilter} onValueChange={(v) => setSortFilter(v as SortFilter)}>
            <SelectTrigger className="w-[180px] rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="newest">{t(language, "published.sort.newest")}</SelectItem>
              <SelectItem value="views">{t(language, "published.sort.views")}</SelectItem>
              <SelectItem value="favorites">{t(language, "published.sort.favorites")}</SelectItem>
              <SelectItem value="hidden">{t(language, "published.sort.hidden")}</SelectItem>
              <SelectItem value="boostActive">{t(language, "published.sort.boostActive")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "active" | "sold")}>
          <TabsList className="rounded-xl h-auto p-1 bg-muted/50">
            <TabsTrigger value="active" className="rounded-lg">
              {t(language, "published.tabs.active")}
            </TabsTrigger>
            <TabsTrigger value="sold" className="rounded-lg">
              {t(language, "published.tabs.sold")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Main content area */}
      <div className="pb-6">
        {filteredListings.length === 0 ? (
          <EmptyState
            icon={Search}
            title={t(language, "published.empty.noListings")}
            description={
              sortFilter === "hidden"
                ? (language === "fr" ? "Aucune annonce masquée" : "No hidden listings")
                : sortFilter === "boostActive"
                ? (language === "fr" ? "Aucune annonce boostée" : "No boosted listings")
                : t(language, "published.empty.selectAccount")
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredListings.map((listing) => (
              <ListingCardNew
                key={listing.id}
                listing={listing}
                language={language}
                onClick={() => handleListingClick(listing)}
                onBoost={() => handleBoost(listing)}
                onRepost={() => handleRepost(listing)}
                onViewOnVinted={() => handleViewOnVinted(listing)}
                onCopyLink={() => handleCopyLink(listing)}
                onHideToggle={() => handleHideToggle(listing)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Repost Modal */}
      <RepostModal
        open={repostModalOpen}
        onClose={() => {
          setRepostModalOpen(false);
          setListingToRepost(null);
        }}
        onConfirm={handleConfirmRepost}
        language={language}
      />
    </>
  );
}