import { useState } from "react";
import { Image as ImageIcon, Send } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Language, t } from "../lib/i18n";
import { toast } from "sonner@2.0.3";

interface MessageComposerProps {
  buyerName: string;
  language: Language;
  onSendMessage: (content: string) => void;
}

export function MessageComposer({ buyerName, language, onSendMessage }: MessageComposerProps) {
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (!message.trim()) return;
    
    onSendMessage(message);
    setMessage("");
    toast.success(
      language === "fr" ? "Message envoyé" : "Message sent"
    );
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t dark:border-[rgba(168,85,247,0.25)] border-border bg-card p-4">
      <div className="flex items-center gap-3">
        {/* Photo upload button */}
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl dark:text-[#9CA3AF] text-muted-foreground hover:dark:text-[#A78BFA] hover:text-primary flex-shrink-0"
          onClick={() => toast.info(language === "fr" ? "Fonctionnalité à venir" : "Coming soon")}
        >
          <ImageIcon className="w-5 h-5" />
        </Button>

        {/* Message input */}
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={t(language, "messages.conversation.compose.placeholder").replace("{name}", buyerName)}
          className="flex-1 rounded-xl dark:bg-[rgba(139,92,246,0.05)] bg-background dark:border-[rgba(168,85,247,0.25)] border-border"
        />

        {/* Send button */}
        <Button
          onClick={handleSend}
          disabled={!message.trim()}
          size="icon"
          className="rounded-xl dark:bg-[#8B5CF6] bg-primary hover:dark:bg-[#7C3AED] hover:bg-primary/90 flex-shrink-0"
          style={{
            boxShadow: message.trim() ? "0 0 16px rgba(139,92,246,0.3)" : "none"
          }}
        >
          <Send className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
