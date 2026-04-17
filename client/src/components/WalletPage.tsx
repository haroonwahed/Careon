import { useState } from "react";
import { Euro, ArrowUpRight, Package, MessageSquare } from "lucide-react";
import { Language, t, formatCurrency, formatNumber } from "../lib/i18n";
import { Button } from "./ui/button";
import { RefreshButton } from "./RefreshButton";
import { AccountFilter, ACCOUNTS } from "./AccountFilter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { toast } from "sonner@2.0.3";

interface WalletPageProps {
  language: Language;
  onNavigateToMessages?: () => void;
}

interface FinancialActivity {
  id: string;
  type: "sale" | "transfer";
  date: Date;
  amount: number;
  status: "finalized" | "completed";
  // For sales
  item?: {
    title: string;
    image: string;
    sku: string;
    price: number;
    margin: number;
    marginPercent: number;
  };
  // For transfers
  transferDetails?: {
    bankName: string;
  };
  account: string;
  accountId: string;
}

// Mock data
const mockActivities: FinancialActivity[] = [
  {
    id: "1",
    type: "sale",
    date: new Date(2024, 11, 27, 14, 30),
    amount: 45.00,
    status: "finalized",
    item: {
      title: "Zara Wool Coat - Camel Brown",
      image: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=400",
      sku: "ZAR-001",
      price: 45.00,
      margin: 28.50,
      marginPercent: 63.3,
    },
    account: "Boutique Alice",
    accountId: "account1",
  },
  {
    id: "2",
    type: "transfer",
    date: new Date(2024, 11, 26, 10, 15),
    amount: 250.00,
    status: "completed",
    transferDetails: {
      bankName: "BNP Paribas",
    },
    account: "Boutique Alice",
    accountId: "account1",
  },
  {
    id: "3",
    type: "sale",
    date: new Date(2024, 11, 25, 16, 20),
    amount: 32.00,
    status: "finalized",
    item: {
      title: "Nike Air Max 90 - White/Blue",
      image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400",
      sku: "NIK-089",
      price: 32.00,
      margin: 18.00,
      marginPercent: 56.3,
    },
    account: "Frip Tim",
    accountId: "account2",
  },
  {
    id: "4",
    type: "sale",
    date: new Date(2024, 11, 24, 11, 45),
    amount: 58.00,
    status: "finalized",
    item: {
      title: "Vintage Levi's 501 Jeans",
      image: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=400",
      sku: "LEV-234",
      price: 58.00,
      margin: 35.00,
      marginPercent: 60.3,
    },
    account: "Boutique Alice",
    accountId: "account1",
  },
  {
    id: "5",
    type: "sale",
    date: new Date(2024, 11, 23, 9, 15),
    amount: 22.00,
    status: "finalized",
    item: {
      title: "H&M Cotton T-Shirt - Navy",
      image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400",
      sku: "HM-456",
      price: 22.00,
      margin: 12.00,
      marginPercent: 54.5,
    },
    account: "Margo Vintage",
    accountId: "account3",
  },
  {
    id: "6",
    type: "transfer",
    date: new Date(2024, 11, 22, 15, 30),
    amount: 180.00,
    status: "completed",
    transferDetails: {
      bankName: "Crédit Agricole",
    },
    account: "Frip Tim",
    accountId: "account2",
  },
];

export function WalletPage({ language, onNavigateToMessages }: WalletPageProps) {
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(
    ACCOUNTS.map((a) => a.id)
  );
  const [accountFilterMode, setAccountFilterMode] = useState<"all" | "selected">("all");
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferAmount, setTransferAmount] = useState("");

  // Mock KPI data - would be calculated from filtered activities in real app
  const availableBalance = 453.50;
  const pendingBalance = 127.80;

  // Determine effective accounts
  const effectiveAccountIds = accountFilterMode === "all"
    ? ACCOUNTS.map((a) => a.id)
    : selectedAccounts.length > 0
    ? selectedAccounts
    : ACCOUNTS.map((a) => a.id);

  // Filter activities by selected accounts
  const filteredActivities = mockActivities.filter((activity) =>
    effectiveAccountIds.includes(activity.accountId)
  );

  const handleTransfer = () => {
    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0 || amount > availableBalance) {
      toast.error(
        language === "fr"
          ? "Montant invalide"
          : "Invalid amount"
      );
      return;
    }

    // Simulate transfer
    toast.success(t(language, "wallet.toast.transferSuccess"));
    setTransferModalOpen(false);
    setTransferAmount("");
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat(language === "fr" ? "fr-FR" : "en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const handleSaleClick = (activity: FinancialActivity) => {
    if (activity.type === "sale" && onNavigateToMessages) {
      // In real app, would navigate to specific conversation
      onNavigateToMessages();
      toast.info(
        language === "fr"
          ? `Ouverture de la conversation pour ${activity.item?.title}`
          : `Opening conversation for ${activity.item?.title}`
      );
    }
  };

  return (
    <>
      {/* Header - Standardized like Dashboard */}
      <div className="border-b border-border bg-background pb-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 sm:gap-6 mb-4">
          <div>
            <h1 className="text-foreground mb-2">{t(language, "wallet.title")}</h1>
            <p className="text-muted-foreground">
              {t(language, "wallet.subtitle")}
            </p>
          </div>
        </div>

        {/* Controls - Standardized filter bar like Dashboard */}
        <div className="flex flex-wrap items-center gap-3 mt-4">
          {/* Account filter with "All accounts" mode */}
          <AccountFilter
            selectedAccounts={selectedAccounts}
            onAccountsChange={setSelectedAccounts}
            mode={accountFilterMode}
            onModeChange={setAccountFilterMode}
            variant="compact"
            showChips={false}
            language={language}
          />

          {/* Refresh Button */}
          <RefreshButton
            onRefresh={async () => {
              await new Promise((resolve) => setTimeout(resolve, 800));
              toast.success(
                language === "fr" ? "Données actualisées" : "Data refreshed"
              );
            }}
            language={language}
          />
        </div>
      </div>

      {/* KPI Cards - No sub-text inside */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Available Balance */}
        <div
          className="rounded-2xl border dark:border-[rgba(168,85,247,0.25)] border-border dark:bg-[#0E0E14] bg-card p-6"
          style={{
            boxShadow:
              "0 0 0 1px rgba(168,85,247,0.25), 0 0 28px rgba(168,85,247,0.10)",
          }}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl dark:bg-primary/15 bg-primary/10 flex items-center justify-center">
              <Euro className="w-6 h-6 dark:text-primary text-primary" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm dark:text-muted-foreground text-muted-foreground">
              {t(language, "wallet.kpi.available")}
            </p>
            <p
              className="dark:text-[#C7B8FF] text-foreground"
              style={{ fontSize: "32px", fontWeight: 600, lineHeight: 1.2 }}
            >
              {formatCurrency(availableBalance, language)}
            </p>
          </div>
        </div>

        {/* Pending Balance */}
        <div
          className="rounded-2xl border dark:border-[rgba(168,85,247,0.25)] border-border dark:bg-[#0E0E14] bg-card p-6"
          style={{
            boxShadow:
              "0 0 0 1px rgba(168,85,247,0.25), 0 0 28px rgba(168,85,247,0.10)",
          }}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl dark:bg-primary/15 bg-primary/10 flex items-center justify-center">
              <Euro className="w-6 h-6 dark:text-primary text-primary opacity-50" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm dark:text-muted-foreground text-muted-foreground">
              {t(language, "wallet.kpi.pending")}
            </p>
            <p
              className="dark:text-[#C7B8FF] text-foreground opacity-70"
              style={{ fontSize: "32px", fontWeight: 600, lineHeight: 1.2 }}
            >
              {formatCurrency(pendingBalance, language)}
            </p>
          </div>
        </div>
      </div>

      {/* Transfer Button */}
      <div className="mb-8">
        <Button
          onClick={() => setTransferModalOpen(true)}
          className="gap-2 rounded-xl dark:bg-[#8B5CF6] bg-primary hover:dark:bg-[#7C3AED] hover:bg-primary/90"
          style={{
            boxShadow: "0 0 16px rgba(139,92,246,0.3)",
          }}
        >
          <ArrowUpRight className="w-4 h-4" />
          {t(language, "wallet.button.transfer")}
        </Button>
      </div>

      {/* Financial Activity List - Compact & Fine Design */}
      <div>
        <h2 className="text-xl font-semibold dark:text-foreground text-foreground mb-4">
          {t(language, "wallet.activity.title")}
        </h2>

        {filteredActivities.length === 0 ? (
          <div
            className="rounded-2xl border dark:border-[rgba(168,85,247,0.25)] border-border dark:bg-[#0E0E14] bg-card p-12 text-center"
            style={{
              boxShadow:
                "0 0 0 1px rgba(168,85,247,0.25), 0 0 28px rgba(168,85,247,0.10)",
            }}
          >
            <p className="dark:text-muted-foreground text-muted-foreground">
              {t(language, "wallet.activity.noActivity")}
            </p>
          </div>
        ) : (
          <div
            className="rounded-2xl border dark:border-[rgba(168,85,247,0.25)] border-border dark:bg-[#0E0E14] bg-card overflow-hidden"
            style={{
              boxShadow:
                "0 0 0 1px rgba(168,85,247,0.25), 0 0 28px rgba(168,85,247,0.10)",
            }}
          >
            {filteredActivities.map((activity, index) => (
              <div
                key={activity.id}
                onClick={() => handleSaleClick(activity)}
                className={`px-4 py-3 transition-all ${
                  activity.type === "sale"
                    ? "cursor-pointer hover:dark:bg-[rgba(139,92,246,0.08)] hover:bg-muted/30"
                    : ""
                } ${
                  index !== filteredActivities.length - 1
                    ? "border-b dark:border-[rgba(168,85,247,0.15)] border-border/50"
                    : ""
                }`}
              >
                {activity.type === "sale" && activity.item ? (
                  <div className="flex items-center gap-3">
                    {/* Thumbnail */}
                    <img
                      src={activity.item.image}
                      alt={activity.item.title}
                      className="w-12 h-12 rounded-lg object-cover shrink-0"
                    />

                    {/* Item Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className="dark:text-foreground text-foreground font-medium truncate text-sm">
                          {activity.item.title}
                        </p>
                        <Badge
                          variant="outline"
                          className="shrink-0 dark:bg-primary/10 bg-primary/5 dark:text-primary text-primary dark:border-primary/30 border-primary/20 text-[10px] px-2 py-0.5"
                        >
                          {t(language, "wallet.activity.status.finalized")}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3 text-xs dark:text-muted-foreground text-muted-foreground flex-wrap">
                        <span className="font-mono">{activity.item.sku}</span>
                        <span className="opacity-50">•</span>
                        <span className="font-semibold dark:text-foreground text-foreground">
                          {formatCurrency(activity.item.price, language)}
                        </span>
                        <span className="opacity-50">•</span>
                        <span>
                          {language === "fr" ? "Marge" : "Margin"}:{" "}
                          {formatCurrency(activity.item.margin, language)}
                        </span>
                        <span className="opacity-50">•</span>
                        <span className="dark:text-primary/80 text-primary">
                          {activity.item.marginPercent.toFixed(1)}%
                        </span>
                        <span className="ml-auto opacity-70 text-[11px]">
                          {formatDate(activity.date)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    {/* Transfer Icon */}
                    <div className="w-12 h-12 rounded-lg dark:bg-primary/10 bg-primary/5 flex items-center justify-center shrink-0">
                      <ArrowUpRight className="w-5 h-5 dark:text-primary text-primary" />
                    </div>

                    {/* Transfer Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className="dark:text-foreground text-foreground font-medium text-sm">
                          {t(language, "wallet.activity.type.transfer")}
                        </p>
                        <Badge
                          variant="outline"
                          className="shrink-0 dark:bg-green-500/10 bg-green-500/5 dark:text-green-400 text-green-600 dark:border-green-500/30 border-green-500/20 text-[10px] px-2 py-0.5"
                        >
                          {t(language, "wallet.activity.status.completed")}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3 text-xs dark:text-muted-foreground text-muted-foreground">
                        <span className="font-semibold dark:text-foreground text-foreground">
                          {formatCurrency(activity.amount, language)}
                        </span>
                        <span className="opacity-50">•</span>
                        <span>{activity.account}</span>
                        <span className="ml-auto opacity-70 text-[11px]">
                          {formatDate(activity.date)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transfer Modal */}
      <Dialog open={transferModalOpen} onOpenChange={setTransferModalOpen}>
        <DialogContent className="rounded-2xl dark:bg-[#12121C] bg-card dark:border-[rgba(168,85,247,0.25)] border-border">
          <DialogHeader>
            <DialogTitle className="dark:text-foreground text-foreground">
              {t(language, "wallet.modal.transfer.title")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <p className="text-sm dark:text-muted-foreground text-muted-foreground mb-2">
                {t(language, "wallet.modal.transfer.available")}:{" "}
                <span className="dark:text-primary text-primary font-semibold">
                  {formatCurrency(availableBalance, language)}
                </span>
              </p>
            </div>

            <div>
              <label className="text-sm font-medium dark:text-foreground text-foreground mb-2 block">
                {t(language, "wallet.modal.transfer.amountLabel")}
              </label>
              <Input
                type="number"
                placeholder="0.00"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                className="rounded-xl"
                step="0.01"
                min="0"
                max={availableBalance}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTransferModalOpen(false)}
              className="rounded-xl"
            >
              {t(language, "wallet.modal.transfer.cancel")}
            </Button>
            <Button
              onClick={handleTransfer}
              className="rounded-xl dark:bg-[#8B5CF6] bg-primary hover:dark:bg-[#7C3AED] hover:bg-primary/90"
              style={{
                boxShadow: "0 0 16px rgba(139,92,246,0.3)",
              }}
            >
              {t(language, "wallet.modal.transfer.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
