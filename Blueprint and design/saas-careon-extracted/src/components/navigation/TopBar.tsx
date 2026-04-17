/**
 * TopBar - Elite Multi-Tenant Navigation
 * 
 * Structure (left → right):
 * [Role/Context] [Search] [Notifications] [Account]
 * 
 * Critical: Role switcher makes system feel like a platform
 */

import { useState } from "react";
import { 
  Search,
  Bell,
  ChevronDown,
  Building2,
  MapPin,
  Shield,
  User,
  Settings,
  LogOut
} from "lucide-react";
import { Input } from "../ui/input";

type RoleType = "gemeente" | "zorgaanbieder" | "admin";

interface Context {
  id: string;
  type: RoleType;
  name: string;
  subtitle?: string;
}

interface TopBarProps {
  currentContext: Context;
  availableContexts: Context[];
  onContextSwitch: (contextId: string) => void;
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

export function TopBar({
  currentContext,
  availableContexts,
  onContextSwitch,
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
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    onSearch?.(e.target.value);
  };

  const handleContextSwitch = (contextId: string) => {
    onContextSwitch(contextId);
    setRoleDropdownOpen(false);
  };

  const getRoleIcon = (type: RoleType) => {
    switch (type) {
      case "gemeente":
        return MapPin;
      case "zorgaanbieder":
        return Building2;
      case "admin":
        return Shield;
    }
  };

  const getRoleLabel = (type: RoleType) => {
    switch (type) {
      case "gemeente":
        return "Gemeente";
      case "zorgaanbieder":
        return "Zorgaanbieder";
      case "admin":
        return "Admin";
    }
  };

  const RoleIcon = getRoleIcon(currentContext.type);

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-40">
      
      {/* LEFT: ROLE/CONTEXT SWITCHER */}
      <div className="flex-shrink-0">
        <div className="relative">
          <button
            onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
            className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-muted/30 transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
              <RoleIcon size={16} className="text-primary" />
            </div>
            
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {getRoleLabel(currentContext.type)}
                </span>
                {availableContexts.length > 1 && (
                  <ChevronDown 
                    size={14} 
                    className={`text-muted-foreground transition-transform ${
                      roleDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                )}
              </div>
              <p className="text-sm font-bold text-foreground">
                {currentContext.name}
              </p>
            </div>
          </button>

          {/* Role Dropdown */}
          {roleDropdownOpen && availableContexts.length > 1 && (
            <>
              {/* Backdrop */}
              <div 
                className="fixed inset-0 z-40"
                onClick={() => setRoleDropdownOpen(false)}
              />
              
              {/* Dropdown */}
              <div className="absolute top-full left-0 mt-2 w-72 premium-card p-2 shadow-xl z-50">
                <div className="space-y-1">
                  {availableContexts.map((context) => {
                    const Icon = getRoleIcon(context.type);
                    const isActive = context.id === currentContext.id;
                    
                    return (
                      <button
                        key={context.id}
                        onClick={() => handleContextSwitch(context.id)}
                        className={`
                          w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                          transition-all text-left
                          ${isActive
                            ? "bg-primary/10 border border-primary/20"
                            : "hover:bg-muted/30"
                          }
                        `}
                      >
                        <div className={`
                          w-8 h-8 rounded-lg flex items-center justify-center border
                          ${isActive
                            ? "bg-primary/10 border-primary/20"
                            : "bg-muted/20 border-border"
                          }
                        `}>
                          <Icon 
                            size={16} 
                            className={isActive ? "text-primary" : "text-muted-foreground"}
                          />
                        </div>
                        
                        <div className="flex-1">
                          <p className={`text-xs font-semibold uppercase tracking-wide ${
                            isActive ? "text-primary" : "text-muted-foreground"
                          }`}>
                            {getRoleLabel(context.type)}
                          </p>
                          <p className={`text-sm font-bold ${
                            isActive ? "text-primary" : "text-foreground"
                          }`}>
                            {context.name}
                          </p>
                          {context.subtitle && (
                            <p className="text-xs text-muted-foreground">
                              {context.subtitle}
                            </p>
                          )}
                        </div>

                        {isActive && (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* CENTER: GLOBAL SEARCH */}
      <div className="flex-1 max-w-xl mx-8">
        <div className="relative">
          <Search 
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" 
            size={18} 
          />
          <Input
            type="search"
            placeholder="Zoek casussen, cliënten, aanbieders..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="pl-10 bg-muted/20 border-muted/30 focus:bg-muted/30"
          />
        </div>
      </div>

      {/* RIGHT: ACTIONS */}
      <div className="flex items-center gap-3">
        
        {/* Notifications */}
        <button
          onClick={onNotificationClick}
          className="relative p-2 rounded-lg hover:bg-muted/30 transition-colors"
          aria-label={`Notifications${notificationCount > 0 ? ` (${notificationCount})` : ""}`}
        >
          <Bell size={20} className="text-muted-foreground" />
          {notificationCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          )}
        </button>

        {/* Divider */}
        <div className="w-px h-8 bg-border" />

        {/* Account */}
        <div className="relative">
          <button
            onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/30 transition-colors"
          >
            {userAvatar ? (
              <img 
                src={userAvatar} 
                alt={userName}
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
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
                className="fixed inset-0 z-40"
                onClick={() => setAccountDropdownOpen(false)}
              />
              
              {/* Dropdown */}
              <div className="absolute top-full right-0 mt-2 w-56 premium-card p-2 shadow-xl z-50">
                <div className="px-3 py-2 border-b border-border mb-2">
                  <p className="text-sm font-bold text-foreground">
                    {userName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {userRole}
                  </p>
                </div>

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
                    onClick={() => {
                      onLogout?.();
                      setAccountDropdownOpen(false);
                    }}
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
