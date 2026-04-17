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
import React from "react";

interface ChartDataPoint {
  date: string;
  costValue: number;
  saleValue: number;
}

interface StockValueEvolutionChartProps {
  data: ChartDataPoint[];
  language: Language;
  customFrom?: Date;
  customTo?: Date;
  aggregation?: "hourly" | "daily" | "weekly" | "monthly";
  preset?: DateRangePreset;
}

export function StockValueEvolutionChart({
  data,
  language,
  customFrom,
  customTo,
  aggregation = "daily",
  preset = "last7d",
}: StockValueEvolutionChartProps) {
  const chartColors = {
    cost: "var(--chart-4)",
    costSoft: "var(--chart-4-soft)",
    sale: "var(--chart-1)",
    saleSoft: "var(--chart-1-soft)",
    grid: "var(--grid-line)",
    muted: "var(--muted-foreground)",
  };
  // Generate unique ID for gradients to avoid conflicts between multiple chart instances
  const uniqueId = React.useMemo(() => Math.random().toString(36).substring(7), []);
  
  // Add unique keys to data
  const chartData = React.useMemo(() => 
    data.map((item, index) => ({
      ...item,
      _chartKey: `${item.date}-${index}`,
    })), 
  [data]);
  
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
        className="rounded-xl border border-border bg-card p-3 shadow-lg"
      >
        <p className="mb-2 text-xs text-muted-foreground">
          {formattedDate}
        </p>
        {payload.map((entry: any, index: number) => (
          <div key={`${entry.dataKey}-${index}`} className="flex items-center gap-2 mb-1">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs text-foreground">
              {entry.name === "costValue"
                ? language === "fr"
                  ? "Valeur achat"
                  : "Cost value"
                : language === "fr"
                ? "Valeur vente"
                : "Sale value"}
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
            ? "Évolution sur la période"
            : "Evolution over period"}
        </p>
      </div>

      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
          >
            <defs>
              <linearGradient id={`colorStockCost-${uniqueId}`} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={chartColors.costSoft}
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor={chartColors.costSoft}
                  stopOpacity={0}
                />
              </linearGradient>
              <linearGradient id={`colorStockSale-${uniqueId}`} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={chartColors.saleSoft}
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor={chartColors.saleSoft}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={chartColors.grid}
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatXAxis}
              stroke={chartColors.muted}
              tick={{ fontSize: 11, fill: chartColors.muted }}
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
              stroke={chartColors.muted}
              tick={{ fontSize: 11, fill: chartColors.muted }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="costValue"
              stroke={chartColors.cost}
              strokeWidth={2}
              fill={`url(#colorStockCost-${uniqueId})`}
              name="costValue"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="saleValue"
              stroke={chartColors.sale}
              strokeWidth={2}
              fill={`url(#colorStockSale-${uniqueId})`}
              name="saleValue"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}