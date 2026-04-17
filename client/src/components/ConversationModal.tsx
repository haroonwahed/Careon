import { useState } from "react";
import { X, Image as ImageIcon, Send } from "lucide-react";
import { Favorite, getTimeAgo } from "../lib/favoritesData";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { Language } from "../lib/i18n";

interface ConversationModalProps {
  favorite: Favorite | null;
  onClose: () => void;
  language?: Language;
}

interface Message {
  id: string;
  type: "buyer" | "seller";
  content: string;
  timestamp: Date;
  isOffer?: boolean;
  offerAmount?: number;
}

export function ConversationModal({ favorite, onClose, language = "en" }: ConversationModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [offerAmount, setOfferAmount] = useState("");
  const [showDemoHint, setShowDemoHint] = useState(true);

  if (!favorite) return null;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  // Demo function to show example conversation
  const loadDemoConversation = () => {
    const demoMessages: Message[] = [
      {
        id: "demo-1",
        type: "seller",
        content: "Prix proposé : 20,00 €",
        timestamp: new Date(),
        isOffer: true,
        offerAmount: 20,
      },
      {
        id: "demo-2",
        type: "seller",
        content: "Bonjour, qu'en dites vous pour 20€ ?",
        timestamp: new Date(),
      },
    ];
    setMessages(demoMessages);
    setShowDemoHint(false);
  };

  const handleMakeOffer = () => {
    if (!offerAmount || parseFloat(offerAmount) <= 0) return;

    const amount = parseFloat(offerAmount);
    const newOfferMessage: Message = {
      id: `msg-${Date.now()}-offer`,
      type: "seller",
      content: `Prix proposé : ${formatPrice(amount)}`,
      timestamp: new Date(),
      isOffer: true,
      offerAmount: amount,
    };

    setMessages(prev => [...prev, newOfferMessage]);
    setOfferAmount("");
  };

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      type: "seller",
      content: messageInput,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newMessage]);
    setMessageInput("");
  };

  const handleSendAll = () => {
    const newMessages: Message[] = [];
    
    if (offerAmount && parseFloat(offerAmount) > 0) {
      const amount = parseFloat(offerAmount);
      newMessages.push({
        id: `msg-${Date.now()}-offer`,
        type: "seller",
        content: `Prix proposé : ${formatPrice(amount)}`,
        timestamp: new Date(),
        isOffer: true,
        offerAmount: amount,
      });
    }

    if (messageInput.trim()) {
      newMessages.push({
        id: `msg-${Date.now() + 1}`,
        type: "seller",
        content: messageInput,
        timestamp: new Date(),
      });
    }

    if (newMessages.length > 0) {
      setMessages(prev => [...prev, ...newMessages]);
      setMessageInput("");
      setOfferAmount("");
    }
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  };

  // Calculate suggested offer (example: 70% of original price) and transaction fees
  const totalForBuyer = favorite.itemPrice; // Total HT for the buyer
  const transactionId = "17259383565";

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
        onClick={onClose}
      >
        {/* Modal */}
        <div 
          className="relative w-full max-w-[640px] max-h-[80vh] flex flex-col rounded-2xl border-2 shadow-2xl dark:bg-gradient-to-br dark:from-[#12121A] dark:to-[#0E0E14] bg-gradient-to-br from-white to-[#fafafa] animate-in zoom-in-95 duration-200"
          style={{
            borderColor: "rgba(139, 92, 246, 0.3)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(139, 92, 246, 0.2), 0 0 40px rgba(139, 92, 246, 0.12)"
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-5 pb-3 border-b dark:border-border/50 border-border/30">
            <div className="flex-1">
              <h2 className="dark:text-foreground text-foreground mb-1.5">
                {language === "fr" ? "Conversation" : "Conversation"}
              </h2>
              <p className="text-sm dark:text-muted-foreground text-muted-foreground">
                <span className="font-medium">{favorite.userHandle}</span> {language === "fr" ? "a marqué ton article" : "favorited your item"}{" "}
                <span className="font-medium">{favorite.itemTitle}</span> {language === "fr" ? "comme favori" : ""}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-xl dark:hover:bg-primary/10 hover:bg-primary/5 dark:border-primary/20 border-primary/10 border flex-shrink-0"
            >
              <X className="w-4 h-4 dark:text-muted-foreground text-muted-foreground" />
            </Button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {/* Product Card - Compact */}
            <div className="rounded-xl border dark:border-border/50 border-border/30 p-3 dark:bg-[#16161E]/50 bg-card/30">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                  <ImageWithFallback
                    src={favorite.itemThumbnail}
                    alt={favorite.itemTitle}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm dark:text-foreground text-foreground mb-0.5 truncate">
                    {favorite.itemTitle}
                  </p>
                  <p className="text-xs dark:text-muted-foreground text-muted-foreground">
                    {language === "fr" ? "Acheteur" : "Buyer"}: <span className="font-medium">{favorite.userHandle}</span>
                  </p>
                </div>
              </div>

              {/* Price Info - Compact */}
              <div className="mt-3 pt-3 border-t dark:border-border/30 border-border/20 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs dark:text-muted-foreground text-muted-foreground">
                    {language === "fr" ? "Prix de l'article" : "Item price"}
                  </span>
                  <span className="font-semibold text-sm dark:text-foreground text-foreground">
                    {formatPrice(favorite.itemPrice)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs dark:text-muted-foreground text-muted-foreground">
                    {language === "fr" ? "Total HT" : "Total excl. tax"}
                  </span>
                  <span className="font-semibold text-sm dark:text-primary text-primary">
                    {formatPrice(totalForBuyer)}
                  </span>
                </div>
                <div className="pt-1.5 border-t dark:border-border/20 border-border/10">
                  <p className="text-[10px] dark:text-muted-foreground/70 text-muted-foreground/60">
                    Transaction #{transactionId}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="space-y-3">
              {messages.length === 0 ? (
                <div className="rounded-xl border dark:border-border/50 border-border/30 p-6 text-center dark:bg-[#16161E]/30 bg-card/20">
                  <p className="text-sm dark:text-muted-foreground text-muted-foreground mb-3">
                    {language === "fr" ? "Aucun message pour le moment" : "No messages yet"}
                  </p>
                  {showDemoHint && favorite.userHandle === "@marie-annelabest" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadDemoConversation}
                      className="rounded-lg text-xs dark:text-primary text-primary dark:hover:bg-primary/10 hover:bg-primary/5 dark:border-primary/20 border-primary/10"
                    >
                      {language === "fr" ? "📝 Voir exemple de conversation" : "📝 Load example conversation"}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.type === "seller" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-xl px-4 py-2.5 ${
                          msg.type === "seller"
                            ? "dark:bg-primary/15 bg-primary/10 border dark:border-primary/30 border-primary/20"
                            : "dark:bg-[#1A1A24] bg-card/50 border dark:border-border/50 border-border/30"
                        }`}
                      >
                        {msg.type === "seller" && (
                          <p className="text-xs dark:text-primary/80 text-primary/70 mb-1 font-medium">
                            {language === "fr" ? "Moi" : "Me"}
                          </p>
                        )}
                        <p
                          className={`text-sm ${
                            msg.isOffer
                              ? "font-semibold dark:text-primary text-primary"
                              : "dark:text-foreground text-foreground"
                          }`}
                        >
                          {msg.content}
                        </p>
                        <p className="text-xs dark:text-muted-foreground/70 text-muted-foreground/60 mt-1.5 text-right">
                          {formatTimestamp(msg.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Reply Input */}
            <div>
              <Textarea
                placeholder={language === "fr" ? "Répondre…" : "Reply…"}
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                className="min-h-[80px] rounded-xl dark:bg-[#1A1A24] bg-card/50 border dark:border-border/50 border-border/30 dark:focus:border-primary focus:border-primary/50 dark:text-foreground text-foreground resize-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t dark:border-border/50 border-border/30 dark:bg-[#0B0B10]/50 bg-card/20">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl gap-2 dark:hover:bg-primary/10 hover:bg-primary/5 dark:border-border/50 border-border/30"
              >
                <ImageIcon className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {language === "fr" ? "Ajouter une photo" : "Add photo"}
                </span>
              </Button>

              <div className="flex-1 min-w-[140px]">
                <Input
                  type="number"
                  placeholder={language === "fr" ? "Montant de l'offre" : "Offer amount"}
                  value={offerAmount}
                  onChange={(e) => setOfferAmount(e.target.value)}
                  className="rounded-xl dark:bg-[#1A1A24] bg-card/50 border dark:border-border/50 border-border/30 dark:focus:border-primary focus:border-primary/50 h-9"
                />
              </div>

              <Button
                onClick={handleMakeOffer}
                disabled={!offerAmount || parseFloat(offerAmount) <= 0}
                size="sm"
                variant="outline"
                className="rounded-xl gap-2 dark:bg-primary/10 bg-primary/5 dark:border-primary/30 border-primary/20 dark:text-primary text-primary dark:hover:bg-primary/15 hover:bg-primary/10 disabled:opacity-50"
              >
                {language === "fr" ? "Faire une offre" : "Make offer"}
              </Button>

              <Button
                onClick={handleSendAll}
                disabled={!messageInput.trim() && !offerAmount}
                size="sm"
                className="rounded-xl gap-2 dark:bg-primary bg-primary dark:text-white text-white dark:hover:bg-primary/90 hover:bg-primary/90"
              >
                <Send className="w-4 h-4" />
                {language === "fr" ? "Envoyer" : "Send"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}