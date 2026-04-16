import { Badge } from "./ui/badge";
import { Card } from "./ui/card";

export type NotificationKind = "sale" | "message" | "offer" | "system";

interface NotificationRowProps {
  kind: NotificationKind;
  title: string;
  details: string;
  timestamp: string;
  accountName: string;
}

const kindStyles = {
  sale: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  message: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  offer: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  system: "bg-neutral-500/10 text-neutral-400 border-neutral-500/20",
};

const kindLabels = {
  sale: "Sale",
  message: "Message",
  offer: "Offer",
  system: "System",
};

export function NotificationRow({
  kind,
  title,
  details,
  timestamp,
  accountName,
}: NotificationRowProps) {
  return (
    <Card className="rounded-2xl border border-border p-4 bg-card shadow-sm hover:border-primary/30 transition-colors cursor-pointer">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`rounded-lg ${kindStyles[kind]}`}>
              {kindLabels[kind]}
            </Badge>
            <span className="text-muted-foreground text-sm">• {accountName}</span>
          </div>
          
          <div>
            <h4 className="text-foreground mb-1">{title}</h4>
            <p className="text-muted-foreground">{details}</p>
          </div>
        </div>
        
        <span className="text-muted-foreground whitespace-nowrap">
          {timestamp}
        </span>
      </div>
    </Card>
  );
}
