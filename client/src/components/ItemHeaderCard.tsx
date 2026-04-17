import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { Language, translations } from "../lib/i18n";

interface ItemHeaderCardProps {
  imageUrl: string;
  title: string;
  basePrice: string;
  buyerSubtotal: string;
  onMakeOffer: () => void;
  language: Language;
}

export function ItemHeaderCard({
  imageUrl,
  title,
  basePrice,
  buyerSubtotal,
  onMakeOffer,
  language,
}: ItemHeaderCardProps) {
  const t = translations[language];
  
  return (
    <Card className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm">
      <div className="flex items-center gap-4 sm:gap-5">
        {/* Left stack: Thumbnail + Info */}
        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
          {/* Thumbnail */}
          <div className="shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-muted">
            <ImageWithFallback
              src={imageUrl}
              alt={title}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-foreground line-clamp-2 mb-2 text-sm sm:text-base">{title}</h3>
            <div className="space-y-1">
              <div className="flex items-baseline gap-2 text-xs sm:text-sm">
                <span className="text-muted-foreground">{t.messages.conversation.item.base}:</span>
                <span className="text-foreground">{basePrice}</span>
              </div>
              <div className="flex items-baseline gap-2 text-xs sm:text-sm">
                <span className="text-muted-foreground">{t.messages.conversation.item.total}:</span>
                <span className="text-foreground">{buyerSubtotal}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right stack: CTA Button - vertically centered, right-aligned */}
        <div className="shrink-0">
          <Button
            onClick={onMakeOffer}
            className="rounded-2xl bg-primary hover:bg-primary/90 h-9 sm:h-10 px-4 sm:px-6 text-sm sm:text-base whitespace-nowrap"
          >
            <span className="hidden sm:inline">{t.messages.conversation.item.makeOffer}</span>
            <span className="sm:hidden">{t.messages.conversation.item.offer}</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}
