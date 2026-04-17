import { useState, useMemo } from "react";
import {
  Euro,
  ShoppingBag,
  Percent,
  TrendingUp,
  ShoppingCart,
  Package,
  AlertCircle,
  TrendingDown,
  Warehouse,
  RotateCcw,
} from "lucide-react";
import { DateRange } from "./PageHeader";
import { KPICard } from "./KPICard";
import { RevenueChart } from "./RevenueChart";
import { SalesChart } from "./SalesChart";
import { MarginChart } from "./MarginChart";
import { AverageBasketChart } from "./AverageBasketChart";
import { RevenueSharePie } from "./RevenueSharePie";
import { PurchasesVsSalesChart } from "./PurchasesVsSalesChart";
import { PurchasesChart } from "./PurchasesChart";
import { PurchaseStatusChart } from "./PurchaseStatusChart";
import { ReturnsChart } from "./ReturnsChart";
import { StockValueEvolutionChart } from "./StockValueEvolutionChart";
import { StockQuantityChart } from "./StockQuantityChart";
import { TopSalesCard } from "./TopSalesCard";
import { TopCategoriesCard } from "./TopCategoriesCard";
import { TransactionsList } from "./TransactionsList";
import { ReturnsTable } from "./ReturnsTable";
import { SectionHeader } from "./SectionHeader";
import {
  DateRangePicker,
  DateRangePreset,
  DateRangeMode,
} from "./DateRangePicker";
import {
  AccountFilter,
  ACCOUNTS as FILTER_ACCOUNTS,
} from "./AccountFilter";
import { RefreshButton } from "./RefreshButton";
import {
  generateMockData,
  calculateKPIs,
  getPreviousPeriodData,
  calculateDelta,
  ACCOUNTS,
} from "../lib/mockData";
import { mockOrders } from "../lib/ordersData";
import { MOCK_PRODUCTS } from "../lib/stockData";
import {
  Language,
  t,
  formatCurrency as formatCurrencyI18n,
  formatNumber,
} from "../lib/i18n";
import { toast } from "sonner@2.0.3";

interface DashboardPageProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  selectedAccounts: string[];
  onAccountsChange: (accounts: string[]) => void;
  language: Language;
}

export function DashboardPage({
  dateRange,
  onDateRangeChange,
  selectedAccounts,
  onAccountsChange,
  language,
}: DashboardPageProps) {
  const [accountFilterMode, setAccountFilterMode] = useState<
    "all" | "selected"
  >("all");
  const [topSortBy, setTopSortBy] = useState<
    "margin" | "revenue" | "volume"
  >("margin");
  const [transactionFilter, setTransactionFilter] = useState<
    "sales" | "purchases" | "returns"
  >("sales");

  // Date range picker state
  const [dateRangePreset, setDateRangePreset] =
    useState<DateRangePreset>(
      dateRange === "today"
        ? "today"
        : dateRange === "yesterday"
          ? "yesterday"
          : dateRange === "7days"
            ? "last7d"
            : dateRange === "30days"
              ? "last30d"
              : dateRange === "90days"
                ? "last90d"
                : "today",
    );
  const [dateRangeMode, setDateRangeMode] =
    useState<DateRangeMode>("rolling");
  const [customFrom, setCustomFrom] = useState<Date>();
  const [customTo, setCustomTo] = useState<Date>();

  // Determine if we're in a preset range (show deltas) or custom range (hide deltas)
  const isPresetRange = dateRangePreset !== "custom";

  // Map date range picker preset to DateRange
  const handleDateRangePresetChange = (
    preset: DateRangePreset,
  ) => {
    setDateRangePreset(preset);

    const mapping: Record<string, DateRange> = {
      today: "today",
      yesterday: "yesterday",
      last7d: "7days",
      last30d: "30days",
      last60d: "90days",
      last90d: "90days",
      last2mo: "90days",
      last3mo: "90days",
      last6mo: "ytd",
      last12mo: "ytd",
      last365d: "ytd",
      ytd: "ytd",
      custom: "30days",
    };

    const newRange = mapping[preset] || "today";
    onDateRangeChange(newRange);
  };

  // When mode is "all", use all accounts, otherwise use selected
  const effectiveAccounts =
    accountFilterMode === "all"
      ? FILTER_ACCOUNTS.map((a) => a.name)
      : selectedAccounts.length > 0
        ? selectedAccounts
        : FILTER_ACCOUNTS.map((a) => a.name);

  const data = generateMockData(
    effectiveAccounts,
    dateRange,
    customFrom,
    customTo,
  );
  const kpis = calculateKPIs(data);

  // Calculate previous period for deltas
  const previousData = getPreviousPeriodData(
    effectiveAccounts,
    dateRange,
    customFrom,
    customTo,
  );
  const previousKpis = calculateKPIs(previousData);

  // Calculate deltas
  const revenueDelta = calculateDelta(
    kpis.revenue,
    previousKpis.revenue,
  );
  const salesDelta = calculateDelta(
    kpis.sales,
    previousKpis.sales,
  );
  const marginDelta = calculateDelta(
    kpis.marginPercent,
    previousKpis.marginPercent,
  );
  const netMarginDelta = calculateDelta(
    kpis.netMargin,
    previousKpis.netMargin,
  );
  const avgBasket =
    kpis.sales > 0 ? kpis.revenue / kpis.sales : 0;
  const prevAvgBasket =
    previousKpis.sales > 0
      ? previousKpis.revenue / previousKpis.sales
      : 0;
  const avgBasketDelta = calculateDelta(
    avgBasket,
    prevAvgBasket,
  );

  const formatCurrency = (value: number) => {
    return formatCurrencyI18n(value, language)
      .replace(/\s/g, "\u00A0")
      .replace(",00", "");
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  // Get comparison label based on preset
  const getComparisonLabel = () => {
    switch (dateRangePreset) {
      case "today":
        return t(language, "delta.vsYesterday");
      case "yesterday":
        return language === "fr"
          ? "vs avant-hier"
          : "vs day before";
      case "last7d":
        return t(language, "delta.vs7d");
      case "last30d":
        return t(language, "delta.vs30d");
      case "last60d":
        return language === "fr"
          ? "vs 60j précédents"
          : "vs prev 60d";
      case "last90d":
        return t(language, "delta.vs90d");
      case "last2mo":
        return language === "fr"
          ? "vs 2 mois précédents"
          : "vs prev 2 months";
      case "last3mo":
        return language === "fr"
          ? "vs 3 mois précédents"
          : "vs prev 3 months";
      case "last6mo":
        return language === "fr"
          ? "vs 6 mois précédents"
          : "vs prev 6 months";
      case "last12mo":
        return language === "fr"
          ? "vs 12 mois précédents"
          : "vs prev 12 months";
      case "last365d":
        return language === "fr"
          ? "vs 365j précédents"
          : "vs prev 365d";
      case "ytd":
        return t(language, "delta.vsLastYear");
      default:
        return "";
    }
  };

  const comparisonLabel = getComparisonLabel();

  // Determine time aggregation granularity based on date range
  const getDayCount = () => {
    if (customFrom && customTo) {
      return (
        Math.ceil(
          (customTo.getTime() - customFrom.getTime()) /
            (1000 * 60 * 60 * 24),
        ) + 1
      );
    }

    switch (dateRangePreset) {
      case "today":
      case "yesterday":
        return 1;
      case "last7d":
        return 7;
      case "last30d":
        return 30;
      case "last60d":
        return 60;
      case "last90d":
        return 90;
      case "last2mo":
        return 60;
      case "last3mo":
        return 90;
      case "last6mo":
        return 180;
      case "last12mo":
        return 365;
      case "last365d":
        return 365;
      case "ytd":
        const now = new Date();
        const yearStart = new Date(now.getFullYear(), 0, 1);
        return (
          Math.ceil(
            (now.getTime() - yearStart.getTime()) /
              (1000 * 60 * 60 * 24),
          ) + 1
        );
      default:
        return 30;
    }
  };

  const dayCount = getDayCount();

  // Determine aggregation: daily (≤31 days), weekly (32-89 days), monthly (≥90 days)
  const aggregation: "hourly" | "daily" | "weekly" | "monthly" =
    dateRangePreset === "today" ||
    dateRangePreset === "yesterday"
      ? "hourly"
      : dayCount <= 31
        ? "daily"
        : dayCount <= 89
          ? "weekly"
          : "monthly";

  // Get account count for subtitle
  const accountCount =
    accountFilterMode === "all"
      ? FILTER_ACCOUNTS.length
      : selectedAccounts.length;

  // Calculate revenue share by account
  const revenueShareData = effectiveAccounts
    .map((accountName) => {
      const account = ACCOUNTS[accountName];
      const accountData = generateMockData(
        [accountName],
        dateRange,
        customFrom,
        customTo,
      );
      const accountKpis = calculateKPIs(accountData);

      return {
        account: accountName,
        revenue: accountKpis.revenue,
        percentage:
          kpis.revenue > 0
            ? (accountKpis.revenue / kpis.revenue) * 100
            : 0,
        color: account.color,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  // Prepare chart data with marginPercent and avgBasket
  const chartData = data.map((d) => ({
    ...d,
    marginPercent:
      d.revenue > 0 ? (d.netMargin / d.revenue) * 100 : 0,
    avgBasket: d.sales > 0 ? d.revenue / d.sales : 0,
  }));

  const previousChartData = previousData.map((d) => ({
    ...d,
    marginPercent:
      d.revenue > 0 ? (d.netMargin / d.revenue) * 100 : 0,
    avgBasket: d.sales > 0 ? d.revenue / d.sales : 0,
  }));

  // ========================================
  // ANALYTICS METRICS
  // ========================================

  // Calculate purchase metrics from mockOrders
  const purchaseMetrics = useMemo(() => {
    const purchases = mockOrders.filter(
      (o) => o.type === "purchase",
    );

    const totalPurchased = purchases.reduce(
      (sum, p) => sum + (p.quantity || 1),
      0,
    );
    const totalSpent = purchases.reduce(
      (sum, p) => sum + p.price,
      0,
    );
    const purchased = purchases.filter(
      (p) =>
        p.status === "waiting_label" ||
        p.status === "label_sent",
    ).length;
    const shipped = purchases.filter(
      (p) =>
        p.status === "shipped" || p.status === "in_transit",
    ).length;
    const delivered = purchases.filter(
      (p) => p.status === "delivered",
    ).length;

    return {
      totalPurchased,
      totalSpent,
      purchased,
      shipped,
      delivered,
    };
  }, []);

  // Calculate returns metrics
  const returnsMetrics = useMemo(() => {
    const returns = mockOrders.filter(
      (o) => o.status === "return_initiated",
    );
    const sales = mockOrders.filter((o) => o.type === "sale");

    const returnsCount = returns.length;
    const returnsValue = returns.reduce(
      (sum, o) => sum + o.price,
      0,
    );
    const returnRate =
      sales.length > 0
        ? (returnsCount / sales.length) * 100
        : 0;

    return {
      count: returnsCount,
      value: returnsValue,
      rate: returnRate,
      transactions: returns.map((r) => ({
        id: r.id,
        title: r.title,
        amount: r.price,
        date: r.createdAt,
        accountName: r.accountName,
        status: r.status,
      })),
    };
  }, []);

  // Calculate stock metrics from MOCK_PRODUCTS
  const stockMetrics = useMemo(() => {
    const totalQuantity = MOCK_PRODUCTS.reduce(
      (sum, p) => sum + (p.quantity || 1),
      0,
    );
    const costValue = MOCK_PRODUCTS.reduce(
      (sum, p) =>
        sum + (p.purchaseCost || 0) * (p.quantity || 1),
      0,
    );
    const saleValue = MOCK_PRODUCTS.reduce(
      (sum, p) => sum + p.price * (p.quantity || 1),
      0,
    );
    const potentialMargin = saleValue - costValue;
    const potentialMarginPercent =
      saleValue > 0 ? (potentialMargin / saleValue) * 100 : 0;

    return {
      totalQuantity,
      costValue,
      saleValue,
      potentialMargin,
      potentialMarginPercent,
    };
  }, []);

  // Generate purchases data for chart
  const purchasesChartData = useMemo(() => {
    return chartData.map((d) => ({
      date: d.date,
      amount: d.revenue * 0.4 + Math.random() * 50 - 25,
    }));
  }, [chartData]);

  // Generate purchases vs sales data for chart
  const purchasesVsSalesData = useMemo(() => {
    return chartData.map((d) => ({
      date: d.date,
      sales: d.revenue,
      purchases: d.revenue * 0.4 + Math.random() * 50 - 25,
    }));
  }, [chartData]);

  // Generate stock evolution data for charts
  const stockValueData = useMemo(() => {
    return chartData.map((d) => ({
      date: d.date,
      costValue:
        stockMetrics.costValue * (0.85 + Math.random() * 0.3),
      saleValue:
        stockMetrics.saleValue * (0.85 + Math.random() * 0.3),
    }));
  }, [chartData, stockMetrics]);

  const stockQuantityData = useMemo(() => {
    return chartData.map((d) => ({
      date: d.date,
      quantity: Math.round(
        stockMetrics.totalQuantity *
          (0.85 + Math.random() * 0.3),
      ),
    }));
  }, [chartData, stockMetrics]);

  // Top sales data
  const topSales = useMemo(() => {
    const sales = mockOrders
      .filter(
        (o) => o.type === "sale" && o.status === "delivered",
      )
      .map((s) => ({
        id: s.id,
        title: s.title,
        thumbnail: s.thumbnail,
        accountName: s.accountName,
        price: s.price,
        margin: s.price - (s.purchaseCost || 0),
        marginPercent:
          s.price > 0
            ? ((s.price - (s.purchaseCost || 0)) / s.price) *
              100
            : 0,
      }));

    if (topSortBy === "margin") {
      return sales.sort((a, b) => b.margin - a.margin);
    } else if (topSortBy === "revenue") {
      return sales.sort((a, b) => b.price - a.price);
    } else {
      return sales;
    }
  }, [topSortBy]);

  // Top categories data
  const topCategories = useMemo(() => {
    const categories: Record<
      string,
      { count: number; revenue: number }
    > = {};

    mockOrders
      .filter(
        (o) => o.type === "sale" && o.status === "delivered",
      )
      .forEach((sale) => {
        const cat = sale.category || "Uncategorized";
        if (!categories[cat]) {
          categories[cat] = { count: 0, revenue: 0 };
        }
        categories[cat].count++;
        categories[cat].revenue += sale.price;
      });

    const totalRevenue = Object.values(categories).reduce(
      (sum, c) => sum + c.revenue,
      0,
    );

    return Object.entries(categories)
      .map(([name, data]) => ({
        name,
        count: data.count,
        revenue: data.revenue,
        percent:
          totalRevenue > 0
            ? (data.revenue / totalRevenue) * 100
            : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, []);

  // All transactions data
  const allTransactions = useMemo(() => {
    return mockOrders.map((order) => ({
      id: order.id,
      title: order.title,
      thumbnail: order.thumbnail,
      type: order.type,
      status: order.status,
      price: order.price,
      purchaseCost: order.purchaseCost,
      accountName: order.accountName,
      createdAt: order.createdAt,
      sku: order.sku,
    }));
  }, []);

  return (
    <>
      {/* Modern Header */}
      <div className="mb-8">
        <div className="border-b border-border bg-background pb-6 mb-6">
          <h1 className="text-foreground mb-2">
            {t(language, "nav.dashboard")}
          </h1>
          <p className="text-sm dark:text-muted-foreground text-muted-foreground">
            {dateRange === "today"
              ? language === "fr"
                ? "Analytique horaire sur 24h de minuit à minuit"
                : "24-hour hourly analytics from midnight to midnight"
              : dateRange === "yesterday"
                ? language === "fr"
                  ? "Analytique du jour précédent avec détails horaires"
                  : "Previous day analytics with hourly breakdown"
                : language === "fr"
                  ? "Vue multi-comptes : chiffre d'affaires, ventes, marge"
                  : "Multi-account overview: revenue, sales, margin"}
          </p>
        </div>

        {/* Modern Filter Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <AccountFilter
              selectedAccounts={selectedAccounts
                .map((name) => {
                  const account = FILTER_ACCOUNTS.find(
                    (a) => a.name === name,
                  );
                  return account?.id || "";
                })
                .filter(Boolean)}
              onAccountsChange={(accountIds) => {
                const accountNames = accountIds
                  .map((id) => {
                    const account = FILTER_ACCOUNTS.find(
                      (a) => a.id === id,
                    );
                    return account?.name || "";
                  })
                  .filter(Boolean);
                onAccountsChange(accountNames);
              }}
              mode={accountFilterMode}
              onModeChange={setAccountFilterMode}
              language={language}
            />

            <RefreshButton
              onRefresh={async () => {
                await new Promise((resolve) =>
                  setTimeout(resolve, 800),
                );
                toast.success(
                  language === "fr"
                    ? "Données actualisées"
                    : "Data refreshed",
                );
              }}
              language={language}
            />
          </div>

          <div className="ml-auto">
            <DateRangePicker
              value={dateRangePreset}
              onChange={handleDateRangePresetChange}
              mode={dateRangeMode}
              onModeChange={setDateRangeMode}
              customFrom={customFrom}
              customTo={customTo}
              onCustomRangeChange={(from, to) => {
                setCustomFrom(from);
                setCustomTo(to);
              }}
              language={language}
            />
          </div>
        </div>
      </div>

      <div className="space-y-12">
        {effectiveAccounts.length === 0 ? (
          <div
            className="rounded-2xl border dark:border-[rgba(168,85,247,0.25)] border-border dark:bg-[#0E0E14] bg-card p-12 text-center"
            style={{
              boxShadow:
                "0 0 0 1px rgba(168,85,247,0.25), 0 0 28px rgba(168,85,247,0.10)",
            }}
          >
            <p
              className="dark:text-[#9CA3AF] text-muted-foreground"
              style={{ fontSize: "14px" }}
            >
              {language === "fr"
                ? "Aucun compte sélectionné. Veuillez sélectionner au moins un compte pour afficher les données."
                : "No accounts selected. Please select at least one account to view data."}
            </p>
          </div>
        ) : (
          <>
            {/* ===================================== */}
            {/* SECTION 1: VENTE                      */}
            {/* ===================================== */}
            <div>
              <SectionHeader
                title={language === "fr" ? "Vente" : "Sales"}
                subtitle={
                  language === "fr"
                    ? "Vue d'ensemble du chiffre d'affaires et des ventes"
                    : "Overview of revenue and sales"
                }
              />

              {/* KPI Cards - VENTE */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
                <KPICard
                  label={t(language, "kpi.revenue")}
                  value={formatCurrency(kpis.revenue)}
                  subtitle={
                    accountCount > 1
                      ? `${accountCount} ${t(language, "common.accounts")}`
                      : undefined
                  }
                  icon={Euro}
                  delta={
                    isPresetRange
                      ? {
                          value: revenueDelta,
                          comparison: comparisonLabel || "",
                          prevValue: formatCurrency(
                            previousKpis.revenue,
                          ),
                        }
                      : undefined
                  }
                  language={language}
                />
                <KPICard
                  label={t(language, "kpi.sales")}
                  value={formatNumber(kpis.sales, language)}
                  subtitle={
                    accountCount > 1
                      ? `${accountCount} ${t(language, "common.accounts")}`
                      : undefined
                  }
                  icon={ShoppingBag}
                  delta={
                    isPresetRange
                      ? {
                          value: salesDelta,
                          comparison: comparisonLabel || "",
                          prevValue: formatNumber(
                            previousKpis.sales,
                            language,
                          ),
                        }
                      : undefined
                  }
                  language={language}
                />
                <KPICard
                  label={t(language, "kpi.marginPct")}
                  value={formatPercent(kpis.marginPercent)}
                  subtitle={
                    accountCount > 1
                      ? `${accountCount} ${t(language, "common.accounts")}`
                      : undefined
                  }
                  icon={Percent}
                  delta={
                    isPresetRange
                      ? {
                          value: marginDelta,
                          comparison: comparisonLabel || "",
                          prevValue: formatPercent(
                            previousKpis.marginPercent,
                          ),
                        }
                      : undefined
                  }
                  language={language}
                />
                <KPICard
                  label={t(language, "kpi.netMargin")}
                  value={formatCurrency(kpis.netMargin)}
                  subtitle={
                    accountCount > 1
                      ? `${accountCount} ${t(language, "common.accounts")}`
                      : undefined
                  }
                  icon={TrendingUp}
                  delta={
                    isPresetRange
                      ? {
                          value: netMarginDelta,
                          comparison: comparisonLabel || "",
                          prevValue: formatCurrency(
                            previousKpis.netMargin,
                          ),
                        }
                      : undefined
                  }
                  language={language}
                />
                <KPICard
                  label={t(language, "kpi.avgBasket")}
                  value={formatCurrency(avgBasket)}
                  subtitle={
                    accountCount > 1
                      ? `${accountCount} ${t(language, "common.accounts")}`
                      : undefined
                  }
                  icon={ShoppingCart}
                  delta={
                    isPresetRange
                      ? {
                          value: avgBasketDelta,
                          comparison: comparisonLabel || "",
                          prevValue:
                            formatCurrency(prevAvgBasket),
                        }
                      : undefined
                  }
                  language={language}
                />
              </div>

              {/* Charts - VENTE (4 graphiques existants) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <RevenueChart
                  data={chartData}
                  delta={
                    isPresetRange
                      ? {
                          revenue: revenueDelta,
                          netMargin: netMarginDelta,
                        }
                      : undefined
                  }
                  language={language}
                  customFrom={customFrom}
                  customTo={customTo}
                  aggregation={aggregation}
                  preset={dateRangePreset}
                />
                <SalesChart
                  data={chartData}
                  delta={isPresetRange ? salesDelta : undefined}
                  language={language}
                  customFrom={customFrom}
                  customTo={customTo}
                  aggregation={aggregation}
                  preset={dateRangePreset}
                />
                <MarginChart
                  data={chartData}
                  delta={
                    isPresetRange ? marginDelta : undefined
                  }
                  language={language}
                  customFrom={customFrom}
                  customTo={customTo}
                  aggregation={aggregation}
                  preset={dateRangePreset}
                />
                <AverageBasketChart
                  data={chartData}
                  delta={
                    isPresetRange ? avgBasketDelta : undefined
                  }
                  language={language}
                  customFrom={customFrom}
                  customTo={customTo}
                  aggregation={aggregation}
                  preset={dateRangePreset}
                />
              </div>

              {/* Top Performance */}
              <div>
                <h3 className="text-sm font-semibold dark:text-primary text-primary uppercase tracking-wide mb-4">
                  {language === "fr"
                    ? "Top performance"
                    : "Top performance"}
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <TopSalesCard
                    topSales={topSales}
                    sortBy={topSortBy}
                    onSortChange={setTopSortBy}
                    language={language}
                  />
                  <TopCategoriesCard
                    topCategories={topCategories}
                    language={language}
                  />
                  {effectiveAccounts.length > 1 && (
                    <RevenueSharePie
                      data={revenueShareData}
                      language={language}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* ===================================== */}
            {/* SECTION 2: ACHATS                     */}
            {/* ===================================== */}
            <div>
              <SectionHeader
                title={
                  language === "fr" ? "Achats" : "Purchases"
                }
                subtitle={
                  language === "fr"
                    ? "Montants et statuts des achats sur la période"
                    : "Purchase amounts and statuses over the period"
                }
              />

              {/* KPI Cards - ACHATS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <KPICard
                  label={
                    language === "fr"
                      ? "Nombre d'achats"
                      : "Number of purchases"
                  }
                  value={formatNumber(
                    purchaseMetrics.totalPurchased,
                    language,
                  )}
                  subtitle={
                    language === "fr"
                      ? "Articles achetés"
                      : "Items purchased"
                  }
                  icon={ShoppingBag}
                  language={language}
                />
                <KPICard
                  label={
                    language === "fr"
                      ? "Montant acheté"
                      : "Purchase amount"
                  }
                  value={formatCurrency(
                    purchaseMetrics.totalSpent,
                  )}
                  subtitle={
                    language === "fr"
                      ? "Total dépensé"
                      : "Total spent"
                  }
                  icon={Euro}
                  language={language}
                />
                <KPICard
                  label={
                    language === "fr"
                      ? "Valeur à la revente"
                      : "Resale value"
                  }
                  value={formatCurrency(
                    purchaseMetrics.totalSpent * 2.5,
                  )}
                  subtitle={
                    language === "fr"
                      ? "Prix de vente estimé"
                      : "Estimated selling price"
                  }
                  icon={TrendingUp}
                  language={language}
                />
              </div>

              {/* Charts - ACHATS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PurchasesChart
                  data={purchasesChartData}
                  language={language}
                  customFrom={customFrom}
                  customTo={customTo}
                  aggregation={aggregation}
                  preset={dateRangePreset}
                />
                <PurchaseStatusChart
                  purchasedCount={purchaseMetrics.purchased}
                  shippedCount={purchaseMetrics.shipped}
                  deliveredCount={purchaseMetrics.delivered}
                  language={language}
                />
              </div>
            </div>

            {/* ===================================== */}
            {/* SECTION 3: RETOURS                    */}
            {/* ===================================== */}
            <div>
              <SectionHeader
                title={
                  language === "fr" ? "Retours" : "Returns"
                }
                subtitle={
                  language === "fr"
                    ? "Valeur des retours et impact sur le CA"
                    : "Returns value and revenue impact"
                }
              />

              {/* KPI Cards - RETOURS */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                <KPICard
                  label={
                    language === "fr"
                      ? "Retours effectués"
                      : "Returns made"
                  }
                  value={formatNumber(
                    returnsMetrics.count,
                    language,
                  )}
                  subtitle={
                    language === "fr"
                      ? "Nombre de retours"
                      : "Number of returns"
                  }
                  icon={RotateCcw}
                  language={language}
                />
                <KPICard
                  label={
                    language === "fr"
                      ? "Valeur des retours"
                      : "Returns value"
                  }
                  value={formatCurrency(returnsMetrics.value)}
                  subtitle={
                    language === "fr"
                      ? "Montant total"
                      : "Total amount"
                  }
                  icon={Euro}
                  language={language}
                />
                <KPICard
                  label={
                    language === "fr"
                      ? "Taux de retour"
                      : "Return rate"
                  }
                  value={formatPercent(returnsMetrics.rate)}
                  subtitle={
                    language === "fr"
                      ? "Retours / Ventes"
                      : "Returns / Sales"
                  }
                  icon={AlertCircle}
                  language={language}
                />
              </div>

              {/* Charts & Table - RETOURS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ReturnsChart
                  data={purchasesChartData.map((d) => ({
                    date: d.date,
                    amount: d.amount * 0.1,
                  }))}
                  language={language}
                  customFrom={customFrom}
                  customTo={customTo}
                  aggregation={aggregation}
                  preset={dateRangePreset}
                />
                <ReturnsTable
                  returns={returnsMetrics.transactions}
                  language={language}
                />
              </div>
            </div>

            {/* ===================================== */}
            {/* SECTION 4: STOCK                      */}
            {/* ===================================== */}
            <div>
              <SectionHeader
                title={language === "fr" ? "Stock" : "Stock"}
                subtitle={
                  language === "fr"
                    ? "Évolution valeur stock et évolution quantité"
                    : "Stock value and quantity evolution"
                }
              />

              {/* KPI Cards - STOCK */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <KPICard
                  label={
                    language === "fr"
                      ? "Articles en stock"
                      : "Items in stock"
                  }
                  value={formatNumber(
                    stockMetrics.totalQuantity,
                    language,
                  )}
                  subtitle={
                    language === "fr"
                      ? "Quantité totale"
                      : "Total quantity"
                  }
                  icon={Package}
                  language={language}
                />
                <KPICard
                  label={
                    language === "fr"
                      ? "Valeur stock (achat)"
                      : "Stock value (cost)"
                  }
                  value={formatCurrency(stockMetrics.costValue)}
                  subtitle={
                    language === "fr"
                      ? "Coût d'achat total"
                      : "Total purchase cost"
                  }
                  icon={Euro}
                  language={language}
                />
                <KPICard
                  label={
                    language === "fr"
                      ? "Valeur stock (vente)"
                      : "Stock value (sale)"
                  }
                  value={formatCurrency(stockMetrics.saleValue)}
                  subtitle={
                    language === "fr"
                      ? "Valeur de revente"
                      : "Resale value"
                  }
                  icon={TrendingUp}
                  language={language}
                />
                <KPICard
                  label={
                    language === "fr"
                      ? "Marge potentielle"
                      : "Potential margin"
                  }
                  value={formatCurrency(
                    stockMetrics.potentialMargin,
                  )}
                  subtitle={`${formatPercent(stockMetrics.potentialMarginPercent)}`}
                  icon={Percent}
                  language={language}
                />
              </div>

              {/* Charts - STOCK */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <StockValueEvolutionChart
                  data={stockValueData}
                  language={language}
                  customFrom={customFrom}
                  customTo={customTo}
                  aggregation={aggregation}
                  preset={dateRangePreset}
                />
                <StockQuantityChart
                  data={stockQuantityData}
                  language={language}
                  customFrom={customFrom}
                  customTo={customTo}
                  aggregation={aggregation}
                  preset={dateRangePreset}
                />
              </div>
            </div>

            {/* ===================================== */}
            {/* SECTION 5: TRANSACTIONS (GLOBAL)      */}
            {/* ===================================== */}
            <div>
              <h3 className="text-sm font-semibold dark:text-primary text-primary uppercase tracking-wide mb-4">
                {language === "fr"
                  ? "Transactions"
                  : "Transactions"}
              </h3>
              <TransactionsList
                transactions={allTransactions}
                language={language}
                filterTab={transactionFilter}
                onFilterChange={setTransactionFilter}
                showTabs={true}
              />
            </div>
          </>
        )}
      </div>
    </>
  );
}