import { useState, useMemo } from "react";
import { Search, Download, MessageCircle } from "lucide-react";
import { mockConversations, mockMessages, mockSystemEvents, mockOffers, Conversation, Offer } from "../lib/conversationsData";
import { ConversationRow } from "./ConversationRow";
import { MessageBubble } from "./MessageBubble";
import { SystemEventBlock } from "./SystemEventBlock";
import { MessageComposer } from "./MessageComposer";
import { ConversationInfoMenu } from "./ConversationInfoMenu";
import { OfferModal } from "./OfferModal";
import { CounterOfferModal } from "./CounterOfferModal";
import { OfferCard } from "./OfferCard";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { EmptyState } from "./EmptyState";
import { AccountFilter, ACCOUNTS } from "./AccountFilter";
import { RefreshButton } from "./RefreshButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Language, t, formatCurrency } from "../lib/i18n";
import { toast } from "sonner@2.0.3";

interface MessagesPageNewProps {
  language: Language;
}

type SortOption = "newest" | "oldest";

export function MessagesPageNew({ language }: MessagesPageNewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(mockConversations[0]);
  const [accountFilterMode, setAccountFilterMode] = useState<"all" | "selected">("all");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(
    ACCOUNTS.map(a => a.id)
  );
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showCounterModal, setShowCounterModal] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [offers, setOffers] = useState<Offer[]>(mockOffers);

  // Filter conversations
  const filteredConversations = useMemo(() => {
    let filtered = [...mockConversations];

    // Account filter
    if (accountFilterMode === "selected") {
      filtered = filtered.filter(conv => selectedAccounts.includes(conv.accountId));
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        conv =>
          conv.buyerName.toLowerCase().includes(query) ||
          conv.itemTitle.toLowerCase().includes(query) ||
          conv.lastMessage.toLowerCase().includes(query)
      );
    }

    // Sort by most recent
    if (sortBy === "newest") {
      filtered.sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime());
    } else {
      filtered.sort((a, b) => a.lastMessageTime.getTime() - b.lastMessageTime.getTime());
    }

    return filtered;
  }, [searchQuery, accountFilterMode, selectedAccounts, sortBy]);

  // Get messages and events for selected conversation
  const conversationMessages = useMemo(() => {
    if (!selectedConversation) return [];
    return mockMessages.filter(msg => msg.conversationId === selectedConversation.id);
  }, [selectedConversation]);

  const conversationEvents = useMemo(() => {
    if (!selectedConversation) return [];
    return mockSystemEvents.filter(event => event.conversationId === selectedConversation.id);
  }, [selectedConversation]);

  const conversationOffers = useMemo(() => {
    if (!selectedConversation) return [];
    return offers.filter(offer => offer.conversationId === selectedConversation.id);
  }, [selectedConversation, offers]);

  // Merge messages, events, and offers, sorted by timestamp
  const timeline = useMemo(() => {
    const items: Array<{ type: "message" | "event" | "offer"; data: any; timestamp: Date }> = [
      ...conversationMessages.map(msg => ({ type: "message" as const, data: msg, timestamp: msg.timestamp })),
      ...conversationEvents.map(event => ({ type: "event" as const, data: event, timestamp: event.timestamp })),
      ...conversationOffers.map(offer => ({ type: "offer" as const, data: offer, timestamp: offer.timestamp })),
    ];
    return items.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [conversationMessages, conversationEvents, conversationOffers]);

  const handleSendMessage = (content: string) => {
    console.log("Sending message:", content);
    // In real app, this would send the message to the backend
  };

  const handleSendOffer = (amount: number, message?: string) => {
    if (!selectedConversation) return;
    
    const newOffer: Offer = {
      id: `offer_${Date.now()}`,
      conversationId: selectedConversation.id,
      senderId: "me",
      senderName: "Me",
      senderAvatar: "https://i.pravatar.cc/150?u=me",
      amount,
      status: "sent",
      timestamp: new Date(),
      isMe: true,
      message,
    };
    
    setOffers([...offers, newOffer]);
  };

  const handleAcceptOffer = (offer: Offer) => {
    setOffers(offers.map(o => 
      o.id === offer.id ? { ...o, status: "accepted" as const } : o
    ));
    toast.success(
      language === "fr" ? "Offre acceptée" : "Offer accepted"
    );
  };

  const handleDeclineOffer = (offer: Offer) => {
    setOffers(offers.map(o => 
      o.id === offer.id ? { ...o, status: "declined" as const } : o
    ));
    toast.success(
      language === "fr" ? "Offre refusée" : "Offer declined"
    );
  };

  const handleCounterOffer = (offer: Offer) => {
    setSelectedOffer(offer);
    setShowCounterModal(true);
  };

  const handleSendCounter = (amount: number) => {
    if (!selectedConversation || !selectedOffer) return;
    
    // Update original offer to countered
    setOffers(offers.map(o => 
      o.id === selectedOffer.id ? { ...o, status: "countered" as const } : o
    ));
    
    // Create counter-offer
    const counterOffer: Offer = {
      id: `offer_${Date.now()}`,
      conversationId: selectedConversation.id,
      senderId: "me",
      senderName: "Me",
      senderAvatar: "https://i.pravatar.cc/150?u=me",
      amount,
      status: "sent",
      timestamp: new Date(),
      isMe: true,
      parentOfferId: selectedOffer.id,
    };
    
    setOffers([...offers, counterOffer]);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header - Standardized like Notifications */}
      <div className="border-b border-border bg-background pb-6 mb-6 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 sm:gap-6 mb-4">
          <div>
            <h1 className="text-foreground mb-2">{t(language, "messages.title")}</h1>
            <p className="text-muted-foreground">
              {language === "fr" 
                ? "Gérez les conversations multi-comptes et répondez rapidement." 
                : "Manage multi-account conversations and respond quickly."}
            </p>
          </div>
        </div>

        {/* Controls - Standardized filter bar */}
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

          {/* Refresh Button */}
          <RefreshButton
            onRefresh={async () => {
              await new Promise(resolve => setTimeout(resolve, 800));
              toast.success(
                language === "fr" 
                  ? "Messages actualisés" 
                  : "Messages refreshed"
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
      </div>

      {/* Two-pane layout - flex-1 to take remaining height */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Pane - Conversations List */}
        <div className="w-full md:w-80 lg:w-96 border-r dark:border-[rgba(168,85,247,0.25)] border-border bg-card flex flex-col overflow-hidden">
          {/* Conversations List - scrollable */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {filteredConversations.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={MessageCircle}
                  title={t(language, "messages.empty.title")}
                  description={t(language, "messages.empty.description")}
                />
              </div>
            ) : (
              <div>
                {filteredConversations.map(conversation => (
                  <ConversationRow
                    key={conversation.id}
                    conversation={conversation}
                    isActive={selectedConversation?.id === conversation.id}
                    onClick={() => setSelectedConversation(conversation)}
                    language={language}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Pane - Conversation Detail */}
        {selectedConversation ? (
          <div className="hidden md:flex flex-1 flex-col bg-background overflow-hidden">
            {/* Top Bar - fixed header within the column */}
            <div className="border-b dark:border-[rgba(168,85,247,0.25)] border-border bg-card flex-shrink-0">
              {/* Buyer info row */}
              <div className="p-4 flex items-center justify-between">
                {/* Left: Buyer info */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Buyer Avatar */}
                  <img
                    src={selectedConversation.buyerAvatar}
                    alt={selectedConversation.buyerName}
                    className="w-10 h-10 rounded-full object-cover border-2 dark:border-[rgba(168,85,247,0.30)] border-border flex-shrink-0"
                  />

                  <div className="flex-1 min-w-0">
                    {/* Buyer Name + Username */}
                    <div className="flex items-baseline gap-2">
                      <h3 className="dark:text-[#E7E7F0] text-foreground truncate">
                        {selectedConversation.buyerName}
                      </h3>
                      <span className="text-sm dark:text-[#9CA3AF] text-muted-foreground">
                        {selectedConversation.buyerUsername}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Info button */}
                <ConversationInfoMenu
                  hasLabel={selectedConversation.hasLabel}
                  isShipped={selectedConversation.status === "shipped"}
                  language={language}
                />
              </div>

              {/* Item strip - Moved up and made more compact */}
              <div className="px-4 pb-3 flex items-center gap-3">
                {/* Item thumbnail */}
                <img
                  src={selectedConversation.itemThumbnail}
                  alt={selectedConversation.itemTitle}
                  className="w-12 h-12 rounded-xl object-cover border dark:border-[rgba(168,85,247,0.20)] border-border flex-shrink-0"
                />

                {/* Item info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm dark:text-[#E7E7F0] text-foreground truncate">
                    {selectedConversation.itemTitle}
                  </div>
                  <div className="text-xs dark:text-[#A78BFA] text-primary">
                    {formatCurrency(selectedConversation.itemPrice, language)}
                  </div>
                </div>

                {/* Make an offer button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowOfferModal(true)}
                  className="rounded-full dark:border-[rgba(168,85,247,0.40)] border-primary dark:text-[#A78BFA] text-primary hover:dark:bg-[rgba(139,92,246,0.10)] hover:bg-primary/10 flex-shrink-0"
                >
                  {t(language, "messages.offer.makeOffer")}
                </Button>
              </div>
            </div>

            {/* Inline Download CTA (if label available) */}
            {selectedConversation.hasLabel && (
              <div className="p-3 border-b dark:border-[rgba(168,85,247,0.25)] border-border dark:bg-[rgba(139,92,246,0.05)] bg-primary/5 flex-shrink-0">
                <Button
                  className="w-full rounded-xl dark:bg-[#8B5CF6] bg-primary hover:dark:bg-[#7C3AED] hover:bg-primary/90 gap-2"
                  style={{
                    boxShadow: "0 0 16px rgba(139,92,246,0.3)"
                  }}
                  onClick={() => {
                    toast.success(
                      language === "fr" ? "Bordereau téléchargé" : "Label downloaded"
                    );
                  }}
                >
                  <Download className="w-4 h-4" />
                  <span>{t(language, "messages.inline.downloadLabel")}</span>
                </Button>
              </div>
            )}

            {/* Messages Area - scrollable */}
            <div className="flex-1 overflow-y-auto p-6 dark:bg-[#0A0A0E] bg-background scrollbar-thin">
              {timeline.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <MessageCircle className="w-12 h-12 dark:text-[#9CA3AF] text-muted-foreground mx-auto mb-3" />
                    <p className="dark:text-[#9CA3AF] text-muted-foreground">
                      {t(language, "messages.empty.noMessagesYet")}
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  {timeline.map((item, index) => {
                    if (item.type === "message") {
                      return (
                        <MessageBubble
                          key={item.data.id}
                          message={item.data}
                          language={language}
                        />
                      );
                    } else if (item.type === "event") {
                      return (
                        <SystemEventBlock
                          key={item.data.id}
                          event={item.data}
                          language={language}
                        />
                      );
                    } else {
                      return (
                        <OfferCard
                          key={item.data.id}
                          offer={item.data}
                          language={language}
                          onAccept={() => handleAcceptOffer(item.data)}
                          onDecline={() => handleDeclineOffer(item.data)}
                          onCounter={() => handleCounterOffer(item.data)}
                        />
                      );
                    }
                  })}
                </div>
              )}
            </div>

            {/* Composer - fixed at bottom */}
            <MessageComposer
              buyerName={selectedConversation.buyerName}
              language={language}
              onSendMessage={handleSendMessage}
            />
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center dark:bg-[#0A0A0E] bg-background">
            <EmptyState
              icon={MessageCircle}
              title={t(language, "messages.empty.title")}
              description={t(language, "messages.empty.description")}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedConversation && (
        <>
          <OfferModal
            open={showOfferModal}
            onClose={() => setShowOfferModal(false)}
            itemPrice={selectedConversation.itemPrice}
            itemTitle={selectedConversation.itemTitle}
            language={language}
            onSendOffer={handleSendOffer}
          />

          <CounterOfferModal
            open={showCounterModal}
            onClose={() => {
              setShowCounterModal(false);
              setSelectedOffer(null);
            }}
            originalAmount={selectedOffer?.amount || 0}
            itemPrice={selectedConversation.itemPrice}
            language={language}
            onSendCounter={handleSendCounter}
          />
        </>
      )}
    </div>
  );
}