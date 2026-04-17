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
  amount: number;
}

interface PurchasesChartProps {
  data: ChartDataPoint[];
  language: Language;
  customFrom?: Date;
  customTo?: Date;
  aggregation?: "hourly" | "daily" | "weekly" | "monthly";
  preset?: DateRangePreset;
}

export function PurchasesChart({
  data,
  language,
  customFrom,
  customTo,
  aggregation = "daily",
  preset = "last7d",
}: PurchasesChartProps) {
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
        className="rounded-xl bg-card border border-border p-3 shadow-lg"
        style={{
          boxShadow:
            "0 0 0 1px rgba(168,85,247,0.25), 0 0 24px rgba(168,85,247,0.15)",
        }}
      >
        <p className="text-xs text-muted-foreground mb-2">
          {formattedDate}
        </p>
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: "rgba(251, 146, 60, 1)" }}
          />
          <span className="text-xs text-foreground">
            {language === "fr" ? "Achats" : "Purchases"}:
          </span>
          <span className="text-xs text-foreground tabular-nums">
            {formatCurrency(payload[0].value, language)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <Card
      className="rounded-2xl border border-border bg-card p-6"
      style={{
        boxShadow:
          "0 0 0 1px rgba(168,85,247,0.25), 0 0 28px rgba(168,85,247,0.10)",
      }}
    >
      <div className="mb-4">
        <h3 className="text-foreground">
          {language === "fr" ? "Montant des achats" : "Purchase amount"}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          {language === "fr"
            ? "Évolution sur la période sélectionnée"
            : "Trend over selected period"}
        </p>
      </div>

      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
          >
            <defs>
              <linearGradient id={`colorPurchasesAmount-${uniqueId}`} x1="0" y1="0" x2="0" y2="1">
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
              className="text-muted-foreground"
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
              className="text-muted-foreground"
              style={{ fontSize: "11px" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="rgba(251, 146, 60, 1)"
              strokeWidth={2}
              fill={`url(#colorPurchasesAmount-${uniqueId})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}