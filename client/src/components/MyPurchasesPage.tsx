import { useState, useMemo } from "react";
import { Search, Package as PackageIcon, ShoppingBag, Plus, Truck } from "lucide-react";
import { mockOrders, Order } from "../lib/ordersData";
import { Product } from "../lib/stockData";
import { OrderDetailModal } from "./OrderDetailModal";
import { ProductFormDialog } from "./ProductFormDialog";
import { TrackingModal } from "./TrackingModal";
import { AddPurchaseModal } from "./AddPurchaseModal";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { AccountFilter, ACCOUNTS } from "./AccountFilter";
import { Badge } from "./ui/badge";
import { RefreshButton } from "./RefreshButton";
import { Language, t, formatCurrency } from "../lib/i18n";
import { toast } from "sonner@2.0.3";
import { OrdersBoard } from "./orders/OrdersBoard";
import { StatusCard } from "./orders/OrdersStatusCards";
import { BoardTab } from "./orders/OrdersTabs";
import { OrdersListRowData } from "./orders/OrdersListRow";

type PurchaseTab = "purchases" | "shipped" | "delivered";

interface MyPurchasesPageProps {
  language: Language;
}

// Helper to determine which tab a purchase belongs to
function getPurchaseTab(order: Order): PurchaseTab {
  // Delivered purchases
  if (order.status === "delivered") {
    return "delivered";
  }
  
  // Shipped purchases (shipped or in_transit)
  if (order.status === "shipped" || order.status === "in_transit") {
    return "shipped";
  }
  
  // All other purchases (pending, paid, waiting_label, label_sent, etc.)
  return "purchases";
}

export function MyPurchasesPage({ language }: MyPurchasesPageProps) {
  const [activeTab, setActiveTab] = useState<PurchaseTab>("purchases");
  const [searchQuery, setSearchQuery] = useState("");
  const [accountFilterMode, setAccountFilterMode] = useState<"all" | "selected">("all");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(
    ACCOUNTS.map(a => a.id)
  );
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // State for "Add to Stock" modal
  const [addToStockModalOpen, setAddToStockModalOpen] = useState(false);
  const [selectedPurchaseForStock, setSelectedPurchaseForStock] = useState<Order | null>(null);

  // State for "Add Purchase" modal
  const [addPurchaseModalOpen, setAddPurchaseModalOpen] = useState(false);

  // State for "Tracking" modal
  const [trackingModalOpen, setTrackingModalOpen] = useState(false);
  const [selectedOrderForTracking, setSelectedOrderForTracking] = useState<Order | null>(null);

  // Get all purchases (type === "purchase")
  const allPurchases = useMemo(() => {
    return mockOrders.filter(order => order.type === "purchase");
  }, []);

  // Filter and sort purchases
  const filteredPurchases = useMemo(() => {
    let filtered = [...allPurchases];

    // Account filter
    if (accountFilterMode === "selected") {
      filtered = filtered.filter(order => selectedAccounts.includes(order.accountId));
    }

    // Tab filter
    filtered = filtered.filter(order => getPurchaseTab(order) === activeTab);

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        order =>
          order.title.toLowerCase().includes(query) ||
          order.sku?.toLowerCase().includes(query) ||
          order.seller?.name.toLowerCase().includes(query) ||
          order.orderId.toLowerCase().includes(query)
      );
    }

    // Sort by newest (default)
    filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return filtered;
  }, [allPurchases, accountFilterMode, selectedAccounts, activeTab, searchQuery]);

  // Count purchases by tab
  const tabCounts = useMemo(() => {
    const counts = {
      purchases: 0,
      shipped: 0,
      delivered: 0,
    };

    allPurchases.forEach(order => {
      if (accountFilterMode === "selected" && !selectedAccounts.includes(order.accountId)) {
        return;
      }
      
      const tab = getPurchaseTab(order);
      counts[tab]++;
    });

    return counts;
  }, [allPurchases, accountFilterMode, selectedAccounts]);

  // KPI calculations
  const purchasesCount = tabCounts.purchases;
  const shippedCount = tabCounts.shipped;
  const deliveredCount = tabCounts.delivered;

  // Show account chip only when viewing all accounts or when multiple accounts are selected
  const showAccountChip = accountFilterMode === "all" || selectedAccounts.length > 1;

  // Handle add to stock
  const handleAddToStock = (order: Order) => {
    setSelectedPurchaseForStock(order);
    setAddToStockModalOpen(true);
  };

  // Handle save product from purchase
  const handleSaveProductFromPurchase = (product: Product) => {
    setAddToStockModalOpen(false);
    setSelectedPurchaseForStock(null);
    toast.success(
      language === "fr"
        ? "Article ajouté au stock"
        : "Item added to stock"
    );
  };

  // Handle tracking
  const handleOpenTracking = (order: Order) => {
    setSelectedOrderForTracking(order);
    setTrackingModalOpen(true);
  };

  // Handle add tracking
  const handleAddTracking = (order: Order) => {
    setSelectedOrderForTracking(order);
    setTrackingModalOpen(true);
  };

  // Handle save tracking
  const handleSaveTracking = (tracking: { carrier: string; trackingNumber: string }) => {
    toast.success(
      language === "fr"
        ? "Suivi enregistré"
        : "Tracking saved"
    );
    console.log("Saved tracking:", tracking);
  };

  // Handle add purchase
  const handleAddPurchase = (purchase: {
    title: string;
    amount: number;
    quantity: number;
    accountId: string;
    seller?: string;
    carrier?: string;
    trackingNumber?: string;
    photo?: string;
  }) => {
    toast.success(
      language === "fr"
        ? "Achat ajouté"
        : "Purchase added"
    );
    console.log("Added purchase:", purchase);
  };

  // Refresh handler
  const handleRefresh = async () => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    setIsLoading(false);
    toast.success(
      language === "fr"
        ? "Achats actualisés"
        : "Purchases refreshed"
    );
  };

  // Transform purchases to OrdersListRowData format
  const rowsData: OrdersListRowData[] = useMemo(() => {
    return filteredPurchases.map(order => {
      const badges = [];

      // Seller info
      if (order.seller) {
        badges.push(
          <span key="seller" className="text-[11px] dark:text-[#9CA3AF] text-muted-foreground">
            {language === "fr" ? "Vendeur :" : "Seller:"} {order.seller.name}
          </span>
        );
      }

      // Account chip (full name, not initials)
      if (showAccountChip) {
        badges.push(
          <Badge 
            key="account" 
            variant="outline"
            className="text-[11px] px-2 py-0.5 h-5 dark:bg-[rgba(139,92,246,0.05)] bg-primary/5 dark:border-[rgba(168,85,247,0.20)] border-primary/20 dark:text-[#A78BFA] text-primary"
          >
            {order.accountName}
          </Badge>
        );
      }

      // Date info
      const getDateLabel = () => {
        if (order.status === "delivered") {
          return language === "fr" 
            ? `Livré le ${order.updatedAt.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}` 
            : `Delivered on ${order.updatedAt.toLocaleDateString("en-US", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`;
        } else if (order.status === "shipped" || order.status === "in_transit") {
          return language === "fr" 
            ? `Expédié le ${order.updatedAt.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}` 
            : `Shipped on ${order.updatedAt.toLocaleDateString("en-US", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`;
        } else {
          return language === "fr" 
            ? `Acheté le ${order.createdAt.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}` 
            : `Purchased on ${order.createdAt.toLocaleDateString("en-US", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`;
        }
      };

      badges.push(
        <span key="date" className="text-[10px] dark:text-[#9CA3AF] text-muted-foreground">
          {getDateLabel()}
        </span>
      );

      // Build actions
      const actions = [];
      
      // Check if order has tracking or if it's a Vinted purchase
      const isVinted = order.source === "vinted";
      const isManual = order.source === "manual";
      const hasManualTracking = isManual && order.trackingNumber && order.trackingCarrier;

      // Only show tracking button for shipped/in_transit status (not delivered)
      if (order.status === "shipped" || order.status === "in_transit") {
        if (isVinted) {
          // Vinted purchase: show "Suivi" button (opens read-only tracking modal)
          actions.push({
            type: "secondary" as const,
            label: language === "fr" ? "Suivi" : "Tracking",
            icon: <Truck className="w-4 h-4 mr-1" />,
            onClick: (e: React.MouseEvent) => {
              e.stopPropagation();
              handleOpenTracking(order);
            },
          });
        } else if (isManual) {
          // Manual purchase: check if tracking is configured
          if (hasManualTracking) {
            // Show "Suivi" button (opens tracking modal with existing data)
            actions.push({
              type: "secondary" as const,
              label: language === "fr" ? "Suivi" : "Tracking",
              icon: <Truck className="w-4 h-4 mr-1" />,
              onClick: (e: React.MouseEvent) => {
                e.stopPropagation();
                handleOpenTracking(order);
              },
            });
          } else {
            // Show "Configurer le suivi" button
            actions.push({
              type: "secondary" as const,
              label: language === "fr" ? "Configurer le suivi" : "Setup tracking",
              icon: <Truck className="w-4 h-4 mr-1" />,
              onClick: (e: React.MouseEvent) => {
                e.stopPropagation();
                handleAddTracking(order);
              },
            });
          }
        }

        // Add to stock button (for shipped/in_transit orders)
        actions.push({
          type: "primary" as const,
          label: language === "fr" ? "Ajouter au stock" : "Add to stock",
          icon: <PackageIcon className="w-4 h-4 mr-1" />,
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            handleAddToStock(order);
          },
        });
      }

      // Build menu items
      const menuItems = [
        {
          label: language === "fr" ? "Voir sur Vinted" : "View on Vinted",
          onClick: () => {
            toast.info(language === "fr" ? "Ouverture de Vinted..." : "Opening Vinted...");
          },
        },
        {
          label: language === "fr" ? "Voir les détails" : "View details",
          onClick: () => {
            setSelectedOrder(order);
          },
        },
      ];

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
        subtitle: undefined, // No subtitle for purchases (seller info is in badges)
        actions,
        menuItems,
      };
    });
  }, [filteredPurchases, activeTab, showAccountChip, language]);

  // Status cards configuration
  const statusCards: StatusCard[] = [
    {
      key: "purchases",
      label: language === "fr" ? "Achats" : "Purchases",
      count: purchasesCount,
      icon: PackageIcon,
      tone: "purple",
    },
    {
      key: "shipped",
      label: language === "fr" ? "Expédié" : "Shipped",
      count: shippedCount,
      icon: PackageIcon,
      tone: "amber",
    },
    {
      key: "delivered",
      label: language === "fr" ? "Livré" : "Delivered",
      count: deliveredCount,
      icon: PackageIcon,
      tone: "green",
    },
  ];

  // Tabs configuration
  const tabs: BoardTab[] = [
    {
      key: "purchases",
      label: language === "fr" ? "Achats" : "Purchases",
      count: tabCounts.purchases,
    },
    {
      key: "shipped",
      label: language === "fr" ? "Expédié" : "Shipped",
      count: tabCounts.shipped,
    },
    {
      key: "delivered",
      label: language === "fr" ? "Livré" : "Delivered",
      count: tabCounts.delivered,
    },
  ];

  return (
    <div>
      {/* Header - Standardized */}
      <div className="border-b border-border bg-background pb-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 sm:gap-6 mb-4">
          <div>
            <h1 className="text-foreground mb-2">
              {language === "fr" ? "Mes achats" : "My purchases"}
            </h1>
            <p className="text-muted-foreground">
              {language === "fr" 
                ? "Suivez vos achats, expédiés et livrés." 
                : "Track your purchases, shipped, and delivered."}
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
            onRefresh={handleRefresh}
            language={language}
          />

          {/* Add Purchase Button */}
          <Button
            onClick={() => setAddPurchaseModalOpen(true)}
            className="rounded-full gap-2 dark:bg-[#8B5CF6] bg-primary hover:dark:bg-[#7C3AED] hover:bg-primary/90 dark:text-white text-primary-foreground px-5 py-2.5 transition-all duration-200"
            style={{
              boxShadow: "0 0 20px rgba(139,92,246,0.3)"
            }}
          >
            <Plus className="w-4 h-4" />
            <span>{language === "fr" ? "Ajouter un achat" : "Add purchase"}</span>
          </Button>
        </div>
      </div>

      {/* Purchases Board */}
      <OrdersBoard
        statusCards={statusCards}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(key) => setActiveTab(key as PurchaseTab)}
        rows={rowsData}
        isLoading={isLoading}
        emptyIcon={ShoppingBag}
        emptyTitle={language === "fr" ? "Aucun achat" : "No purchases"}
        emptyDescription={language === "fr" ? "Vos achats apparaîtront ici." : "Your purchases will appear here."}
        onRowClick={(rowId) => {
          const order = filteredPurchases.find(o => o.id === rowId);
          if (order) setSelectedOrder(order);
        }}
      />

      {/* Order Detail Modal */}
      <OrderDetailModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        language={language}
        onMarkProcessed={() => {}}
        onGoToChat={() => {}}
        onDownloadLabel={() => {}}
      />

      {/* Add to Stock Modal */}
      <ProductFormDialog
        open={addToStockModalOpen}
        onOpenChange={setAddToStockModalOpen}
        onSave={handleSaveProductFromPurchase}
        language={language}
        initialData={
          selectedPurchaseForStock
            ? {
                title: selectedPurchaseForStock.title,
                category: "",
                brand: "",
                size: "",
                condition: "",
                material: "",
                colors: [],
                salePrice: 0,
                costPrice: selectedPurchaseForStock.purchaseCost || selectedPurchaseForStock.price,
                lastPrice: selectedPurchaseForStock.purchaseCost || selectedPurchaseForStock.price,
                quantity: selectedPurchaseForStock.quantity || 1,
                description: "",
                sku: selectedPurchaseForStock.sku || "",
                images: selectedPurchaseForStock.thumbnail ? [selectedPurchaseForStock.thumbnail] : [],
              }
            : undefined
        }
      />

      {/* Tracking Modal */}
      {selectedOrderForTracking && (
        <TrackingModal
          open={trackingModalOpen}
          onOpenChange={setTrackingModalOpen}
          language={language}
          order={selectedOrderForTracking}
          onSave={handleSaveTracking}
        />
      )}

      {/* Add Purchase Modal */}
      <AddPurchaseModal
        open={addPurchaseModalOpen}
        onOpenChange={setAddPurchaseModalOpen}
        language={language}
        onSave={handleAddPurchase}
      />
    </div>
  );
}