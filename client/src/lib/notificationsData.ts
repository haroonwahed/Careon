import { NotificationKind } from "../components/NotificationRow";

export interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  details: string;
  timestamp: Date;
  accountName: string;
}

const generateNotifications = (): Notification[] => {
  const accounts = ["Boutique Alice", "Frip Tim", "Margo Vintage"];
  const notifications: Notification[] = [];
  const now = new Date("2025-10-29T14:30:00");

  const templates = [
    {
      kind: "sale" as NotificationKind,
      titleTemplate: "New sale: {item}",
      detailsTemplate: "You sold {item} for {price}",
      items: [
        { item: "Vintage Denim Jacket", price: "45€" },
        { item: "Leather Bag", price: "68€" },
        { item: "Nike Air Max", price: "85€" },
        { item: "Wool Coat", price: "92€" },
        { item: "Silk Scarf", price: "28€" },
      ],
    },
    {
      kind: "message" as NotificationKind,
      titleTemplate: "New message from {buyer}",
      detailsTemplate: "{buyer} sent you a message about {item}",
      items: [
        { buyer: "Sophie M.", item: "Blue Dress" },
        { buyer: "Thomas L.", item: "Running Shoes" },
        { buyer: "Emma D.", item: "Handbag" },
        { buyer: "Lucas B.", item: "Winter Jacket" },
      ],
    },
    {
      kind: "offer" as NotificationKind,
      titleTemplate: "New offer: {price} for {item}",
      detailsTemplate: "{buyer} made an offer of {price}",
      items: [
        { buyer: "Marie P.", item: "Vintage T-shirt", price: "15€" },
        { buyer: "Alexandre R.", item: "Jeans", price: "32€" },
        { buyer: "Camille H.", item: "Boots", price: "55€" },
      ],
    },
    {
      kind: "system" as NotificationKind,
      titleTemplate: "System: {action}",
      detailsTemplate: "{details}",
      items: [
        { action: "Item listed", details: "Your item has been successfully listed" },
        { action: "Price updated", details: "Price reduced by 10%" },
        { action: "Shipping reminder", details: "Remember to ship your sold item" },
      ],
    },
  ];

  let idCounter = 0;

  // Generate notifications for the last 7 days
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const notificationsPerDay = Math.floor(Math.random() * 8) + 5; // 5-12 per day
    
    for (let i = 0; i < notificationsPerDay; i++) {
      const template = templates[Math.floor(Math.random() * templates.length)];
      const item = template.items[Math.floor(Math.random() * template.items.length)];
      const account = accounts[Math.floor(Math.random() * accounts.length)];
      
      const timestamp = new Date(now);
      timestamp.setDate(timestamp.getDate() - dayOffset);
      timestamp.setHours(Math.floor(Math.random() * 24));
      timestamp.setMinutes(Math.floor(Math.random() * 60));

      let title = template.titleTemplate;
      let details = template.detailsTemplate;
      
      // Replace placeholders
      Object.entries(item).forEach(([key, value]) => {
        title = title.replace(`{${key}}`, value);
        details = details.replace(`{${key}}`, value);
      });

      notifications.push({
        id: `notif-${idCounter++}`,
        kind: template.kind,
        title,
        details,
        timestamp,
        accountName: account,
      });
    }
  }

  // Sort by timestamp descending
  return notifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};

export const NOTIFICATIONS = generateNotifications();

export function formatNotificationTimestamp(date: Date): string {
  const now = new Date("2025-10-29T14:30:00");
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) + 
         " " + 
         date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
