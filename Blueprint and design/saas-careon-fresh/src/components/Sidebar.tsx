import { ChartLine, Bell, MessageSquare, Play, Package, Megaphone, LayoutGrid, Settings, Shirt, RotateCw, TrendingUp, Users, Globe } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { Language, t } from "../lib/i18n";
import { toast } from "sonner@2.0.3";

export type Page = "dashboard" | "orders" | "notifications" | "messages" | "launcher" | "stock" | "publisher" | "published" | "settings" | "tracking-products" | "tracking-vendors" | "tracking-public";

interface SidebarProps {
  activePage: Page;
  onPageChange: (page: Page) => void;
  language: Language;
  onGlobalRefresh?: () => Promise<void>;
}

export function Sidebar({ activePage, onPageChange, language, onGlobalRefresh }: SidebarProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  
  // Account management (top)
  const accountItems = [
    { id: "launcher" as Page, icon: Play, label: t(language, "nav.accountLauncher") },
  ];

  // Main navigation (middle)
  const navItems = [
    { id: "dashboard" as Page, icon: ChartLine, label: t(language, "nav.dashboard") },
    { id: "orders" as Page, icon: Package, label: t(language, "orders.nav.myOrders") },
    { id: "notifications" as Page, icon: Bell, label: t(language, "nav.notifications") },
    { id: "messages" as Page, icon: MessageSquare, label: t(language, "nav.messages") },
    { id: "stock" as Page, icon: Shirt, label: t(language, "nav.stockManager") },
    { id: "publisher" as Page, icon: Megaphone, label: t(language, "nav.listingsPublisher") },
    { id: "published" as Page, icon: LayoutGrid, label: t(language, "nav.publishedListings") },
    { id: "tracking-products" as Page, icon: TrendingUp, label: t(language, "nav.trackingProducts") },
    { id: "tracking-vendors" as Page, icon: Users, label: t(language, "nav.trackingVendors") },
    { id: "tracking-public" as Page, icon: Globe, label: t(language, "nav.trackingPublic") },
  ];

  // Settings (bottom - pinned)
  const settingsItems = [
    { id: "settings" as Page, icon: Settings, label: t(language, "nav.settings") },
  ];

  const renderNavItem = (item: typeof navItems[0]) => {
    const Icon = item.icon;
    const isActive = activePage === item.id;
    
    return (
      <Tooltip key={item.id}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`w-12 h-12 rounded-2xl ${
              isActive
                ? "dark:bg-[rgba(139,92,246,0.15)] bg-primary/10 border dark:border-[rgba(168,85,247,0.5)] border-primary dark:text-[#8B5CF6] text-primary"
                : "dark:text-[#9CA3AF] text-muted-foreground dark:hover:text-[#E7E7F0] hover:text-foreground dark:hover:bg-[#12121A]"
            }`}
            onClick={() => onPageChange(item.id)}
            style={isActive ? {
              boxShadow: "0 0 20px rgba(139,92,246,0.3)"
            } : undefined}
          >
            <Icon className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent 
          side="right" 
          className="rounded-xl dark:bg-[#0E0E14] dark:border-[rgba(168,85,247,0.25)]"
          style={{
            boxShadow: "0 0 0 1px rgba(168,85,247,0.25), 0 0 28px rgba(168,85,247,0.10)"
          }}
        >
          <p className="dark:text-[#E7E7F0]">{item.label}</p>
        </TooltipContent>
      </Tooltip>
    );
  };
  
  const handleGlobalRefresh = async () => {
    if (isRefreshing || cooldownRemaining > 0 || !onGlobalRefresh) return;
    
    setIsRefreshing(true);
    
    try {
      await onGlobalRefresh();
      toast.success(t(language, "globalRefresh.toastDone"));
      
      // Start cooldown (5 seconds)
      const cooldownDuration = 5000;
      const cooldownStep = 100;
      let remaining = cooldownDuration;
      
      const cooldownInterval = setInterval(() => {
        remaining -= cooldownStep;
        setCooldownRemaining(Math.max(0, remaining));
        
        if (remaining <= 0) {
          clearInterval(cooldownInterval);
        }
      }, cooldownStep);
    } catch (error) {
      toast.error(t(language, "globalRefresh.toastError"));
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div 
        className="fixed left-0 top-0 h-screen w-[72px] border-r dark:border-[rgba(168,85,247,0.25)] border-border dark:bg-[#0E0E14] bg-card z-40 flex flex-col items-center py-6"
        style={{
          boxShadow: "1px 0 0 rgba(168,85,247,0.15)"
        }}
      >
        {/* Account management group - top */}
        <div className="flex flex-col items-center gap-3">
          {accountItems.map(renderNavItem)}
        </div>
        
        {/* Gap to emphasize grouping */}
        <div className="h-4" />
        
        {/* Main navigation group */}
        <div className="flex flex-col items-center gap-3">
          {navItems.map(renderNavItem)}
        </div>

        {/* Spacer to push settings to bottom */}
        <div className="flex-1" />

        {/* Global Refresh Button */}
        {onGlobalRefresh && (
          <>
            <div className="mb-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleGlobalRefresh}
                    disabled={isRefreshing || cooldownRemaining > 0}
                    className={`w-10 h-10 rounded-full dark:bg-[#0E0E14] bg-card border dark:border-[rgba(148,163,184,0.30)] border-gray-300 dark:text-[#E7E7F0] text-foreground transition-all ${
                      isRefreshing || cooldownRemaining > 0
                        ? "opacity-50 cursor-not-allowed"
                        : "dark:hover:bg-[#1A1A24] hover:bg-gray-100 dark:hover:text-[#E7E7F0] hover:text-foreground opacity-80 hover:opacity-100"
                    }`}
                    style={
                      isRefreshing || cooldownRemaining > 0
                        ? undefined
                        : {
                            boxShadow: "0 0 0 0px rgba(168,85,247,0.55)",
                            transition: "box-shadow 0.2s ease-in-out, transform 0.2s ease-in-out",
                          }
                    }
                    aria-label={t(language, "globalRefresh.tooltip")}
                  >
                    <RotateCw
                      className={`h-4 w-4 ${
                        isRefreshing ? "animate-spin" : ""
                      }`}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  className="rounded-xl dark:bg-[#0E0E14] bg-popover dark:border-[rgba(168,85,247,0.25)] border-border"
                  style={{
                    boxShadow: "0 0 0 1px rgba(168,85,247,0.25), 0 0 28px rgba(168,85,247,0.10)",
                  }}
                >
                  <p className="dark:text-[#E7E7F0] text-foreground">
                    {t(language, "globalRefresh.tooltip")}
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          </>
        )}

        {/* Settings (bottom - pinned) */}
        <div className="flex flex-col items-center gap-3">
          {settingsItems.map(renderNavItem)}
        </div>
      </div>
    </TooltipProvider>
  );
}