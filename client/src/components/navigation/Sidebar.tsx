/**
 * Sidebar Navigation - Elite Design with Role-Based Access
 * 
 * Role-based navigation:
 * 🟣 Gemeente - Full access (primary user)
 * 🔵 Zorgaanbieder - Limited to intake, their cases, documents
 * 🟡 Admin - Full access + user management
 */

import { useState } from "react";
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
  Users,
  FileCheck,
  MapPinned,
  CheckCircle
} from "lucide-react";

type RoleType = "gemeente" | "zorgaanbieder" | "admin";

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badge?: number;
  href?: string;
}

interface NavSection {
  id: string;
  label: string;
  color: string;
  items: NavItem[];
}

// GEMEENTE - Full access (primary user)
const gemeenteNavigation: NavSection[] = [
  {
    id: "regie",
    label: "REGIE",
    color: "purple",
    items: [
      {
        id: "regiekamer",
        label: "Regiekamer",
        icon: LayoutDashboard,
        href: "/regiekamer"
      },
      {
        id: "casussen",
        label: "Casussen",
        icon: FileText,
        href: "/casussen"
      },
      {
        id: "beoordelingen",
        label: "Beoordelingen",
        icon: FileCheck,
        href: "/beoordelingen"
      },
      {
        id: "matching",
        label: "Matching",
        icon: MapPinned,
        href: "/matching"
      },
      {
        id: "plaatsingen",
        label: "Plaatsingen",
        icon: CheckCircle,
        href: "/plaatsingen"
      },
      {
        id: "acties",
        label: "Acties",
        icon: CheckSquare,
        badge: 12,
        href: "/acties"
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
        href: "/zorgaanbieders"
      },
      {
        id: "gemeenten",
        label: "Gemeenten",
        icon: MapPin,
        href: "/gemeenten"
      },
      {
        id: "regios",
        label: "Regio's",
        icon: Map,
        href: "/regios"
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
        badge: 5,
        href: "/signalen"
      },
      {
        id: "rapportages",
        label: "Rapportages",
        icon: BarChart3,
        href: "/rapportages"
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
        href: "/documenten"
      },
      {
        id: "audittrail",
        label: "Audittrail",
        icon: History,
        href: "/audittrail"
      },
      {
        id: "instellingen",
        label: "Instellingen",
        icon: Settings,
        href: "/instellingen"
      }
    ]
  }
];

// ZORGAANBIEDER - Limited access (receive work)
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
        badge: 3,
        href: "/intake"
      },
      {
        id: "mijn-casussen",
        label: "Mijn casussen",
        icon: FileText,
        href: "/mijn-casussen"
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
        href: "/documenten"
      }
    ]
  }
];

// ADMIN - Full access + extras
const adminNavigation: NavSection[] = [
  {
    id: "regie",
    label: "REGIE",
    color: "purple",
    items: [
      {
        id: "regiekamer",
        label: "Regiekamer",
        icon: LayoutDashboard,
        href: "/regiekamer"
      },
      {
        id: "casussen",
        label: "Casussen",
        icon: FileText,
        href: "/casussen"
      },
      {
        id: "acties",
        label: "Acties",
        icon: CheckSquare,
        badge: 12,
        href: "/acties"
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
        href: "/zorgaanbieders"
      },
      {
        id: "gemeenten",
        label: "Gemeenten",
        icon: MapPin,
        href: "/gemeenten"
      },
      {
        id: "regios",
        label: "Regio's",
        icon: Map,
        href: "/regios"
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
        badge: 5,
        href: "/signalen"
      },
      {
        id: "rapportages",
        label: "Rapportages",
        icon: BarChart3,
        href: "/rapportages"
      }
    ]
  },
  {
    id: "beheer",
    label: "BEHEER",
    color: "red",
    items: [
      {
        id: "gebruikers",
        label: "Gebruikers",
        icon: Users,
        href: "/gebruikers"
      },
      {
        id: "audittrail",
        label: "Audittrail",
        icon: History,
        href: "/audittrail"
      },
      {
        id: "instellingen",
        label: "Instellingen",
        icon: Settings,
        href: "/instellingen"
      }
    ]
  }
];

function getNavigationForRole(role: RoleType): NavSection[] {
  switch (role) {
    case "gemeente":
      return gemeenteNavigation;
    case "zorgaanbieder":
      return zorgaanbiederNavigation;
    case "admin":
      return adminNavigation;
  }
}

interface SidebarProps {
  role: RoleType;
  activeItemId?: string;
  onNavigate?: (itemId: string, href: string) => void;
}

export function Sidebar({ role, activeItemId = "regiekamer", onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  
  const navigationStructure = getNavigationForRole(role);

  return (
    <aside 
      className={`
        h-screen bg-card border-r border-border
        transition-all duration-300 ease-in-out
        flex flex-col
        ${collapsed ? "w-20" : "w-64"}
      `}
    >
      {/* LOGO / HEADER */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-border">
        {!collapsed && (
          <div>
            <h1 className="text-lg font-bold text-foreground">Careon</h1>
            <p className="text-xs text-muted-foreground">Zorgregie</p>
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
      <nav className="flex-1 overflow-y-auto py-6 px-3">
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

                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate?.(item.id, item.href || "#")}
                    className={`
                      w-full group relative
                      flex items-center gap-3
                      px-3 py-2.5 rounded-lg
                      transition-all duration-200
                      ${collapsed ? "justify-center" : ""}
                      ${isActive
                        ? "bg-primary-light text-primary shadow-sm border border-transparent"
                        : "text-muted-foreground hover:bg-bg-subtle hover:text-foreground"
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
                      <span className={`
                        flex-1 text-left text-sm font-medium
                        ${isActive ? "text-primary" : ""}
                      `}>
                        {item.label}
                      </span>
                    )}

                    {/* Badge */}
                    {!collapsed && item.badge !== undefined && (
                      <span className={`
                        px-2 py-0.5 rounded-full text-xs font-bold
                        ${isActive 
                          ? "bg-primary text-white" 
                          : "careon-badge-red"
                        }
                      `}>
                        {item.badge}
                      </span>
                    )}

                    {/* Badge (collapsed) */}
                    {collapsed && item.badge !== undefined && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-base rounded-full flex items-center justify-center text-xs font-bold text-white">
                        {item.badge}
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
                        {item.badge !== undefined && (
                          <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold careon-badge-red">
                            {item.badge}
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

      {/* FOOTER (Optional - User Profile) */}
      <div className="p-3 border-t border-border">
        <div className={`
          flex items-center gap-3 p-2 rounded-lg
          hover:bg-muted/30 transition-colors cursor-pointer
          ${collapsed ? "justify-center" : ""}
        `}>
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-primary">JD</span>
          </div>
          
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                Jane Doe
              </p>
              <p className="text-xs text-muted-foreground truncate">
                Regisseur
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}