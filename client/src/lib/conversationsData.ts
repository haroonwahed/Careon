export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  timestamp: Date;
  isMe: boolean;
  imageUrl?: string;
  originalLanguage?: string; // For translation feature
}

export interface Offer {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  amount: number;
  status: "sent" | "accepted" | "declined" | "countered" | "expired";
  timestamp: Date;
  isMe: boolean;
  message?: string;
  parentOfferId?: string; // For counter-offers
}

export interface SystemEvent {
  id: string;
  conversationId: string;
  type: "sold" | "shipped" | "delivered" | "buyer_paid_shipping" | "days_left";
  timestamp: Date;
  data?: {
    shipByDate?: Date;
    daysLeft?: number;
  };
}

export interface Conversation {
  id: string;
  buyerId: string;
  buyerName: string;
  buyerUsername: string;
  buyerAvatar: string;
  itemId: string;
  itemTitle: string;
  itemThumbnail: string;
  itemPrice: number;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  accountId: string;
  accountName: string;
  status: "active" | "sold" | "shipped" | "delivered" | "cancelled";
  hasLabel: boolean; // Whether label is available for download
}

// Mock data
export const mockConversations: Conversation[] = [
  {
    id: "conv_001",
    buyerId: "buyer_001",
    buyerName: "Marie Laurent",
    buyerUsername: "@marie_l",
    buyerAvatar: "https://i.pravatar.cc/150?u=marie",
    itemId: "item_001",
    itemTitle: "Vintage Levi's 501 Jeans",
    itemThumbnail: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&h=400&fit=crop",
    itemPrice: 45.00,
    lastMessage: "Merci beaucoup ! J'attends le colis avec impatience 😊",
    lastMessageTime: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    unreadCount: 2,
    accountId: "acc_001",
    accountName: "VintedPro",
    status: "sold",
    hasLabel: true,
  },
  {
    id: "conv_002",
    buyerId: "buyer_002",
    buyerName: "Sophie Dubois",
    buyerUsername: "@sophie_d",
    buyerAvatar: "https://i.pravatar.cc/150?u=sophie",
    itemId: "item_002",
    itemTitle: "Nike Air Max 90",
    itemThumbnail: "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=400&h=400&fit=crop",
    itemPrice: 75.00,
    lastMessage: "Est-ce que vous pouvez faire 65€ ?",
    lastMessageTime: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    unreadCount: 1,
    accountId: "acc_001",
    accountName: "VintedPro",
    status: "active",
    hasLabel: false,
  },
  {
    id: "conv_003",
    buyerId: "buyer_003",
    buyerName: "Lucas Martin",
    buyerUsername: "@lucas_m",
    buyerAvatar: "https://i.pravatar.cc/150?u=lucas",
    itemId: "item_003",
    itemTitle: "Adidas Originals Tracksuit",
    itemThumbnail: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=400&fit=crop",
    itemPrice: 55.00,
    lastMessage: "Perfect! I'll buy it now 👍",
    lastMessageTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    unreadCount: 0,
    accountId: "acc_002",
    accountName: "StyleHub",
    status: "sold",
    hasLabel: true,
  },
  {
    id: "conv_004",
    buyerId: "buyer_004",
    buyerName: "Emma Bernard",
    buyerUsername: "@emma_b",
    buyerAvatar: "https://i.pravatar.cc/150?u=emma",
    itemId: "item_004",
    itemTitle: "Zara Wool Coat",
    itemThumbnail: "https://images.unsplash.com/photo-1539533113208-f6df8cc8b543?w=400&h=400&fit=crop",
    itemPrice: 95.00,
    lastMessage: "Bonjour, quelle est la longueur du manteau ?",
    lastMessageTime: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
    unreadCount: 1,
    accountId: "acc_001",
    accountName: "VintedPro",
    status: "active",
    hasLabel: false,
  },
  {
    id: "conv_005",
    buyerId: "buyer_005",
    buyerName: "Thomas Petit",
    buyerUsername: "@thomas_p",
    buyerAvatar: "https://i.pravatar.cc/150?u=thomas",
    itemId: "item_005",
    itemTitle: "Ralph Lauren Polo Shirt",
    itemThumbnail: "https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=400&h=400&fit=crop",
    itemPrice: 30.00,
    lastMessage: "Je l'ai reçu aujourd'hui, merci !",
    lastMessageTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    unreadCount: 0,
    accountId: "acc_002",
    accountName: "StyleHub",
    status: "delivered",
    hasLabel: false,
  },
  {
    id: "conv_006",
    buyerId: "buyer_006",
    buyerName: "Camille Rousseau",
    buyerUsername: "@camille_r",
    buyerAvatar: "https://i.pravatar.cc/150?u=camille",
    itemId: "item_006",
    itemTitle: "H&M Summer Dress",
    itemThumbnail: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400&h=400&fit=crop",
    itemPrice: 25.00,
    lastMessage: "Can you ship it by Friday?",
    lastMessageTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    unreadCount: 0,
    accountId: "acc_001",
    accountName: "VintedPro",
    status: "shipped",
    hasLabel: false,
  },
];

export const mockMessages: Message[] = [
  // Conversation 1 - Marie Laurent
  {
    id: "msg_001",
    conversationId: "conv_001",
    senderId: "buyer_001",
    senderName: "Marie Laurent",
    senderAvatar: "https://i.pravatar.cc/150?u=marie",
    content: "Bonjour, est-ce que le jean est toujours disponible ?",
    timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000),
    isMe: false,
  },
  {
    id: "msg_002",
    conversationId: "conv_001",
    senderId: "me",
    senderName: "Me",
    senderAvatar: "https://i.pravatar.cc/150?u=me",
    content: "Oui, il est toujours disponible ! 😊",
    timestamp: new Date(Date.now() - 47 * 60 * 60 * 1000),
    isMe: true,
  },
  {
    id: "msg_003",
    conversationId: "conv_001",
    senderId: "buyer_001",
    senderName: "Marie Laurent",
    senderAvatar: "https://i.pravatar.cc/150?u=marie",
    content: "Super ! Je l'achète maintenant.",
    timestamp: new Date(Date.now() - 46 * 60 * 60 * 1000),
    isMe: false,
  },
  {
    id: "msg_004",
    conversationId: "conv_001",
    senderId: "buyer_001",
    senderName: "Marie Laurent",
    senderAvatar: "https://i.pravatar.cc/150?u=marie",
    content: "Merci beaucoup ! J'attends le colis avec impatience 😊",
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    isMe: false,
  },
  
  // Conversation 2 - Sophie Dubois
  {
    id: "msg_005",
    conversationId: "conv_002",
    senderId: "buyer_002",
    senderName: "Sophie Dubois",
    senderAvatar: "https://i.pravatar.cc/150?u=sophie",
    content: "Salut ! Les baskets sont en bon état ?",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    isMe: false,
  },
  {
    id: "msg_006",
    conversationId: "conv_002",
    senderId: "me",
    senderName: "Me",
    senderAvatar: "https://i.pravatar.cc/150?u=me",
    content: "Oui, elles sont en très bon état, portées seulement 3-4 fois.",
    timestamp: new Date(Date.now() - 90 * 60 * 1000),
    isMe: true,
  },
  {
    id: "msg_007",
    conversationId: "conv_002",
    senderId: "buyer_002",
    senderName: "Sophie Dubois",
    senderAvatar: "https://i.pravatar.cc/150?u=sophie",
    content: "Est-ce que vous pouvez faire 65€ ?",
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
    isMe: false,
  },
  
  // Conversation 3 - Lucas Martin (English)
  {
    id: "msg_008",
    conversationId: "conv_003",
    senderId: "buyer_003",
    senderName: "Lucas Martin",
    senderAvatar: "https://i.pravatar.cc/150?u=lucas",
    content: "Hi! Is the tracksuit still available?",
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
    isMe: false,
    originalLanguage: "english",
  },
  {
    id: "msg_009",
    conversationId: "conv_003",
    senderId: "me",
    senderName: "Me",
    senderAvatar: "https://i.pravatar.cc/150?u=me",
    content: "Yes, it is! The condition is like new.",
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
    isMe: true,
  },
  {
    id: "msg_010",
    conversationId: "conv_003",
    senderId: "buyer_003",
    senderName: "Lucas Martin",
    senderAvatar: "https://i.pravatar.cc/150?u=lucas",
    content: "Perfect! I'll buy it now 👍",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    isMe: false,
    originalLanguage: "english",
  },
  
  // Conversation 4 - Emma Bernard
  {
    id: "msg_011",
    conversationId: "conv_004",
    senderId: "buyer_004",
    senderName: "Emma Bernard",
    senderAvatar: "https://i.pravatar.cc/150?u=emma",
    content: "Bonjour, quelle est la longueur du manteau ?",
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
    isMe: false,
  },
];

export const mockOffers: Offer[] = [
  {
    id: "offer_001",
    conversationId: "conv_002",
    senderId: "buyer_002",
    senderName: "Sophie Dubois",
    senderAvatar: "https://i.pravatar.cc/150?u=sophie",
    amount: 65.00,
    status: "sent",
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
    isMe: false,
    message: "Est-ce que vous pouvez faire 65€ ?",
  },
];

export const mockSystemEvents: SystemEvent[] = [
  {
    id: "sys_001",
    conversationId: "conv_001",
    type: "sold",
    timestamp: new Date(Date.now() - 45 * 60 * 60 * 1000),
    data: {
      shipByDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
    },
  },
  {
    id: "sys_002",
    conversationId: "conv_001",
    type: "buyer_paid_shipping",
    timestamp: new Date(Date.now() - 45 * 60 * 60 * 1000),
  },
  {
    id: "sys_003",
    conversationId: "conv_001",
    type: "days_left",
    timestamp: new Date(Date.now() - 10 * 60 * 1000),
    data: {
      daysLeft: 3,
    },
  },
  {
    id: "sys_004",
    conversationId: "conv_003",
    type: "sold",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    data: {
      shipByDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
    },
  },
  {
    id: "sys_005",
    conversationId: "conv_003",
    type: "buyer_paid_shipping",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
];