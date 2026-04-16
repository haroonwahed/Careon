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
import { Language } from "../lib/i18n";
import { DateRangePreset } from "./DateRangePicker";

interface ChartDataPoint {
  date: string;
  quantity: number;
}

interface StockQuantityChartProps {
  data: ChartDataPoint[];
  language: Language;
  customFrom?: Date;
  customTo?: Date;
  aggregation?: "hourly" | "daily" | "weekly" | "monthly";
  preset?: DateRangePreset;
}

export function StockQuantityChart({
  data,
  language,
  customFrom,
  customTo,
  aggregation = "daily",
  preset = "last7d",
}: StockQuantityChartProps) {
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
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: "rgba(139, 92, 246, 1)" }}
          />
          <span className="text-xs dark:text-[#E7E7F0] text-foreground">
            {language === "fr" ? "Quantité" : "Quantity"}:
          </span>
          <span className="text-xs dark:text-[#E7E7F0] text-foreground tabular-nums">
            {payload[0].value} {language === "fr" ? "articles" : "items"}
          </span>
        </div>
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
          {language === "fr" ? "Évolution du stock" : "Stock evolution"}
        </h3>
        <p className="text-xs dark:text-[#9CA3AF] text-muted-foreground mt-1">
          {language === "fr"
            ? "Nombre d'articles en stock"
            : "Number of items in stock"}
        </p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart
          data={data}
          margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
        >
          <defs>
            <linearGradient id="colorStockQuantity" x1="0" y1="0" x2="0" y2="1">
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
            className="dark:text-[#9CA3AF] text-muted-foreground"
            style={{ fontSize: "11px" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="quantity"
            stroke="rgba(139, 92, 246, 1)"
            strokeWidth={2}
            fill="url(#colorStockQuantity)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}
