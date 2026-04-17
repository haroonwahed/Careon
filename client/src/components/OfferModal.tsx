import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Language, t, formatCurrency } from "../lib/i18n";
import { toast } from "sonner@2.0.3";

interface OfferModalProps {
  open: boolean;
  onClose: () => void;
  itemPrice: number;
  itemTitle: string;
  language: Language;
  onSendOffer: (amount: number, message?: string) => void;
}

export function OfferModal({
  open,
  onClose,
  itemPrice,
  itemTitle,
  language,
  onSendOffer,
}: OfferModalProps) {
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    setError("");
    
    const numAmount = parseFloat(amount);
    
    if (!amount || isNaN(numAmount)) {
      setError(t(language, "messages.offer.modal.validationRequired"));
      return;
    }
    
    if (numAmount <= 0) {
      setError(t(language, "messages.offer.modal.validationPositive"));
      return;
    }
    
    if (numAmount >= itemPrice) {
      setError(t(language, "messages.offer.modal.validationLowerThanPrice"));
      return;
    }

    setIsSending(true);
    
    // Simulate sending
    await new Promise(resolve => setTimeout(resolve, 500));
    
    onSendOffer(numAmount, message || undefined);
    
    toast.success(
      language === "fr" ? "Offre envoyée" : "Offer sent"
    );
    
    // Reset and close
    setAmount("");
    setMessage("");
    setError("");
    setIsSending(false);
    onClose();
  };

  const handleClose = () => {
    setAmount("");
    setMessage("");
    setError("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="rounded-2xl dark:bg-[#0E0E14] bg-card border dark:border-[rgba(168,85,247,0.25)] border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="dark:text-[#E7E7F0] text-foreground">
            {t(language, "messages.offer.modal.title")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* Item info */}
          <div className="p-3 rounded-xl dark:bg-[rgba(139,92,246,0.05)] bg-gray-50 border dark:border-[rgba(168,85,247,0.15)] border-border">
            <div className="text-sm dark:text-[#9CA3AF] text-muted-foreground mb-1">
              {itemTitle}
            </div>
            <div className="dark:text-[#A78BFA] text-primary">
              {formatCurrency(itemPrice, language)}
            </div>
          </div>

          {/* Offer amount */}
          <div>
            <label className="block text-sm dark:text-[#E7E7F0] text-foreground mb-2">
              {t(language, "messages.offer.modal.priceLabel")}
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max={itemPrice}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="rounded-xl dark:bg-[rgba(139,92,246,0.05)] bg-background dark:border-[rgba(168,85,247,0.25)] border-border"
            />
            {error && (
              <p className="text-xs dark:text-[#FF5C8A] text-destructive mt-1">
                {error}
              </p>
            )}
          </div>

          {/* Optional message */}
          <div>
            <label className="block text-sm dark:text-[#E7E7F0] text-foreground mb-2">
              {t(language, "messages.offer.modal.messageLabel")}
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t(language, "messages.offer.modal.messagePlaceholder")}
              rows={3}
              className="rounded-xl dark:bg-[rgba(139,92,246,0.05)] bg-background dark:border-[rgba(168,85,247,0.25)] border-border resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSending}
            className="flex-1 rounded-xl"
          >
            {t(language, "messages.offer.modal.cancel")}
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending}
            className="flex-1 rounded-xl dark:bg-[#8B5CF6] bg-primary hover:dark:bg-[#7C3AED] hover:bg-primary/90"
            style={{
              boxShadow: "0 0 16px rgba(139,92,246,0.3)"
            }}
          >
            {t(language, "messages.offer.modal.send")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
