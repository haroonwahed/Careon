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
        className="rounded-xl dark:bg-[#0E0E14] bg-card border dark:border-[rgba(168,85,247,0.25)] border-border p-3 shadow-lg"
        style={{
          boxShadow:
            "0 0 0 1px rgba(168,85,247,0.25), 0 0 24px rgba(168,85,247,0.15)",
        }}
      >
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 mb-1">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs dark:text-[#E7E7F0] text-foreground">
              {entry.name === "cost"
                ? language === "fr"
                  ? "Prix d'achat"
                  : "Purchase price"
                : language === "fr"
                ? "Prix de vente"
                : "Sale price"}
              :
            </span>
            <span className="text-xs dark:text-[#E7E7F0] text-foreground tabular-nums">
              {formatCurrency(entry.value, language)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card
      className="rounded-2xl border dark:border-[rgba(168,85,247,0.25)] border-border dark:bg-[#0E0E14] bg-card p-6"
      style={{
        boxShadow:
          "0 0 0 1px rgba(168,85,247,0.25), 0 0 28px rgba(168,85,247,0.10)",
      }}
    >
      <div className="mb-4">
        <h3 className="dark:text-[#E7E7F0] text-foreground">
          {language === "fr" ? "Valeur stock (achat vs vente)" : "Stock value (cost vs sale)"}
        </h3>
        <p className="text-xs dark:text-[#9CA3AF] text-muted-foreground mt-1">
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
            className="dark:stroke-[rgba(168,85,247,0.10)] stroke-border"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            className="dark:text-[#9CA3AF] text-muted-foreground"
            style={{ fontSize: "11px" }}
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
            className="dark:text-[#9CA3AF] text-muted-foreground"
            style={{ fontSize: "11px" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="cost"
            fill="rgba(251, 146, 60, 1)"
            radius={[8, 8, 0, 0]}
            name="cost"
          />
          <Bar
            dataKey="sale"
            fill="rgba(139, 92, 246, 1)"
            radius={[8, 8, 0, 0]}
            name="sale"
          />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
