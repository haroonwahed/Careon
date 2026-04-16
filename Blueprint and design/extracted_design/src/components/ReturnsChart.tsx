import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "./ui/card";
import { Language, formatCurrency } from "../lib/i18n";
import { DateRangePreset } from "./DateRangePicker";

interface ReturnsChartProps {
  data: Array<{ date: string; amount: number }>;
  language: Language;
  customFrom?: Date;
  customTo?: Date;
  aggregation: "hourly" | "daily" | "weekly" | "monthly";
  preset: DateRangePreset;
}

export function ReturnsChart({
  data,
  language,
  customFrom,
  customTo,
  aggregation,
  preset,
}: ReturnsChartProps) {
  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const date = payload[0].payload.date;
    const amount = payload[0].value;

    return (
      <div
        className="rounded-xl dark:bg-[#0E0E14] bg-card border dark:border-[rgba(168,85,247,0.25)] border-border p-3 shadow-lg"
        style={{
          boxShadow:
            "0 0 0 1px rgba(168,85,247,0.25), 0 0 24px rgba(168,85,247,0.15)",
        }}
      >
        <p className="text-xs dark:text-[#9CA3AF] text-muted-foreground mb-1">
          {date}
        </p>
        <p className="text-sm dark:text-[#E7E7F0] text-foreground tabular-nums">
          {formatCurrency(amount, language)}
        </p>
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
          {language === "fr" ? "Montant des retours" : "Returns amount"}
        </h3>
        <p className="text-xs dark:text-[#9CA3AF] text-muted-foreground mt-1">
          {language === "fr"
            ? "Évolution des retours sur la période"
            : "Returns evolution over period"}
        </p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart
          data={data}
          margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
        >
          <defs>
            <linearGradient id="colorReturns" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="rgba(239, 68, 68, 0.4)"
                stopOpacity={0.8}
              />
              <stop
                offset="95%"
                stopColor="rgba(239, 68, 68, 0.4)"
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
            className="dark:text-[#9CA3AF] text-muted-foreground"
            style={{ fontSize: "11px" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(value) => formatCurrency(value, language)}
            className="dark:text-[#9CA3AF] text-muted-foreground"
            style={{ fontSize: "11px" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="amount"
            stroke="#EF4444"
            strokeWidth={2}
            fill="url(#colorReturns)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}
