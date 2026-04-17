import { LucideIcon } from "lucide-react";
import { EmptyState } from "../EmptyState";

interface OrdersEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function OrdersEmptyState({ icon, title, description }: OrdersEmptyStateProps) {
  return (
    <div className="p-12">
      <EmptyState
        icon={icon}
        title={title}
        description={description}
      />
    </div>
  );
}
