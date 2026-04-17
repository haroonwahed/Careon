import { Star, MapPin, Clock } from "lucide-react";
import { Card } from "./ui/card";
import { Language, translations } from "../lib/i18n";

interface UserInfoCardProps {
  username: string;
  rating: number;
  ratingCount: number;
  location: string;
  lastSeen: string;
  language: Language;
}

export function UserInfoCard({
  username,
  rating,
  ratingCount,
  location,
  lastSeen,
  language,
}: UserInfoCardProps) {
  const t = translations[language];
  
  return (
    <Card className="rounded-2xl border border-border bg-card/50 p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h4 className="text-foreground">{username}</h4>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
              <span>{rating.toFixed(1)}</span>
              <span className="text-muted-foreground/70">({ratingCount} {t.messages.conversation.user.reviews})</span>
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              <span>{location}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{lastSeen}</span>
        </div>
      </div>
    </Card>
  );
}
