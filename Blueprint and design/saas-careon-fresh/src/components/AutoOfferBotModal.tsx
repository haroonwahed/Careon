import { useState } from "react";
import { Bot, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Checkbox } from "./ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Slider } from "./ui/slider";
import { Language, t } from "../lib/i18n";
import { ACCOUNTS } from "./AccountFilter";

interface AutoOfferBotModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: Language;
  botEnabled: boolean;
  onBotEnabledChange: (enabled: boolean) => void;
}

type OfferMethod = "percentage" | "lastPrice";
type DiscountRate = 5 | 10 | 15 | 20;

export function AutoOfferBotModal({
  open,
  onOpenChange,
  language,
  botEnabled,
  onBotEnabledChange,
}: AutoOfferBotModalProps) {
  const [offerMethod, setOfferMethod] = useState<OfferMethod>("percentage");
  const [discountRate, setDiscountRate] = useState<DiscountRate>(10);
  const [examplePrice, setExamplePrice] = useState([50]);
  const [applyToAllAccounts, setApplyToAllAccounts] = useState(true);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);

  const calculatedOfferPrice = examplePrice[0] * (1 - discountRate / 100);

  const handleSave = () => {
    // Here you would save the configuration
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto dark:bg-card bg-card border-2 dark:border-primary/30 border-primary/20 rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl dark:bg-primary/15 bg-primary/10 dark:text-primary text-primary">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="dark:text-foreground text-foreground">
                {language === "fr" ? "Bot d'offres automatiques" : "Automatic Offers Bot"}
              </DialogTitle>
              <DialogDescription className="dark:text-muted-foreground text-muted-foreground">
                {language === "fr"
                  ? "Envoyez automatiquement une offre aux utilisateurs qui mettent vos articles en favori."
                  : "Automatically send offers to users who favorite your items."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Bot Status Toggle */}
          <div className="flex items-center justify-between p-4 dark:bg-muted/50 bg-muted/30 rounded-xl border dark:border-border border-border">
            <div>
              <Label className="dark:text-foreground text-foreground font-semibold">
                {language === "fr" ? "État du bot" : "Bot Status"}
              </Label>
              <p className="text-sm dark:text-muted-foreground text-muted-foreground mt-1">
                {botEnabled
                  ? language === "fr"
                    ? "Le bot est actuellement activé"
                    : "Bot is currently enabled"
                  : language === "fr"
                  ? "Le bot est actuellement désactivé"
                  : "Bot is currently disabled"}
              </p>
            </div>
            <Switch checked={botEnabled} onCheckedChange={onBotEnabledChange} />
          </div>

          {/* Offer Method */}
          <div className="space-y-3">
            <Label className="dark:text-foreground text-foreground font-semibold">
              {language === "fr" ? "Méthode d'offre" : "Offer Method"}
            </Label>
            <RadioGroup value={offerMethod} onValueChange={(val) => setOfferMethod(val as OfferMethod)}>
              <div className="flex items-center space-x-2 p-3 rounded-lg border dark:border-border border-border dark:hover:bg-muted/50 hover:bg-muted/30 cursor-pointer">
                <RadioGroupItem value="percentage" id="percentage" />
                <Label htmlFor="percentage" className="cursor-pointer flex-1 dark:text-foreground text-foreground">
                  {language === "fr" ? "Réduction (%)" : "Discount (%)"}
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 rounded-lg border dark:border-border border-border dark:hover:bg-muted/50 hover:bg-muted/30 cursor-pointer">
                <RadioGroupItem value="lastPrice" id="lastPrice" />
                <Label htmlFor="lastPrice" className="cursor-pointer flex-1 dark:text-foreground text-foreground">
                  {language === "fr" ? "Dernier prix (depuis fiches produits)" : "Last Price (from product sheets)"}
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Discount Rate Selection (if percentage method) */}
          {offerMethod === "percentage" && (
            <div className="space-y-3">
              <Label className="dark:text-foreground text-foreground font-semibold">
                {language === "fr" ? "Taux de réduction" : "Discount Rate"}
              </Label>
              <div className="grid grid-cols-4 gap-3">
                {[5, 10, 15, 20].map((rate) => (
                  <Button
                    key={rate}
                    type="button"
                    variant={discountRate === rate ? "default" : "outline"}
                    className={`rounded-xl ${
                      discountRate === rate
                        ? "dark:bg-primary bg-primary dark:text-white text-white"
                        : "dark:hover:bg-muted/50 hover:bg-muted/30"
                    }`}
                    onClick={() => setDiscountRate(rate as DiscountRate)}
                  >
                    -{rate}%
                  </Button>
                ))}
              </div>

              {/* Preview */}
              <div className="p-4 dark:bg-primary/10 bg-primary/5 rounded-xl border dark:border-primary/30 border-primary/20">
                <div className="flex items-start gap-2 mb-3">
                  <Info className="w-4 h-4 dark:text-primary text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium dark:text-foreground text-foreground">
                      {language === "fr" ? "Aperçu" : "Preview"}
                    </p>
                    <p className="text-xs dark:text-muted-foreground text-muted-foreground mt-1">
                      {language === "fr"
                        ? "L'offre est envoyée sur le prix affiché au moment du favori."
                        : "The offer is sent based on the displayed price at the time of favoriting."}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs dark:text-muted-foreground text-muted-foreground mb-2 block">
                      {language === "fr" ? "Prix d'exemple" : "Example Price"}
                    </Label>
                    <Slider
                      value={examplePrice}
                      onValueChange={setExamplePrice}
                      min={10}
                      max={200}
                      step={5}
                      className="mb-2"
                    />
                    <div className="flex justify-between text-xs dark:text-muted-foreground text-muted-foreground">
                      <span>10€</span>
                      <span className="dark:text-foreground text-foreground font-medium">{examplePrice[0]}€</span>
                      <span>200€</span>
                    </div>
                  </div>
                  
                  <div className="p-3 dark:bg-card bg-white rounded-lg border dark:border-border border-border">
                    <p className="text-sm dark:text-foreground text-foreground">
                      {language === "fr" ? "Sur" : "On"} <span className="font-semibold">{examplePrice[0]}€</span>,{" "}
                      <span className="dark:text-primary text-primary font-semibold">-{discountRate}%</span> ={" "}
                      <span className="font-semibold dark:text-primary text-primary">{calculatedOfferPrice.toFixed(2)}€</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Last Price Method Info */}
          {offerMethod === "lastPrice" && (
            <div className="p-4 dark:bg-muted/50 bg-muted/30 rounded-xl border dark:border-border border-border">
              <div className="flex items-start gap-2 mb-3">
                <Info className="w-4 h-4 dark:text-primary text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium dark:text-foreground text-foreground">
                    {language === "fr"
                      ? "Le bot utilise le dernier prix défini dans la fiche produit (Gestion du stock)."
                      : "The bot uses the last price defined in the product sheet (Stock Management)."}
                  </p>
                </div>
              </div>
              
              <div className="p-3 dark:bg-card bg-white rounded-lg border dark:border-border border-border mt-3">
                <p className="text-sm dark:text-muted-foreground text-muted-foreground mb-2">
                  {language === "fr" ? "Exemple d'aperçu :" : "Preview example:"}
                </p>
                <p className="text-sm dark:text-foreground text-foreground">
                  {language === "fr" ? "Prix affiché" : "Displayed price"}: <span className="font-semibold">50€</span> →{" "}
                  {language === "fr" ? "Offre envoyée : Dernier prix" : "Offer sent: Last price"}:{" "}
                  <span className="font-semibold dark:text-primary text-primary">42€</span>
                </p>
              </div>
              
              <div className="mt-3 p-2 dark:bg-primary/10 bg-primary/5 rounded-lg border dark:border-primary/20 border-primary/10">
                <p className="text-xs dark:text-primary text-primary font-medium">
                  {language === "fr"
                    ? "⚠️ Nécessite d'avoir renseigné 'Dernier prix' sur les fiches produits."
                    : "⚠️ Requires 'Last Price' to be filled in product sheets."}
                </p>
              </div>
            </div>
          )}

          {/* Targeting */}
          <div className="space-y-3">
            <Label className="dark:text-foreground text-foreground font-semibold">
              {language === "fr" ? "Ciblage" : "Targeting"}
            </Label>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="allAccounts"
                  checked={applyToAllAccounts}
                  onCheckedChange={(checked) => setApplyToAllAccounts(checked === true)}
                />
                <Label htmlFor="allAccounts" className="cursor-pointer dark:text-foreground text-foreground">
                  {language === "fr" ? "Appliquer à tous les comptes" : "Apply to all accounts"}
                </Label>
              </div>
              
              {!applyToAllAccounts && (
                <Select
                  value={selectedAccountIds.length > 0 ? selectedAccountIds[0] : ""}
                  onValueChange={(value) => setSelectedAccountIds([value])}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={language === "fr" ? "Sélectionner un compte" : "Select an account"} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {ACCOUNTS.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            {language === "fr" ? "Annuler" : "Cancel"}
          </Button>
          <Button onClick={handleSave} className="rounded-xl dark:bg-primary bg-primary dark:text-white text-white">
            {language === "fr" ? "Enregistrer la configuration" : "Save Configuration"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}