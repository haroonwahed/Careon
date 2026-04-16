import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card } from "./ui/card";
import { Language, t, formatDate } from "../lib/i18n";
import { DateRangePreset } from "./DateRangePicker";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface MarginChartProps {
  data: Array<{
    date: string;
    marginPercent: number;
  }>;
  delta?: number;
  language: Language;
  customFrom?: Date;
  customTo?: Date;
  aggregation?: "hourly" | "daily" | "weekly" | "monthly";
  preset?: DateRangePreset;
}

// Helper to aggregate data
function aggregateData(
  data: Array<{ date: string; marginPercent: number }>,
  type: "hourly" | "daily" | "weekly" | "monthly",
  language: Language
) {
  if (type === "hourly" || type === "daily") {
    return data;
  }
  
  const buckets = new Map<string, { marginPercent: number; count: number; firstDate: Date }>();
  const now = new Date();
  const currentYear = now.getFullYear();
  
  data.forEach(item => {
    let date: Date;
    if (item.date.includes(':')) {
      return;
    } else if (item.date.includes('/')) {
      const parts = item.date.split('/');
      if (parts.length !== 2) return;
      
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      
      if (isNaN(day) || isNaN(month) || day < 1 || day > 31 || month < 1 || month > 12) {
        return;
      }
      
      date = new Date(currentYear, month - 1, day);
      
      if (isNaN(date.getTime())) {
        return;
      }
      
      if (date > now) {
        date = new Date(currentYear - 1, month - 1, day);
        if (isNaN(date.getTime())) {
          return;
        }
      }
    } else {
      return;
    }
    
    let key: string;
    
    try {
      if (type === "weekly") {
        const dayOfWeek = date.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() + diff);
        key = formatDate(weekStart, language, { day: "numeric", month: "short" });
      } else {
        key = formatDate(date, language, { month: "short", year: "numeric" });
      }
    } catch (e) {
      return;
    }
    
    const existing = buckets.get(key) || { marginPercent: 0, count: 0, firstDate: date };
    buckets.set(key, {
      marginPercent: existing.marginPercent + item.marginPercent,
      count: existing.count + 1,
      firstDate: existing.firstDate,
    });
  });
  
  const sorted = Array.from(buckets.entries()).sort((a, b) => 
    a[1].firstDate.getTime() - b[1].firstDate.getTime()
  );
  
  return sorted.map(([date, values]) => ({
    date,
    marginPercent: values.marginPercent / values.count,
  }));
}

export function MarginChart({ data, delta, language, customFrom, customTo, aggregation = "daily", preset }: MarginChartProps) {
  
  // Check if we're in hourly mode
  const isHourly = aggregation === "hourly";
  
  // Aggregate data
  const aggregatedData = aggregateData(data, aggregation, language);
  
  // Determine x-axis interval based on data length
  const getXAxisInterval = () => {
    if (isHourly) return 3;
    if (aggregation === "weekly" || aggregation === "monthly") return 0;
    if (aggregatedData.length <= 7) return 0;
    if (aggregatedData.length <= 31) return Math.floor(aggregatedData.length / 7);
    return "preserveStartEnd";
  };

  // Calculate weighted average margin
  const avgMargin = data.reduce((sum, d) => sum + d.marginPercent, 0) / data.length;

  const getDeltaDisplay = (value: number) => {
    const isPositive = value > 0;
    const isNeutral = Math.abs(value) < 0.5;
    
    let colorClass = "";
    let DeltaIcon = Minus;
    
    if (!isNeutral) {
      if (isPositive) {
        colorClass = "dark:text-[#2AF07A] text-emerald-600";
        DeltaIcon = TrendingUp;
      } else {
        colorClass = "dark:text-[#FF5C8A] text-red-600";
        DeltaIcon = TrendingDown;
      }
    } else {
      colorClass = "dark:text-[#9CA3AF] text-neutral-500";
    }
    
    const displayValue = isNeutral ? "0%" : `${isPositive ? "+" : ""}${value.toFixed(1)}%`;
    
    return (
      <div className={`inline-flex items-center gap-1.5 ${colorClass}`}>
        <DeltaIcon className="w-3.5 h-3.5" />
        <span className="text-xs" style={{ fontWeight: 500, fontSize: "12px" }}>
          {displayValue}
        </span>
      </div>
    );
  };
  
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const currentValue = payload[0].value;
      
      return (
        <div 
          className="rounded-xl border dark:border-[rgba(168,85,247,0.25)] dark:bg-[#0E0E14] bg-popover p-3 min-w-[180px]"
          style={{
            boxShadow: "0 0 0 1px rgba(168,85,247,0.25), 0 0 28px rgba(168,85,247,0.10)"
          }}
        >
          <p className="dark:text-[#9CA3AF] text-muted-foreground mb-3" style={{ fontSize: "12px", fontWeight: 600 }}>
            {label}
          </p>
          <div className="space-y-1">
            <p className="dark:text-[#9CA3AF] text-muted-foreground" style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {t(language, "chart.marginPct")}
            </p>
            <p className="dark:text-[#C7B8FF] text-foreground" style={{ fontSize: "14px", fontWeight: 600 }}>
              {currentValue.toFixed(1)}%
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card 
      className="rounded-2xl border p-6 dark:bg-[#0E0E14] dark:border-[rgba(168,85,247,0.25)] bg-card shadow-sm"
      style={{
        boxShadow: "0 0 0 1px rgba(168,85,247,0.25), 0 0 28px rgba(168,85,247,0.10)"
      }}
    >
      {/* Header with inline metrics */}
      <div className="flex items-start justify-between mb-6">
        <div className="space-y-3">
          <h3 
            className="dark:text-[#E7E7F0] text-foreground"
            style={{ fontSize: "18px", fontWeight: 600 }}
          >
            {t(language, "chart.marginPct")} {isHourly && (
              <span 
                className="dark:text-[#9CA3AF] text-muted-foreground ml-2"
                style={{ fontSize: "14px", fontWeight: 400 }}
              >
                (24h)
              </span>
            )}
          </h3>
          
          <div className="space-y-2">
            <div>
              <div 
                className="dark:text-[#C7B8FF] text-foreground"
                style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "-0.02em" }}
              >
                {avgMargin.toFixed(1)}%
              </div>
              <p className="dark:text-[#9CA3AF] text-muted-foreground text-xs">
                {t(language, "chart.average")}
              </p>
              {delta !== undefined && getDeltaDisplay(delta)}
            </div>
          </div>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={300} minHeight={300}>
        <LineChart data={aggregatedData}>
          <CartesianGrid 
            strokeDasharray="0" 
            stroke="rgba(167, 139, 250, 0.10)" 
            strokeWidth={1}
          />
          <XAxis 
            dataKey="date" 
            stroke="#9CA3AF"
            tick={{ fontSize: 13, fill: "#9CA3AF" }}
            tickLine={{ stroke: "rgba(167, 139, 250, 0.10)" }}
            axisLine={{ stroke: "rgba(167, 139, 250, 0.10)" }}
            interval={getXAxisInterval()}
          />
          <YAxis 
            stroke="#9CA3AF"
            tick={{ fontSize: 13, fill: "#9CA3AF" }}
            tickLine={{ stroke: "rgba(167, 139, 250, 0.10)" }}
            axisLine={{ stroke: "rgba(167, 139, 250, 0.10)" }}
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          
          {/* Current period line */}
          <Line
            type="monotone"
            dataKey="marginPercent"
            stroke="#8B5CF6"
            strokeWidth={2}
            dot={false}
            name={t(language, "chart.marginPct")}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}