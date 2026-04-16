import { useState, useMemo } from "react";
import { Search, TrendingUp, TrendingDown, Package, ShoppingBag, RotateCcw, Boxes, DollarSign, Percent, Send, CheckCircle2, XCircle, ShoppingCart } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { AccountFilter, ACCOUNTS } from "./AccountFilter";
import { RefreshButton } from "./RefreshButton";
import { Language, formatCurrency } from "../lib/i18n";
import { toast } from "sonner@2.0.3";
import { mockOrders } from "../lib/ordersData";
import { MOCK_PRODUCTS } from "../lib/stockData";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ImageWithFallback } from "./figma/ImageWithFallback";

interface AnalyticsPageProps {
  language: Language;
}

type TimeFrame = "24h" | "7d" | "30d" | "current_month" | "previous_month" | "custom";
type Segmentation = "global" | "category" | "brand" | "account" | "status";
type DetailTab = "orders" | "purchases" | "returns";

export function AnalyticsPage({ language }: AnalyticsPageProps) {
  const [accountFilterMode, setAccountFilterMode] = useState<"all" | "selected">("all");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(
    ACCOUNTS.map(a => a.id)
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [timeFrame, setTimeFrame] = useState<TimeFrame>("30d");
  const [segmentation, setSegmentation] = useState<Segmentation>("global");
  const [includeReturns, setIncludeReturns] = useState(true);
  const [showMarginLine, setShowMarginLine] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>("orders");
  const [topSortBy, setTopSortBy] = useState<"margin" | "revenue" | "volume">("margin");

  // Filter orders and purchases
  const sales = useMemo(() => {
    return mockOrders.filter(order => {
      if (order.type !== "sale") return false;
      if (accountFilterMode === "selected" && !selectedAccounts.includes(order.accountId)) return false;
      return true;
    });
  }, [accountFilterMode, selectedAccounts]);

  const purchases = useMemo(() => {
    return mockOrders.filter(order => {
      if (order.type !== "purchase") return false;
      if (accountFilterMode === "selected" && !selectedAccounts.includes(order.accountId)) return false;
      return true;
    });
  }, [accountFilterMode, selectedAccounts]);

  // KPI Calculations - Sales Block
  const itemsSold = sales.filter(s => s.status === "delivered").length;
  const totalRevenue = sales
    .filter(s => s.status === "delivered")
    .reduce((sum, s) => sum + s.price, 0);
  const totalCost = sales
    .filter(s => s.status === "delivered")
    .reduce((sum, s) => sum + (s.purchaseCost || 0), 0);
  const totalMargin = totalRevenue - totalCost;
  const marginPercent = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;
  const packagesSent = sales.filter(s => s.status === "shipped" || s.status === "in_transit" || s.status === "delivered").length;
  const deliveryRate = sales.length > 0 ? (sales.filter(s => s.status === "delivered").length / sales.length) * 100 : 0;
  const cancelledOrders = sales.filter(s => s.status.startsWith("cancelled")).length;

  // KPI Calculations - Purchases Block
  const itemsPurchased = purchases.length;
  const totalPurchased = purchases.reduce((sum, p) => sum + p.price, 0);
  const purchasesInProgress = purchases.filter(p => p.status === "waiting_label" || p.status === "label_sent").length;
  const purchasesShipped = purchases.filter(p => p.status === "shipped" || p.status === "in_transit").length;
  const purchasesDelivered = purchases.filter(p => p.status === "delivered").length;

  // KPI Calculations - Returns Block
  const returnsCount = sales.filter(s => s.status === "return_initiated").length;
  const returnsValue = sales
    .filter(s => s.status === "return_initiated")
    .reduce((sum, s) => sum + s.price, 0);
  const revenueImpact = -returnsValue;

  // KPI Calculations - Stock Block
  const stockQuantity = MOCK_PRODUCTS.reduce((sum, p) => sum + (p.quantity || 0), 0);
  const stockCostValue = MOCK_PRODUCTS.reduce((sum, p) => sum + (p.purchaseCost || 0) * (p.quantity || 0), 0);
  const stockSaleValue = MOCK_PRODUCTS.reduce((sum, p) => sum + p.price * (p.quantity || 0), 0);
  const stockPotentialMargin = stockSaleValue - stockCostValue;
  const stockMarginPercent = stockSaleValue > 0 ? (stockPotentialMargin / stockSaleValue) * 100 : 0;

  // Chart Data - Sales vs Purchases
  const chartData = useMemo(() => {
    // Generate last 7 days
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayName = date.toLocaleDateString(language === "fr" ? "fr-FR" : "en-GB", { weekday: "short" });
      
      // Mock data for demo
      days.push({
        name: dayName,
        revenue: Math.floor(Math.random() * 500) + 200,
        purchases: Math.floor(Math.random() * 300) + 100,
        margin: Math.floor(Math.random() * 200) + 50,
      });
    }
    return days;
  }, [language]);

  // Chart Data - Order Status Distribution
  const statusData = useMemo(() => {
    return [
      { name: language === "fr" ? "En cours" : "In Progress", count: sales.filter(s => !s.status.startsWith("cancelled") && s.status !== "delivered").length, fill: "#8B5CF6" },
      { name: language === "fr" ? "Expédié" : "Shipped", count: sales.filter(s => s.status === "shipped" || s.status === "in_transit").length, fill: "#A78BFA" },
      { name: language === "fr" ? "Livré" : "Delivered", count: sales.filter(s => s.status === "delivered").length, fill: "#10B981" },
      { name: language === "fr" ? "Annulé" : "Cancelled", count: cancelledOrders, fill: "#EF4444" },
      { name: language === "fr" ? "Retour" : "Return", count: returnsCount, fill: "#F59E0B" },
    ];
  }, [sales, cancelledOrders, returnsCount, language]);

  // Top Sales
  const topSales = useMemo(() => {
    return sales
      .filter(s => s.status === "delivered")
      .map(s => ({
        ...s,
        margin: s.price - (s.purchaseCost || 0),
        marginPercent: s.price > 0 ? ((s.price - (s.purchaseCost || 0)) / s.price) * 100 : 0,
      }))
      .sort((a, b) => {
        if (topSortBy === "margin") return b.margin - a.margin;
        if (topSortBy === "revenue") return b.price - a.price;
        return 0; // volume would need quantity
      })
      .slice(0, 10);
  }, [sales, topSortBy]);

  // Top Categories
  const topCategories = useMemo(() => {
    const categories: Record<string, { count: number; revenue: number }> = {};
    
    sales.filter(s => s.status === "delivered").forEach(s => {
      const cat = s.title.split(" ")[0]; // Simple category extraction from title
      if (!categories[cat]) {
        categories[cat] = { count: 0, revenue: 0 };
      }
      categories[cat].count++;
      categories[cat].revenue += s.price;
    });

    const total = Object.values(categories).reduce((sum, c) => sum + c.revenue, 0);

    return Object.entries(categories)
      .map(([name, data]) => ({
        name,
        count: data.count,
        revenue: data.revenue,
        percent: total > 0 ? (data.revenue / total) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [sales]);

  // Handle refresh
  const handleRefresh = async () => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsLoading(false);
    toast.success(
      language === "fr"
        ? "Données actualisées"
        : "Data refreshed"
    );
  };

  // KPI Card Component
  const KPICard = ({ 
    title, 
    value, 
    delta, 
    icon: Icon, 
    subtitle,
    valuePrefix = "",
    valueSuffix = "",
  }: { 
    title: string; 
    value: number | string; 
    delta?: number; 
    icon: any; 
    subtitle?: string;
    valuePrefix?: string;
    valueSuffix?: string;
  }) => (
    <div className="dark:bg-card/50 bg-white border dark:border-primary/20 border-gray-200 rounded-2xl p-5 space-y-3 dark:shadow-[0_2px_16px_rgba(124,58,237,0.1)] shadow-sm transition-all duration-200 hover:-translate-y-0.5 dark:hover:shadow-[0_4px_20px_rgba(124,58,237,0.15)] hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl dark:bg-primary/15 bg-primary/10 flex items-center justify-center">
            <Icon className="w-5 h-5 dark:text-primary text-primary" />
          </div>
          <p className="text-sm dark:text-muted-foreground text-gray-600">{title}</p>
        </div>
        {delta !== undefined && (
          <Badge className={`gap-1 ${delta >= 0 ? "dark:bg-emerald-500/15 bg-emerald-100 dark:text-emerald-400 text-emerald-700" : "dark:bg-red-500/15 bg-red-100 dark:text-red-400 text-red-700"} border-0`}>
            {delta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(delta)}%
          </Badge>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-3xl dark:text-foreground text-gray-900 tracking-tight">
          {valuePrefix}{typeof value === "number" ? value.toLocaleString() : value}{valueSuffix}
        </p>
        {subtitle && <p className="text-xs dark:text-muted-foreground text-gray-500">{subtitle}</p>}
      </div>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="border-b border-border bg-background pb-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-foreground mb-2">
              {language === "fr" ? "Analyse" : "Analytics"}
            </h1>
            <p className="text-muted-foreground">
              {language === "fr" 
                ? "Vue globale des ventes, achats, retours et stock — multi-comptes." 
                : "Global view of sales, purchases, returns and stock — multi-account."}
            </p>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Account Filter */}
          <AccountFilter
            mode={accountFilterMode}
            selectedAccounts={selectedAccounts}
            onModeChange={setAccountFilterMode}
            onAccountsChange={setSelectedAccounts}
            language={language}
          />

          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder={
                language === "fr"
                  ? "Rechercher une commande / article..."
                  : "Search order / item..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 rounded-xl dark:bg-card/50 bg-white border-border"
            />
          </div>

          {/* Time Frame */}
          <Select value={timeFrame} onValueChange={(val) => setTimeFrame(val as TimeFrame)}>
            <SelectTrigger className="w-[160px] h-10 rounded-xl dark:bg-card/50 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="24h">{language === "fr" ? "Aujourd'hui" : "Today"}</SelectItem>
              <SelectItem value="7d">{language === "fr" ? "7 jours" : "7 days"}</SelectItem>
              <SelectItem value="30d">{language === "fr" ? "30 jours" : "30 days"}</SelectItem>
              <SelectItem value="current_month">{language === "fr" ? "Mois en cours" : "Current month"}</SelectItem>
              <SelectItem value="previous_month">{language === "fr" ? "Mois précédent" : "Previous month"}</SelectItem>
              <SelectItem value="custom">{language === "fr" ? "Personnalisé" : "Custom"}</SelectItem>
            </SelectContent>
          </Select>

          {/* Segmentation */}
          <Select value={segmentation} onValueChange={(val) => setSegmentation(val as Segmentation)}>
            <SelectTrigger className="w-[160px] h-10 rounded-xl dark:bg-card/50 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="global">{language === "fr" ? "Global" : "Global"}</SelectItem>
              <SelectItem value="category">{language === "fr" ? "Par catégorie" : "By category"}</SelectItem>
              <SelectItem value="brand">{language === "fr" ? "Par marque" : "By brand"}</SelectItem>
              <SelectItem value="account">{language === "fr" ? "Par compte" : "By account"}</SelectItem>
              <SelectItem value="status">{language === "fr" ? "Par statut" : "By status"}</SelectItem>
            </SelectContent>
          </Select>

          {/* Include Returns Toggle */}
          <div className="flex items-center gap-2 px-4 h-10 rounded-xl dark:bg-card/50 bg-white border dark:border-border border-gray-200">
            <Switch
              id="include-returns"
              checked={includeReturns}
              onCheckedChange={setIncludeReturns}
            />
            <Label htmlFor="include-returns" className="text-sm cursor-pointer dark:text-foreground text-gray-700">
              {language === "fr" ? "Inclure retours" : "Include returns"}
            </Label>
          </div>

          {/* Refresh Button */}
          <RefreshButton
            onRefresh={handleRefresh}
            isLoading={isLoading}
            language={language}
          />
        </div>
      </div>

      {/* KPI Grid */}
      <div className="space-y-6 mb-8">
        {/* Sales Block */}
        <div>
          <h3 className="text-sm font-semibold dark:text-primary text-primary uppercase tracking-wide mb-3">
            {language === "fr" ? "Ventes" : "Sales"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title={language === "fr" ? "Articles vendus" : "Items sold"}
              value={itemsSold}
              delta={5.2}
              icon={Package}
            />
            <KPICard
              title={language === "fr" ? "Montant vendu" : "Revenue"}
              value={formatCurrency(totalRevenue, language)}
              delta={12.8}
              icon={DollarSign}
            />
            <KPICard
              title={language === "fr" ? "Marge totale" : "Total margin"}
              value={formatCurrency(totalMargin, language)}
              delta={8.4}
              icon={TrendingUp}
            />
            <KPICard
              title={language === "fr" ? "Marge %" : "Margin %"}
              value={marginPercent.toFixed(1)}
              valueSuffix="%"
              delta={2.1}
              icon={Percent}
            />
            <KPICard
              title={language === "fr" ? "Colis envoyés" : "Packages sent"}
              value={packagesSent}
              delta={6.7}
              icon={Send}
            />
            <KPICard
              title={language === "fr" ? "Taux de livraison" : "Delivery rate"}
              value={deliveryRate.toFixed(1)}
              valueSuffix="%"
              delta={1.5}
              icon={CheckCircle2}
              subtitle={language === "fr" ? "Livré / total" : "Delivered / total"}
            />
            <KPICard
              title={language === "fr" ? "Commandes annulées" : "Cancelled orders"}
              value={cancelledOrders}
              delta={-2.3}
              icon={XCircle}
            />
          </div>
        </div>

        {/* Purchases Block */}
        <div>
          <h3 className="text-sm font-semibold dark:text-primary text-primary uppercase tracking-wide mb-3">
            {language === "fr" ? "Achats" : "Purchases"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title={language === "fr" ? "Articles achetés" : "Items purchased"}
              value={itemsPurchased}
              delta={4.1}
              icon={ShoppingCart}
            />
            <KPICard
              title={language === "fr" ? "Montant acheté" : "Amount purchased"}
              value={formatCurrency(totalPurchased, language)}
              delta={7.3}
              icon={DollarSign}
            />
            <KPICard
              title={language === "fr" ? "Achats en cours" : "In progress"}
              value={purchasesInProgress}
              icon={Package}
              subtitle={language === "fr" ? "Statut 'Achats'" : "Status 'Purchases'"}
            />
            <KPICard
              title={language === "fr" ? "Achats expédiés" : "Shipped"}
              value={purchasesShipped}
              delta={3.8}
              icon={Send}
            />
            <KPICard
              title={language === "fr" ? "Achats livrés" : "Delivered"}
              value={purchasesDelivered}
              delta={9.2}
              icon={CheckCircle2}
            />
          </div>
        </div>

        {/* Returns Block */}
        <div>
          <h3 className="text-sm font-semibold dark:text-primary text-primary uppercase tracking-wide mb-3">
            {language === "fr" ? "Retours / Annulations" : "Returns / Cancellations"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <KPICard
              title={language === "fr" ? "Retours effectués" : "Returns made"}
              value={returnsCount}
              delta={-1.5}
              icon={RotateCcw}
            />
            <KPICard
              title={language === "fr" ? "Valeur des retours" : "Returns value"}
              value={formatCurrency(returnsValue, language)}
              delta={-3.2}
              icon={DollarSign}
            />
            <KPICard
              title={language === "fr" ? "Impact CA" : "Revenue impact"}
              value={formatCurrency(revenueImpact, language)}
              icon={TrendingDown}
              subtitle={language === "fr" ? "Montant à soustraire" : "Amount to subtract"}
            />
          </div>
        </div>

        {/* Stock Block */}
        <div>
          <h3 className="text-sm font-semibold dark:text-primary text-primary uppercase tracking-wide mb-3">
            {language === "fr" ? "Stock" : "Stock"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title={language === "fr" ? "Stock actuel" : "Current stock"}
              value={stockQuantity}
              delta={2.4}
              icon={Boxes}
              subtitle={language === "fr" ? "Quantité totale" : "Total quantity"}
            />
            <KPICard
              title={language === "fr" ? "Valeur stock (coût)" : "Stock value (cost)"}
              value={formatCurrency(stockCostValue, language)}
              delta={5.6}
              icon={DollarSign}
            />
            <KPICard
              title={language === "fr" ? "Valeur stock (vente)" : "Stock value (sale)"}
              value={formatCurrency(stockSaleValue, language)}
              delta={4.8}
              icon={DollarSign}
              subtitle={language === "fr" ? "Prix de vente potentiel" : "Potential sale price"}
            />
            <KPICard
              title={language === "fr" ? "Marge potentielle" : "Potential margin"}
              value={`${formatCurrency(stockPotentialMargin, language)} (${stockMarginPercent.toFixed(1)}%)`}
              delta={3.2}
              icon={TrendingUp}
            />
          </div>
        </div>
      </div>

      {/* Performance & Trends */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold dark:text-primary text-primary uppercase tracking-wide mb-4">
          {language === "fr" ? "Performance & tendances" : "Performance & trends"}
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales vs Purchases Chart */}
          <div className="dark:bg-card/50 bg-white border dark:border-primary/20 border-gray-200 rounded-2xl p-6 dark:shadow-[0_2px_16px_rgba(124,58,237,0.1)] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold dark:text-foreground text-gray-900">
                {language === "fr" ? "Ventes vs Achats" : "Sales vs Purchases"}
              </h4>
              <div className="flex items-center gap-2">
                <Switch
                  id="show-margin"
                  checked={showMarginLine}
                  onCheckedChange={setShowMarginLine}
                />
                <Label htmlFor="show-margin" className="text-xs cursor-pointer dark:text-muted-foreground text-gray-600">
                  {language === "fr" ? "Afficher marge" : "Show margin"}
                </Label>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280} minHeight={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.1} />
                <XAxis dataKey="name" stroke="#888" fontSize={12} />
                <YAxis stroke="#888" fontSize={12} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "#1a1a1f",
                    border: "1px solid rgba(139, 92, 246, 0.3)",
                    borderRadius: "12px",
                    color: "#fff",
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#8B5CF6" strokeWidth={2} name={language === "fr" ? "CA vendu" : "Revenue"} />
                <Line type="monotone" dataKey="purchases" stroke="#10B981" strokeWidth={2} name={language === "fr" ? "Montant acheté" : "Purchases"} />
                {showMarginLine && (
                  <Line type="monotone" dataKey="margin" stroke="#F59E0B" strokeWidth={2} name={language === "fr" ? "Marge" : "Margin"} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Order Status Chart */}
          <div className="dark:bg-card/50 bg-white border dark:border-primary/20 border-gray-200 rounded-2xl p-6 dark:shadow-[0_2px_16px_rgba(124,58,237,0.1)] shadow-sm">
            <h4 className="font-semibold dark:text-foreground text-gray-900 mb-4">
              {language === "fr" ? "Statuts commandes" : "Order status"}
            </h4>
            <ResponsiveContainer width="100%" height={280} minHeight={280}>
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.1} />
                <XAxis dataKey="name" stroke="#888" fontSize={11} />
                <YAxis stroke="#888" fontSize={12} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "#1a1a1f",
                    border: "1px solid rgba(139, 92, 246, 0.3)",
                    borderRadius: "12px",
                    color: "#fff",
                  }}
                />
                <Bar dataKey="count" fill="#8B5CF6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Performance */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold dark:text-primary text-primary uppercase tracking-wide mb-4">
          {language === "fr" ? "Top performance" : "Top performance"}
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Sales */}
          <div className="dark:bg-card/50 bg-white border dark:border-primary/20 border-gray-200 rounded-2xl p-6 dark:shadow-[0_2px_16px_rgba(124,58,237,0.1)] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold dark:text-foreground text-gray-900">
                {language === "fr" ? "Top ventes du mois" : "Top sales of the month"}
              </h4>
              <Select value={topSortBy} onValueChange={(val) => setTopSortBy(val as any)}>
                <SelectTrigger className="w-[140px] h-8 text-xs rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  <SelectItem value="margin">{language === "fr" ? "Par marge" : "By margin"}</SelectItem>
                  <SelectItem value="revenue">{language === "fr" ? "Par CA" : "By revenue"}</SelectItem>
                  <SelectItem value="volume">{language === "fr" ? "Par volume" : "By volume"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              {topSales.slice(0, 5).map((sale, idx) => (
                <div
                  key={sale.id}
                  className="flex items-center gap-3 p-3 rounded-xl dark:bg-background/50 bg-gray-50 dark:hover:bg-background/70 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-center w-6 h-6 rounded-full dark:bg-primary/20 bg-primary/10 text-xs font-bold dark:text-primary text-primary">
                    {idx + 1}
                  </div>
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    <ImageWithFallback
                      src={sale.thumbnail}
                      alt={sale.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm dark:text-foreground text-gray-900 truncate">{sale.title}</p>
                    <p className="text-xs dark:text-muted-foreground text-gray-500">{sale.accountName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold dark:text-foreground text-gray-900">{formatCurrency(sale.price, language)}</p>
                    <p className="text-xs dark:text-emerald-400 text-emerald-600">+{formatCurrency(sale.margin, language)} ({sale.marginPercent.toFixed(0)}%)</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Categories */}
          <div className="dark:bg-card/50 bg-white border dark:border-primary/20 border-gray-200 rounded-2xl p-6 dark:shadow-[0_2px_16px_rgba(124,58,237,0.1)] shadow-sm">
            <h4 className="font-semibold dark:text-foreground text-gray-900 mb-4">
              {language === "fr" ? "Top catégories" : "Top categories"}
            </h4>
            <div className="space-y-3">
              {topCategories.map((cat, idx) => (
                <div key={cat.name} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full dark:bg-primary/20 bg-primary/10 text-xs font-bold dark:text-primary text-primary">
                        {idx + 1}
                      </div>
                      <span className="text-sm dark:text-foreground text-gray-900">{cat.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold dark:text-foreground text-gray-900">{formatCurrency(cat.revenue, language)}</p>
                      <p className="text-xs dark:text-muted-foreground text-gray-500">{cat.count} {language === "fr" ? "ventes" : "sales"}</p>
                    </div>
                  </div>
                  <div className="w-full h-2 rounded-full dark:bg-background/50 bg-gray-200 overflow-hidden">
                    <div
                      className="h-full dark:bg-primary bg-primary rounded-full"
                      style={{ width: `${cat.percent}%` }}
                    />
                  </div>
                  <p className="text-xs dark:text-muted-foreground text-gray-500 text-right">{cat.percent.toFixed(1)}% {language === "fr" ? "du CA" : "of revenue"}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Detail Transactions Table */}
      <div>
        <h3 className="text-sm font-semibold dark:text-primary text-primary uppercase tracking-wide mb-4">
          {language === "fr" ? "Détail transactions" : "Transaction details"}
        </h3>
        <div className="dark:bg-card/50 bg-white border dark:border-primary/20 border-gray-200 rounded-2xl overflow-hidden dark:shadow-[0_2px_16px_rgba(124,58,237,0.1)] shadow-sm">
          {/* Tabs */}
          <div className="p-4 border-b dark:border-border border-gray-200">
            <Tabs value={detailTab} onValueChange={(val) => setDetailTab(val as DetailTab)}>
              <TabsList className="rounded-2xl h-10 p-1 dark:bg-background/50 bg-gray-100">
                <TabsTrigger value="orders" className="rounded-xl">
                  {language === "fr" ? "Commandes" : "Orders"}
                </TabsTrigger>
                <TabsTrigger value="purchases" className="rounded-xl">
                  {language === "fr" ? "Achats" : "Purchases"}
                </TabsTrigger>
                <TabsTrigger value="returns" className="rounded-xl">
                  {language === "fr" ? "Retours" : "Returns"}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="dark:bg-background/30 bg-gray-50">
                <tr className="border-b dark:border-border border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold dark:text-muted-foreground text-gray-600 uppercase tracking-wide">
                    {language === "fr" ? "Article" : "Item"}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold dark:text-muted-foreground text-gray-600 uppercase tracking-wide">
                    {language === "fr" ? "Statut" : "Status"}
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold dark:text-muted-foreground text-gray-600 uppercase tracking-wide">
                    {language === "fr" ? "Prix" : "Price"}
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold dark:text-muted-foreground text-gray-600 uppercase tracking-wide">
                    {language === "fr" ? "Marge" : "Margin"}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold dark:text-muted-foreground text-gray-600 uppercase tracking-wide">
                    {language === "fr" ? "Compte" : "Account"}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold dark:text-muted-foreground text-gray-600 uppercase tracking-wide">
                    {language === "fr" ? "Date" : "Date"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {(detailTab === "orders" ? sales : detailTab === "purchases" ? purchases : sales.filter(s => s.status === "return_initiated"))
                  .slice(0, 10)
                  .map((item) => {
                    const margin = item.price - (item.purchaseCost || 0);
                    const marginPercent = item.price > 0 ? (margin / item.price) * 100 : 0;
                    return (
                      <tr
                        key={item.id}
                        className="border-b dark:border-border border-gray-100 dark:hover:bg-background/30 hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                              <ImageWithFallback
                                src={item.thumbnail}
                                alt={item.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm dark:text-foreground text-gray-900 truncate max-w-xs">{item.title}</p>
                              {item.sku && (
                                <p className="text-xs dark:text-muted-foreground text-gray-500">{item.sku}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className="dark:bg-primary/15 bg-primary/10 dark:text-primary text-primary border-0">
                            {item.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className="text-sm dark:text-foreground text-gray-900">{formatCurrency(item.price, language)}</p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className="text-sm dark:text-emerald-400 text-emerald-600">{formatCurrency(margin, language)}</p>
                          <p className="text-xs dark:text-muted-foreground text-gray-500">{marginPercent.toFixed(0)}%</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm dark:text-foreground text-gray-900">{item.accountName}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm dark:text-muted-foreground text-gray-600">
                            {item.createdAt.toLocaleDateString(language === "fr" ? "fr-FR" : "en-GB")}
                          </p>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}