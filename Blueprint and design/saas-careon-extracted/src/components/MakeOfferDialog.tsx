import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Language, translations } from "../lib/i18n";

interface MakeOfferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemTitle: string;
  basePrice: number;
  onSubmit: (offerPrice: number, note: string) => void;
  language: Language;
}

export function MakeOfferDialog({
  open,
  onOpenChange,
  itemTitle,
  basePrice,
  onSubmit,
  language,
}: MakeOfferDialogProps) {
  const [offerPrice, setOfferPrice] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const t = translations[language];

  const handleQuickDiscount = (percentage: number) => {
    const discountedPrice = basePrice * (1 - percentage / 100);
    setOfferPrice(discountedPrice.toFixed(2));
    setError("");
  };

  const handleSubmit = () => {
    const price = parseFloat(offerPrice);

    if (!offerPrice || isNaN(price)) {
      setError(t.messages.conversation.dialog.errors.validPrice);
      return;
    }

    if (price <= 0) {
      setError(t.messages.conversation.dialog.errors.greaterThanZero);
      return;
    }

    if (price >= basePrice) {
      setError(t.messages.conversation.dialog.errors.lowerThanBase);
      return;
    }

    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      onSubmit(price, note);
      setIsLoading(false);
      onOpenChange(false);
      
      // Reset form
      setOfferPrice("");
      setNote("");
      setError("");
    }, 1000);
  };

  const calculateFee = () => {
    const price = parseFloat(offerPrice);
    if (!isNaN(price)) {
      return (price * 0.05).toFixed(2); // 5% fee example
    }
    return "0.00";
  };

  const calculateSubtotal = () => {
    const price = parseFloat(offerPrice);
    const fee = parseFloat(calculateFee());
    if (!isNaN(price)) {
      return (price + fee).toFixed(2);
    }
    return "0.00";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle>{t.messages.conversation.dialog.title}</DialogTitle>
          <DialogDescription className="line-clamp-2">
            {itemTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Offer price */}
          <div className="space-y-2">
            <Label htmlFor="offerPrice">
              {t.messages.conversation.dialog.yourOffer} <span className="text-red-500">{t.messages.conversation.dialog.required}</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                €
              </span>
              <Input
                id="offerPrice"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={offerPrice}
                onChange={(e) => {
                  setOfferPrice(e.target.value);
                  setError("");
                }}
                className={`rounded-2xl h-12 pl-7 ${error ? "border-red-500" : ""}`}
                disabled={isLoading}
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
          </div>

          {/* Quick discount chips */}
          <div className="space-y-2">
            <Label>{t.messages.conversation.dialog.quickDiscounts}</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => handleQuickDiscount(5)}
                disabled={isLoading}
              >
                -5%
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => handleQuickDiscount(10)}
                disabled={isLoading}
              >
                -10%
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => handleQuickDiscount(15)}
                disabled={isLoading}
              >
                -15%
              </Button>
            </div>
          </div>

          {/* Price breakdown */}
          {offerPrice && !isNaN(parseFloat(offerPrice)) && (
            <div className="space-y-2 p-3 rounded-2xl bg-muted/50 border border-border text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.messages.conversation.dialog.itemPrice}</span>
                <span className="text-foreground">€{parseFloat(offerPrice).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.messages.conversation.dialog.serviceFee}</span>
                <span className="text-foreground">€{calculateFee()}</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex justify-between">
                <span className="text-foreground">{t.messages.conversation.dialog.buyerTotal}</span>
                <span className="text-foreground">€{calculateSubtotal()}</span>
              </div>
            </div>
          )}

          {/* Optional note */}
          <div className="space-y-2">
            <Label htmlFor="offerNote">{t.messages.conversation.dialog.noteOptional}</Label>
            <Textarea
              id="offerNote"
              placeholder={t.messages.conversation.dialog.notePlaceholder}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="rounded-2xl resize-none"
              rows={3}
              disabled={isLoading}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="rounded-2xl flex-1"
            disabled={isLoading}
          >
            {t.messages.conversation.dialog.cancel}
          </Button>
          <Button
            onClick={handleSubmit}
            className="rounded-2xl bg-primary hover:bg-primary/90 flex-1"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t.messages.conversation.dialog.sending}
              </>
            ) : (
              t.messages.conversation.dialog.sendOffer
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
