import { useState } from "react";
import { Plus, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Language } from "../lib/i18n";
import { ACCOUNTS } from "./AccountFilter";

interface AddPurchaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: Language;
  onSave: (purchase: {
    title: string;
    amount: number;
    quantity: number;
    accountId: string;
    seller?: string;
    carrier?: string;
    trackingNumber?: string;
    photo?: string;
  }) => void;
}

const CARRIERS = [
  { value: "colissimo", label: "Colissimo" },
  { value: "mondial_relay", label: "Mondial Relay" },
  { value: "chronopost", label: "Chronopost" },
  { value: "ups", label: "UPS" },
  { value: "dhl", label: "DHL" },
  { value: "other", label: "Autre" },
];

export function AddPurchaseModal({
  open,
  onOpenChange,
  language,
  onSave,
}: AddPurchaseModalProps) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [accountId, setAccountId] = useState("");
  const [seller, setSeller] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string>("");

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (title && amount && accountId) {
      onSave({
        title,
        amount: parseFloat(amount),
        quantity: parseInt(quantity) || 1,
        accountId,
        seller: seller || undefined,
        carrier: carrier || undefined,
        trackingNumber: trackingNumber || undefined,
        photo: photoPreview || undefined,
      });
      // Reset form
      setTitle("");
      setAmount("");
      setQuantity("1");
      setAccountId("");
      setSeller("");
      setCarrier("");
      setTrackingNumber("");
      setPhotoPreview("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl rounded-2xl dark:bg-[#0E0E14] bg-card border dark:border-[rgba(168,85,247,0.25)] border-border overflow-hidden max-h-[90vh] overflow-y-auto"
        style={{
          boxShadow:
            "0 0 0 1px rgba(168,85,247,0.25), 0 0 48px rgba(168,85,247,0.15)",
        }}
      >
        <DialogHeader className="border-b dark:border-[rgba(168,85,247,0.25)] border-border pb-4">
          <DialogTitle className="text-xl dark:text-[#E7E7F0] text-foreground">
            {language === "fr" ? "Ajouter un achat" : "Add purchase"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {language === "fr"
              ? "Ajouter un achat manuel"
              : "Add a manual purchase"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-6">
          {/* Photo Upload */}
          <div className="space-y-2">
            <Label className="dark:text-[#E7E7F0] text-foreground">
              {language === "fr" ? "Photo" : "Photo"} *
            </Label>
            <div className="flex items-center gap-4">
              {photoPreview ? (
                <div className="relative">
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="w-24 h-24 rounded-xl object-cover border dark:border-[rgba(168,85,247,0.25)] border-border"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPhotoPreview("")}
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 hover:bg-red-600 text-white p-0"
                  >
                    ×
                  </Button>
                </div>
              ) : (
                <label className="flex items-center justify-center w-24 h-24 rounded-xl border-2 border-dashed dark:border-[rgba(168,85,247,0.30)] border-primary/30 dark:bg-[rgba(139,92,246,0.05)] bg-primary/5 cursor-pointer hover:dark:bg-[rgba(139,92,246,0.10)] hover:bg-primary/10 transition-colors">
                  <Upload className="w-6 h-6 dark:text-[#A78BFA] text-primary" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label
              htmlFor="title"
              className="dark:text-[#E7E7F0] text-foreground"
            >
              {language === "fr" ? "Titre de l'achat" : "Purchase title"} *
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                language === "fr"
                  ? "Ex: T-shirt Vintage Nike"
                  : "Ex: Vintage Nike T-shirt"
              }
              className="rounded-xl dark:bg-[rgba(10,10,15,0.50)] bg-background dark:border-[rgba(168,85,247,0.20)] border-border"
            />
          </div>

          {/* Amount & Quantity */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label
                htmlFor="amount"
                className="dark:text-[#E7E7F0] text-foreground"
              >
                {language === "fr" ? "Montant (€)" : "Amount (€)"} *
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="rounded-xl dark:bg-[rgba(10,10,15,0.50)] bg-background dark:border-[rgba(168,85,247,0.20)] border-border"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="quantity"
                className="dark:text-[#E7E7F0] text-foreground"
              >
                {language === "fr" ? "Quantité" : "Quantity"}
              </Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="rounded-xl dark:bg-[rgba(10,10,15,0.50)] bg-background dark:border-[rgba(168,85,247,0.20)] border-border"
              />
            </div>
          </div>

          {/* Account */}
          <div className="space-y-2">
            <Label
              htmlFor="account"
              className="dark:text-[#E7E7F0] text-foreground"
            >
              {language === "fr" ? "Compte" : "Account"} *
            </Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger
                id="account"
                className="rounded-xl dark:bg-[rgba(10,10,15,0.50)] bg-background dark:border-[rgba(168,85,247,0.20)] border-border"
              >
                <SelectValue
                  placeholder={
                    language === "fr"
                      ? "Sélectionner un compte"
                      : "Select an account"
                  }
                />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {ACCOUNTS.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Seller (optional) */}
          <div className="space-y-2">
            <Label
              htmlFor="seller"
              className="dark:text-[#E7E7F0] text-foreground"
            >
              {language === "fr" ? "Vendeur (optionnel)" : "Seller (optional)"}
            </Label>
            <Input
              id="seller"
              value={seller}
              onChange={(e) => setSeller(e.target.value)}
              placeholder={language === "fr" ? "Ex: @username" : "Ex: @username"}
              className="rounded-xl dark:bg-[rgba(10,10,15,0.50)] bg-background dark:border-[rgba(168,85,247,0.20)] border-border"
            />
          </div>

          {/* Tracking (optional) */}
          <div className="space-y-4 p-4 rounded-xl dark:bg-[rgba(139,92,246,0.05)] bg-gray-50 border dark:border-[rgba(168,85,247,0.15)] border-gray-200">
            <h3 className="text-sm dark:text-[#E7E7F0] text-foreground">
              {language === "fr"
                ? "Suivi (optionnel)"
                : "Tracking (optional)"}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label
                  htmlFor="carrier"
                  className="dark:text-[#E7E7F0] text-foreground text-xs"
                >
                  {language === "fr" ? "Transporteur" : "Carrier"}
                </Label>
                <Select value={carrier} onValueChange={setCarrier}>
                  <SelectTrigger
                    id="carrier"
                    className="rounded-xl dark:bg-[rgba(10,10,15,0.50)] bg-background dark:border-[rgba(168,85,247,0.20)] border-border h-9"
                  >
                    <SelectValue
                      placeholder={
                        language === "fr"
                          ? "Sélectionner"
                          : "Select"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {CARRIERS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="tracking"
                  className="dark:text-[#E7E7F0] text-foreground text-xs"
                >
                  {language === "fr" ? "N° de suivi" : "Tracking #"}
                </Label>
                <Input
                  id="tracking"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="6A12345..."
                  className="rounded-xl dark:bg-[rgba(10,10,15,0.50)] bg-background dark:border-[rgba(168,85,247,0.20)] border-border h-9"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t dark:border-[rgba(168,85,247,0.25)] border-border pt-4 flex gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 rounded-xl dark:border-[rgba(168,85,247,0.30)] border-border dark:text-[#E7E7F0] text-foreground hover:dark:bg-[rgba(139,92,246,0.10)] hover:bg-gray-100"
          >
            {language === "fr" ? "Annuler" : "Cancel"}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title || !amount || !accountId}
            className="flex-1 rounded-xl dark:bg-[#8B5CF6] bg-primary hover:dark:bg-[#7C3AED] hover:bg-primary/90 dark:text-white text-primary-foreground"
            style={{
              boxShadow: "0 0 20px rgba(139,92,246,0.4)",
            }}
          >
            {language === "fr" ? "Ajouter" : "Add"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
