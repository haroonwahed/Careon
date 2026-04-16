import { useState } from "react";
import { Search, ExternalLink, Pause, StopCircle, RefreshCw } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { PublishForm } from "./PublishForm";
import { ListingsTable } from "./ListingsTable";
import { EmptyState } from "./EmptyState";
import { MOCK_LISTINGS, Listing, ListingStatus } from "../lib/listingsData";
import { Megaphone } from "lucide-react";
import { Language, t } from "../lib/i18n";
import { AccountFilter, ACCOUNTS } from "./AccountFilter";

interface ListingsPublisherPageProps {
  language: Language;
}

export function ListingsPublisherPage({ language }: ListingsPublisherPageProps) {
  const [listings, setListings] = useState<Listing[]>(MOCK_LISTINGS);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(
    ACCOUNTS.map((a) => a.id)
  );
  const [filterMode, setFilterMode] = useState<"all" | "selected">("all");
  const [statusFilter, setStatusFilter] = useState<ListingStatus | "all">("all");
  const [sortBy, setSortBy] = useState("created");

  const handleAccountsChange = (accounts: string[]) => {
    setSelectedAccounts(accounts);
  };

  const handleModeChange = (mode: "all" | "selected") => {
    setFilterMode(mode);
    if (mode === "all") {
      setSelectedAccounts(ACCOUNTS.map((a) => a.id));
    }
  };

  // Filter listings
  const filteredListings = listings.filter((listing) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !listing.title.toLowerCase().includes(query) &&
        !listing.sku.toLowerCase().includes(query) &&
        !listing.listingId.toLowerCase().includes(query)
      ) {
        return false;
      }
    }

    // Account filter
    if (filterMode === "selected") {
      const listingAccount = ACCOUNTS.find((a) => a.name === listing.accountName);
      if (!listingAccount || !selectedAccounts.includes(listingAccount.id)) {
        return false;
      }
    }

    // Status filter
    if (statusFilter !== "all") {
      if (listing.status !== statusFilter) {
        return false;
      }
    }

    return true;
  });

  // Sort listings
  const sortedListings = [...filteredListings].sort((a, b) => {
    switch (sortBy) {
      case "created":
        return b.createdAt.getTime() - a.createdAt.getTime();
      case "sync":
        return b.lastSync.getTime() - a.lastSync.getTime();
      case "price":
        return b.price - a.price;
      default:
        return 0;
    }
  });

  const handleNewListing = (listing: Listing) => {
    setListings([listing, ...listings]);
  };

  return (
    <>
      {/* Header */}
      <div className="border-b border-border bg-background pb-6 mb-6">
        <div>
          <h1 className="text-foreground mb-2">{t(language, "publisher.title")}</h1>
          <p className="text-muted-foreground">
            {t(language, "publisher.subtitle")}
          </p>
        </div>
      </div>

      {/* Publish Form */}
      <div className="mb-6">
        <PublishForm accounts={ACCOUNTS.map((a) => a.name)} onPublish={handleNewListing} language={language} />
      </div>

      {/* Active Listings Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-foreground">{t(language, "publisher.activeListings")}</h2>
          <AccountFilter
            selectedAccounts={selectedAccounts}
            onAccountsChange={handleAccountsChange}
            mode={filterMode}
            onModeChange={handleModeChange}
            variant="compact"
            language={language}
          />
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {/* Search */}
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t(language, "publisher.search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-2xl"
            />
          </div>

          {/* Status filter */}
          <Select
            value={statusFilter}
            onValueChange={(value) =>
              setStatusFilter(value as ListingStatus | "all")
            }
          >
            <SelectTrigger className="rounded-2xl">
              <SelectValue placeholder={t(language, "publisher.allStatus")} />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="all">{t(language, "publisher.allStatus")}</SelectItem>
              <SelectItem value="queued">{t(language, "publisher.status.queued")}</SelectItem>
              <SelectItem value="posting">{t(language, "publisher.status.posting")}</SelectItem>
              <SelectItem value="active">{t(language, "publisher.status.active")}</SelectItem>
              <SelectItem value="failed">{t(language, "publisher.status.failed")}</SelectItem>
              <SelectItem value="ended">{t(language, "publisher.status.ended")}</SelectItem>
              <SelectItem value="paused">{t(language, "publisher.status.paused")}</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort */}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="rounded-2xl">
              <SelectValue placeholder={t(language, "publisher.sortBy")} />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="created">{t(language, "publisher.sortOptions.created")}</SelectItem>
              <SelectItem value="sync">{t(language, "publisher.sortOptions.sync")}</SelectItem>
              <SelectItem value="price">{t(language, "publisher.sortOptions.price")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Content */}
        {sortedListings.length === 0 && !searchQuery && statusFilter === "all" ? (
          <EmptyState
            icon={Megaphone}
            title={t(language, "publisher.empty.title")}
            description={t(language, "publisher.empty.description")}
          />
        ) : sortedListings.length === 0 ? (
          <EmptyState
            icon={Search}
            title={t(language, "common.noResults")}
            description={t(language, "publisher.empty.description")}
          />
        ) : (
          <ListingsTable listings={sortedListings} language={language} />
        )}
      </div>
    </>
  );
}
