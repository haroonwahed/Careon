import { useState } from "react";
import { Message } from "../lib/conversationsData";
import { Button } from "./ui/button";
import { Language, t } from "../lib/i18n";

interface MessageBubbleProps {
  message: Message;
  language: Language;
  showAvatar?: boolean;
}

export function MessageBubble({ message, language, showAvatar = true }: MessageBubbleProps) {
  const [isTranslated, setIsTranslated] = useState(false);
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(language === "fr" ? "fr-FR" : "en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const showTranslateButton = message.originalLanguage && message.originalLanguage !== (language === "fr" ? "french" : "english");

  // Simulate translation (in real app, this would call an API)
  const translatedContent = isTranslated && message.content.includes("Hi!")
    ? "Salut ! Le survêtement est-il toujours disponible ?"
    : isTranslated && message.content.includes("Perfect")
    ? "Parfait ! Je l'achète maintenant 👍"
    : message.content;

  return (
    <div className={`flex gap-3 mb-4 ${message.isMe ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      {showAvatar && !message.isMe && (
        <div className="flex-shrink-0">
          <img
            src={message.senderAvatar}
            alt={message.senderName}
            className="w-8 h-8 rounded-full object-cover border dark:border-[rgba(168,85,247,0.25)] border-border"
          />
        </div>
      )}
      {showAvatar && message.isMe && <div className="w-8" />}

      {/* Message content */}
      <div className={`flex flex-col max-w-[70%] ${message.isMe ? "items-end" : "items-start"}`}>
        <div
          className={`
            px-4 py-2.5 rounded-2xl
            ${message.isMe
              ? "dark:bg-[#8B5CF6] bg-primary dark:text-white text-primary-foreground rounded-br-sm"
              : "dark:bg-[rgba(139,92,246,0.10)] bg-gray-100 dark:text-[#E7E7F0] text-foreground rounded-bl-sm"
            }
          `}
        >
          {message.imageUrl && (
            <img
              src={message.imageUrl}
              alt="Attachment"
              className="rounded-xl mb-2 max-w-full"
            />
          )}
          <p className="break-words">{translatedContent}</p>
        </div>

        {/* Timestamp */}
        <span className="text-[11px] dark:text-[#9CA3AF] text-muted-foreground mt-1 px-1">
          {formatTime(message.timestamp)}
        </span>

        {/* Translate button */}
        {showTranslateButton && !message.isMe && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsTranslated(!isTranslated)}
            className="text-xs dark:text-[#A78BFA] text-primary hover:dark:text-[#8B5CF6] hover:text-primary/80 h-auto py-1 px-2 mt-1"
          >
            {isTranslated 
              ? t(language, "messages.translate.buttonShowOriginal")
              : t(language, "messages.translate.button")
            }
          </Button>
        )}
        {isTranslated && (
          <span className="text-[10px] dark:text-[#9CA3AF] text-muted-foreground mt-1 px-1">
            {t(language, "messages.translate.labelTranslatedFrom").replace("{language}", 
              t(language, `messages.languageNames.${message.originalLanguage || "english"}`)
            )}
          </span>
        )}
      </div>
    </div>
  );
}
