import { useState } from "react";
import { RotateCw } from "lucide-react";
import { Button } from "./ui/button";
import { Language } from "../lib/i18n";

interface RefreshButtonProps {
  onRefresh: () => void | Promise<void>;
  language: Language;
}

export function RefreshButton({ onRefresh, language }: RefreshButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 500);
    }
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleRefresh}
      disabled={isRefreshing}
      className="h-10 w-10 rounded-xl dark:bg-card bg-card dark:border-input border-input dark:hover:bg-surface-hover hover:bg-muted/50 dark:hover:border-primary/30 hover:border-primary/20 dark:hover:text-primary hover:text-primary transition-all duration-200 [&_svg]:dark:hover:text-primary [&_svg]:hover:text-primary"
      style={{
        boxShadow: isRefreshing ? "0 0 12px rgba(139, 92, 246, 0.2)" : undefined,
      }}
    >
      <RotateCw
        className={`w-4 h-4 transition-colors duration-200 ${
          isRefreshing ? "animate-spin" : ""
        }`}
      />
    </Button>
  );
}