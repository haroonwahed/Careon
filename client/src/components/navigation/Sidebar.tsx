/**
 * Sidebar Navigation — CareOn v1.3 (aanmelder-first orchestration).
 *
 * Role-based navigation:
 * 🟣 Aanmelder-keten (often gemeente account) — doorstroom & validatie
 * 🔵 Zorgaanbieder — reacties, intake, eigen aanvragen
 * 🟡 Admin — volledige keten + sturing
 */

import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  FileText,
  CheckSquare,
  Building2,
  MapPin,
  Map,
  AlertTriangle,
  BarChart3,
  FolderOpen,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Plus,
  Users,
  FileCheck,
  MapPinned,
  CheckCircle,
  Shield,
} from "lucide-react";
import { CARE_PATHS, SPA_DASHBOARD_URL } from "../../lib/routes";

type RoleType = "gemeente" | "zorgaanbieder" | "admin";
type SurfaceStatus =
  | "ACTIVE_PRODUCT"
  | "SUPPORTING_INTERNAL"
  | "DEMO_ONLY"
  | "LEGACY"
  | "DUPLICATE"
  | "UNKNOWN";

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badge?: number;
  href?: string;
  surfaceStatus?: SurfaceStatus;
}

interface NavSection {
  id: string;
  label: string;
  color: string;
  items: NavItem[];
}

// Aanmelder-keten (volledige doorstroom)
const gemeenteNavigation: NavSection[] = [
  {
    id: "regie",
    label: "DOORSTROOM",
    color: "purple",
    items: [
      {
        id: "regiekamer",
        label: "Coördinatie",
        icon: LayoutDashboard,
        href: SPA_DASHBOARD_URL,
        surfaceStatus: "ACTIVE_PRODUCT",
      },
      {
        id: "casussen",
        label: "Aanvragen",
        icon: FileText,
        href: "/casussen",
        surfaceStatus: "ACTIVE_PRODUCT",
      },
      {
        id: "acties",
        label: "Acties",
        icon: CheckSquare,
        href: "/acties",
        surfaceStatus: "ACTIVE_PRODUCT",
      }
    ]
  },
  {
    id: "flow-status",
    label: "CAPACITEIT",
    color: "amber",
    items: [
      {
        id: "matching",
        label: "Matching",
        icon: MapPinned,
        href: "/matching",
        surfaceStatus: "ACTIVE_PRODUCT",
      },
      {
        id: "beoordelingen",
        label: "Reacties",
        icon: FileCheck,
        href: "/beoordelingen",
        surfaceStatus: "ACTIVE_PRODUCT",
      },
      {
        id: "plaatsingen",
        label: "Plaatsingen",
        icon: CheckCircle,
        href: "/plaatsingen",
        surfaceStatus: "ACTIVE_PRODUCT",
      },
    ]
  },
  {
    id: "netwerk",
    label: "NETWERK",
    color: "blue",
    items: [
      {
        id: "zorgaanbieders",
        label: "Zorgaanbieders",
        icon: Building2,
        href: "/zorgaanbieders",
        surfaceStatus: "ACTIVE_PRODUCT",
      },
      {
        id: "gemeenten",
        label: "Gemeenten",
        icon: MapPin,
        href: "/gemeenten",
        surfaceStatus: "ACTIVE_PRODUCT",
      },
      {
        id: "regios",
        label: "Regio's",
        icon: Map,
        href: "/regios",
        surfaceStatus: "ACTIVE_PRODUCT",
      }
    ]
  },
  {
    id: "beheer",
    label: "BEHEER",
    color: "muted",
    items: [
      {
        id: "documenten",
        label: "Documenten",
        icon: FolderOpen,
        href: "/documenten",
        surfaceStatus: "SUPPORTING_INTERNAL",
      },
      {
        id: "audittrail",
        label: "Audittrail",
        icon: History,
        href: "/audittrail",
        surfaceStatus: "SUPPORTING_INTERNAL",
      },
      {
        id: "instellingen",
        label: "Instellingen",
        icon: Settings,
        href: CARE_PATHS.SETTINGS,
        surfaceStatus: "SUPPORTING_INTERNAL",
      },
    ]
  }
];

// Zorgaanbieder — lichte reactie- en overdrachtsstromen
const zorgaanbiederNavigation: NavSection[] = [
  {
    id: "werk",
    label: "WERK",
    color: "purple",
    items: [
      {
        id: "intake",
        label: "Intake",
        icon: ClipboardList,
        href: "/intake",
        surfaceStatus: "ACTIVE_PRODUCT",
      },
      {
        id: "nieuwe-casus",
        label: "Nieuwe aanvraag",
        icon: Plus,
        href: "/casussen/nieuw",
        surfaceStatus: "ACTIVE_PRODUCT",
      },
      {
        id: "beoordelingen",
        label: "Reacties",
        icon: FileCheck,
        href: "/beoordelingen",
        surfaceStatus: "ACTIVE_PRODUCT",
      },
      {
        id: "mijn-casussen",
        label: "Mijn aanvragen",
        icon: FileText,
        href: "/mijn-casussen",
        surfaceStatus: "ACTIVE_PRODUCT",
      }
    ]
  },
  {
    id: "instellingen",
    label: "INSTELLINGEN",
    color: "muted",
    items: [
      {
        id: "documenten",
        label: "Documenten",
        icon: FolderOpen,
        href: "/documenten",
        surfaceStatus: "SUPPORTING_INTERNAL",
      }
    ]
  }
];

// ADMIN — same keten + netwerk coverage as gemeente, plus gebruikers (shell parity with ADMIN_PAGES).
const adminNavigation: NavSection[] = [
  {
    id: "regie",
    label: "DOORSTROOM",
    color: "purple",
    items: [
      {
        id: "regiekamer",
        label: "Coördinatie",
        icon: LayoutDashboard,
        href: SPA_DASHBOARD_URL,
        surfaceStatus: "ACTIVE_PRODUCT",
      },
      {
        id: "casussen",
        label: "Aanvragen",
        icon: FileText,
        href: "/casussen",
        surfaceStatus: "ACTIVE_PRODUCT",
      },
      {
        id: "acties",
        label: "Acties",
        icon: CheckSquare,
        href: "/acties",
        surfaceStatus: "ACTIVE_PRODUCT",
      }
    ]
  },
  {
    id: "flow-status",
    label: "CAPACITEIT",
    color: "amber",
    items: [
      {
        id: "matching",
        label: "Matching",
        icon: MapPinned,
        href: "/matching",
        surfaceStatus: "ACTIVE_PRODUCT",
      },
      {
        id: "beoordelingen",
        label: "Reacties",
        icon: FileCheck,
        href: "/beoordelingen",
        surfaceStatus: "ACTIVE_PRODUCT",
      },
      {
        id: "plaatsingen",
        label: "Plaatsingen",
        icon: CheckCircle,
        href: "/plaatsingen",
        surfaceStatus: "ACTIVE_PRODUCT",
      },
    ]
  },
  {
    id: "netwerk",
    label: "NETWERK",
    color: "blue",
    items: [
      {
        id: "zorgaanbieders",
        label: "Zorgaanbieders",
        icon: Building2,
        href: "/zorgaanbieders",
        surfaceStatus: "ACTIVE_PRODUCT",
      },
      {
        id: "gemeenten",
        label: "Gemeenten",
        icon: MapPin,
        href: "/gemeenten",
        surfaceStatus: "ACTIVE_PRODUCT",
      },
      {
        id: "regios",
        label: "Regio's",
        icon: Map,
        href: "/regios",
        surfaceStatus: "ACTIVE_PRODUCT",
      }
    ]
  },
  {
    id: "sturing",
    label: "STURING",
    color: "amber",
    items: [
      {
        id: "signalen",
        label: "Signalen",
        icon: AlertTriangle,
        href: "/signalen",
        surfaceStatus: "ACTIVE_PRODUCT",
      },
      {
        id: "rapportages",
        label: "Rapportages",
        icon: BarChart3,
        href: "/rapportages",
        surfaceStatus: "SUPPORTING_INTERNAL",
      }
    ]
  },
  {
    id: "beheer",
    label: "BEHEER",
    color: "muted",
    items: [
      {
        id: "documenten",
        label: "Documenten",
        icon: FolderOpen,
        href: "/documenten",
        surfaceStatus: "SUPPORTING_INTERNAL",
      },
      {
        id: "gebruikers",
        label: "Gebruikers",
        icon: Users,
        href: "/gebruikers",
        surfaceStatus: "SUPPORTING_INTERNAL",
      },
      {
        id: "audittrail",
        label: "Audittrail",
        icon: History,
        href: "/audittrail",
        surfaceStatus: "SUPPORTING_INTERNAL",
      },
      {
        id: "instellingen",
        label: "Instellingen",
        icon: Settings,
        href: CARE_PATHS.SETTINGS,
        surfaceStatus: "SUPPORTING_INTERNAL",
      }
    ]
  }
];

const visibleSurfaceStatuses: SurfaceStatus[] = ["ACTIVE_PRODUCT", "SUPPORTING_INTERNAL"];

function getNavigationForRole(role: RoleType): NavSection[] {
  const sections = (() => {
    switch (role) {
      case "gemeente":
        return gemeenteNavigation;
      case "zorgaanbieder":
        return zorgaanbiederNavigation;
      case "admin":
        return adminNavigation;
    }
  })();

  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => visibleSurfaceStatuses.includes(item.surfaceStatus ?? "UNKNOWN")),
    }))
    .filter((section) => section.items.length > 0);
}

interface SidebarProps {
  role: RoleType;
  activeItemId?: string;
  onNavigate?: (itemId: string, href: string) => void;
  badgeOverrides?: Partial<Record<string, number>>;
  /** Session user (avoid hardcoded demo labels in footer). */
  profileDisplayName?: string;
  profileSubtitle?: string;
  profileInitials?: string;
}

export function Sidebar({
  role,
  activeItemId = "regiekamer",
  onNavigate,
  badgeOverrides = {},
  profileDisplayName = "Gebruiker",
  profileSubtitle = "",
  profileInitials = "?",
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const asideRef = useRef<HTMLElement>(null);

  /** Keep the active route visible: nav scroll position persists across page changes, so DOORSTROOM can sit above the fold while the user is on Coördinatie. */
  useEffect(() => {
    const root = asideRef.current;
    if (!root) {
      return;
    }
    const active = root.querySelector<HTMLElement>(`[data-sidebar-item-id="${activeItemId}"]`);
    active?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeItemId]);

  const navigationStructure = getNavigationForRole(role);
  const gemeenteBottomSignalItem: NavItem | null = role === "gemeente"
    ? {
        id: "signalen",
        label: "Signalen",
        icon: AlertTriangle,
        href: "/signalen",
        surfaceStatus: "ACTIVE_PRODUCT",
      }
    : null;

  return (
    <aside
      ref={asideRef}
      data-testid="care-sidebar"
      className={`
        h-screen bg-card border-r border-border
        transition-all duration-300 ease-in-out
        flex flex-col
        ${collapsed ? "w-20" : "w-64"}
      `}
    >
      {/* LOGO / HEADER */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/80 bg-muted/30 text-foreground">
              <Shield size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">CareOn</h1>
              <p className="text-xs text-muted-foreground">Zorg OS</p>
            </div>
          </div>
        )}
        
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-lg hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* NAVIGATION */}
      <nav className="flex-1 overflow-y-auto py-6 px-3" aria-label="Hoofdnavigatie">
        {navigationStructure.map((section, sectionIndex) => (
          <div 
            key={section.id}
            style={{
              marginTop: sectionIndex === 0 ? 0 : collapsed ? 24 : 28
            }}
          >
            {/* Section Label */}
            {!collapsed && (
              <div className="px-3 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {section.label}
                </span>
              </div>
            )}

            {/* Section Items */}
            <div className="space-y-2">
              {section.items.map((item) => {
                const isActive = activeItemId === item.id;
                const Icon = item.icon;
                const badgeValue = badgeOverrides[item.id] ?? item.badge;
                const isSupportingInternal = item.surfaceStatus === "SUPPORTING_INTERNAL";

                return (
                  <button
                    key={item.id}
                    type="button"
                    data-sidebar-item-id={item.id}
                    onClick={() => onNavigate?.(item.id, item.href || "#")}
                    className={`
                      w-full group relative
                      flex items-center gap-3
                      px-3 py-2.5 rounded-lg
                      transition-all duration-200
                      ${collapsed ? "justify-center" : ""}
                      ${isActive
                        ? "bg-primary/10 text-primary border border-primary/20 shadow-none"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground border border-transparent"
                      }
                    `}
                    title={collapsed ? item.label : undefined}
                  >
                    {/* Icon */}
                    <Icon 
                      size={20} 
                      className={`
                        flex-shrink-0 transition-colors
                        ${isActive ? "text-primary" : ""}
                      `}
                    />

                    {/* Label */}
                    {!collapsed && (
                      <span className="flex flex-1 items-center gap-2 text-left text-sm font-medium">
                        <span className={isActive ? "text-primary" : ""}>
                          {item.label}
                        </span>
                      </span>
                    )}

                    {/* Badge */}
                    {!collapsed && badgeValue !== undefined && (
                      <span className={`
                        min-w-6 px-2 py-0.5 rounded-full text-xs font-semibold text-center border
                        ${isActive 
                          ? "bg-primary text-white" 
                          : "bg-muted/40 text-foreground/70 border-border"
                        }
                      `}>
                        {badgeValue}
                      </span>
                    )}

                    {/* Badge (collapsed) */}
                    {collapsed && badgeValue !== undefined && (
                      <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-muted text-foreground border border-border rounded-full flex items-center justify-center text-[10px] font-semibold">
                        {badgeValue}
                      </span>
                    )}

                    {/* Tooltip (collapsed) */}
                    {collapsed && (
                      <div className="
                        absolute left-full ml-2 px-3 py-2 rounded-lg
                        bg-card border border-border shadow-lg
                        opacity-0 invisible group-hover:opacity-100 group-hover:visible
                        transition-all duration-200 pointer-events-none
                        whitespace-nowrap z-50
                      ">
                        <span className="text-sm font-medium text-foreground">
                          {item.label}
                        </span>
                        {badgeValue !== undefined && (
                          <span className="ml-2 min-w-6 px-2 py-0.5 rounded-full text-xs font-semibold text-center border bg-muted/40 text-foreground/70 border-border">
                            {badgeValue}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {gemeenteBottomSignalItem && (
        <div className="px-3 pb-2">
          {(() => {
            const SignalIcon = gemeenteBottomSignalItem.icon;
            return (
              <>
          {!collapsed && (
            <div className="px-3 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                STURING
              </span>
            </div>
          )}
          <button
            type="button"
            data-sidebar-item-id={gemeenteBottomSignalItem.id}
            onClick={() => onNavigate?.(gemeenteBottomSignalItem.id, gemeenteBottomSignalItem.href || "#")}
            className={`
              w-full group relative
              flex items-center gap-3
              px-3 py-2.5 rounded-lg
              transition-all duration-200
              ${collapsed ? "justify-center" : ""}
              ${activeItemId === gemeenteBottomSignalItem.id
                ? "bg-primary-light text-primary shadow-sm border border-transparent"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              }
            `}
            title={collapsed ? gemeenteBottomSignalItem.label : undefined}
          >
            <SignalIcon size={20} className={activeItemId === gemeenteBottomSignalItem.id ? "text-primary" : ""} />
            {!collapsed && (
              <span className="flex flex-1 items-center gap-2 text-left text-sm font-medium">
                <span className={activeItemId === gemeenteBottomSignalItem.id ? "text-primary" : ""}>
                  {gemeenteBottomSignalItem.label}
                </span>
              </span>
            )}
            {!collapsed && (badgeOverrides[gemeenteBottomSignalItem.id] ?? gemeenteBottomSignalItem.badge) !== undefined && (
              <span className={`
                min-w-6 px-2 py-0.5 rounded-full text-xs font-semibold text-center border
                ${activeItemId === gemeenteBottomSignalItem.id
                  ? "bg-primary text-white"
                  : "bg-muted/40 text-foreground/70 border-border"
                }
              `}>
                {badgeOverrides[gemeenteBottomSignalItem.id] ?? gemeenteBottomSignalItem.badge}
              </span>
            )}
          </button>
              </>
            );
          })()}
        </div>
      )}

      {/* FOOTER (Optional - User Profile) */}
      <div className="p-3 border-t border-border">
        <div className={`
          flex items-center gap-3 p-2 rounded-lg
          hover:bg-muted/30 transition-colors cursor-pointer
          ${collapsed ? "justify-center" : ""}
        `}>
          <div className="w-8 h-8 rounded-full bg-muted/40 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-foreground">{profileInitials}</span>
          </div>
          
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {profileDisplayName}
              </p>
              {profileSubtitle ? (
                <p className="text-xs text-muted-foreground truncate">
                  {profileSubtitle}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
