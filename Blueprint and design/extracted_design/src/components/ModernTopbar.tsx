import { Settings, Globe, Moon, Sun, User, LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Language, t } from "../lib/i18n";
import { ProfileModal } from "./ProfileModal";

interface ModernTopbarProps {
  theme: "light" | "dark";
  language: Language;
  onThemeChange: (theme: "light" | "dark") => void;
  onLanguageChange: (language: Language) => void;
  onNavigateToSettings?: () => void;
  onNavigateToSubscription?: () => void;
  sidebarCollapsed: boolean;
}

export function ModernTopbar({ 
  theme, 
  language, 
  onThemeChange, 
  onLanguageChange,
  onNavigateToSettings,
  onNavigateToSubscription,
  sidebarCollapsed
}: ModernTopbarProps) {
  const [showProfileModal, setShowProfileModal] = useState(false);

  return (
    <>
      <div 
        className={`fixed top-0 right-0 h-16 z-30 transition-all duration-300 border-b border-border backdrop-blur-xl ${
          sidebarCollapsed ? "left-[72px]" : "left-[240px]"
        } dark:bg-gradient-to-r dark:from-[#12121C]/95 dark:to-[#0E0E18]/90 bg-gradient-to-r from-white/95 to-[#fafafa]/90`}
        style={{
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)"
        }}
      >
        <div className="h-full px-6 flex items-center justify-between gap-6">
          {/* Left: Logo */}
          <div className="flex items-center gap-3">
            <div 
              className="flex items-center justify-center w-9 h-9 rounded-xl text-white font-bold text-base shadow-lg"
              style={{
                background: "linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)",
                boxShadow: "0 0 15px rgba(139, 92, 246, 0.4)"
              }}
            >
              V
            </div>
            <span className="text-base font-semibold dark:text-foreground text-foreground">Vintsy</span>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* Language Toggle */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-10 w-10 rounded-xl dark:hover:bg-surface-hover hover:bg-muted/50"
                >
                  <Globe className="h-5 w-5 dark:text-muted-foreground text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                className="w-48 dark:bg-popover bg-popover dark:border-border border-border rounded-xl"
              >
                <DropdownMenuLabel className="dark:text-foreground text-foreground">
                  {t(language, "topbar.language")}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="dark:bg-border bg-border" />
                <DropdownMenuItem 
                  onClick={() => onLanguageChange("en")}
                  className={`rounded-lg ${language === "en" ? "dark:bg-primary/15 bg-primary/10 dark:text-primary text-primary" : ""}`}
                >
                  English (GB)
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onLanguageChange("fr")}
                  className={`rounded-lg ${language === "fr" ? "dark:bg-primary/15 bg-primary/10 dark:text-primary text-primary" : ""}`}
                >
                  Français (FR)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Theme Toggle */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onThemeChange(theme === "dark" ? "light" : "dark")}
              className="h-10 w-10 rounded-xl dark:hover:bg-surface-hover hover:bg-muted/50"
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5 dark:text-muted-foreground text-muted-foreground" />
              ) : (
                <Moon className="h-5 w-5 dark:text-muted-foreground text-muted-foreground" />
              )}
            </Button>

            {/* Settings Quick Access */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onNavigateToSettings}
              className="h-10 w-10 rounded-xl dark:hover:bg-surface-hover hover:bg-muted/50"
            >
              <Settings className="h-5 w-5 dark:text-muted-foreground text-muted-foreground" />
            </Button>

            {/* Account Button - Opens Profile Modal */}
            <Button 
              variant="ghost" 
              className="h-10 pl-2 pr-3 rounded-xl dark:hover:bg-surface-hover hover:bg-muted/50 gap-2"
              onClick={() => setShowProfileModal(true)}
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback className="dark:bg-primary bg-primary dark:text-white text-white text-xs font-semibold">
                  VU
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium dark:text-foreground text-foreground hidden md:inline">
                {t(language, "topbar.account")}
              </span>
            </Button>
          </div>
        </div>
      </div>

      {/* Profile Modal */}
      <ProfileModal
        open={showProfileModal}
        onOpenChange={setShowProfileModal}
        language={language}
        onLanguageChange={onLanguageChange}
        onNavigateToSubscription={onNavigateToSubscription}
      />
    </>
  );
}