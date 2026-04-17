import { 
  ChartLine, 
  Bell, 
  MessageSquare, 
  Play, 
  Package, 
  Megaphone, 
  LayoutGrid, 
  Settings, 
  Shirt, 
  RotateCw, 
  TrendingUp, 
  Users, 
  Globe,
  ChevronLeft,
  ShoppingCart
} from "lucide-react";
import { useState } from "react";
import { Language, t } from "../lib/i18n";
import { toast } from "sonner@2.0.3";

export type Page = 
  | "dashboard" 
  | "orders" 
  | "notifications" 
  | "messages" 
  | "launcher" 
  | "stock" 
  | "publisher" 
  | "published" 
  | "settings" 
  | "tracking-products" 
  | "tracking-vendors" 
  | "tracking-public";

interface SidebarExtendedProps {
  activePage: Page;
  onPageChange: (page: Page) => void;
  language: Language;
  onGlobalRefresh?: () => Promise<void>;
  onCollapse?: () => void;
  variant?: "soft" | "max"; // Compact soft ou Compact max
}

export function SidebarExtended({ 
  activePage, 
  onPageChange, 
  language, 
  onGlobalRefresh,
  onCollapse,
  variant = "soft"
}: SidebarExtendedProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Spacing configuration based on variant
  const spacing = {
    soft: {
      containerPy: "py-0", // Supprimé complètement (py-1.5 → py-0)
      sectionGap: "mb-2.5",
      itemGap: "gap-0.5",
      itemHeight: "h-8",
      itemPaddingX: "px-3",
      sectionTitleMb: "mb-1.5",
      sectionTitleSize: "text-[9px]",
      labelSize: "text-[12px]",
      iconSize: "w-4 h-4",
      footerPy: "py-2",
      footerItemHeight: "h-7",
      badgeSize: "w-4 h-4 text-[10px]",
    },
    max: {
      containerPy: "py-0", // Supprimé complètement (py-1 → py-0)
      sectionGap: "mb-2",
      itemGap: "gap-0.5",
      itemHeight: "h-7",
      itemPaddingX: "px-2.5",
      sectionTitleMb: "mb-1",
      sectionTitleSize: "text-[8px]",
      labelSize: "text-[11px]",
      iconSize: "w-3.5 h-3.5",
      footerPy: "py-1.5",
      footerItemHeight: "h-6",
      badgeSize: "w-3.5 h-3.5 text-[9px]",
    },
  };

  const s = spacing[variant];

  const handleGlobalRefresh = async () => {
    if (isRefreshing || !onGlobalRefresh) return;
    
    setIsRefreshing(true);
    
    try {
      await onGlobalRefresh();
      toast.success(t(language, "globalRefresh.toastDone"));
    } catch (error) {
      toast.error(t(language, "globalRefresh.toastError"));
    } finally {
      setIsRefreshing(false);
    }
  };

  // Navigation sections
  const sections = [
    {
      title: language === "fr" ? "COMPTES" : "ACCOUNTS",
      items: [
        { id: "launcher" as Page, icon: Play, label: t(language, "nav.accountLauncher") },
      ],
    },
    {
      title: language === "fr" ? "PRINCIPAL" : "MAIN",
      items: [
        { id: "dashboard" as Page, icon: ChartLine, label: t(language, "nav.dashboard") },
        { id: "notifications" as Page, icon: Bell, label: t(language, "nav.notifications") },
        { id: "messages" as Page, icon: MessageSquare, label: t(language, "nav.messages") },
      ],
    },
    {
      title: language === "fr" ? "VENTE-ACHAT" : "SALES-PURCHASE",
      items: [
        { id: "orders" as Page, icon: ShoppingCart, label: t(language, "orders.nav.myOrders") },
      ],
    },
    {
      title: language === "fr" ? "ANNONCES" : "LISTINGS",
      items: [
        { id: "stock" as Page, icon: Shirt, label: t(language, "nav.stockManager") },
        { id: "publisher" as Page, icon: Megaphone, label: t(language, "nav.listingsPublisher") },
        { id: "published" as Page, icon: LayoutGrid, label: t(language, "nav.publishedListings") },
      ],
    },
    {
      title: "TRACKING",
      items: [
        { id: "tracking-products" as Page, icon: TrendingUp, label: t(language, "nav.trackingProducts") },
        { id: "tracking-vendors" as Page, icon: Users, label: t(language, "nav.trackingVendors") },
        { id: "tracking-public" as Page, icon: Globe, label: t(language, "nav.trackingPublic") },
      ],
    },
  ];

  const renderNavItem = (item: { id: Page; icon: any; label: string }) => {
    const Icon = item.icon;
    const isActive = activePage === item.id;
    
    return (
      <button
        key={item.id}
        onClick={() => onPageChange(item.id)}
        className={`w-full flex items-center gap-2.5 ${s.itemHeight} ${s.itemPaddingX} rounded-lg transition-all duration-200 ${
          isActive
            ? "dark:bg-[rgba(139,92,246,0.15)] bg-primary/10 border dark:border-[rgba(168,85,247,0.5)] border-primary dark:text-[#8B5CF6] text-primary"
            : "dark:text-[#9CA3AF] text-muted-foreground dark:hover:text-[#E7E7F0] hover:text-foreground dark:hover:bg-[#12121A] hover:bg-muted/50"
        }`}
        style={isActive ? {
          boxShadow: "0 0 15px rgba(139,92,246,0.25)"
        } : undefined}
      >
        <Icon className={s.iconSize} />
        <span className={`${s.labelSize} font-medium truncate`}>{item.label}</span>
      </button>
    );
  };

  return (
    <div 
      className={`fixed left-0 top-0 h-screen w-56 border-r dark:border-[rgba(168,85,247,0.25)] border-border dark:bg-[#0E0E14] bg-card z-40 flex flex-col px-3 overflow-hidden`}
      style={{
        boxShadow: "1px 0 0 rgba(168,85,247,0.15)"
      }}
    >
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar pt-3">
        {sections.map((section, idx) => (
          <div key={idx} className={idx === 0 ? "mb-2.5" : s.sectionGap}>
            <h3 
              className={`${s.sectionTitleSize} font-semibold dark:text-primary/70 text-primary uppercase tracking-wider ${s.sectionTitleMb} px-1`}
            >
              {section.title}
            </h3>
            <div className={`flex flex-col ${s.itemGap}`}>
              {section.items.map(renderNavItem)}
            </div>
          </div>
        ))}

        {/* Settings */}
        <div className={s.sectionGap}>
          <h3 
            className={`${s.sectionTitleSize} font-semibold dark:text-primary/70 text-primary uppercase tracking-wider ${s.sectionTitleMb} px-1`}
          >
            {language === "fr" ? "PARAMÈTRES" : "SETTINGS"}
          </h3>
          <div className={`flex flex-col ${s.itemGap}`}>
            {renderNavItem({ id: "settings", icon: Settings, label: t(language, "nav.settings") })}
          </div>
        </div>
      </div>

      {/* Footer - Fixed at bottom */}
      <div className={`border-t dark:border-[rgba(168,85,247,0.15)] border-border ${s.footerPy} flex flex-col gap-2 flex-shrink-0`}>
        {/* Global Refresh */}
        {onGlobalRefresh && (
          <button
            onClick={handleGlobalRefresh}
            disabled={isRefreshing}
            className={`w-full flex items-center justify-center gap-2 ${s.footerItemHeight} px-3 rounded-lg transition-all duration-200 dark:bg-[#1A1A24] bg-muted border dark:border-[rgba(168,85,247,0.20)] border-border dark:text-[#E7E7F0] text-foreground ${
              isRefreshing
                ? "opacity-50 cursor-not-allowed"
                : "hover:dark:bg-[#242430] hover:bg-muted/70"
            }`}
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span className="text-[12px] font-medium">
              {language === "fr" ? "Actualiser tout" : "Refresh all"}
            </span>
          </button>
        )}

        {/* Collapse Button */}
        {onCollapse && (
          <button
            onClick={onCollapse}
            className={`w-full flex items-center justify-center gap-2 ${s.footerItemHeight} px-3 rounded-lg transition-all duration-200 dark:bg-primary bg-primary dark:text-white text-white hover:scale-[1.02] active:scale-[0.98]`}
            style={{
              boxShadow: "0 0 15px rgba(139,92,246,0.3)"
            }}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="text-[12px] font-medium">
              {language === "fr" ? "Réduire la barre" : "Collapse sidebar"}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}