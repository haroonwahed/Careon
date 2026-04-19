import { useState, useRef, useEffect } from "react";
import { ChevronLeft, Info } from "lucide-react";
import { Button } from "./ui/button";
import { ItemHeaderCard } from "./ItemHeaderCard";
import { UserInfoCard } from "./UserInfoCard";
import { MessageBubble, MessageType, OfferStatus } from "./MessageBubble";
import { MessageComposer } from "./MessageComposer";
import { MakeOfferDialog } from "./MakeOfferDialog";
import { TimestampDivider } from "./TimestampDivider";
import { toast } from "sonner@2.0.3";
import { Language, t, translations } from "../lib/i18n";

interface Message {
  id: string;
  type: MessageType;
  content?: string;
  photoUrl?: string;
  isOwn: boolean;
  timestamp: string;
  readStatus?: "sent" | "delivered" | "read";
  offerPrice?: string;
  offerOldPrice?: string;
  offerStatus?: OfferStatus;
  isForeignLanguage?: boolean;
  detectedLanguage?: string;
  translatedContent?: string;
}

interface TimestampDivider {
  id: string;
  type: "divider";
  text: string;
}

type ConversationItem = Message | TimestampDivider;

interface MessageDetailPageProps {
  conversationPartner: string;
  onBack: () => void;
  language: Language;
}

// Mock data for the conversation
const ITEM_DATA = {
  imageUrl: "https://images.unsplash.com/photo-1559551409-dadc959f76b8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2aW50YWdlJTIwY2xvdGhpbmclMjBqYWNrZXR8ZW58MXx8fHwxNzYxNzQ3MDM4fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  title: "Vintage Leather Jacket - Size M - Excellent Condition",
  basePrice: "€65.00",
  buyerSubtotal: "€72.50",
  basePriceNumber: 65,
};

const USER_DATA = {
  username: "antofrau4",
  rating: 4.8,
  ratingCount: 142,
  location: "Paris, France",
  lastSeen: "Active 2h ago",
};

const getInitialMessages = (language: Language): ConversationItem[] => {
  const t = translations[language];
  
  return [
    {
      id: "system-1",
      type: "system",
      content: t.messages.system.orderCreated,
    },
    {
      id: "div-1",
      type: "divider",
      text: "Today 14:07",
    },
    {
      id: "msg-1",
      type: "text",
      content: "Hi! I'm interested in this jacket. Is it still available?",
      isOwn: false,
      timestamp: "14:07",
      // Foreign message for French UI users
      isForeignLanguage: language === "fr",
      detectedLanguage: "english",
      translatedContent: language === "fr" ? "Bonjour ! Je suis intéressé par cette veste. Est-elle toujours disponible ?" : undefined,
    },
    {
      id: "msg-2",
      type: "text",
      content: language === "fr" 
        ? "Oui, elle est disponible ! Elle est en excellent état, portée seulement quelques fois."
        : "Yes, it's available! It's in excellent condition, worn only a few times.",
      isOwn: true,
      timestamp: "14:09",
      readStatus: "read",
    },
    {
      id: "msg-3",
      type: "text",
      content: "Great! Could you tell me more about the fit? I'm usually a medium but some brands run small.",
      isOwn: false,
      timestamp: "14:12",
      isForeignLanguage: language === "fr",
      detectedLanguage: "english",
      translatedContent: language === "fr" ? "Super ! Pouvez-vous m'en dire plus sur la coupe ? Je fais habituellement du M mais certaines marques taillent petit." : undefined,
    },
    {
      id: "msg-4",
      type: "text",
      content: language === "fr"
        ? "Elle taille normalement. Je peux vous envoyer les mesures si vous voulez ?\n\nÉpaules : 45cm\nPoitrine : 54cm\nLongueur : 65cm"
        : "It fits true to size. I can send you the measurements if you'd like?\n\nShoulder: 45cm\nChest: 54cm\nLength: 65cm",
      isOwn: true,
      timestamp: "14:14",
      readStatus: "read",
    },
    {
      id: "div-2",
      type: "divider",
      text: "41 minutes ago",
    },
    {
      id: "msg-5",
      type: "offer",
      offerPrice: "€55.00",
      offerOldPrice: "€65.00",
      offerStatus: "sent",
      isOwn: false,
      timestamp: "14:49",
    },
    {
      id: "msg-6",
      type: "text",
      content: "¿Considerarías esta oferta? ¡Estoy listo para comprar de inmediato!",
      isOwn: false,
      timestamp: "14:49",
      isForeignLanguage: true,
      detectedLanguage: "spanish",
      translatedContent: language === "fr" 
        ? "Considéreriez-vous cette offre ? Je suis prêt à acheter immédiatement !"
        : "Would you consider this offer? I'm ready to purchase right away!",
    },
  ];
};

export function MessageDetailPage({
  conversationPartner,
  onBack,
  language,
}: MessageDetailPageProps) {
  const [messages, setMessages] = useState<ConversationItem[]>(() => getInitialMessages(language));
  const [offerDialogOpen, setOfferDialogOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Update messages when language changes
  useEffect(() => {
    setMessages(getInitialMessages(language));
  }, [language]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = (message: string, photos: File[]) => {
    const newMessages: ConversationItem[] = [];

    // Add photos
    photos.forEach((photo, index) => {
      newMessages.push({
        id: `msg-${Date.now()}-photo-${index}`,
        type: "photo",
        photoUrl: URL.createObjectURL(photo),
        isOwn: true,
        timestamp: new Date().toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        readStatus: "sent",
      });
    });

    // Add text message
    if (message.trim()) {
      newMessages.push({
        id: `msg-${Date.now()}`,
        type: "text",
        content: message,
        isOwn: true,
        timestamp: new Date().toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        readStatus: "sent",
      });
    }

    setMessages([...messages, ...newMessages]);
    toast.success(t(language, "messages.conversation.compose.send"));
  };

  const handleMakeOffer = (offerPrice: number, note: string) => {
    const newMessages: ConversationItem[] = [];

    // Add offer message
    newMessages.push({
      id: `msg-${Date.now()}-offer`,
      type: "offer",
      offerPrice: `€${offerPrice.toFixed(2)}`,
      offerOldPrice: ITEM_DATA.basePrice,
      offerStatus: "sent",
      isOwn: true,
      timestamp: new Date().toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      readStatus: "sent",
    });

    // Add optional note
    if (note.trim()) {
      newMessages.push({
        id: `msg-${Date.now()}-note`,
        type: "text",
        content: note,
        isOwn: true,
        timestamp: new Date().toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        readStatus: "sent",
      });
    }

    setMessages([...messages, ...newMessages]);
    toast.success(t(language, "toast.offerSent"));
  };

  const handleAcceptOffer = (messageId: string) => {
    setMessages(
      messages.map((msg) => {
        if ("type" in msg && msg.id === messageId && msg.type === "offer") {
          return { ...msg, offerStatus: "accepted" as OfferStatus };
        }
        return msg;
      })
    );
    toast.success(t(language, "messages.offer.accepted"));
  };

  const handleDeclineOffer = (messageId: string) => {
    setMessages(
      messages.map((msg) => {
        if ("type" in msg && msg.id === messageId && msg.type === "offer") {
          return { ...msg, offerStatus: "declined" as OfferStatus };
        }
        return msg;
      })
    );
    toast.success(t(language, "messages.offer.declined"));
  };

  const handleCounterOffer = () => {
    setOfferDialogOpen(true);
  };

  return (
    <div className="fixed inset-0 ml-[72px] flex flex-col overflow-hidden bg-background z-50">
      {/* Top bar */}
      <div className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl shrink-0 h-9 w-9"
            onClick={onBack}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="text-foreground truncate">{conversationPartner}</h2>
          </div>
          <Button variant="ghost" size="icon" className="rounded-xl shrink-0 h-9 w-9">
            <Info className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Item header card - sticky */}
      <div className="sticky top-[57px] z-40 border-b border-border bg-background/95 backdrop-blur-sm px-3 sm:px-4 py-2 sm:py-3">
        <ItemHeaderCard
          imageUrl={ITEM_DATA.imageUrl}
          title={ITEM_DATA.title}
          basePrice={ITEM_DATA.basePrice}
          buyerSubtotal={ITEM_DATA.buyerSubtotal}
          onMakeOffer={() => setOfferDialogOpen(true)}
          language={language}
        />
      </div>

      {/* Conversation thread */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6"
      >
        {/* User info card */}
        <UserInfoCard
          username={USER_DATA.username}
          rating={USER_DATA.rating}
          ratingCount={USER_DATA.ratingCount}
          location={USER_DATA.location}
          lastSeen={USER_DATA.lastSeen}
          language={language}
        />

        {/* Messages */}
        <div className="space-y-3">
          {messages.map((item, index) => {
            if ("type" in item && item.type === "divider") {
              return <TimestampDivider key={item.id} text={item.text} />;
            }

            const message = item as Message;
            
            // System messages - render directly
            if (message.type === "system") {
              return (
                <MessageBubble
                  key={message.id}
                  type="system"
                  content={message.content}
                  isOwn={false}
                  language={language}
                />
              );
            }
            
            // Check if this message is from the same sender as the previous one (for grouping)
            const prevItem = index > 0 ? messages[index - 1] : null;
            const isPrevSameSender = 
              prevItem && 
              "isOwn" in prevItem && 
              prevItem.type !== "divider" &&
              prevItem.type !== "system" &&
              (prevItem as Message).isOwn === message.isOwn;
            
            return (
              <div key={message.id} className={isPrevSameSender ? "-mt-1.5" : ""}>
                <MessageBubble
                  type={message.type}
                  content={message.content}
                  photoUrl={message.photoUrl}
                  isOwn={message.isOwn}
                  timestamp={message.timestamp}
                  readStatus={message.readStatus}
                  language={language}
                  offerPrice={message.offerPrice}
                  offerOldPrice={message.offerOldPrice}
                  offerStatus={message.offerStatus}
                  showOfferActions={!message.isOwn && message.offerStatus === "sent"}
                  onAcceptOffer={() => handleAcceptOffer(message.id)}
                  onDeclineOffer={() => handleDeclineOffer(message.id)}
                  onCounterOffer={handleCounterOffer}
                  isForeignLanguage={message.isForeignLanguage}
                  detectedLanguage={message.detectedLanguage}
                  translatedContent={message.translatedContent}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Composer - fixed at bottom */}
      <MessageComposer
        onSendMessage={handleSendMessage}
        onMakeOffer={() => setOfferDialogOpen(true)}
        language={language}
      />

      {/* Make offer dialog */}
      <MakeOfferDialog
        open={offerDialogOpen}
        onOpenChange={setOfferDialogOpen}
        itemTitle={ITEM_DATA.title}
        basePrice={ITEM_DATA.basePriceNumber}
        onSubmit={handleMakeOffer}
        language={language}
      />
    </div>
  );
}
