import { Card } from "./ui/card";
import { Language, formatCurrency } from "../lib/i18n";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface TopSale {
  id: string;
  title: string;
  thumbnail: string;
  accountName: string;
  price: number;
  margin: number;
  marginPercent: number;
}

interface TopSalesCardProps {
  topSales: TopSale[];
  sortBy: "margin" | "revenue" | "volume";
  onSortChange: (value: "margin" | "revenue" | "volume") => void;
  language: Language;
}

export function TopSalesCard({ topSales, sortBy, onSortChange, language }: TopSalesCardProps) {
  return (
    <Card className="dark:bg-card/50 bg-white border dark:border-primary/20 border-gray-200 rounded-2xl p-6 dark:shadow-[0_2px_16px_rgba(124,58,237,0.1)] shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold dark:text-foreground text-gray-900">
          {language === "fr" ? "Top ventes du mois" : "Top sales of the month"}
        </h4>
        <Select value={sortBy} onValueChange={(val) => onSortChange(val as any)}>
          <SelectTrigger className="w-[140px] h-8 text-xs rounded-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-lg">
            <SelectItem value="margin">{language === "fr" ? "Par marge" : "By margin"}</SelectItem>
            <SelectItem value="revenue">{language === "fr" ? "Par CA" : "By revenue"}</SelectItem>
            <SelectItem value="volume">{language === "fr" ? "Par volume" : "By volume"}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        {topSales.slice(0, 5).map((sale, idx) => (
          <div
            key={sale.id}
            className="flex items-center gap-3 p-3 rounded-xl dark:bg-background/50 bg-gray-50 dark:hover:bg-background/70 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center justify-center w-6 h-6 rounded-full dark:bg-primary/20 bg-primary/10 text-xs font-bold dark:text-primary text-primary">
              {idx + 1}
            </div>
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
              <ImageWithFallback
                src={sale.thumbnail}
                alt={sale.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm dark:text-foreground text-gray-900 truncate">{sale.title}</p>
              <p className="text-xs dark:text-muted-foreground text-gray-500">{sale.accountName}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold dark:text-foreground text-gray-900">{formatCurrency(sale.price, language)}</p>
              <p className="text-xs dark:text-emerald-400 text-emerald-600">+{formatCurrency(sale.margin, language)} ({sale.marginPercent.toFixed(0)}%)</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
