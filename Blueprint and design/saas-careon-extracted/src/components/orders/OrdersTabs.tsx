import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { cn } from "../ui/utils";

export interface BoardTab {
  key: string;
  label: string;
  count: number;
}

interface OrdersTabsProps {
  tabs: BoardTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

export function OrdersTabs({ tabs, activeTab, onTabChange }: OrdersTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <div className="px-4 pt-4 border-b border-border">
        <TabsList className="w-full justify-start rounded-xl h-auto p-1 bg-muted/50">
          {tabs.map((tab) => (
            <TabsTrigger 
              key={tab.key} 
              value={tab.key} 
              className="rounded-lg gap-2"
            >
              {tab.label}
              <span className="px-1.5 py-0.5 rounded-md bg-background/50 text-[11px]">
                {tab.count}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </Tabs>
  );
}