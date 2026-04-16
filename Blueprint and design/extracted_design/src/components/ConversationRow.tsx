import { Conversation } from "../lib/conversationsData";
import { Badge } from "./ui/badge";
import { Language, t } from "../lib/i18n";

interface ConversationRowProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
  language: Language;
}

export function ConversationRow({ conversation, isActive, onClick, language }: ConversationRowProps) {
  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t(language, "messages.time.justNow");
    if (minutes < 60) return minutes === 1 
      ? t(language, "messages.time.minutesAgo").replace("{count}", "1")
      : t(language, "messages.time.minutesAgo_plural").replace("{count}", minutes.toString());
    if (hours < 24) return hours === 1
      ? t(language, "messages.time.hoursAgo").replace("{count}", "1")
      : t(language, "messages.time.hoursAgo_plural").replace("{count}", hours.toString());
    if (days === 1) return t(language, "messages.time.yesterday");
    return days === 1
      ? t(language, "messages.time.daysAgo").replace("{count}", "1")
      : t(language, "messages.time.daysAgo_plural").replace("{count}", days.toString());
  };

  return (
    <div
      onClick={onClick}
      className={`
        p-4 cursor-pointer transition-all border-l-2
        hover:dark:bg-[rgba(139,92,246,0.08)] hover:bg-gray-100
        ${isActive 
          ? "dark:bg-[rgba(139,92,246,0.15)] bg-primary/10 dark:border-[#8B5CF6] border-primary" 
          : "dark:bg-transparent bg-background border-transparent"
        }
      `}
      style={
        isActive ? { boxShadow: "0 0 20px rgba(139,92,246,0.2)" } : undefined
      }
    >
      <div className="flex gap-3">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <img
            src={conversation.buyerAvatar}
            alt={conversation.buyerName}
            className="w-12 h-12 rounded-full object-cover border-2 dark:border-[rgba(168,85,247,0.30)] border-border"
          />
          {conversation.unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full dark:bg-[#8B5CF6] bg-primary flex items-center justify-center">
              <span className="text-[10px] dark:text-white text-primary-foreground">
                {conversation.unreadCount}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Top row: Name + Time */}
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <h4 className="dark:text-[#E7E7F0] text-foreground truncate">
              {conversation.buyerName}
            </h4>
            <span className="text-xs dark:text-[#9CA3AF] text-muted-foreground flex-shrink-0">
              {formatTime(conversation.lastMessageTime)}
            </span>
          </div>

          {/* Item title */}
          <div className="text-xs dark:text-[#9CA3AF] text-muted-foreground truncate mb-1">
            {conversation.itemTitle}
          </div>

          {/* Last message preview */}
          <div className={`text-sm truncate mb-2 ${
            conversation.unreadCount > 0 
              ? "dark:text-[#E7E7F0] text-foreground" 
              : "dark:text-[#9CA3AF] text-muted-foreground"
          }`}>
            {conversation.lastMessage}
          </div>

          {/* Account chip */}
          <Badge 
            variant="outline" 
            className="text-[10px] px-2 py-0 dark:bg-[rgba(139,92,246,0.10)] bg-primary/10 dark:border-[rgba(168,85,247,0.25)] border-primary/25 dark:text-[#A78BFA] text-primary"
          >
            {conversation.accountName}
          </Badge>
        </div>
      </div>
    </div>
  );
}
