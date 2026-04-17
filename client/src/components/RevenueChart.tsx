import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card } from "./ui/card";
import { Language, t, formatCurrency, formatNumber, formatDate } from "../lib/i18n";
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

interface RevenueChartProps {
  data: Array<{
    date: string;
    revenue: number;
    netMargin: number;
  }>;
  delta?: {
    revenue: number;
    netMargin: number;
  };
  language: Language;
  customFrom?: Date;
  customTo?: Date;
  aggregation?: "hourly" | "daily" | "weekly" | "monthly";
  preset?: DateRangePreset;
}

// Helper to aggregate data
function aggregateData(
  data: Array<{ date: string; revenue: number; netMargin: number }>,
  type: "hourly" | "daily" | "weekly" | "monthly",
  language: Language
) {
  if (type === "hourly" || type === "daily") {
    return data; // No aggregation needed
  }
  
  const buckets = new Map<string, { revenue: number; netMargin: number; count: number; firstDate: Date }>();
  const now = new Date();
  const currentYear = now.getFullYear();
  
  data.forEach((item) => {
    // Parse the date string (format: "DD/MM" or "HH:00")
    let date: Date;
    if (item.date.includes(':')) {
      // Hourly format - shouldn't happen with weekly/monthly but handle it
      return;
    } else if (item.date.includes('/')) {
      // French date format: "DD/MM"
      const parts = item.date.split('/');
      if (parts.length !== 2) return;
      
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      
      if (isNaN(day) || isNaN(month) || day < 1 || day > 31 || month < 1 || month > 12) {
        return;
      }
      
      date = new Date(currentYear, month - 1, day);
      
      // Validate the date was created correctly
      if (isNaN(date.getTime())) {
        return;
      }
      
      // If the date is in the future, it's probably from last year
      if (date > now) {
        date = new Date(currentYear - 1, month - 1, day);
        if (isNaN(date.getTime())) {
          return;
        }
      }
    } else {
      // Already formatted date string, skip aggregation
      return;
    }
    
    let key: string;
    
    try {
      if (type === "weekly") {
        // Get week start (Monday)
        const dayOfWeek = date.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() + diff);
        key = formatDate(weekStart, language, { day: "numeric", month: "short" });
      } else { // monthly
        key = formatDate(date, language, { month: "short", year: "numeric" });
      }
    } catch (e) {
      // Skip invalid dates
      return;
    }
    
    const existing = buckets.get(key) || { revenue: 0, netMargin: 0, count: 0, firstDate: date };
    buckets.set(key, {
      revenue: existing.revenue + item.revenue,
      netMargin: existing.netMargin + item.netMargin,
      count: existing.count + 1,
      firstDate: existing.firstDate,
    });
  });
  
  // Sort by date
  const sorted = Array.from(buckets.entries()).sort((a, b) => 
    a[1].firstDate.getTime() - b[1].firstDate.getTime()
  );
  
  return sorted.map(([date, values]) => ({
    date,
    revenue: values.revenue,
    netMargin: values.netMargin,
    _id: `${date}-${values.firstDate.getTime()}`, // Unique key
  }));
}

export function RevenueChart({ data, delta, language, customFrom, customTo, aggregation = "daily", preset }: RevenueChartProps) {
  const chartColors = {
    positive: "var(--delta-positive)",
    negative: "var(--delta-negative)",
    neutral: "var(--muted-foreground)",
    revenue: "var(--chart-1)",
    margin: "var(--chart-2)",
    grid: "var(--grid-line)",
    heading: "var(--foreground)",
    muted: "var(--muted-foreground)",
  };
  
  // Check if we're in hourly mode (24 data points for "today")
  const isHourly = aggregation === "hourly";
  
  // Aggregate data based on granularity
  const aggregatedData = aggregateData(data, aggregation, language);
  
  // Add unique keys to data if not already present
  const chartData = aggregatedData.map((item, index) => ({
    ...item,
    _chartKey: `${item.date}-${index}`,
  }));
  
  // Determine x-axis interval based on data length
  const getXAxisInterval = () => {
    if (isHourly) return 3; // Show every 4th hour (00:00, 04:00, 08:00...)
    if (aggregation === "weekly" || aggregation === "monthly") return 0; // Show all ticks for aggregated data
    if (chartData.length <= 7) return 0; // Show all days for week or less
    if (chartData.length <= 31) return Math.floor(chartData.length / 7); // Show ~7 ticks for month
    return "preserveStartEnd";
  };

  // Calculate totals
  const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);
  
  const formatCurr = (value: number) => {
    return formatCurrency(value, language).replace(/,00/g, '').replace(/\.00/g, '');
  };

  const getDeltaDisplay = (value: number) => {
    const isPositive = value > 0;
    const isNeutral = Math.abs(value) < 0.5;
    
    let colorClass = "";
    let DeltaIcon = Minus;
    let color = chartColors.neutral;
    
    if (!isNeutral) {
      if (isPositive) {
        color = chartColors.positive;
        DeltaIcon = TrendingUp;
      } else {
        color = chartColors.negative;
        DeltaIcon = TrendingDown;
      }
    }
    
    const displayValue = isNeutral ? "0%" : `${isPositive ? "+" : ""}${value.toFixed(1)}%`;
    
    return (
      <div className="inline-flex items-center gap-1.5" style={{ color }}>
        <DeltaIcon className="w-3.5 h-3.5" />
        <span className="text-xs" style={{ fontWeight: 500, fontSize: "12px" }}>
          {displayValue}
        </span>
      </div>
    );
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const currentRevenue = payload.find((p: any) => p.dataKey === 'revenue')?.value || 0;
      const currentMargin = payload.find((p: any) => p.dataKey === 'netMargin')?.value || 0;
      
      return (
        <div 
          className="min-w-[200px] rounded-xl border border-border bg-popover p-3 shadow-xl"
        >
          <p className="mb-3 text-muted-foreground" style={{ fontSize: "12px", fontWeight: 600 }}>
            {label}
          </p>
          
          {/* Revenue */}
          <div className="space-y-1 mb-3">
            <p className="text-muted-foreground" style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {t(language, "chart.revenue")}
            </p>
            <p className="text-foreground" style={{ fontSize: "14px", fontWeight: 600, color: chartColors.revenue }}>
              {formatCurr(currentRevenue)}
            </p>
          </div>

          {/* Net Margin */}
          <div className="space-y-1">
            <p className="text-muted-foreground" style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {t(language, "chart.margin")}
            </p>
            <p className="text-foreground" style={{ fontSize: "14px", fontWeight: 600, color: chartColors.margin }}>
              {formatCurr(currentMargin)}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card 
      className="rounded-2xl border border-border bg-card p-6 shadow-sm"
    >
      {/* Header with inline metrics */}
      <div className="flex items-start justify-between mb-6">
        <div className="space-y-3">
          <h3 
            className="text-foreground"
            style={{ fontSize: "18px", fontWeight: 600 }}
          >
            {t(language, "chart.revenue")} & {t(language, "chart.margin")} {isHourly && (
              <span 
                className="ml-2 text-muted-foreground"
                style={{ fontSize: "14px", fontWeight: 400 }}
              >
                (24h)
              </span>
            )}
          </h3>
          
          <div className="space-y-2">
            <div>
              <div 
                className="text-foreground"
                style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "-0.02em", color: chartColors.revenue }}
              >
                {formatCurr(totalRevenue)}
              </div>
              {delta && getDeltaDisplay(delta.revenue)}
            </div>
          </div>
        </div>
      </div>
      
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid 
              strokeDasharray="0" 
              stroke={chartColors.grid}
              strokeWidth={1}
            />
            <XAxis 
              dataKey="date" 
              stroke={chartColors.muted}
              tick={{ fontSize: 13, fill: chartColors.muted }}
              tickLine={{ stroke: chartColors.grid }}
              axisLine={{ stroke: chartColors.grid }}
              interval={getXAxisInterval()}
            />
            <YAxis 
              stroke={chartColors.muted}
              tick={{ fontSize: 13, fill: chartColors.muted }}
              tickLine={{ stroke: chartColors.grid }}
              axisLine={{ stroke: chartColors.grid }}
              tickFormatter={(value) => formatCurr(value)}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Current period lines */}
            <Line
              type="monotone"
              dataKey="revenue"
              stroke={chartColors.revenue}
              strokeWidth={2}
              dot={false}
              name={t(language, "chart.revenue")}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="netMargin"
              stroke={chartColors.margin}
              strokeWidth={2}
              dot={false}
              name={t(language, "chart.margin")}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}