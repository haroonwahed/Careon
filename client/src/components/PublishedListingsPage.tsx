import { useState } from "react";
import { Search, MoreVertical, ExternalLink, Copy } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { RefreshButton } from "./RefreshButton";
import { Skeleton } from "./ui/skeleton";
import { Language, t } from "../lib/i18n";
import { ACCOUNTS } from "./AccountFilter";
import { MOCK_PUBLISHED_LISTINGS, PublishedListing } from "../lib/publishedListingsData";
import { toast } from "sonner@2.0.3";

interface PublishedListingsPageProps {
  language: Language;
}

type TabType = "active" | "sold";
type SortType = "newest" | "views" | "favorites";

export function PublishedListingsPage({ language }: PublishedListingsPageProps) {
  const [listings] = useState<PublishedListing[]>(MOCK_PUBLISHED_LISTINGS);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<TabType>("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortType>("newest");
  const [isLoading, setIsLoading] = useState(false);
  const [boostDialogOpen, setBoostDialogOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<PublishedListing | null>(null);

  const handleRefresh = async () => {
    setIsLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsLoading(false);
  };

  const handleBoost = (listing: PublishedListing) => {
    setSelectedListing(listing);
    setBoostDialogOpen(true);
  };

  const confirmBoost = () => {
    if (selectedListing) {
      toast.success(t(language, "published.toast.boosted"));
      setBoostDialogOpen(false);
      setSelectedListing(null);
    }
  };

  const handleCopyLink = (listing: PublishedListing) => {
    navigator.clipboard.writeText(listing.vintedUrl);
    toast.success(t(language, "published.toast.linkCopied"));
  };

  // Filter by account
  const accountFilteredListings = selectedAccountId
    ? listings.filter((l) => l.accountId === selectedAccountId)
    : [];

  // Filter by tab (active/sold)
  const tabFilteredListings = accountFilteredListings.filter(
    (l) => l.status === activeTab
  );

  // Filter by search
  const searchFilteredListings = tabFilteredListings.filter((l) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      l.title.toLowerCase().includes(query) || l.sku.toLowerCase().includes(query)
    );
  });

  // Sort listings
  const sortedListings = [...searchFilteredListings].sort((a, b) => {
    switch (sortBy) {
      case "newest":
        return b.publishedAt.getTime() - a.publishedAt.getTime();
      case "views":
        return b.views - a.views;
      case "favorites":
        return b.favorites - a.favorites;
      default:
        return 0;
    }
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat(language === "fr" ? "fr-FR" : "en-GB", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
    }).format(price);
  };

  const renderEmptyState = () => {
    if (!selectedAccountId) {
      return (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-16 h-16 rounded-2xl dark:bg-[rgba(139,92,246,0.15)] bg-primary/10 dark:border-[rgba(168,85,247,0.25)] border-primary/25 border flex items-center justify-center mb-4">
            <Search className="w-8 h-8 dark:text-[#8B5CF6] text-primary" />
          </div>
          <p className="dark:text-[#E7E7F0] text-foreground text-center max-w-md">
            {t(language, "published.empty.selectAccount")}
          </p>
        </div>
      );
    }

    if (sortedListings.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-16 h-16 rounded-2xl dark:bg-[rgba(139,92,246,0.15)] bg-primary/10 dark:border-[rgba(168,85,247,0.25)] border-primary/25 border flex items-center justify-center mb-4">
            <Search className="w-8 h-8 dark:text-[#8B5CF6] text-primary" />
          </div>
          <p className="dark:text-[#E7E7F0] text-foreground text-center max-w-md">
            {t(language, "published.empty.noListings")}
          </p>
        </div>
      );
    }

    return null;
  };

  const renderSkeletonCards = () => {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Card
            key={i}
            className="rounded-2xl dark:border-[rgba(168,85,247,0.25)] border-primary/25 p-4 dark:bg-[#0E0E14] bg-card"
            style={{
              boxShadow: "0 0 0 1px rgba(168,85,247,0.25), 0 0 28px rgba(168,85,247,0.10)",
            }}
          >
            <Skeleton className="w-full aspect-square rounded-xl mb-3" />
            <Skeleton className="h-5 w-3/4 mb-3" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-10 w-full rounded-full mt-3" />
          </Card>
        ))}
      </div>
    );
  };

  const renderListingCard = (listing: PublishedListing) => {
    return (
      <Card
        key={listing.id}
        className="rounded-2xl dark:border-[rgba(168,85,247,0.25)] border-primary/25 p-4 dark:bg-[#0E0E14] bg-card dark:hover:border-[rgba(168,85,247,0.4)] hover:border-primary/40 transition-all group"
        style={{
          boxShadow: "0 0 0 1px rgba(168,85,247,0.25), 0 0 28px rgba(168,85,247,0.10)",
        }}
      >
        {/* Image */}
        <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-3 dark:bg-[#12121A] bg-gray-100">
          <img
            src={listing.imageUrl}
            alt={listing.title}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Title */}
        <h3
          className="dark:text-[#E7E7F0] text-foreground truncate mb-2"
          style={{ fontSize: "15px", fontWeight: 600 }}
        >
          {listing.title}
        </h3>

        {/* Stats */}
        <div
          className="dark:text-[#9CA3AF] text-muted-foreground mb-3 flex items-center gap-1 flex-wrap"
          style={{ fontSize: "13px" }}
        >
          <span>
            {listing.views} {t(language, "published.stats.views")}
          </span>
          <span>•</span>
          <span>
            {listing.favorites} {t(language, "published.stats.favorites")}
          </span>
          <span>•</span>
          <span className="dark:text-[#C7B8FF] text-primary" style={{ fontWeight: 600 }}>
            {formatPrice(listing.price)}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            className="flex-1 rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA] hover:from-[#9D6FFF] hover:to-[#B89FFF] text-white border-0"
            onClick={() => handleBoost(listing)}
            style={{ fontWeight: 600 }}
          >
            {t(language, "published.button.boost")}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="rounded-full w-10 h-10 dark:border-[rgba(168,85,247,0.4)] border-primary/40 dark:bg-[#0E0E14] bg-card dark:hover:bg-[rgba(139,92,246,0.10)] hover:bg-primary/10"
              >
                <MoreVertical className="w-4 h-4 dark:text-[#9CA3AF] text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="rounded-xl dark:bg-[#0E0E14] bg-popover dark:border-[rgba(168,85,247,0.25)] border-border"
            >
              <DropdownMenuItem
                className="rounded-lg cursor-pointer"
                onClick={() => window.open(listing.vintedUrl, "_blank")}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                {t(language, "published.action.viewOnVinted")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="rounded-lg cursor-pointer"
                onClick={() => handleCopyLink(listing)}
              >
                <Copy className="w-4 h-4 mr-2" />
                {t(language, "published.action.copyLink")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>
    );
  };

  return (
    <>
      {/* Header */}
      <div className="border-b border-border bg-background pb-6 mb-6">
        <h1
          className="dark:text-[#E7E7F0] text-foreground mb-6"
          style={{ fontSize: "28px", fontWeight: 700 }}
        >
          {t(language, "published.title")}
        </h1>

        {/* Controls */}
        <div className="flex flex-col gap-4">
          {/* Row 1: Account selector + Tabs */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Account Selector */}
            <div className="w-full sm:w-64">
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger className="rounded-xl dark:border-[rgba(168,85,247,0.25)] border-primary/25 dark:bg-[#0E0E14] bg-card h-11">
                  <div className="flex items-center gap-2 w-full">
                    {selectedAccountId ? (
                      <>
                        {(() => {
                          const account = ACCOUNTS.find((a) => a.id === selectedAccountId);
                          return (
                            <>
                              <Avatar className="w-6 h-6 rounded-lg">
                                <AvatarFallback
                                  className="rounded-lg text-white text-xs"
                                  style={{
                                    backgroundColor: "#8B5CF6",
                                    fontWeight: 600,
                                  }}
                                >
                                  {account?.initial}
                                </AvatarFallback>
                              </Avatar>
                              <span className="dark:text-[#E7E7F0] text-foreground">{account?.name}</span>
                            </>
                          );
                        })()}
                      </>
                    ) : (
                      <span className="dark:text-[#9CA3AF] text-muted-foreground">
                        {t(language, "published.accountSelect.placeholder")}
                      </span>
                    )}
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-xl dark:bg-[#0E0E14] bg-popover dark:border-[rgba(168,85,247,0.25)] border-border">
                  {ACCOUNTS.map((account) => (
                    <SelectItem
                      key={account.id}
                      value={account.id}
                      className="rounded-lg cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6 rounded-lg">
                          <AvatarFallback
                            className="rounded-lg text-white text-xs"
                            style={{ backgroundColor: "#8B5CF6", fontWeight: 600 }}
                          >
                            {account.initial}
                          </AvatarFallback>
                        </Avatar>
                        <span>{account.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Active/Sold Tabs */}
            {selectedAccountId && (
              <div className="flex items-center gap-2 p-1 rounded-full dark:bg-[#12121A] bg-gray-100 dark:border-[rgba(168,85,247,0.25)] border-primary/25 border">
                <button
                  className={`px-5 py-2 rounded-full text-sm transition-all ${
                    activeTab === "active"
                      ? "bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA] text-white"
                      : "dark:text-[#9CA3AF] text-muted-foreground dark:hover:text-[#E7E7F0] hover:text-foreground"
                  }`}
                  style={{ fontWeight: 600 }}
                  onClick={() => setActiveTab("active")}
                >
                  {t(language, "published.tabs.active")}
                </button>
                <button
                  className={`px-5 py-2 rounded-full text-sm transition-all ${
                    activeTab === "sold"
                      ? "bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA] text-white"
                      : "dark:text-[#9CA3AF] text-muted-foreground dark:hover:text-[#E7E7F0] hover:text-foreground"
                  }`}
                  style={{ fontWeight: 600 }}
                  onClick={() => setActiveTab("sold")}
                >
                  {t(language, "published.tabs.sold")}
                </button>
              </div>
            )}
          </div>

          {/* Row 2: Search + Sort + Refresh */}
          {selectedAccountId && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 dark:text-[#9CA3AF] text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={t(language, "published.search.placeholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 rounded-xl dark:border-[rgba(168,85,247,0.25)] border-primary/25 dark:bg-[#0E0E14] bg-card h-11 dark:text-[#E7E7F0] text-foreground"
                />
              </div>

              {/* Sort */}
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortType)}>
                <SelectTrigger className="rounded-xl dark:border-[rgba(168,85,247,0.25)] border-primary/25 dark:bg-[#0E0E14] bg-card h-11 w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl dark:bg-[#0E0E14] bg-popover dark:border-[rgba(168,85,247,0.25)] border-border">
                  <SelectItem value="newest" className="rounded-lg cursor-pointer">
                    {t(language, "published.sort.newest")}
                  </SelectItem>
                  <SelectItem value="views" className="rounded-lg cursor-pointer">
                    {t(language, "published.sort.views")}
                  </SelectItem>
                  <SelectItem value="favorites" className="rounded-lg cursor-pointer">
                    {t(language, "published.sort.favorites")}
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Refresh */}
              <RefreshButton onRefresh={handleRefresh} language={language} />
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div>
        {renderEmptyState()}
        {selectedAccountId &&
          sortedListings.length > 0 &&
          (isLoading ? (
            renderSkeletonCards()
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {sortedListings.map(renderListingCard)}
            </div>
          ))}
      </div>

      {/* Boost Confirmation Dialog */}
      <AlertDialog open={boostDialogOpen} onOpenChange={setBoostDialogOpen}>
        <AlertDialogContent className="rounded-2xl dark:bg-[#0E0E14] bg-card dark:border-[rgba(168,85,247,0.25)] border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-[#E7E7F0] text-foreground">
              {t(language, "published.dialog.boost.title")}
            </AlertDialogTitle>
            <AlertDialogDescription className="dark:text-[#9CA3AF] text-muted-foreground">
              {t(language, "published.dialog.boost.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl dark:border-[rgba(168,85,247,0.25)] border-border dark:bg-[#0E0E14] bg-card dark:text-[#E7E7F0] text-foreground">
              {t(language, "published.dialog.boost.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBoost}
              className="rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA] hover:from-[#9D6FFF] hover:to-[#B89FFF] text-white border-0"
            >
              {t(language, "published.dialog.boost.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}