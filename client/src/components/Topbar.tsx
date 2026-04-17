import { Moon, Sun } from "lucide-react";
import { Button } from "./ui/button";

interface TopbarProps {
  theme: "light" | "dark";
  onThemeToggle: () => void;
}

export function Topbar({ theme, onThemeToggle }: TopbarProps) {
  return (
    <div 
      className="sticky top-0 z-50 backdrop-blur-md dark:bg-[#0A0A0E]/80 bg-background/80 border-b dark:border-[rgba(168,85,247,0.25)] border-border"
      style={{
        boxShadow: theme === "dark" ? "0 1px 0 rgba(168,85,247,0.15)" : undefined
      }}
    >
      <div className="px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <div 
            className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center"
            style={{
              boxShadow: theme === "dark" ? "0 0 20px rgba(139,92,246,0.4)" : undefined
            }}
          >
            <span className="text-white" style={{ fontWeight: 700 }}>V</span>
          </div>
          <span 
            className="dark:text-[#E7E7F0] text-foreground"
            style={{ fontWeight: 600, fontSize: "16px" }}
          >
            Vinted Manager
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-2xl dark:hover:bg-[#12121A]"
            onClick={onThemeToggle}
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5 dark:text-[#9CA3AF]" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
