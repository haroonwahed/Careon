import { useState, useMemo } from "react";
import { Search, Package as PackageIcon, ShoppingBag, Download } from "lucide-react";
import { mockOrders, Order } from "../lib/ordersData";
import { OrderDetailModal } from "./OrderDetailModal";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { AccountFilter, ACCOUNTS } from "./AccountFilter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Badge } from "./ui/badge";
import { RefreshButton } from "./RefreshButton";
import { Language, t, formatCurrency } from "../lib/i18n";
import { toast } from "sonner@2.0.3";
import { OrdersBoard } from "./orders/OrdersBoard";
import { StatusCard } from "./orders/OrdersStatusCards";
import { BoardTab } from "./orders/OrdersTabs";
import { OrdersListRowData } from "./orders/OrdersListRow";

type OrderTab = "to_process" | "to_hand_in" | "shipped" | "finished" | "cancelled";

interface OrdersPageNewProps {
  language: Language;
}

// Helper to determine which tab an order belongs to
function getOrderTab(order: Order): OrderTab {
  // Cancelled orders
  if (order.status.startsWith("cancelled")) {
    return "cancelled";
  }
  
  // Finished orders
  if (order.status === "delivered") {
    return "finished";
  }
  
  // Shipped orders - only if status is shipped or in_transit
  if (order.status === "shipped" || order.status === "in_transit") {
    return "shipped";
  }
  
  // To hand in - orders marked as processed but not yet shipped
  if (order.processed) {
    return "to_hand_in";
  }
  
  // To process (waiting_label, label_sent, return_initiated, and not processed)
  return "to_process";
}

export function OrdersPageNew({ language }: OrdersPageNewProps) {
  const [activeTab, setActiveTab] = useState<OrderTab>("to_process");
  const [searchQuery, setSearchQuery] = useState("");
  const [accountFilterMode, setAccountFilterMode] = useState<"all" | "selected">("all");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(
    ACCOUNTS.map(a => a.id)
  );
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showBulkLabelDialog, setShowBulkLabelDialog] = useState(false);
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  
  // Track processed orders in state
  const [processedOrders, setProcessedOrders] = useState<Set<string>>(new Set());
  
  // Enhance orders with processed state
  const ordersWithProcessed = useMemo(() => {
    return mockOrders
      .filter(order => order.type === "sale") // Only sales
      .map(order => ({
        ...order,
        processed: processedOrders.has(order.id),
      }));
  }, [processedOrders]);

  // Filter and sort orders
  const filteredOrders = useMemo(() => {
    let filtered = [...ordersWithProcessed];

    // Account filter
    if (accountFilterMode === "selected") {
      filtered = filtered.filter(order => selectedAccounts.includes(order.accountId));
    }

    // Tab filter
    filtered = filtered.filter(order => getOrderTab(order) === activeTab);

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        order =>
          order.title.toLowerCase().includes(query) ||
          order.sku?.toLowerCase().includes(query) ||
          order.buyer.name.toLowerCase().includes(query) ||
          order.orderId.toLowerCase().includes(query)
      );
    }

    // Sort by newest (default)
    filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return filtered;
  }, [ordersWithProcessed, accountFilterMode, selectedAccounts, activeTab, searchQuery]);

  // Count orders by tab
  const tabCounts = useMemo(() => {
    const counts = {
      to_process: 0,
      to_hand_in: 0,
      shipped: 0,
      finished: 0,
      cancelled: 0,
    };

    ordersWithProcessed.forEach(order => {
      if (accountFilterMode === "selected" && !selectedAccounts.includes(order.accountId)) {
        return;
      }
      
      const tab = getOrderTab(order);
      counts[tab]++;
    });

    return counts;
  }, [ordersWithProcessed, accountFilterMode, selectedAccounts]);

  // KPI calculations
  const toProcessCount = tabCounts.to_process;
  const shippedCount = tabCounts.shipped;
  const toHandInCount = ordersWithProcessed.filter(order => {
    if (accountFilterMode === "selected" && !selectedAccounts.includes(order.accountId)) {
      return false;
    }
    return order.processed && order.status !== "shipped" && order.status !== "in_transit";
  }).length;

  // Show account chip only when viewing all accounts or when multiple accounts are selected
  const showAccountChip = accountFilterMode === "all" || selectedAccounts.length > 1;

  // Handle mark as processed
  const handleMarkProcessed = (order: Order) => {
    setProcessedOrders(prev => new Set(prev).add(order.id));
    toast.success(
      language === "fr"
        ? "Commande marquée comme traitée"
        : "Order marked as processed"
    );
  };

  // Handle undo processed
  const handleUndoProcessed = (order: Order) => {
    setProcessedOrders(prev => {
      const newSet = new Set(prev);
      newSet.delete(order.id);
      return newSet;
    });
    toast.success(
      language === "fr"
        ? "Commande remise en \"à traiter\""
        : "Order moved back to \"to process\""
    );
  };

  // Handle download label
  const handleDownloadLabel = (order: Order) => {
    toast.success(
      language === "fr"
        ? "Bordereau téléchargé"
        : "Label downloaded"
    );
    console.log("Downloading label for order:", order.orderId);
  };

  // Get eligible orders for bulk label download
  const eligibleLabelsOrders = useMemo(() => {
    return ordersWithProcessed.filter(order => {
      if (accountFilterMode === "selected" && !selectedAccounts.includes(order.accountId)) {
        return false;
      }
      // Eligible: waiting_label status (label ready or waiting for label)
      return order.status === "waiting_label";
    });
  }, [ordersWithProcessed, accountFilterMode, selectedAccounts]);

  // Handle bulk label download
  const handleBulkDownloadLabels = async () => {
    setShowBulkLabelDialog(false);
    setIsBulkDownloading(true);

    // Simulate downloading labels
    await new Promise(resolve => setTimeout(resolve, 1500));

    setIsBulkDownloading(false);
    
    // In a real app, you might have some failures
    const successCount = eligibleLabelsOrders.length;
    const failureCount = 0;

    if (failureCount > 0) {
      toast.error(
        t(language, "orders.bulkLabels.toast.partial")
      );
    } else {
      toast.success(
        t(language, "orders.bulkLabels.toast.success")
      );
    }
  };

  // Handle go to chat
  const handleGoToChat = (order: Order) => {
    toast.info(
      language === "fr"
        ? `Ouverture de la conversation avec ${order.buyer.name}...`
        : `Opening conversation with ${order.buyer.name}...`
    );
    // In a real app, this would navigate to the messages page
  };

  // Transform orders to OrdersListRowData format
  const rowsData: OrdersListRowData[] = useMemo(() => {
    return filteredOrders.map(order => {
      const badges = [];

      // Account chip
      if (showAccountChip) {
        badges.push(
          <Badge key="account" variant="outline" className="text-xs">
            {order.accountName}
          </Badge>
        );
      }

      // Processed badge
      if (order.processed) {
        badges.push(
          <Badge 
            key="processed"
            className="dark:bg-[rgba(42,240,122,0.15)] bg-green-100 dark:border-[rgba(42,240,122,0.40)] border-green-300 dark:text-[#2AF07A] text-green-700 text-xs"
          >
            {t(language, "orders.badge.processed")}
          </Badge>
        );
      }

      // Waiting label badge
      if (order.status === "waiting_label" && !order.processed) {
        badges.push(
          <Badge 
            key="waiting-label"
            variant="outline"
            className="dark:text-[#9CA3AF] text-muted-foreground text-xs"
          >
            {t(language, "orders.badge.waitingLabel")}
          </Badge>
        );
      }

      // Build actions
      const actions = [];
      
      // Mark as processed button (only in to_process tab)
      if (activeTab === "to_process" && !order.processed) {
        actions.push({
          type: "primary" as const,
          label: t(language, "orders.action.markProcessed"),
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            handleMarkProcessed(order);
          },
        });
      }

      // Download label button
      if (order.status === "waiting_label" || order.status === "label_sent") {
        actions.push({
          type: "ghost" as const,
          label: t(language, "orders.action.downloadLabel"),
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            handleDownloadLabel(order);
          },
        });
      }

      // Build menu items
      const menuItems = [
        {
          label: t(language, "orders.menu.viewOnVinted"),
          onClick: () => {
            toast.info(language === "fr" ? "Ouverture de Vinted..." : "Opening Vinted...");
          },
        },
        {
          label: t(language, "orders.menu.viewDetails"),
          onClick: () => {
            setSelectedOrder(order);
          },
        },
      ];

      // Add "undo processed" menu item in to_hand_in tab
      if (activeTab === "to_hand_in") {
        menuItems.push({
          label: t(language, "orders.action.undoProcessed"),
          onClick: () => {
            handleUndoProcessed(order);
          },
        });
      }

      return {
        id: order.id,
        imageUrl: order.thumbnail,
        title: order.title,
        sku: order.sku,
        badges,
        price: (
          <div className="dark:text-[#E7E7F0] text-foreground">
            {formatCurrency(order.price, language)}
          </div>
        ),
        subtitle: order.buyer.name,
        actions,
        menuItems: undefined, // Pas de menu kebab dans Mes commandes
      };
    });
  }, [filteredOrders, activeTab, showAccountChip, language]);

  // Status cards configuration
  const statusCards: StatusCard[] = [
    {
      key: "to_process",
      label: t(language, "orders.kpi.toProcess"),
      count: toProcessCount,
      icon: PackageIcon,
      tone: "purple",
    },
    {
      key: "to_hand_in",
      label: t(language, "orders.kpi.toHandIn"),
      count: toHandInCount,
      icon: PackageIcon,
      tone: "amber",
    },
    {
      key: "shipped",
      label: t(language, "orders.kpi.shipped"),
      count: shippedCount,
      icon: PackageIcon,
      tone: "green",
    },
  ];

  // Tabs configuration
  const tabs: BoardTab[] = [
    {
      key: "to_process",
      label: t(language, "orders.tabs.toProcess"),
      count: tabCounts.to_process,
    },
    {
      key: "to_hand_in",
      label: t(language, "orders.tabs.toHandIn"),
      count: tabCounts.to_hand_in,
    },
    {
      key: "shipped",
      label: t(language, "orders.tabs.shipped"),
      count: tabCounts.shipped,
    },
    {
      key: "finished",
      label: t(language, "orders.tabs.finished"),
      count: tabCounts.finished,
    },
    {
      key: "cancelled",
      label: t(language, "orders.tabs.cancelled"),
      count: tabCounts.cancelled,
    },
  ];

  return (
    <div>
      {/* Header - Standardized like Notifications */}
      <div className="border-b border-border bg-background pb-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 sm:gap-6 mb-4">
          <div>
            <h1 className="text-foreground mb-2">{t(language, "orders.title")}</h1>
            <p className="text-muted-foreground">
              {language === "fr" ? "Suivez vos commandes à traiter, à déposer et expédiées." : "Track orders to process, hand in, and shipped."}
            </p>
          </div>
        </div>

        {/* Controls - Standardized filter bar */}
        <div className="flex flex-wrap items-center gap-3 mt-4">
          {/* Account Filter */}
          <AccountFilter
            selectedAccounts={selectedAccounts}
            onAccountsChange={setSelectedAccounts}
            mode={accountFilterMode}
            onModeChange={setAccountFilterMode}
            language={language}
          />

          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-[400px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t(language, "common.search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>

          {/* Refresh Button */}
          <RefreshButton
            onRefresh={async () => {
              setIsLoading(true);
              await new Promise(resolve => setTimeout(resolve, 800));
              setIsLoading(false);
              toast.success(
                language === "fr" 
                  ? "Commandes actualisées" 
                  : "Orders refreshed"
              );
            }}
            language={language}
          />

          {/* Download All Labels Button (if there are eligible orders) */}
          {eligibleLabelsOrders.length > 0 && (
            <Button
              onClick={() => setShowBulkLabelDialog(true)}
              disabled={eligibleLabelsOrders.length === 0 || isBulkDownloading}
              className="rounded-full gap-2 dark:bg-[#8B5CF6] bg-primary hover:dark:bg-[#7C3AED] hover:bg-primary/90 dark:text-white text-primary-foreground px-5 py-2.5 transition-all duration-200"
              style={{
                boxShadow: eligibleLabelsOrders.length > 0 ? "0 0 20px rgba(139,92,246,0.3)" : "none"
              }}
            >
              <Download className="w-4 h-4" />
              <span>{t(language, "orders.bulkLabels.button")}</span>
              {eligibleLabelsOrders.length > 0 && (
                <Badge 
                  variant="secondary" 
                  className="ml-1 px-2 py-0.5 rounded-full dark:bg-[rgba(139,92,246,0.30)] bg-primary/20 dark:text-[#E7E7F0] text-primary-foreground border-0"
                >
                  {eligibleLabelsOrders.length}
                </Badge>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Orders Board */}
      <OrdersBoard
        statusCards={statusCards}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(key) => setActiveTab(key as OrderTab)}
        rows={rowsData}
        isLoading={isLoading}
        emptyIcon={ShoppingBag}
        emptyTitle={t(language, "orders.empty.title")}
        emptyDescription={t(language, "orders.empty.description")}
        onRowClick={(rowId) => {
          const order = filteredOrders.find(o => o.id === rowId);
          if (order) setSelectedOrder(order);
        }}
      />

      {/* Order Detail Modal */}
      <OrderDetailModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        language={language}
        onMarkProcessed={handleMarkProcessed}
        onGoToChat={handleGoToChat}
        onDownloadLabel={handleDownloadLabel}
      />

      {/* Bulk Label Download Confirmation Dialog */}
      <AlertDialog open={showBulkLabelDialog} onOpenChange={setShowBulkLabelDialog}>
        <AlertDialogContent className="rounded-2xl dark:bg-[#0E0E14] bg-card border dark:border-[rgba(168,85,247,0.25)] border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-[#E7E7F0] text-foreground">
              {t(language, "orders.bulkLabels.confirm.title")}
            </AlertDialogTitle>
            <AlertDialogDescription className="dark:text-[#9CA3AF] text-muted-foreground">
              {t(language, "orders.bulkLabels.confirm.body").replace("{count}", eligibleLabelsOrders.length.toString())}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">
              {t(language, "orders.bulkLabels.confirm.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkDownloadLabels}
              className="rounded-xl dark:bg-[#8B5CF6] bg-primary hover:dark:bg-[#7C3AED] hover:bg-primary/90"
            >
              {t(language, "orders.bulkLabels.confirm.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}