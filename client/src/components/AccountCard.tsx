import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";

interface AccountCardProps {
  name: string;
  sales: number;
  revenue: number;
  color: string;
}

export function AccountCard({ name, sales, revenue, color }: AccountCardProps) {
  const initial = name.charAt(0).toUpperCase();
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card 
      className="rounded-2xl border dark:border-[rgba(168,85,247,0.25)] border-border p-6 dark:bg-[#0E0E14] bg-card shadow-sm"
      style={{
        boxShadow: "0 0 0 1px rgba(168,85,247,0.25), 0 0 28px rgba(168,85,247,0.10)"
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <Avatar className="w-12 h-12 rounded-xl" style={{ backgroundColor: color }}>
          <AvatarFallback className="rounded-xl text-white" style={{ backgroundColor: color, fontWeight: 600 }}>
            {initial}
          </AvatarFallback>
        </Avatar>
      </div>
      
      <h4 
        className="dark:text-[#E7E7F0] text-foreground mb-4"
        style={{ fontSize: "16px", fontWeight: 600 }}
      >
        {name}
      </h4>
      
      <div className="space-y-3 mb-4">
        <div>
          <p 
            className="dark:text-[#9CA3AF] text-muted-foreground"
            style={{ fontSize: "13px", fontWeight: 500 }}
          >
            Sales
          </p>
          <p 
            className="dark:text-[#C7B8FF] text-foreground"
            style={{ fontSize: "20px", fontWeight: 700 }}
          >
            {sales}
          </p>
        </div>
        <div>
          <p 
            className="dark:text-[#9CA3AF] text-muted-foreground"
            style={{ fontSize: "13px", fontWeight: 500 }}
          >
            Revenue
          </p>
          <p 
            className="dark:text-[#C7B8FF] text-foreground"
            style={{ fontSize: "20px", fontWeight: 700 }}
          >
            {formatCurrency(revenue)}
          </p>
        </div>
      </div>
      
      <Button 
        variant="outline" 
        className="w-full rounded-2xl dark:border-[rgba(168,85,247,0.4)] dark:text-[#8B5CF6] dark:hover:bg-[rgba(139,92,246,0.1)]"
      >
        Manage
      </Button>
    </Card>
  );
}
