import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Language } from "../lib/i18n";

interface RevenueSharePieProps {
  data: Array<{
    account: string;
    revenue: number;
    percentage: number;
    color: string;
  }>;
  language: Language;
}

export function RevenueSharePie({ data, language }: RevenueSharePieProps) {
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
        <p className="text-sm dark:text-[#E7E7F0] text-foreground mb-1">
          {payload[0].name}
        </p>
        <p className="text-xs dark:text-[#9CA3AF] text-muted-foreground">
          {payload[0].value.toFixed(1)}%
        </p>
      </div>
    );
  };

  return (
    <div
      className="rounded-2xl border dark:border-[rgba(168,85,247,0.25)] border-border dark:bg-[#0E0E14] bg-card p-6"
      style={{
        boxShadow:
          "0 0 0 1px rgba(168,85,247,0.25), 0 0 28px rgba(168,85,247,0.10)",
      }}
    >
      <div className="mb-4">
        <h3 className="text-lg dark:text-[#E7E7F0] text-foreground mb-1">
          {language === "fr" ? "Part du CA" : "Revenue share"}
        </h3>
        <p className="text-sm dark:text-[#9CA3AF] text-muted-foreground">
          {language === "fr" ? "Répartition sur la période" : "Distribution over period"}
        </p>
      </div>

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<CustomTooltip />} />
            <Pie
              data={data}
              dataKey="percentage"
              nameKey="account"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={3}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 space-y-2">
        {data.map((d, i) => (
          <div
            key={d.account}
            className="flex items-center justify-between text-sm"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: d.color }}
              />
              <span className="dark:text-[#E7E7F0] text-foreground">
                {d.account}
              </span>
            </div>
            <span className="dark:text-[#9CA3AF] text-muted-foreground tabular-nums">
              {d.percentage.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}