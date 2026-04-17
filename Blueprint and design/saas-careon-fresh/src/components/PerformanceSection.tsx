import { Card } from "./ui/card";
import { Language, formatCurrency } from "../lib/i18n";
import { TrendingUp, Package, Tag } from "lucide-react";

interface TopProduct {
  name: string;
  sales: number;
  revenue: number;
  margin: number;
}

interface TopCategory {
  name: string;
  count: number;
  revenue: number;
}

interface Transaction {
  id: string;
  date: string;
  type: "sale" | "purchase";
  item: string;
  amount: number;
  status: string;
}

interface PerformanceSectionProps {
  topProducts: TopProduct[];
  topCategories: TopCategory[];
  recentTransactions: Transaction[];
  language: Language;
}

export function PerformanceSection({
  topProducts,
  topCategories,
  recentTransactions,
  language,
}: PerformanceSectionProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Top ventes */}
      <Card
        className="rounded-2xl border dark:border-[rgba(168,85,247,0.25)] border-border dark:bg-[#0E0E14] bg-card p-6"
        style={{
          boxShadow:
            "0 0 0 1px rgba(168,85,247,0.25), 0 0 28px rgba(168,85,247,0.10)",
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl dark:bg-primary/15 bg-primary/10">
            <TrendingUp className="h-5 w-5 dark:text-primary text-primary" />
          </div>
          <div>
            <h3 className="dark:text-[#E7E7F0] text-foreground">
              {language === "fr" ? "Top ventes du mois" : "Top sales this month"}
            </h3>
            <p className="text-xs dark:text-[#9CA3AF] text-muted-foreground">
              {language === "fr" ? "Produits les plus vendus" : "Best-selling products"}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {topProducts.map((product, index) => (
            <div
              key={index}
              className="flex items-start justify-between p-3 rounded-xl dark:bg-[#1A1A24] bg-muted/50 border dark:border-[rgba(168,85,247,0.15)] border-border"
            >
              <div className="flex-1">
                <p className="text-sm dark:text-[#E7E7F0] text-foreground mb-1 line-clamp-1">
                  {product.name}
                </p>
                <p className="text-xs dark:text-[#9CA3AF] text-muted-foreground">
                  {product.sales} {language === "fr" ? "ventes" : "sales"}
                </p>
              </div>
              <div className="text-right ml-3">
                <p className="text-sm dark:text-[#E7E7F0] text-foreground tabular-nums">
                  {formatCurrency(product.revenue, language)}
                </p>
                <p className="text-xs dark:text-primary text-primary tabular-nums">
                  {product.margin.toFixed(1)}% {language === "fr" ? "marge" : "margin"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Top catégories */}
      <Card
        className="rounded-2xl border dark:border-[rgba(168,85,247,0.25)] border-border dark:bg-[#0E0E14] bg-card p-6"
        style={{
          boxShadow:
            "0 0 0 1px rgba(168,85,247,0.25), 0 0 28px rgba(168,85,247,0.10)",
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl dark:bg-primary/15 bg-primary/10">
            <Tag className="h-5 w-5 dark:text-primary text-primary" />
          </div>
          <div>
            <h3 className="dark:text-[#E7E7F0] text-foreground">
              {language === "fr" ? "Top catégories" : "Top categories"}
            </h3>
            <p className="text-xs dark:text-[#9CA3AF] text-muted-foreground">
              {language === "fr" ? "Classement par CA" : "Ranking by revenue"}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {topCategories.map((category, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 rounded-xl dark:bg-[#1A1A24] bg-muted/50 border dark:border-[rgba(168,85,247,0.15)] border-border"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg dark:bg-primary/10 bg-primary/5">
                  <span className="text-sm dark:text-primary text-primary">
                    {index + 1}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm dark:text-[#E7E7F0] text-foreground mb-0.5">
                    {category.name}
                  </p>
                  <p className="text-xs dark:text-[#9CA3AF] text-muted-foreground">
                    {category.count} {language === "fr" ? "articles" : "items"}
                  </p>
                </div>
              </div>
              <p className="text-sm dark:text-[#E7E7F0] text-foreground tabular-nums ml-3">
                {formatCurrency(category.revenue, language)}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Transactions récentes */}
      <Card
        className="rounded-2xl border dark:border-[rgba(168,85,247,0.25)] border-border dark:bg-[#0E0E14] bg-card p-6"
        style={{
          boxShadow:
            "0 0 0 1px rgba(168,85,247,0.25), 0 0 28px rgba(168,85,247,0.10)",
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl dark:bg-primary/15 bg-primary/10">
            <Package className="h-5 w-5 dark:text-primary text-primary" />
          </div>
          <div>
            <h3 className="dark:text-[#E7E7F0] text-foreground">
              {language === "fr" ? "Transactions récentes" : "Recent transactions"}
            </h3>
            <p className="text-xs dark:text-[#9CA3AF] text-muted-foreground">
              {language === "fr" ? "Dernières opérations" : "Latest operations"}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {recentTransactions.map((transaction) => (
            <div
              key={transaction.id}
              className="flex items-center justify-between p-2.5 rounded-lg dark:bg-[#1A1A24] bg-muted/50 border dark:border-[rgba(168,85,247,0.10)] border-border"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wide ${
                      transaction.type === "sale"
                        ? "dark:bg-primary/15 bg-primary/10 dark:text-primary text-primary"
                        : "dark:bg-orange-500/15 bg-orange-500/10 dark:text-orange-400 text-orange-600"
                    }`}
                  >
                    {transaction.type === "sale"
                      ? language === "fr"
                        ? "Vente"
                        : "Sale"
                      : language === "fr"
                      ? "Achat"
                      : "Purchase"}
                  </span>
                  <span className="text-xs dark:text-[#9CA3AF] text-muted-foreground">
                    {transaction.date}
                  </span>
                </div>
                <p className="text-xs dark:text-[#E7E7F0] text-foreground line-clamp-1">
                  {transaction.item}
                </p>
              </div>
              <p className="text-sm dark:text-[#E7E7F0] text-foreground tabular-nums ml-3">
                {formatCurrency(transaction.amount, language)}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
