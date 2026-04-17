import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Language, formatCurrency } from "../lib/i18n";
import { ExternalLink } from "lucide-react";

interface ReturnTransaction {
  id: string;
  title: string;
  sku?: string;
  thumbnail?: string;
  amount: number;
  date: Date;
  accountName: string;
  status: string;
  returnStatus?: "refunded" | "received" | "in_transit" | "dispute";
}

interface ReturnsTableProps {
  returns: ReturnTransaction[];
  language: Language;
}

// Mock example data - 6 retours d'exemple
const EXAMPLE_RETURNS: ReturnTransaction[] = [
  {
    id: "ret-001",
    title: "Nike Air Max 90 Sneakers – Size 42",
    sku: "VM-20251027-A1B2",
    thumbnail: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200",
    amount: 85.00,
    accountName: "Alice's Closet",
    status: "return_initiated",
    returnStatus: "received",
    date: new Date("2025-10-27T10:30:00"),
  },
  {
    id: "ret-002",
    title: "Vintage Levi's 501 Jeans – W32 L34",
    sku: "VM-20251026-C3D4",
    thumbnail: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=200",
    amount: 45.00,
    accountName: "TrendyBoutique",
    status: "return_initiated",
    returnStatus: "refunded",
    date: new Date("2025-10-26T16:45:00"),
  },
  {
    id: "ret-003",
    title: "H&M Black Leather Jacket – Size L",
    sku: "VM-20251024-E5F6",
    thumbnail: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=200",
    amount: 65.00,
    accountName: "Minimal Style",
    status: "return_initiated",
    returnStatus: "dispute",
    date: new Date("2025-10-24T09:15:00"),
  },
  {
    id: "ret-004",
    title: "COS Minimalist Grey Wool Coat – Size M",
    sku: "VM-20251023-G7H8",
    thumbnail: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=200",
    amount: 120.00,
    accountName: "Minimal Style",
    status: "return_initiated",
    returnStatus: "in_transit",
    date: new Date("2025-10-23T18:22:00"),
  },
  {
    id: "ret-005",
    title: "Tommy Hilfiger Polo Shirt – Red – XL",
    sku: "VM-20251021-I9J0",
    thumbnail: "https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=200",
    amount: 28.00,
    accountName: "Alice's Closet",
    status: "return_initiated",
    returnStatus: "refunded",
    date: new Date("2025-10-21T11:20:00"),
  },
  {
    id: "ret-006",
    title: "Adidas Originals Track Jacket – Black & White",
    sku: "VM-20251020-K1L2",
    thumbnail: "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=200",
    amount: 52.00,
    accountName: "Alice's Closet",
    status: "return_initiated",
    returnStatus: "received",
    date: new Date("2025-10-20T08:15:00"),
  },
];

export function ReturnsTable({ returns, language }: ReturnsTableProps) {
  // Use example data if no returns provided
  const displayReturns = returns.length > 0 ? returns : EXAMPLE_RETURNS;

  const getReturnStatusLabel = (status: string) => {
    switch (status) {
      case "refunded":
        return language === "fr" ? "Remboursé" : "Refunded";
      case "received":
        return language === "fr" ? "Retour reçu" : "Return received";
      case "in_transit":
        return language === "fr" ? "Retour en transit" : "Return in transit";
      case "dispute":
        return language === "fr" ? "Litige ouvert" : "Dispute open";
      default:
        return language === "fr" ? "Retour" : "Return";
    }
  };

  const getReturnStatusColor = (status: string) => {
    switch (status) {
      case "refunded":
        return "dark:bg-green-500/20 bg-green-500/10 dark:text-green-400 text-green-600 border-0";
      case "received":
        return "dark:bg-primary/20 bg-primary/10 dark:text-primary text-primary border-0";
      case "in_transit":
        return "dark:bg-orange-500/20 bg-orange-500/10 dark:text-orange-400 text-orange-600 border-0";
      case "dispute":
        return "dark:bg-red-500/20 bg-red-500/10 dark:text-red-400 text-red-600 border-0";
      default:
        return "dark:bg-[#9CA3AF]/20 bg-neutral-200 dark:text-[#9CA3AF] text-neutral-600 border-0";
    }
  };

  const formatDateTime = (date: Date) => {
    const dateStr = date.toLocaleDateString(language === "fr" ? "fr-FR" : "en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const timeStr = date.toLocaleTimeString(language === "fr" ? "fr-FR" : "en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${dateStr} • ${timeStr}`;
  };

  return (
    <Card
      className="rounded-2xl border dark:border-[rgba(168,85,247,0.25)] border-border dark:bg-[#0E0E14] bg-card p-6"
      style={{
        boxShadow:
          "0 0 0 1px rgba(168,85,247,0.25), 0 0 28px rgba(168,85,247,0.10)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="dark:text-[#E7E7F0] text-foreground">
            {language === "fr" ? "Transactions retours" : "Return transactions"}
          </h3>
          <p className="text-xs dark:text-[#9CA3AF] text-muted-foreground mt-1">
            {language === "fr"
              ? "Derniers retours effectués"
              : "Recent returns made"}
          </p>
        </div>
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium dark:text-[#9CA3AF] text-muted-foreground hover:dark:text-primary hover:text-primary transition-colors"
        >
          {language === "fr" ? "Voir tout" : "View all"}
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-12 gap-3 px-3 pb-2 mb-2 border-b dark:border-[rgba(168,85,247,0.10)] border-border">
        <div className="col-span-4 text-[10px] font-semibold dark:text-[#9CA3AF] text-muted-foreground uppercase tracking-wider">
          {language === "fr" ? "Article" : "Item"}
        </div>
        <div className="col-span-2 text-[10px] font-semibold dark:text-[#9CA3AF] text-muted-foreground uppercase tracking-wider">
          {language === "fr" ? "Statut" : "Status"}
        </div>
        <div className="col-span-2 text-[10px] font-semibold dark:text-[#9CA3AF] text-muted-foreground uppercase tracking-wider text-right">
          {language === "fr" ? "Montant" : "Amount"}
        </div>
        <div className="col-span-2 text-[10px] font-semibold dark:text-[#9CA3AF] text-muted-foreground uppercase tracking-wider">
          {language === "fr" ? "Compte" : "Account"}
        </div>
        <div className="col-span-2 text-[10px] font-semibold dark:text-[#9CA3AF] text-muted-foreground uppercase tracking-wider">
          {language === "fr" ? "Date" : "Date"}
        </div>
      </div>

      {/* Table Rows */}
      <div className="space-y-1">
        {displayReturns.slice(0, 6).map((ret) => (
          <div
            key={ret.id}
            className="grid grid-cols-12 gap-3 p-2.5 rounded-lg dark:bg-[#1A1A24]/40 bg-muted/30 border dark:border-[rgba(168,85,247,0.08)] border-border hover:dark:bg-[#1A1A24] hover:bg-muted/50 transition-all duration-200 cursor-pointer group"
          >
            {/* Article (with thumbnail + title + SKU) */}
            <div className="col-span-4 flex items-center gap-2.5 min-w-0">
              <div className="flex-shrink-0 w-8 h-8 rounded-md overflow-hidden dark:bg-[#0E0E14] bg-card border dark:border-[rgba(168,85,247,0.15)] border-border">
                <img
                  src={ret.thumbnail || "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=200"}
                  alt={ret.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] dark:text-[#E7E7F0] text-foreground line-clamp-1 leading-tight">
                  {ret.title}
                </p>
                {ret.sku && (
                  <p className="text-[9px] dark:text-[#9CA3AF] text-muted-foreground mt-0.5">
                    {ret.sku}
                  </p>
                )}
              </div>
            </div>

            {/* Statut */}
            <div className="col-span-2 flex items-center">
              <Badge className={`${getReturnStatusColor(ret.returnStatus || "received")} text-[10px] px-2 py-0.5`}>
                {getReturnStatusLabel(ret.returnStatus || "received")}
              </Badge>
            </div>

            {/* Montant */}
            <div className="col-span-2 flex items-center justify-end">
              <span className="text-[13px] dark:text-[#E7E7F0] text-foreground font-semibold tabular-nums">
                {formatCurrency(ret.amount, language)}
              </span>
            </div>

            {/* Compte */}
            <div className="col-span-2 flex items-center">
              <span className="text-[11px] dark:text-[#9CA3AF] text-muted-foreground truncate">
                {ret.accountName}
              </span>
            </div>

            {/* Date */}
            <div className="col-span-2 flex items-center">
              <span className="text-[10px] dark:text-[#9CA3AF] text-muted-foreground">
                {formatDateTime(ret.date)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}