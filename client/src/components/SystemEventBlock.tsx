import { SystemEvent } from "../lib/conversationsData";
import { Language, t } from "../lib/i18n";

interface SystemEventBlockProps {
  event: SystemEvent;
  language: Language;
}

export function SystemEventBlock({ event, language }: SystemEventBlockProps) {
  const getMessage = () => {
    switch (event.type) {
      case "sold":
        if (event.data?.shipByDate) {
          const dateStr = event.data.shipByDate.toLocaleDateString(
            language === "fr" ? "fr-FR" : "en-GB",
            { day: "numeric", month: "short" }
          );
          return t(language, "messages.system.soldShipBefore").replace("{date}", dateStr);
        }
        return t(language, "messages.system.orderCreated");
      
      case "buyer_paid_shipping":
        return t(language, "messages.system.buyerPaidShipping");
      
      case "days_left":
        const days = event.data?.daysLeft || 0;
        return days === 1
          ? t(language, "messages.system.daysLeftToShip").replace("{count}", "1")
          : t(language, "messages.system.daysLeftToShip_plural").replace("{count}", days.toString());
      
      case "shipped":
        return t(language, "messages.system.orderShipped");
      
      case "delivered":
        return t(language, "messages.system.orderDelivered");
      
      default:
        return "";
    }
  };

  return (
    <div className="flex items-center gap-4 my-6">
      {/* Left line */}
      <div className="flex-1 h-px dark:bg-[rgba(168,85,247,0.15)] bg-border" />
      
      {/* System message */}
      <div className="text-xs dark:text-[#9CA3AF] text-muted-foreground text-center px-3 py-1.5 rounded-full dark:bg-[rgba(139,92,246,0.05)] bg-gray-50">
        {getMessage()}
      </div>
      
      {/* Right line */}
      <div className="flex-1 h-px dark:bg-[rgba(168,85,247,0.15)] bg-border" />
    </div>
  );
}
