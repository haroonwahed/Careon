import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { Language, formatCurrency } from "../lib/i18n";
import { ImageWithFallback } from "./figma/ImageWithFallback";

interface Transaction {
  id: string;
  title: string;
  thumbnail: string;
  type: "sale" | "purchase" | "return";
  status: string;
  price: number;
  purchaseCost?: number;
  accountName: string;
  createdAt: Date;
  sku?: string;
}

interface TransactionsListProps {
  transactions: Transaction[];
  language: Language;
  filterTab?: "sales" | "purchases" | "returns";
  onFilterChange?: (tab: "sales" | "purchases" | "returns") => void;
  showTabs?: boolean;
}

export function TransactionsList({ 
  transactions, 
  language,
  filterTab = "sales",
  onFilterChange,
  showTabs = true
}: TransactionsListProps) {
  const filteredTransactions = filterTab === "sales" 
    ? transactions.filter(t => t.type === "sale")
    : filterTab === "purchases"
    ? transactions.filter(t => t.type === "purchase")
    : transactions.filter(t => t.type === "return");

  const getTypeLabel = (type: string) => {
    if (type === "sale") return language === "fr" ? "Vente" : "Sale";
    if (type === "purchase") return language === "fr" ? "Achat" : "Purchase";
    return language === "fr" ? "Retour" : "Return";
  };

  return (
    <Card className="dark:bg-card/50 bg-white border dark:border-primary/20 border-gray-200 rounded-2xl overflow-hidden dark:shadow-[0_2px_16px_rgba(124,58,237,0.1)] shadow-sm">
      {showTabs && onFilterChange && (
        <div className="p-4 border-b dark:border-border border-gray-200">
          <Tabs value={filterTab} onValueChange={(val) => onFilterChange(val as any)}>
            <TabsList className="rounded-2xl h-10 p-1 dark:bg-background/50 bg-gray-100">
              <TabsTrigger value="sales" className="rounded-xl">
                {language === "fr" ? "Ventes" : "Sales"}
              </TabsTrigger>
              <TabsTrigger value="purchases" className="rounded-xl">
                {language === "fr" ? "Achats" : "Purchases"}
              </TabsTrigger>
              <TabsTrigger value="returns" className="rounded-xl">
                {language === "fr" ? "Retours" : "Returns"}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="dark:bg-background/30 bg-gray-50">
            <tr className="border-b dark:border-border border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-semibold dark:text-muted-foreground text-gray-600 uppercase tracking-wide">
                {language === "fr" ? "Article" : "Item"}
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold dark:text-muted-foreground text-gray-600 uppercase tracking-wide">
                {language === "fr" ? "Type" : "Type"}
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold dark:text-muted-foreground text-gray-600 uppercase tracking-wide">
                {language === "fr" ? "Statut" : "Status"}
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold dark:text-muted-foreground text-gray-600 uppercase tracking-wide">
                {language === "fr" ? "Montant" : "Amount"}
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold dark:text-muted-foreground text-gray-600 uppercase tracking-wide">
                {language === "fr" ? "Compte" : "Account"}
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold dark:text-muted-foreground text-gray-600 uppercase tracking-wide">
                {language === "fr" ? "Date" : "Date"}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.slice(0, 20).map((item) => {
              return (
                <tr
                  key={item.id}
                  className="border-b dark:border-border border-gray-100 dark:hover:bg-background/30 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        <ImageWithFallback
                          src={item.thumbnail}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm dark:text-foreground text-gray-900 truncate max-w-xs">{item.title}</p>
                        {item.sku && (
                          <p className="text-xs dark:text-muted-foreground text-gray-500">{item.sku}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge 
                      className={
                        item.type === "sale"
                          ? "dark:bg-primary/15 bg-primary/10 dark:text-primary text-primary border-0"
                          : item.type === "purchase"
                          ? "dark:bg-orange-500/15 bg-orange-500/10 dark:text-orange-400 text-orange-600 border-0"
                          : "dark:bg-red-500/15 bg-red-500/10 dark:text-red-400 text-red-600 border-0"
                      }
                    >
                      {getTypeLabel(item.type)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className="dark:bg-primary/15 bg-primary/10 dark:text-primary text-primary border-0">
                      {item.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm dark:text-foreground text-gray-900 tabular-nums">{formatCurrency(item.price, language)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm dark:text-foreground text-gray-900">{item.accountName}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm dark:text-muted-foreground text-gray-600">
                      <p>{item.createdAt.toLocaleDateString(language === "fr" ? "fr-FR" : "en-GB")}</p>
                      <p className="text-xs">{item.createdAt.toLocaleTimeString(language === "fr" ? "fr-FR" : "en-GB", { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}