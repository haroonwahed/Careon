import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { Card } from "./ui/card";
import { Language, formatCurrency } from "../lib/i18n";

interface StockValueChartProps {
  costValue: number;
  saleValue: number;
  language: Language;
}

export function StockValueChart({
  costValue,
  saleValue,
  language,
}: StockValueChartProps) {
  const chartColors = {
    cost: "var(--chart-4)",
    sale: "var(--chart-1)",
    grid: "var(--grid-line)",
    muted: "var(--muted-foreground)",
  };
  const data = [
    {
      name: language === "fr" ? "Valeur stock" : "Stock value",
      cost: costValue,
      sale: saleValue,
    },
  ];

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div
        className="rounded-xl border border-border bg-card p-3 shadow-lg"
      >
        {payload.map((entry: any, index: number) => (
          <div key={`${entry.dataKey}-${index}`} className="flex items-center gap-2 mb-1">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs text-foreground">
              {entry.name === "cost"
                ? language === "fr"
                  ? "Prix d'achat"
                  : "Purchase price"
                : language === "fr"
                ? "Prix de vente"
                : "Sale price"}
              :
            </span>
            <span className="text-xs text-foreground tabular-nums">
              {formatCurrency(entry.value, language)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card
      className="rounded-2xl border border-border bg-card p-6 shadow-sm"
    >
      <div className="mb-4">
        <h3 className="text-foreground">
          {language === "fr" ? "Valeur stock (achat vs vente)" : "Stock value (cost vs sale)"}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {language === "fr"
            ? "Comparaison du prix d'achat et de vente"
            : "Comparison of purchase and sale prices"}
        </p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={data}
          margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={chartColors.grid}
            vertical={false}
          />
          <XAxis
            dataKey="name"
            stroke={chartColors.muted}
            tick={{ fontSize: 11, fill: chartColors.muted }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(value) => {
              if (value >= 1000) {
                return `${(value / 1000).toFixed(0)}k€`;
              }
              return `${value}€`;
            }}
            stroke={chartColors.muted}
            tick={{ fontSize: 11, fill: chartColors.muted }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="cost"
            fill={chartColors.cost}
            radius={[8, 8, 0, 0]}
            name="cost"
          />
          <Bar
            dataKey="sale"
            fill={chartColors.sale}
            radius={[8, 8, 0, 0]}
            name="sale"
          />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}