export interface Message {
  id: string;
  sender: string;
  subject: string;
  preview: string;
  timestamp: Date;
  accountId: string;
  accountName: string;
  accountInitial: string;
  avatarColor: string;
}

const generateMessages = (): Message[] => {
  const accounts = [
    { id: "account1", name: "Boutique Alice", initial: "A", color: "#8B5CF6" },
    { id: "account2", name: "Frip Tim", initial: "T", color: "#22D3EE" },
    { id: "account3", name: "Margo Vintage", initial: "M", color: "#EC4899" },
  ];
  
  const messages: Message[] = [];
  const now = new Date("2025-10-29T14:30:00");

  const senders = [
    "Sophie Martin",
    "Thomas Dubois",
    "Emma Laurent",
    "Lucas Bernard",
    "Camille Moreau",
    "Alexandre Petit",
    "Marie Rousseau",
    "Nicolas Simon",
    "Julie Michel",
    "Antoine Lefebvre",
    "Léa Garcia",
    "Maxime Roux",
  ];

  const subjects = [
    "Question about item",
    "Shipping details",
    "Price negotiation",
    "Product condition",
    "Bundle discount",
    "Return policy",
    "Payment method",
    "Size inquiry",
    "Additional photos",
    "Availability",
  ];

  const previews = [
    "Hi! I'm interested in this item. Could you provide more details about the condition?",
    "Hello, is the price negotiable? I'm interested in buying multiple items.",
    "Can you ship to another city? How much would the shipping cost?",
    "Is this still available? I'd like to purchase it as soon as possible.",
    "Do you have other similar items? I'm looking for something specific.",
    "Could you send me more photos from different angles?",
    "What are the exact measurements? I want to make sure it fits.",
    "Is there any damage or wear that's not shown in the photos?",
    "Can I pick it up in person instead of shipping?",
    "Would you consider a bundle discount if I buy multiple items?",
  ];

  const avatarColors = ["#8B5CF6", "#22D3EE", "#EC4899", "#F59E0B", "#10B981", "#EF4444"];

  let idCounter = 0;

  // Generate messages for the last 7 days
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const messagesPerDay = Math.floor(Math.random() * 6) + 3; // 3-8 per day
    
    for (let i = 0; i < messagesPerDay; i++) {
      const account = accounts[Math.floor(Math.random() * accounts.length)];
      const sender = senders[Math.floor(Math.random() * senders.length)];
      const subject = subjects[Math.floor(Math.random() * subjects.length)];
      const preview = previews[Math.floor(Math.random() * previews.length)];
      
      const timestamp = new Date(now);
      timestamp.setDate(timestamp.getDate() - dayOffset);
      timestamp.setHours(Math.floor(Math.random() * 24));
      timestamp.setMinutes(Math.floor(Math.random() * 60));

      messages.push({
        id: `msg-${idCounter++}`,
        sender,
        subject,
        preview,
        timestamp,
        accountId: account.id,
        accountName: account.name,
        accountInitial: account.initial,
        avatarColor: avatarColors[Math.floor(Math.random() * avatarColors.length)],
      });
    }
  }

  // Sort by timestamp descending
  return messages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};

export const MESSAGES = generateMessages();

export function formatMessageTimestamp(date: Date): string {
  const now = new Date("2025-10-29T14:30:00");
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays === 1) return "Yesterday";
  
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) + 
         " " + 
         date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
