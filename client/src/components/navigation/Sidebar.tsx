/**
 * Sidebar Navigation — Carelane v1.3 (aanmelder-first orchestration).
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
} from "lucide-react";
import { CarelaneLogo } from "../logos/CarelaneLogo";
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
    id: "coordination",
    label: "DOORSTROOM",
    color: "purple",
    items: [
      {
        id: "coordination",
        label: "Regiekamer",
        icon: LayoutDashboard,
        href: SPA_DASHBOARD_URL,
        surfaceStatus: "ACTIVE_PRODUCT",
      },
      {
        id: "casussen",
        label: "Aanmeldingen",
        icon: FileText,
        href: "/casussen",
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
    id: "support",
    label: "ONDERSTEUNING",
    color: "muted",
    items: [
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
      },
    ]
  },
  {
    id: "support",
    label: "ONDERSTEUNING",
    color: "muted",
    items: [
      {
        id: "nieuwe-casus",
        label: "Nieuwe aanvraag",
        icon: Plus,
        href: "/casussen/nieuw",
        surfaceStatus: "ACTIVE_PRODUCT",
      },
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
    id: "coordination",
    label: "DOORSTROOM",
    color: "purple",
    items: [
      {
        id: "coordination",
        label: "Regiekamer",
        icon: LayoutDashboard,
        href: SPA_DASHBOARD_URL,
        surfaceStatus: "ACTIVE_PRODUCT",
      },
      {
        id: "casussen",
        label: "Aanmeldingen",
        icon: FileText,
        href: "/casussen",
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
    id: "support",
    label: "ONDERSTEUNING",
    color: "muted",
    items: [
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
  activeItemId = "coordination",
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
        h-screen bg-sidebar border-r border-border
        transition-all duration-300 ease-in-out
        flex flex-col
        ${collapsed ? "w-20" : "w-64"}
      `}
    >
      {/* LOGO / HEADER */}
      <div className={`flex h-16 border-b border-border/50 px-4 ${collapsed ? "flex-col items-center justify-center gap-1.5" : "items-center justify-between"}`}>
        <a
          href={SPA_DASHBOARD_URL}
          aria-label="Carelane home"
          className="flex items-center rounded-lg text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <CarelaneLogo
            variant={collapsed ? "mark" : "horizontal"}
            theme="adaptive"
            size={collapsed ? "sm" : "md"}
            ariaLabel=""
          />
        </a>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`rounded-lg border border-border/60 bg-background/35 text-muted-foreground transition-colors hover:bg-muted/20 hover:text-foreground ${collapsed ? "p-1" : "p-2"}`}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* NAVIGATION */}
      <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Hoofdnavigatie">
        {navigationStructure.map((section, sectionIndex) => (
          <div 
            key={section.id}
            style={{
              marginTop: sectionIndex === 0 ? 0 : collapsed ? 20 : 24
            }}
          >
            {/* Section Label */}
            {!collapsed && (
              <div className="mb-2 px-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
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
                      rounded-xl border px-3 py-2.5
                      transition-colors duration-200
                      ${collapsed ? "justify-center" : ""}
                      ${isActive
                        ? "border-primary/[0.34] bg-primary/[0.14] text-foreground"
                        : "border-transparent text-muted-foreground hover:border-border/55 hover:bg-foreground/[0.05] hover:text-foreground"
                      }
                    `}
                    title={collapsed ? item.label : undefined}
                  >
                    {/* Icon */}
                    <Icon 
                      size={20} 
                      className={`
                        flex-shrink-0 transition-colors
                        ${isActive ? "text-primary" : "text-muted-foreground/80"}
                      `}
                    />

                    {/* Label */}
                    {!collapsed && (
                      <span className="flex flex-1 items-center gap-2 text-left text-sm font-medium">
                        <span className={isActive ? "text-foreground" : ""}>
                          {item.label}
                        </span>
                      </span>
                    )}

                    {/* Badge */}
                    {!collapsed && badgeValue !== undefined && (
                      <span className={`
                        min-w-6 rounded-full border px-2 py-0.5 text-center text-xs font-semibold
                        ${isActive
                          ? "border-primary/[0.34] bg-primary/[0.14] text-primary"
                          : "border-border/60 bg-foreground/[0.06] text-foreground/70"
                        }
                      `}>
                        {badgeValue}
                      </span>
                    )}

                    {/* Badge (collapsed) */}
                    {collapsed && badgeValue !== undefined && (
                      <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-border/60 bg-background/85 px-1 text-[10px] font-semibold text-foreground">
                        {badgeValue}
                      </span>
                    )}

                    {/* Tooltip (collapsed) */}
                    {collapsed && (
                        <div className="
                        absolute left-full ml-2 px-3 py-2 rounded-lg
                        bg-card/95 border border-border/70 shadow-xl backdrop-blur-[2px]
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
            <div className="mb-2 px-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">
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
              rounded-xl border px-3 py-2.5
              transition-colors duration-200
              ${collapsed ? "justify-center" : ""}
              ${activeItemId === gemeenteBottomSignalItem.id
                ? "border-primary/[0.34] bg-primary/[0.14] text-foreground"
                : "border-transparent text-muted-foreground hover:border-border/55 hover:bg-foreground/[0.05] hover:text-foreground"
              }
            `}
            title={collapsed ? gemeenteBottomSignalItem.label : undefined}
          >
            <SignalIcon
              size={20}
              className={activeItemId === gemeenteBottomSignalItem.id ? "text-primary" : "text-muted-foreground/80"}
            />
            {!collapsed && (
              <span className="flex flex-1 items-center gap-2 text-left text-sm font-medium">
                <span className={activeItemId === gemeenteBottomSignalItem.id ? "text-foreground" : ""}>
                  {gemeenteBottomSignalItem.label}
                </span>
              </span>
            )}
            {!collapsed && (badgeOverrides[gemeenteBottomSignalItem.id] ?? gemeenteBottomSignalItem.badge) !== undefined && (
              <span className={`
                min-w-6 rounded-full border px-2 py-0.5 text-center text-xs font-semibold
                ${activeItemId === gemeenteBottomSignalItem.id
                  ? "border-primary/[0.34] bg-primary/[0.14] text-primary"
                  : "border-border/60 bg-foreground/[0.06] text-foreground/70"
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
      <div className="border-t border-border/50 p-3">
        <div className={`
          flex items-center gap-3 rounded-xl border border-transparent p-2 transition-colors hover:border-border/55 hover:bg-foreground/[0.05]
          ${collapsed ? "justify-center" : ""}
        `}>
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-border/50 bg-background/35">
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
