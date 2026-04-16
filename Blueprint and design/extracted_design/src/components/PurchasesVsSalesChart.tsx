import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "./ui/card";
import { Language, formatCurrency } from "../lib/i18n";
import { DateRangePreset } from "./DateRangePicker";

interface ChartDataPoint {
  date: string;
  sales: number;
  purchases: number;
}

interface PurchasesVsSalesChartProps {
  data: ChartDataPoint[];
  language: Language;
  customFrom?: Date;
  customTo?: Date;
  aggregation?: "hourly" | "daily" | "weekly" | "monthly";
  preset?: DateRangePreset;
}

export function PurchasesVsSalesChart({
  data,
  language,
  customFrom,
  customTo,
  aggregation = "daily",
  preset = "last7d",
}: PurchasesVsSalesChartProps) {
  // Format X-axis based on aggregation
  const formatXAxis = (value: string) => {
    const date = new Date(value);
    
    if (aggregation === "hourly") {
      return date.toLocaleTimeString(language === "fr" ? "fr-FR" : "en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (aggregation === "daily") {
      return date.toLocaleDateString(language === "fr" ? "fr-FR" : "en-GB", {
        day: "2-digit",
        month: "short",
      });
    } else if (aggregation === "weekly") {
      return date.toLocaleDateString(language === "fr" ? "fr-FR" : "en-GB", {
        day: "2-digit",
        month: "short",
      });
    } else {
      return date.toLocaleDateString(language === "fr" ? "fr-FR" : "en-GB", {
        month: "short",
        year: "numeric",
      });
    }
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const date = new Date(label);
    const formattedDate = date.toLocaleDateString(
      language === "fr" ? "fr-FR" : "en-GB",
      {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );

    return (
      <div
        className="rounded-xl dark:bg-[#0E0E14] bg-card border dark:border-[rgba(168,85,247,0.25)] border-border p-3 shadow-lg"
        style={{
          boxShadow:
            "0 0 0 1px rgba(168,85,247,0.25), 0 0 24px rgba(168,85,247,0.15)",
        }}
      >
        <p className="text-xs dark:text-[#9CA3AF] text-muted-foreground mb-2">
          {formattedDate}
        </p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 mb-1">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs dark:text-[#E7E7F0] text-foreground">
              {entry.name === "sales"
                ? language === "fr"
                  ? "Ventes"
                  : "Sales"
                : language === "fr"
                ? "Achats"
                : "Purchases"}
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
          {language === "fr" ? "Ventes vs Achats" : "Sales vs Purchases"}
        </h3>
        <p className="text-xs dark:text-[#9CA3AF] text-muted-foreground mt-1">
          {language === "fr"
            ? "Évolution sur la période sélectionnée"
            : "Trend over selected period"}
        </p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart
          data={data}
          margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
        >
          <defs>
            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="rgba(139, 92, 246, 0.4)"
                stopOpacity={0.8}
              />
              <stop
                offset="95%"
                stopColor="rgba(139, 92, 246, 0.4)"
                stopOpacity={0}
              />
            </linearGradient>
            <linearGradient id="colorPurchases" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="rgba(251, 146, 60, 0.4)"
                stopOpacity={0.8}
              />
              <stop
                offset="95%"
                stopColor="rgba(251, 146, 60, 0.4)"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            className="dark:stroke-[rgba(168,85,247,0.10)] stroke-border"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tickFormatter={formatXAxis}
            className="dark:text-[#9CA3AF] text-muted-foreground"
            style={{ fontSize: "11px" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(value) => {
              if (value >= 1000) {
                return `${(value / 1000).toFixed(0)}k`;
              }
              return value.toString();
            }}
            className="dark:text-[#9CA3AF] text-muted-foreground"
            style={{ fontSize: "11px" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="sales"
            stroke="rgba(139, 92, 246, 1)"
            strokeWidth={2}
            fill="url(#colorSales)"
            name="sales"
          />
          <Area
            type="monotone"
            dataKey="purchases"
            stroke="rgba(251, 146, 60, 1)"
            strokeWidth={2}
            fill="url(#colorPurchases)"
            name="purchases"
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}
