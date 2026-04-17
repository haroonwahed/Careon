import { 
  ChartLine, 
  Bell, 
  MessageSquare, 
  ClipboardList, 
  Users, 
  MapPin, 
  FileText,
  Settings,
  RotateCw, 
  ChevronLeft, 
  ChevronRight,
  FolderOpen,
  GitMerge,
  CheckCircle2,
  UserPlus,
  Building2,
  Map,
  AlertTriangle,
  Inbox
} from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { Language, t } from "../lib/i18n";
import { toast } from "sonner@2.0.3";

export type Page = 
  | "dashboard" 
  | "casussen"
  | "beoordelingen"
  | "matching"
  | "plaatsingen"
  | "intake"
  | "provider-intake"
  | "zorgaanbieders"
  | "gemeenten"
  | "regios"
  | "notifications" 
  | "messages" 
  | "settings";

interface ModernSidebarProps {
  activePage: Page;
  onPageChange: (page: Page) => void;
  language: Language;
  onGlobalRefresh?: () => Promise<void>;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

interface NavItem {
  id: Page;
  icon: any;
  label: string;
  badge?: number;
}

interface NavSection {
  title?: string;
  items: NavItem[];
  emphasis?: boolean; // For WERKFLOW section
}

export function ModernSidebar({ 
  activePage, 
  onPageChange, 
  language, 
  onGlobalRefresh,
  collapsed,
  onToggleCollapse
}: ModernSidebarProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  // Define navigation sections for healthcare coordination workflow
  const sections: NavSection[] = [
    {
      title: "Regie",
      items: [
        { id: "dashboard" as Page, icon: ChartLine, label: "Regiekamer" },
        { id: "casussen" as Page, icon: FolderOpen, label: "Casussen" },
      ]
    },
    {
      title: "Werkflow",
      emphasis: true, // Visual emphasis for core workflow
      items: [
        { id: "beoordelingen" as Page, icon: ClipboardList, label: "Beoordelingen", badge: 2 },
        { id: "matching" as Page, icon: GitMerge, label: "Matching", badge: 3 },
        { id: "plaatsingen" as Page, icon: CheckCircle2, label: "Plaatsingen", badge: 1 },
        { id: "intake" as Page, icon: UserPlus, label: "Intake" },
        { id: "provider-intake" as Page, icon: Inbox, label: "Provider Intake", badge: 2 },
      ]
    },
    {
      title: "Netwerk",
      items: [
        { id: "zorgaanbieders" as Page, icon: Building2, label: "Zorgaanbieders" },
        { id: "gemeenten" as Page, icon: MapPin, label: "Gemeenten" },
        { id: "regios" as Page, icon: Map, label: "Regio's" },
      ]
    },
    {
      title: "Signalering",
      items: [
        { id: "notifications" as Page, icon: AlertTriangle, label: "Signalen", badge: 3 },
        { id: "messages" as Page, icon: Bell, label: "Meldingen", badge: 5 },
      ]
    },
    {
      title: "Systeem",
      items: [
        { id: "settings" as Page, icon: Settings, label: "Instellingen" },
      ]
    }
  ];

  const handleGlobalRefresh = async () => {
    if (isRefreshing || cooldownRemaining > 0 || !onGlobalRefresh) return;
    
    setIsRefreshing(true);
    
    try {
      await onGlobalRefresh();
      toast.success(t(language, "globalRefresh.toastDone"));
      
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

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = activePage === item.id;

    if (collapsed) {
      return (
        <Button
          key={item.id}
          variant="ghost"
          size="icon"
          className={`w-10 h-10 rounded-xl relative transition-all duration-200 ${
            isActive
              ? "dark:bg-primary/15 bg-primary/10 dark:text-primary text-primary border dark:border-primary/40 border-primary/30"
              : "dark:text-muted-foreground text-muted-foreground dark:hover:text-foreground hover:text-foreground dark:hover:bg-surface-hover hover:bg-muted/50 dark:hover:border-primary/20 hover:border-primary/10 border border-transparent"
          }`}
          onClick={() => onPageChange(item.id)}
        >
          <Icon className="h-5 w-5" />
          {item.badge && item.badge > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-white">
              {item.badge > 9 ? "9+" : item.badge}
            </span>
          )}
        </Button>
      );
    }

    return (
      <Button
        key={item.id}
        variant="ghost"
        className={`w-full justify-start h-9 rounded-xl px-3 gap-3 relative ${
          isActive
            ? "dark:bg-primary/15 bg-primary/10 dark:text-primary text-primary border dark:border-primary/40 border-primary/30"
            : "dark:text-muted-foreground text-muted-foreground dark:hover:text-foreground hover:text-foreground dark:hover:bg-surface-hover hover:bg-muted/50"
        }`}
        onClick={() => onPageChange(item.id)}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className="flex-1 text-left truncate">{item.label}</span>
        {item.badge && item.badge > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-white">
            {item.badge > 9 ? "9+" : item.badge}
          </span>
        )}
      </Button>
    );
  };

  return (
    <div 
      className={`fixed left-0 top-0 h-screen z-40 flex flex-col transition-all duration-300 border-r border-border ${
        collapsed ? "w-[72px]" : "w-[240px]"
      } dark:bg-gradient-to-b dark:from-[#0E0E18] dark:to-[#0A0A0F] bg-gradient-to-b from-[#fafafa] to-[#f5f5f5]`}
      style={{
        boxShadow: "2px 0 24px rgba(0, 0, 0, 0.08)"
      }}
    >
      {/* Empty header section - logo moved to topbar - no harsh divider */}
      <div className="h-16"></div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {sections.map((section, idx) => (
          <div 
            key={idx} 
            className={`space-y-0.5 ${
              section.emphasis 
                ? 'pb-4 mb-4' 
                : idx < sections.length - 1 ? 'pb-2' : ''
            }`}
            style={section.emphasis ? {
              borderBottom: '1px solid rgba(139, 92, 246, 0.15)'
            } : undefined}
          >
            {!collapsed && section.title && (
              <div className={`px-3 mb-2 ${section.emphasis ? 'mb-3' : ''}`}>
                <p className={`text-[11px] font-bold uppercase tracking-wider leading-tight ${
                  section.emphasis 
                    ? 'dark:text-primary text-primary opacity-100' 
                    : 'dark:text-primary text-primary opacity-90'
                }`}>
                  {section.title}
                </p>
              </div>
            )}
            <div className={collapsed ? "space-y-1.5 flex flex-col items-center" : "space-y-0.5"}>
              {section.items.map(renderNavItem)}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Actions - no harsh divider */}
      <div 
        className={`px-3 py-4 mt-auto space-y-2 ${
          collapsed ? "flex flex-col items-center" : ""
        }`}
        style={{
          borderTop: "1px solid rgba(139, 92, 246, 0.1)"
        }}
      >
        {/* Global Refresh */}
        {onGlobalRefresh && (
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "default"}
            onClick={handleGlobalRefresh}
            disabled={isRefreshing || cooldownRemaining > 0}
            className={`${
              collapsed ? "w-11 h-11" : "w-full justify-start h-11 gap-3"
            } rounded-xl dark:text-muted-foreground text-muted-foreground dark:hover:text-foreground hover:text-foreground dark:hover:bg-surface-hover hover:bg-muted/50 dark:hover:border-primary/20 hover:border-primary/10 border border-transparent transition-all duration-200 ${
              (isRefreshing || cooldownRemaining > 0) ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <RotateCw className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""} ${collapsed ? "" : "shrink-0"}`} />
            {!collapsed && <span className="flex-1 text-left">{t(language, "globalRefresh.tooltip")}</span>}
          </Button>
        )}

        {/* Collapse/Expand Toggle - Same style as Refresh button */}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          onClick={onToggleCollapse}
          className={`${
            collapsed ? "w-11 h-11" : "w-full justify-start h-11 gap-3"
          } rounded-xl dark:text-muted-foreground text-muted-foreground dark:hover:text-foreground hover:text-foreground dark:hover:bg-surface-hover hover:bg-muted/50 dark:hover:border-primary/20 hover:border-primary/10 border border-transparent transition-all duration-200`}
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <>
              <ChevronLeft className="h-5 w-5 shrink-0" />
              <span className="flex-1 text-left">{t(language, "nav.collapse")}</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}