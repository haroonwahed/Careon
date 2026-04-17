import { useState } from "react";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { ScrollArea } from "./ui/scroll-area";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { Product } from "../lib/stockData";
import { Language, t } from "../lib/i18n";

interface PublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  accounts: string[];
  onPublish: (productIds: string[], accountNames: string[]) => void;
  language: Language;
}

type PublishStatus = "queued" | "posting" | "posted" | "failed";

interface PublishProgress {
  productId: string;
  accountName: string;
  status: PublishStatus;
}

export function PublishDialog({
  open,
  onOpenChange,
  products,
  accounts,
  onPublish,
  language,
}: PublishDialogProps) {
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [autoPriceRounding, setAutoPriceRounding] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState<PublishProgress[]>([]);

  // Reset state when dialog opens
  useState(() => {
    if (open) {
      setSelectedAccounts(accounts);
      setAutoPriceRounding(true);
      setIsPublishing(false);
      setPublishProgress([]);
    }
  });

  const handleSelectAll = () => {
    if (selectedAccounts.length === accounts.length) {
      setSelectedAccounts([]);
    } else {
      setSelectedAccounts([...accounts]);
    }
  };

  const handleToggleAccount = (account: string) => {
    if (selectedAccounts.includes(account)) {
      setSelectedAccounts(selectedAccounts.filter((a) => a !== account));
    } else {
      setSelectedAccounts([...selectedAccounts, account]);
    }
  };

  const handlePublish = async () => {
    if (selectedAccounts.length === 0) {
      return;
    }

    setIsPublishing(true);

    // Initialize progress
    const progress: PublishProgress[] = [];
    products.forEach((product) => {
      selectedAccounts.forEach((account) => {
        progress.push({
          productId: product.id,
          accountName: account,
          status: "queued",
        });
      });
    });
    setPublishProgress(progress);

    // Simulate publishing with delays
    for (let i = 0; i < progress.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Update to posting
      setPublishProgress((prev) =>
        prev.map((p, idx) =>
          idx === i ? { ...p, status: "posting" as PublishStatus } : p
        )
      );

      await new Promise((resolve) => setTimeout(resolve, 1200));

      // Update to posted (90% success rate)
      const success = Math.random() > 0.1;
      setPublishProgress((prev) =>
        prev.map((p, idx) =>
          idx === i
            ? { ...p, status: (success ? "posted" : "failed") as PublishStatus }
            : p
        )
      );
    }

    // Wait a bit then call onPublish
    await new Promise((resolve) => setTimeout(resolve, 500));

    const successfulPublishes = publishProgress.filter((p) => p.status === "posted");
    if (successfulPublishes.length > 0) {
      onPublish(
        products.map((p) => p.id),
        selectedAccounts
      );
    }
  };

  const getStatusIcon = (status: PublishStatus) => {
    switch (status) {
      case "queued":
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      case "posting":
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case "posted":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusLabel = (status: PublishStatus) => {
    return t(language, `publisher.dialog.status${status.charAt(0).toUpperCase()}${status.slice(1)}`);
  };

  const formatPrice = (price: number) => {
    const locale = language === "fr" ? "fr-FR" : "en-GB";
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{t(language, "publisher.dialog.title")}</DialogTitle>
          <DialogDescription>
            {t(language, "publisher.dialog.description").replace("{count}", products.length.toString())}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6 py-4">
            {/* Account selection */}
            {!isPublishing && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>{t(language, "publisher.dialog.selectAccounts")}</Label>
                  <button
                    onClick={handleSelectAll}
                    className="text-sm text-primary hover:underline"
                  >
                    {selectedAccounts.length === accounts.length
                      ? t(language, "publisher.dialog.deselectAll")
                      : t(language, "publisher.dialog.selectAll")}
                  </button>
                </div>
                <div className="space-y-2 p-4 rounded-2xl border border-border">
                  {accounts.map((account) => (
                    <div key={account} className="flex items-center space-x-2">
                      <Checkbox
                        id={`account-${account}`}
                        checked={selectedAccounts.includes(account)}
                        onCheckedChange={() => handleToggleAccount(account)}
                      />
                      <Label
                        htmlFor={`account-${account}`}
                        className="cursor-pointer flex-1"
                      >
                        {account}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Product summary */}
            <div className="space-y-3">
              <Label>{t(language, "publisher.dialog.productsToPublish")}</Label>
              <div className="space-y-2 p-4 rounded-2xl border border-border bg-muted/20">
                {products.map((product) => (
                  <div key={product.id} className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted shrink-0">
                      {product.photos[0] && (
                        <ImageWithFallback
                          src={product.photos[0]}
                          alt={product.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground line-clamp-1">
                        {product.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {product.sku} • {formatPrice(product.price)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Options */}
            {!isPublishing && (
              <div className="space-y-3">
                <Label>{t(language, "publisher.dialog.publishingOptions")}</Label>
                <div className="space-y-3 p-4 rounded-2xl border border-border">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="price-rounding">
                        {t(language, "publisher.dialog.autoPriceRounding")}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {t(language, "publisher.dialog.autoPriceRoundingDesc")}
                      </p>
                    </div>
                    <Switch
                      id="price-rounding"
                      checked={autoPriceRounding}
                      onCheckedChange={setAutoPriceRounding}
                    />
                  </div>

                  <div className="flex items-center justify-between opacity-50">
                    <div className="space-y-0.5">
                      <Label htmlFor="auto-translate">
                        {t(language, "publisher.dialog.autoTranslate")}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {t(language, "publisher.dialog.comingSoon")}
                      </p>
                    </div>
                    <Switch id="auto-translate" disabled />
                  </div>
                </div>
              </div>
            )}

            {/* Publishing progress */}
            {isPublishing && publishProgress.length > 0 && (
              <div className="space-y-3">
                <Label>{t(language, "publisher.dialog.publishingStatus")}</Label>
                <div className="space-y-2">
                  {publishProgress.map((progress, index) => {
                    const product = products.find(
                      (p) => p.id === progress.productId
                    );
                    if (!product) return null;

                    return (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 rounded-xl border border-border"
                      >
                        <div className="shrink-0">
                          {getStatusIcon(progress.status)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground line-clamp-1">
                            {product.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {progress.accountName}
                          </p>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {getStatusLabel(progress.status)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="rounded-2xl flex-1"
            disabled={isPublishing}
          >
            {isPublishing
              ? t(language, "publisher.dialog.closeWhenDone")
              : t(language, "publisher.form.cancel")}
          </Button>
          {!isPublishing && (
            <Button
              onClick={handlePublish}
              className="rounded-2xl bg-primary hover:bg-primary/90 flex-1"
              disabled={selectedAccounts.length === 0}
            >
              {t(language, "publisher.dialog.publishToAccounts").replace(
                "{count}",
                selectedAccounts.length.toString()
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
