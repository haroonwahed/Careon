import { Offer } from "../lib/conversationsData";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Language, t, formatCurrency } from "../lib/i18n";

interface OfferCardProps {
  offer: Offer;
  language: Language;
  onAccept?: () => void;
  onDecline?: () => void;
  onCounter?: () => void;
}

export function OfferCard({ offer, language, onAccept, onDecline, onCounter }: OfferCardProps) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(language === "fr" ? "fr-FR" : "en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = () => {
    const statusMap = {
      sent: { label: t(language, "messages.offer.card.sent"), className: "dark:bg-[rgba(139,92,246,0.15)] bg-primary/10 dark:text-[#A78BFA] text-primary" },
      accepted: { label: t(language, "messages.offer.card.accepted"), className: "dark:bg-[rgba(42,240,122,0.15)] bg-green-100 dark:text-[#2AF07A] text-green-700" },
      declined: { label: t(language, "messages.offer.card.declined"), className: "dark:bg-[rgba(255,92,138,0.15)] bg-red-100 dark:text-[#FF5C8A] text-red-700" },
      countered: { label: t(language, "messages.offer.card.countered"), className: "dark:bg-[rgba(251,191,36,0.15)] bg-yellow-100 dark:text-[#FBBF24] text-yellow-700" },
      expired: { label: t(language, "messages.offer.card.expired"), className: "dark:bg-[rgba(156,163,175,0.15)] bg-gray-100 dark:text-[#9CA3AF] text-gray-700" },
    };
    
    return statusMap[offer.status];
  };

  const statusBadge = getStatusBadge();
  const showActions = !offer.isMe && offer.status === "sent";

  return (
    <div className={`flex gap-3 mb-4 ${offer.isMe ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      {!offer.isMe && (
        <div className="flex-shrink-0">
          <img
            src={offer.senderAvatar}
            alt={offer.senderName}
            className="w-8 h-8 rounded-full object-cover border dark:border-[rgba(168,85,247,0.25)] border-border"
          />
        </div>
      )}
      {offer.isMe && <div className="w-8" />}

      {/* Offer card */}
      <div className={`flex flex-col max-w-[70%] ${offer.isMe ? "items-end" : "items-start"}`}>
        <div
          className={`
            rounded-2xl overflow-hidden border
            ${offer.isMe
              ? "dark:bg-[rgba(139,92,246,0.10)] bg-primary/10 dark:border-[rgba(168,85,247,0.30)] border-primary/30"
              : "dark:bg-[rgba(139,92,246,0.15)] bg-primary/15 dark:border-[rgba(168,85,247,0.35)] border-primary/35"
            }
          `}
        >
          {/* Offer header */}
          <div className="px-4 py-3 border-b dark:border-[rgba(168,85,247,0.25)] border-border/50">
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="text-xs dark:text-[#9CA3AF] text-muted-foreground">
                {language === "fr" ? "Offre" : "Offer"}
              </span>
              <Badge className={statusBadge.className}>
                {statusBadge.label}
              </Badge>
            </div>
            <div className="text-xl dark:text-[#E7E7F0] text-foreground">
              {formatCurrency(offer.amount, language)}
            </div>
          </div>

          {/* Optional message */}
          {offer.message && (
            <div className="px-4 py-3 text-sm dark:text-[#E7E7F0] text-foreground">
              {offer.message}
            </div>
          )}

          {/* Action buttons (for incoming offers) */}
          {showActions && (
            <div className="px-4 py-3 bg-background/30 flex gap-2">
              <Button
                onClick={onAccept}
                size="sm"
                className="flex-1 rounded-lg dark:bg-[#2AF07A] bg-green-600 hover:dark:bg-[#24D66D] hover:bg-green-700 dark:text-[#0A0A0E] text-white"
              >
                {t(language, "messages.offer.action.accept")}
              </Button>
              <Button
                onClick={onCounter}
                size="sm"
                variant="outline"
                className="flex-1 rounded-lg"
              >
                {t(language, "messages.offer.action.counter")}
              </Button>
              <Button
                onClick={onDecline}
                size="sm"
                variant="ghost"
                className="rounded-lg dark:text-[#FF5C8A] text-red-600 hover:dark:bg-[rgba(255,92,138,0.10)] hover:bg-red-50"
              >
                {t(language, "messages.offer.action.decline")}
              </Button>
            </div>
          )}
        </div>

        {/* Timestamp */}
        <span className="text-[11px] dark:text-[#9CA3AF] text-muted-foreground mt-1 px-1">
          {formatTime(offer.timestamp)}
        </span>
      </div>
    </div>
  );
}
