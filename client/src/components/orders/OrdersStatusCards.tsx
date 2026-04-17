import { LucideIcon } from "lucide-react";
import { cn } from "../ui/utils";

export interface StatusCard {
  key: string;
  label: string;
  count: number;
  icon: LucideIcon;
  tone?: "purple" | "amber" | "green" | "neutral";
}

interface OrdersStatusCardsProps {
  items: StatusCard[];
  activeKey?: string;
  onPick?: (key: string) => void;
}

export function OrdersStatusCards({ items, activeKey, onPick }: OrdersStatusCardsProps) {
  const getToneClasses = (tone?: "purple" | "amber" | "green" | "neutral") => {
    switch (tone) {
      case "purple":
        return {
          bg: "bg-primary/10",
          border: "border-primary/30",
          icon: "text-primary",
        };
      case "amber":
        return {
          bg: "dark:bg-[rgba(251,191,36,0.10)] bg-yellow-50",
          border: "dark:border-[rgba(251,191,36,0.30)] border-yellow-300",
          icon: "text-yellow-base text-yellow-600",
        };
      case "green":
        return {
          bg: "dark:bg-[rgba(42,240,122,0.10)] bg-green-50",
          border: "dark:border-[rgba(42,240,122,0.30)] border-green-300",
          icon: "text-green-base text-green-600",
        };
      default:
        return {
          bg: "bg-primary/10",
          border: "border-primary/30",
          icon: "text-primary",
        };
    }
  };

  return (
    <div className="p-4 border-b border-border">
      <div className="flex flex-wrap gap-3">
        {items.map((item) => {
          const { bg, border, icon: iconClass } = getToneClasses(item.tone);
          const Icon = item.icon;
          
          return (
            <div
              key={item.key}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl border",
                bg,
                border
              )}
            >
              <Icon className={cn("w-4 h-4", iconClass)} />
              <div>
                <div className="text-xs text-muted-foreground">
                  {item.label}
                </div>
                <div className="text-lg text-foreground">
                  {item.count}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}