import { Avatar, AvatarFallback } from "./ui/avatar";
import { Card } from "./ui/card";

interface MessageRowProps {
  sender: string;
  subject: string;
  preview: string;
  timestamp: string;
  accountName: string;
  accountInitial: string;
  avatarColor: string;
  showAccountChip?: boolean;
}

export function MessageRow({
  sender,
  subject,
  preview,
  timestamp,
  accountName,
  accountInitial,
  avatarColor,
  showAccountChip = false,
}: MessageRowProps) {
  const initial = sender.charAt(0).toUpperCase();

  return (
    <Card className="rounded-2xl border border-border p-4 bg-card shadow-sm hover:border-primary/30 transition-colors cursor-pointer">
      <div className="flex items-start gap-4">
        <Avatar className="w-10 h-10 rounded-xl" style={{ backgroundColor: avatarColor }}>
          <AvatarFallback className="rounded-xl text-white" style={{ backgroundColor: avatarColor }}>
            {initial}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-foreground">{sender}</span>
              <span className="text-muted-foreground">• {subject}</span>
            </div>
            <span className="text-muted-foreground text-sm whitespace-nowrap">
              {timestamp}
            </span>
          </div>
          
          <div className="flex items-start gap-2">
            <p className="text-muted-foreground truncate flex-1">{preview}</p>
            {showAccountChip ? (
              <span
                className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-primary/10 text-primary text-[10px] border border-primary/20 flex-shrink-0"
              >
                {accountInitial}
              </span>
            ) : (
              <span className="text-muted-foreground text-sm whitespace-nowrap">• {accountName}</span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}