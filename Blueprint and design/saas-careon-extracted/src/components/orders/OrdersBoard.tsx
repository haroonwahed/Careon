import { LucideIcon } from "lucide-react";
import { OrdersStatusCards, StatusCard } from "./OrdersStatusCards";
import { OrdersTabs, BoardTab } from "./OrdersTabs";
import { OrdersListRow, OrdersListRowData } from "./OrdersListRow";
import { OrdersEmptyState } from "./OrdersEmptyState";
import { LoadingSkeleton } from "../LoadingSkeleton";

interface OrdersBoardProps {
  // Status cards at the top
  statusCards: StatusCard[];
  
  // Tabs configuration
  tabs: BoardTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  
  // Rows data
  rows: OrdersListRowData[];
  isLoading?: boolean;
  
  // Empty state
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
  
  // Row click handler
  onRowClick: (rowId: string) => void;
}

export function OrdersBoard({
  statusCards,
  tabs,
  activeTab,
  onTabChange,
  rows,
  isLoading = false,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  onRowClick,
}: OrdersBoardProps) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Status Cards */}
      <OrdersStatusCards 
        items={statusCards} 
        activeKey={activeTab} 
        onPick={onTabChange} 
      />

      {/* Tabs */}
      <OrdersTabs 
        tabs={tabs} 
        activeTab={activeTab} 
        onTabChange={onTabChange} 
      />

      {/* Rows List */}
      <div>
        {isLoading ? (
          <div className="p-6">
            <LoadingSkeleton count={5} />
          </div>
        ) : rows.length === 0 ? (
          <OrdersEmptyState
            icon={emptyIcon}
            title={emptyTitle}
            description={emptyDescription}
          />
        ) : (
          <div className="divide-y divide-border">
            {rows.map((row) => (
              <OrdersListRow
                key={row.id}
                row={row}
                onClick={() => onRowClick(row.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
