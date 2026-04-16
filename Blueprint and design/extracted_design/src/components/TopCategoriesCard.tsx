import { Card } from "./ui/card";
import { Language, formatCurrency } from "../lib/i18n";

interface TopCategory {
  name: string;
  count: number;
  revenue: number;
  percent: number;
}

interface TopCategoriesCardProps {
  topCategories: TopCategory[];
  language: Language;
}

export function TopCategoriesCard({ topCategories, language }: TopCategoriesCardProps) {
  return (
    <Card className="dark:bg-card/50 bg-white border dark:border-primary/20 border-gray-200 rounded-2xl p-6 dark:shadow-[0_2px_16px_rgba(124,58,237,0.1)] shadow-sm">
      <h4 className="font-semibold dark:text-foreground text-gray-900 mb-4">
        {language === "fr" ? "Top catégories" : "Top categories"}
      </h4>
      <div className="space-y-3">
        {topCategories.map((cat, idx) => (
          <div key={cat.name} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full dark:bg-primary/20 bg-primary/10 text-xs font-bold dark:text-primary text-primary">
                  {idx + 1}
                </div>
                <span className="text-sm dark:text-foreground text-gray-900">{cat.name}</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold dark:text-foreground text-gray-900">{formatCurrency(cat.revenue, language)}</p>
                <p className="text-xs dark:text-muted-foreground text-gray-500">{cat.count} {language === "fr" ? "ventes" : "sales"}</p>
              </div>
            </div>
            <div className="w-full h-2 rounded-full dark:bg-background/50 bg-gray-200 overflow-hidden">
              <div
                className="h-full dark:bg-primary bg-primary rounded-full"
                style={{ width: `${cat.percent}%` }}
              />
            </div>
            <p className="text-xs dark:text-muted-foreground text-gray-500 text-right">{cat.percent.toFixed(1)}% {language === "fr" ? "du CA" : "of revenue"}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
