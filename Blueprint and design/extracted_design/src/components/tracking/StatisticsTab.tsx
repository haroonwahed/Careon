import {
  TrendingUp,
  Package,
  Clock,
  BarChart3,
  ShoppingBag,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Language, formatCurrency } from "../../lib/i18n";

interface StatisticsTabProps {
  language: Language;
  isLoading?: boolean;
}

// Mock data - remplacer par vraies données
const mockDistributionData = [
  { price: "0-10", count: 12 },
  { price: "10-20", count: 28 },
  { price: "20-30", count: 45 },
  { price: "30-40", count: 38 },
  { price: "40-50", count: 24 },
  { price: "50-60", count: 15 },
  { price: "60-70", count: 8 },
  { price: "70+", count: 5 },
];

export function StatisticsTab({ language, isLoading }: StatisticsTabProps) {
  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 rounded-xl dark:bg-[#1A1A24] bg-muted animate-pulse"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-24 rounded-xl dark:bg-[#1A1A24] bg-muted animate-pulse"
            />
          ))}
        </div>
        <div className="h-96 rounded-xl dark:bg-[#1A1A24] bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* KPI Row 1 - 3 cartes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          icon={TrendingUp}
          label={language === "fr" ? "Prix moyen de vente" : "Average sale price"}
          value="32,50 €"
          subtitle={language === "fr" ? "Sur 175 ventes" : "Over 175 sales"}
          iconColor="text-primary"
          language={language}
        />
        <KPICard
          icon={Package}
          label={
            language === "fr"
              ? "Produits ajoutés qui sont vendus"
              : "Added products that sold"
          }
          value="68%"
          subtitle="175 / 258"
          iconColor="text-green-500"
          language={language}
        />
        <KPICard
          icon={Clock}
          label={language === "fr" ? "Temps moyen de vente" : "Average sale time"}
          value="12 jours"
          subtitle={language === "fr" ? "Médiane 8 jours" : "Median 8 days"}
          iconColor="text-blue-500"
          language={language}
        />
      </div>

      {/* KPI Row 2 - 2 cartes plus larges */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <KPICard
          icon={BarChart3}
          label={
            language === "fr"
              ? "Nombre d'analyses / Produits"
              : "Number of analyses / Products"
          }
          value="258"
          subtitle={
            language === "fr" ? "Produits dans l'analyse" : "Products in analysis"
          }
          iconColor="text-purple-500"
          language={language}
        />
        <KPICard
          icon={ShoppingBag}
          label={language === "fr" ? "Nombre de ventes / Jour" : "Sales per day"}
          value="175 / 14,6"
          subtitle={
            language === "fr"
              ? "175 ventes, 14,6 par jour"
              : "175 sales, 14.6 per day"
          }
          iconColor="text-orange-500"
          language={language}
        />
      </div>

      {/* Distribution Chart */}
      <div
        className="rounded-2xl border dark:border-[rgba(168,85,247,0.25)] border-border dark:bg-[#0E0E14] bg-card p-6"
        style={{
          boxShadow:
            "0 0 0 1px rgba(168,85,247,0.25), 0 0 28px rgba(168,85,247,0.10)",
        }}
      >
        <div className="mb-6">
          <h3 className="text-lg dark:text-[#E7E7F0] text-foreground mb-2">
            {language === "fr"
              ? "Répartition des ventes"
              : "Sales distribution"}
          </h3>
          <p className="text-sm dark:text-[#9CA3AF] text-muted-foreground leading-relaxed">
            {language === "fr" ? (
              <>
                1 produit sur 4 est vendu à moins de{" "}
                <span className="dark:text-primary text-primary font-medium">
                  20€
                </span>
                , tandis que les{" "}
                <span className="dark:text-primary text-primary font-medium">
                  achats
                </span>{" "}
                moyens tournent autour de{" "}
                <span className="dark:text-primary text-primary font-medium">
                  15€
                </span>
                , permettant une{" "}
                <span className="dark:text-primary text-primary font-medium">
                  revente
                </span>{" "}
                intéressante.
              </>
            ) : (
              <>
                1 in 4 products sells for less than{" "}
                <span className="dark:text-primary text-primary font-medium">
                  €20
                </span>
                , while average{" "}
                <span className="dark:text-primary text-primary font-medium">
                  purchases
                </span>{" "}
                are around{" "}
                <span className="dark:text-primary text-primary font-medium">
                  €15
                </span>
                , enabling interesting{" "}
                <span className="dark:text-primary text-primary font-medium">
                  resale
                </span>{" "}
                margins.
              </>
            )}
          </p>
        </div>

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%" minHeight={320}>
            <AreaChart
              data={mockDistributionData}
              margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
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
                dataKey="price"
                className="dark:text-[#9CA3AF] text-muted-foreground"
                style={{ fontSize: "12px" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                className="dark:text-[#9CA3AF] text-muted-foreground"
                style={{ fontSize: "12px" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip language={language} />} />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#8B5CF6"
                strokeWidth={2}
                fill="url(#colorCount)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

interface KPICardProps {
  icon: any;
  label: string;
  value: string;
  subtitle: string;
  iconColor: string;
  language: Language;
}

function KPICard({
  icon: Icon,
  label,
  value,
  subtitle,
  iconColor,
}: KPICardProps) {
  return (
    <div
      className="rounded-xl border dark:border-[rgba(168,85,247,0.20)] border-border dark:bg-[#0E0E14] bg-card p-5"
      style={{
        boxShadow: "0 0 0 1px rgba(168,85,247,0.15)",
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className={`p-2.5 rounded-lg dark:bg-[#1A1A24] bg-muted ${iconColor}`}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="text-2xl dark:text-[#E7E7F0] text-foreground font-semibold mb-1 tabular-nums">
        {value}
      </div>
      <div className="text-sm dark:text-[#E7E7F0] text-foreground mb-1">
        {label}
      </div>
      <div className="text-xs dark:text-[#9CA3AF] text-muted-foreground">
        {subtitle}
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, language }: any) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div
      className="rounded-xl dark:bg-[#0E0E14] bg-card border dark:border-[rgba(168,85,247,0.25)] border-border p-3 shadow-lg"
      style={{
        boxShadow:
          "0 0 0 1px rgba(168,85,247,0.25), 0 0 24px rgba(168,85,247,0.15)",
      }}
    >
      <p className="text-xs dark:text-[#9CA3AF] text-muted-foreground mb-1">
        {payload[0].payload.price}€
      </p>
      <p className="text-sm dark:text-[#E7E7F0] text-foreground tabular-nums">
        {payload[0].value}{" "}
        {language === "fr" ? "produits" : "products"}
      </p>
    </div>
  );
}