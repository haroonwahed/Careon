import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "./ui/card";
import { Language } from "../lib/i18n";

interface PurchaseStatusChartProps {
  purchasedCount: number;
  shippedCount: number;
  deliveredCount: number;
  language: Language;
}

export function PurchaseStatusChart({
  purchasedCount,
  shippedCount,
  deliveredCount,
  language,
}: PurchaseStatusChartProps) {
  const data = [
    {
      name: language === "fr" ? "Acheté" : "Purchased",
      count: purchasedCount,
      fill: "rgba(139, 92, 246, 0.8)",
    },
    {
      name: language === "fr" ? "Expédié" : "Shipped",
      count: shippedCount,
      fill: "rgba(251, 146, 60, 0.8)",
    },
    {
      name: language === "fr" ? "Livré" : "Delivered",
      count: deliveredCount,
      fill: "rgba(34, 197, 94, 0.8)",
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
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: payload[0].payload.fill }}
          />
          <span className="text-xs dark:text-[#E7E7F0] text-foreground">
            {payload[0].payload.name}:
          </span>
          <span className="text-xs dark:text-[#E7E7F0] text-foreground tabular-nums">
            {payload[0].value} {language === "fr" ? "achats" : "purchases"}
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
          {language === "fr" ? "Statuts des achats" : "Purchase status"}
        </h3>
        <p className="text-xs dark:text-[#9CA3AF] text-muted-foreground mt-1">
          {language === "fr"
            ? "Répartition par statut"
            : "Distribution by status"}
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
            className="dark:text-[#9CA3AF] text-muted-foreground"
            style={{ fontSize: "11px" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "transparent" }} />
          <Bar
            dataKey="count"
            radius={[8, 8, 0, 0]}
            fill="rgba(139, 92, 246, 1)"
          />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}