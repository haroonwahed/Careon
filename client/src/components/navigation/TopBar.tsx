/**
 * TopBar - Elite Multi-Tenant Navigation
 * 
 * Structure (left → right):
 * [Role/Context] [Search] [Notifications] [Account]
 * 
 * Critical: Role switcher makes system feel like a platform
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Bell,
  ChevronDown,
  Building2,
  MapPin,
  Shield,
  User,
  Settings,
  LogOut,
  HelpCircle,
  Mail,
} from "lucide-react";
import { Input } from "../ui/input";
import { LOGOUT_URL, SPA_LANDING_URL } from "../../lib/routes";

type RoleType = "gemeente" | "zorgaanbieder" | "admin";

interface Context {
  id: string;
  type: RoleType;
  name: string;
  subtitle?: string;
}

interface TopBarProps {
  theme: "light" | "dark";
  onThemeToggle: () => void;
  currentContext: Context;
  availableContexts: Context[];
  onContextSwitch: (contextId: string) => void;
  /** When false, role is session-fixed (pilot); dropdown hidden. */
  showRoleSwitcher?: boolean;
  notificationCount?: number;
  onNotificationClick?: () => void;
  onSearch?: (query: string) => void;
  userName: string;
  userRole: string;
  userAvatar?: string;
  onProfileClick?: () => void;
  onSettingsClick?: () => void;
  onLogout?: () => void;
}

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function getDjangoUrl(path: string): string {
  const backendOrigin = import.meta.env.VITE_DJANGO_ORIGIN;

  if (backendOrigin) {
    return new URL(path, backendOrigin).toString();
  }

  return path;
}

function submitLogoutForm(): void {
  const form = document.createElement("form");
  form.method = "post";
  form.action = getDjangoUrl(LOGOUT_URL);
  form.style.display = "none";

  const csrfInput = document.createElement("input");
  csrfInput.type = "hidden";
  csrfInput.name = "csrfmiddlewaretoken";
  csrfInput.value = getCsrfToken();
  form.appendChild(csrfInput);

  const nextInput = document.createElement("input");
  nextInput.type = "hidden";
  nextInput.name = "next";
  nextInput.value = SPA_LANDING_URL;
  form.appendChild(nextInput);

  document.body.appendChild(form);
  form.submit();
}

export function TopBar({
  theme,
  onThemeToggle,
  currentContext,
  availableContexts,
  onContextSwitch,
  showRoleSwitcher = true,
  notificationCount = 0,
  onNotificationClick,
  onSearch,
  userName,
  userRole,
  userAvatar,
  onProfileClick,
  onSettingsClick,
  onLogout
}: TopBarProps) {
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const globalSearchShortcut = useMemo(() => {
    if (typeof navigator === "undefined") {
      return "⌘K";
    }
    return /Mac|iPhone|iPad|iPod/.test(navigator.platform ?? "") ? "⌘K" : "Ctrl+K";
  }, []);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onGlobalKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onGlobalKey);
    return () => window.removeEventListener("keydown", onGlobalKey);
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    onSearch?.(e.target.value);
  };

  const handleContextSwitch = (contextId: string) => {
    onContextSwitch(contextId);
  };

  const handleNotificationsToggle = () => {
    setNotificationsOpen((currentState) => !currentState);
    setAccountDropdownOpen(false);
    onNotificationClick?.();
  };

  const handleLogout = () => {
    onLogout?.();
    setAccountDropdownOpen(false);
    submitLogoutForm();
  };


  return (
    <header
      data-testid="care-top-bar"
      className="sticky top-0 flex items-center justify-between border-b border-border/60 bg-card/80 backdrop-blur-md"
      style={{
        zIndex: "var(--care-z-topbar)",
        height: "var(--care-topbar-height)",
        paddingLeft: "var(--care-page-h-padding)",
        paddingRight: "var(--care-page-h-padding)",
      }}
    >
      
      {/* CENTER: GLOBAL SEARCH */}
      <div className="flex-1 max-w-xl mx-8">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            size={18}
          />
          <Input
            ref={searchInputRef}
            type="search"
            placeholder="Zoek op casus, cliënt, aanbieder of document..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="bg-muted/20 pl-10 pr-[4.5rem] border-muted/30 focus:bg-muted/30"
            aria-keyshortcuts={globalSearchShortcut.includes("⌘") ? "Meta+K" : "Control+K"}
          />
          <span
            className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-border/50 bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground sm:inline-flex"
            aria-hidden
          >
            {globalSearchShortcut}
          </span>
        </div>
      </div>

      {/* RIGHT: ACTIONS */}
      <div className="flex items-center gap-3">
        {/* Help */}
        <button
          type="button"
          className="p-2 rounded-lg hover:bg-muted/30 transition-colors"
          aria-label="Help"
          title="Help"
        >
          <HelpCircle size={20} className="text-muted-foreground" />
        </button>

        {/* Notifications (Bell) */}
        <div className="relative">
          <button
            onClick={handleNotificationsToggle}
            className="relative p-2 rounded-lg hover:bg-muted/30 transition-colors"
            aria-label={`Notifications${notificationCount > 0 ? ` (${notificationCount})` : ""}`}
            aria-expanded={notificationsOpen ? "true" : "false"}
          >
            <Bell size={20} className="text-muted-foreground" />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-white shadow-sm shadow-primary/20">
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <>
              <div
                className="fixed inset-0" style={{ zIndex: "var(--care-z-topbar)" }}
                onClick={() => setNotificationsOpen(false)}
              />

              <div className="absolute top-full right-0 mt-2 w-96 rounded-xl border border-border/80 bg-popover px-2 py-2 text-popover-foreground shadow-2xl backdrop-blur-none z-50">
                <div className="px-3 py-3 border-b border-border mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-foreground">Meldingen</p>
                    <p className="text-xs text-muted-foreground">Recente activiteit en operationele alerts</p>
                  </div>
                  <span className="inline-flex min-w-6 h-6 px-2 items-center justify-center rounded-full bg-muted/35 text-foreground text-xs font-semibold">
                    {notificationCount}
                  </span>
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {notificationCount === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                      Geen nieuwe meldingen
                    </p>
                  ) : (
                    <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                      {notificationCount} melding{notificationCount !== 1 ? "en" : ""} — open het dossierpaneel voor details
                    </p>
                  )}
                </div>

                <div className="pt-2 mt-2 border-t border-border">
                  <button
                    onClick={() => setNotificationsOpen(false)}
                    className="w-full px-3 py-2 rounded-lg text-sm font-medium text-primary hover:bg-muted/35 transition-colors"
                  >
                    Sluit meldingen
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Mail with badge (hardcoded 7) */}
        <button
          type="button"
          className="relative p-2 rounded-lg hover:bg-muted/30 transition-colors"
          aria-label="Berichten"
          title="Berichten"
        >
          <Mail size={20} className="text-muted-foreground" />
        </button>

        {/* Divider */}
        <div className="w-px h-8 bg-border" />

        {/* Account */}
        <div className="relative">
          <button
            onClick={() => {
              setAccountDropdownOpen(!accountDropdownOpen);
              setNotificationsOpen(false);
            }}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/30 transition-colors"
          >
            {userAvatar ? (
              <img 
                src={userAvatar} 
                alt={userName}
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-muted/40 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">
                  {userName.split(" ").map(n => n[0]).join("").toUpperCase()}
                </span>
              </div>
            )}
            
            <div className="text-left hidden lg:block">
              <p className="text-sm font-semibold text-foreground">
                {userName}
              </p>
              <p className="text-xs text-muted-foreground">
                {userRole}
              </p>
            </div>

            <ChevronDown 
              size={14} 
              className={`text-muted-foreground hidden lg:block transition-transform ${
                accountDropdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Account Dropdown */}
          {accountDropdownOpen && (
            <>
              {/* Backdrop */}
              <div 
                className="fixed inset-0" style={{ zIndex: "var(--care-z-topbar)" }}
                onClick={() => setAccountDropdownOpen(false)}
              />
              
              {/* Dropdown */}
              <div className="absolute top-full right-0 mt-2 w-72 rounded-xl border border-border/80 bg-popover px-2 py-2 text-popover-foreground shadow-2xl backdrop-blur-none z-50">
                <div className="px-3 py-2 border-b border-border mb-2">
                  <p className="text-sm font-bold text-foreground">
                    {userName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {userRole}
                  </p>
                </div>

                {showRoleSwitcher && availableContexts.length > 1 && (
                  <div className="mb-2">
                    <p className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      Wissel van omgeving
                    </p>
                    {availableContexts.map((ctx) => {
                      const isActive = ctx.id === currentContext.id;
                      const Icon = ctx.type === "zorgaanbieder" ? Building2 : ctx.type === "gemeente" ? MapPin : Shield;
                      return (
                        <button
                          key={ctx.id}
                          onClick={() => {
                            handleContextSwitch(ctx.id);
                            setAccountDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                            isActive
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-muted/30 text-foreground"
                          }`}
                        >
                          <Icon size={15} className={isActive ? "text-primary" : "text-muted-foreground"} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{ctx.name}</p>
                            {ctx.subtitle && (
                              <p className="text-[11px] text-muted-foreground truncate">{ctx.subtitle}</p>
                            )}
                          </div>
                          {isActive && (
                            <span className="shrink-0 text-[10px] font-semibold text-primary">Actief</span>
                          )}
                        </button>
                      );
                    })}
                    <div className="h-px bg-border my-2" />
                  </div>
                )}

                <div className="space-y-1">
                  <button
                    onClick={() => {
                      onProfileClick?.();
                      setAccountDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/30 transition-colors text-left"
                  >
                    <User size={16} className="text-muted-foreground" />
                    <span className="text-sm text-foreground">Profiel</span>
                  </button>

                  <button
                    onClick={() => {
                      onSettingsClick?.();
                      setAccountDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/30 transition-colors text-left"
                  >
                    <Settings size={16} className="text-muted-foreground" />
                    <span className="text-sm text-foreground">Instellingen</span>
                  </button>

                  <div className="h-px bg-border my-1" />

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-500/10 transition-colors text-left"
                  >
                    <LogOut size={16} className="text-red-400" />
                    <span className="text-sm text-red-400">Uitloggen</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
