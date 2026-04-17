import { useState, useMemo } from "react";
import { Search, Package, Plus, Heart, Bot } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { AccountFilter, ACCOUNTS } from "./AccountFilter";
import { FavoriteRow } from "./FavoriteRow";
import { ConversationModal } from "./ConversationModal";
import { EmptyState } from "./EmptyState";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { RefreshButton } from "./RefreshButton";
import { AutoOfferBotModal } from "./AutoOfferBotModal";
import { mockFavorites, Favorite } from "../lib/favoritesData";
import { Language, t } from "../lib/i18n";
import { toast } from "sonner@2.0.3";

type SortOption = "newest" | "oldest";

interface NotificationsPageProps {
  isLoading?: boolean;
  language: Language;
}

export function NotificationsPage({ isLoading = false, language }: NotificationsPageProps) {
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(
    ACCOUNTS.map(a => a.id)
  );
  const [accountFilterMode, setAccountFilterMode] = useState<"all" | "selected">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [selectedFavorite, setSelectedFavorite] = useState<Favorite | null>(null);
  const [autoOfferBotEnabled, setAutoOfferBotEnabled] = useState(false);
  const [showBotModal, setShowBotModal] = useState(false);

  // Filter and sort favorites
  const filteredFavorites = useMemo(() => {
    let filtered = [...mockFavorites];

    // Account filter
    if (accountFilterMode === "selected") {
      filtered = filtered.filter(fav => selectedAccounts.includes(fav.accountId));
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        fav =>
          fav.itemTitle.toLowerCase().includes(query) ||
          fav.itemSku?.toLowerCase().includes(query) ||
          fav.itemId.toLowerCase().includes(query) ||
          fav.userHandle.toLowerCase().includes(query)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === "newest") {
        return b.timestamp.getTime() - a.timestamp.getTime();
      } else {
        return a.timestamp.getTime() - b.timestamp.getTime();
      }
    });

    return filtered;
  }, [accountFilterMode, selectedAccounts, searchQuery, sortBy]);

  // Show account chip only when viewing all accounts or when multiple accounts are selected
  const showAccountChip = accountFilterMode === "all" || selectedAccounts.length > 1;

  return (
    <>
      {/* Header */}
      <div className="border-b border-border bg-background pb-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 sm:gap-6 mb-4">
          <div>
            <h1 className="text-foreground mb-2">{t(language, "notifications.title")}</h1>
            <p className="text-muted-foreground">
              {t(language, "notifications.favoritesOnly")}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mt-4">
          {/* Account Filter */}
          <AccountFilter
            selectedAccounts={selectedAccounts}
            onAccountsChange={setSelectedAccounts}
            mode={accountFilterMode}
            onModeChange={setAccountFilterMode}
            language={language}
          />

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

          {/* Auto Offer Bot Toggle */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border dark:border-border border-border dark:bg-card/50 bg-card/30">
            <Bot className="w-4 h-4 dark:text-primary text-primary" />
            <span className="text-sm dark:text-foreground text-foreground">Bot</span>
            <Switch 
              checked={autoOfferBotEnabled} 
              onCheckedChange={(checked) => {
                setAutoOfferBotEnabled(checked);
                toast.success(
                  checked 
                    ? (language === "fr" ? "Bot activé" : "Bot enabled")
                    : (language === "fr" ? "Bot désactivé" : "Bot disabled")
                );
              }}
            />
          </div>

          {/* Configure Bot Button */}
          <Button
            variant="outline"
            onClick={() => setShowBotModal(true)}
            className="rounded-xl gap-2 dark:hover:bg-primary/10 hover:bg-primary/5 dark:hover:border-primary/40 hover:border-primary/30"
          >
            <Bot className="w-4 h-4" />
            {language === "fr" ? "Configurer" : "Configure"}
          </Button>

          {/* Refresh Button */}
          <RefreshButton
            onRefresh={async () => {
              await new Promise(resolve => setTimeout(resolve, 800));
              toast.success(
                language === "fr" 
                  ? "Notifications actualisées" 
                  : "Notifications refreshed"
              );
            }}
            language={language}
          />

          {/* Sort */}
          <Select value={sortBy} onValueChange={(val) => setSortBy(val as SortOption)}>
            <SelectTrigger className="w-[140px] rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="newest">{t(language, "common.newest")}</SelectItem>
              <SelectItem value="oldest">{t(language, "common.oldest")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bot Status Summary */}
        {autoOfferBotEnabled && (
          <div className="mt-4 p-3 rounded-xl border dark:border-primary/30 border-primary/20 dark:bg-primary/10 bg-primary/5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg dark:bg-primary/20 bg-primary/10">
                  <Bot className="w-4 h-4 dark:text-primary text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium dark:text-foreground text-foreground">
                    {language === "fr" ? "Bot d'offres automatiques : ON" : "Automatic Offers Bot: ON"}
                  </p>
                  <p className="text-xs dark:text-muted-foreground text-muted-foreground">
                    {language === "fr" ? "Mode : -10%" : "Mode: -10%"}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowBotModal(true)}
                className="rounded-lg dark:text-primary text-primary dark:hover:bg-primary/20 hover:bg-primary/10"
              >
                {language === "fr" ? "Modifier" : "Edit"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Favorites List */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <LoadingSkeleton count={5} />
          </div>
        ) : filteredFavorites.length === 0 ? (
          <div className="p-12">
            <EmptyState
              icon={Heart}
              title="No favorites yet"
              description={
                searchQuery
                  ? "Try adjusting your search or filters"
                  : "When someone favorites your items, they'll appear here"
              }
            />
            {!searchQuery && (
              <div className="flex justify-center gap-3 mt-6">
                <Button variant="outline" className="rounded-xl gap-2">
                  <Package className="w-4 h-4" />
                  View Listings
                </Button>
                <Button className="rounded-xl gap-2">
                  <Plus className="w-4 h-4" />
                  Add Product
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredFavorites.map(favorite => (
              <FavoriteRow
                key={favorite.id}
                favorite={favorite}
                showAccountChip={showAccountChip}
                onClick={() => setSelectedFavorite(favorite)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Conversation Modal */}
      <ConversationModal
        favorite={selectedFavorite}
        onClose={() => setSelectedFavorite(null)}
        language={language}
      />

      {/* Auto Offer Bot Modal */}
      <AutoOfferBotModal
        open={showBotModal}
        onOpenChange={setShowBotModal}
        language={language}
        botEnabled={autoOfferBotEnabled}
        onBotEnabledChange={setAutoOfferBotEnabled}
      />
    </>
  );
}