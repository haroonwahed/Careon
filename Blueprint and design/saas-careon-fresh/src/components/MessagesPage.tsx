import { useState } from "react";
import { MessageSquare, Search } from "lucide-react";
import { MessageRow } from "./MessageRow";
import { EmptyState } from "./EmptyState";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { MessageDetailPage } from "./MessageDetailPage";
import { AccountFilter, ACCOUNTS } from "./AccountFilter";
import { RefreshButton } from "./RefreshButton";
import { MESSAGES, formatMessageTimestamp } from "../lib/messagesData";
import { Input } from "./ui/input";
import { Language, t } from "../lib/i18n";
import { toast } from "sonner@2.0.3";

interface MessagesPageProps {
  isLoading?: boolean;
  language: Language;
}

export function MessagesPage({ isLoading = false, language }: MessagesPageProps) {
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(
    ACCOUNTS.map((a) => a.id)
  );
  const [filterMode, setFilterMode] = useState<"all" | "selected">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);

  const handleAccountsChange = (accounts: string[]) => {
    setSelectedAccounts(accounts);
  };

  const handleModeChange = (mode: "all" | "selected") => {
    setFilterMode(mode);
    if (mode === "all") {
      setSelectedAccounts(ACCOUNTS.map((a) => a.id));
    }
  };

  const filteredMessages = MESSAGES.filter((message) => {
    // Filter by account
    const accountMatch = filterMode === "all" || selectedAccounts.includes(message.accountId);
    
    // Filter by search query
    const searchMatch = !searchQuery || 
      message.sender.toLowerCase().includes(searchQuery.toLowerCase()) ||
      message.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      message.preview.toLowerCase().includes(searchQuery.toLowerCase());
    
    return accountMatch && searchMatch;
  });

  // If a conversation is selected, show the detail view
  if (selectedConversation) {
    return (
      <MessageDetailPage
        conversationPartner={selectedConversation}
        onBack={() => setSelectedConversation(null)}
        language={language}
      />
    );
  }

  return (
    <>
      {/* Header */}
      <div className="border-b border-border bg-background pb-6 mb-6">
        <div className="flex flex-col gap-4 sm:gap-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 sm:gap-6">
            <div>
              <h1 className="text-foreground mb-2">{t(language, "messages.title")}</h1>
              <p className="text-muted-foreground">
                {t(language, "messages.empty.description")}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <AccountFilter
                selectedAccounts={selectedAccounts}
                onAccountsChange={handleAccountsChange}
                mode={filterMode}
                onModeChange={handleModeChange}
                variant="compact"
                language={language}
              />
              
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
            </div>
          </div>

          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder={t(language, "messages.search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-2xl border-input bg-background"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div>
        {isLoading ? (
          <LoadingSkeleton count={8} type="message" />
        ) : filteredMessages.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title={t(language, "messages.empty.title")}
            description={t(language, "messages.empty.description")}
          />
        ) : (
          <div className="space-y-3">
            {filteredMessages.map((message) => (
              <div
                key={message.id}
                onClick={() => setSelectedConversation(message.sender)}
                className="cursor-pointer"
              >
                <MessageRow
                  sender={message.sender}
                  subject={message.subject}
                  preview={message.preview}
                  timestamp={formatMessageTimestamp(message.timestamp)}
                  accountName={message.accountName}
                  accountInitial={message.accountInitial}
                  avatarColor={message.avatarColor}
                  showAccountChip={filterMode === "all" || selectedAccounts.length > 1}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
