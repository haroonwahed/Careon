import { ReactNode } from "react";
import { MoreVertical } from "lucide-react";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { cn } from "../ui/utils";

export interface RowAction {
  type: "primary" | "secondary" | "ghost";
  label: string;
  onClick: (e: React.MouseEvent) => void;
  icon?: ReactNode;
}

export interface RowMenuItem {
  label: string;
  onClick: () => void;
  destructive?: boolean;
}

export interface OrdersListRowData {
  id: string;
  imageUrl: string;
  title: string;
  sku?: string;
  badges: ReactNode[];
  price: ReactNode;
  subtitle?: ReactNode;
  actions?: RowAction[];
  menuItems?: RowMenuItem[];
}

interface OrdersListRowProps {
  row: OrdersListRowData;
  onClick: () => void;
}

export function OrdersListRow({ row, onClick }: OrdersListRowProps) {
  return (
    <div className="p-4 hover:dark:bg-[rgba(139,92,246,0.05)] hover:bg-gray-50 transition-colors cursor-pointer group">
      <div className="flex items-center justify-between gap-4">
        {/* LEFT: Image + Title + Badges */}
        <div className="flex items-center gap-4 min-w-0 flex-1" onClick={onClick}>
          {/* Thumbnail */}
          <div className="flex-shrink-0">
            <ImageWithFallback
              src={row.imageUrl}
              alt={row.title}
              className="w-16 h-16 rounded-xl object-cover border dark:border-[rgba(168,85,247,0.25)] border-border"
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="dark:text-[#E7E7F0] text-foreground truncate">
              {row.title}
            </h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {row.sku && (
                <Badge
                  variant="outline"
                  className="dark:bg-[rgba(139,92,246,0.10)] bg-primary/10 dark:border-[rgba(168,85,247,0.30)] border-primary/30 dark:text-[#A78BFA] text-primary text-xs"
                >
                  {row.sku}
                </Badge>
              )}
              {row.badges.map((badge, idx) => (
                <div key={idx}>{badge}</div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Price + Actions */}
        <div className="flex items-center gap-3">
          {/* PRIX (colonne fixe, centré) */}
          <div className="w-[110px] text-center">
            <div className="text-base tabular-nums">{row.price}</div>
            {row.subtitle && (
              <div className="text-xs dark:text-[#9CA3AF] text-muted-foreground mt-0.5">
                {row.subtitle}
              </div>
            )}
          </div>

          {/* ACTIONS */}
          <div className="flex items-center gap-2">
            {row.actions?.map((action, idx) => (
              <Button
                key={idx}
                variant={
                  action.type === "primary"
                    ? "default"
                    : action.type === "secondary"
                    ? "outline"
                    : "ghost"
                }
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick(e);
                }}
                className={cn(
                  "rounded-xl",
                  action.type === "primary" &&
                    "dark:bg-[#8B5CF6] bg-primary hover:dark:bg-[#7C3AED] hover:bg-primary/90 dark:text-white text-primary-foreground px-4 py-2",
                  action.type === "secondary" &&
                    "dark:text-[#E7E7F0] text-foreground hover:dark:bg-[rgba(139,92,246,0.10)] hover:bg-gray-100",
                  action.type === "ghost" &&
                    "dark:text-[#E7E7F0] text-foreground hover:dark:bg-[rgba(139,92,246,0.10)] hover:bg-gray-100"
                )}
                style={
                  action.type === "primary"
                    ? {
                        boxShadow: "0 0 20px rgba(139,92,246,0.3)",
                      }
                    : undefined
                }
              >
                {action.icon}
                {action.label}
              </Button>
            ))}

            {/* Overflow Menu - Only render if menuItems exist */}
            {row.menuItems && row.menuItems.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => e.stopPropagation()}
                    className="h-8 w-8 rounded-lg dark:hover:bg-[rgba(139,92,246,0.10)] hover:bg-gray-100"
                  >
                    <MoreVertical className="w-4 h-4 dark:text-[#9CA3AF] text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="rounded-xl dark:bg-[#0E0E14] bg-card border dark:border-[rgba(168,85,247,0.25)] border-border"
                >
                  {row.menuItems.map((item, idx) => (
                    <DropdownMenuItem
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        item.onClick();
                      }}
                      className={cn(
                        "rounded-lg cursor-pointer",
                        item.destructive && "text-red-600 dark:text-red-400"
                      )}
                    >
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}