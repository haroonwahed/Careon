export type OrderStatus = 
  | "label_sent"
  | "shipped"
  | "in_transit"
  | "delivered"
  | "return_initiated"
  | "cancelled_buyer"
  | "cancelled_seller"
  | "cancelled_system"
  | "waiting_label";

export type OrderCategory = "in_progress" | "finished" | "cancelled";
export type OrderType = "sale" | "purchase";
export type PurchaseSource = "vinted" | "manual";

export interface Order {
  id: string;
  orderId: string;
  type: OrderType; // sale or purchase
  source?: PurchaseSource; // Only for purchases - "vinted" or "manual"
  accountId: string;
  accountName: string;
  accountInitial: string;
  title: string;
  sku?: string;
  price: number;
  status: OrderStatus;
  category: OrderCategory;
  thumbnail: string;
  imageUrl: string; // Alias for thumbnail (used in some components)
  buyer: {
    name: string;
    username: string;
  };
  seller?: {
    name: string;
    username: string;
  };
  createdAt: Date;
  updatedAt: Date;
  shippingAddress?: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
  timeline: {
    status: string;
    timestamp: Date;
    icon: string;
  }[];
  fees: {
    itemPrice: number;
    shippingFee: number;
    serviceFee: number;
    total: number;
  };
  processed?: boolean;
  purchaseCost?: number;
  quantity?: number;
  trackingNumber?: string; // For manual purchases
  trackingCarrier?: string; // For manual purchases
  trackingUrl?: string; // For vinted purchases
  bundle?: {
    isBundle: boolean;
    items?: {
      title: string;
      sku?: string;
      thumbnail: string;
    }[];
  };
}

import { Language, t } from "./i18n";

const statusLabels: Record<OrderStatus, string> = {
  waiting_label: "Waiting for label",
  label_sent: "Label sent to seller",
  shipped: "Order shipped",
  in_transit: "In transit",
  delivered: "Delivered",
  return_initiated: "Return initiated",
  cancelled_buyer: "Cancelled by buyer",
  cancelled_seller: "Cancelled by seller",
  cancelled_system: "Cancelled",
};

export function getStatusLabel(status: OrderStatus, language?: Language): string {
  if (language) {
    return t(language, `orders.status.${status}` as any);
  }
  return statusLabels[status];
}

export function getOrderCategory(status: OrderStatus): OrderCategory {
  if (status === "delivered") return "finished";
  if (status.startsWith("cancelled")) return "cancelled";
  return "in_progress";
}

// Mock orders data
export const mockOrders: Order[] = [
  {
    id: "1",
    orderId: "VIN-2025-001234",
    type: "sale",
    accountId: "account1",
    accountName: "Alice's Closet",
    accountInitial: "A",
    title: "Vintage Levi's 501 Jeans - Medium Blue Wash",
    sku: "VM-20251028-0012",
    price: 45.00,
    status: "in_transit",
    category: "in_progress",
    thumbnail: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=400",
    imageUrl: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=400",
    buyer: {
      name: "Sophie Martin",
      username: "@sophie_m"
    },
    createdAt: new Date("2025-10-27T10:30:00"),
    updatedAt: new Date("2025-10-28T14:20:00"),
    shippingAddress: {
      street: "12 Rue de la Paix",
      city: "Paris",
      postalCode: "75002",
      country: "France"
    },
    timeline: [
      { status: "Order created", timestamp: new Date("2025-10-27T10:30:00"), icon: "check" },
      { status: "Label sent to seller", timestamp: new Date("2025-10-27T15:00:00"), icon: "mail" },
      { status: "Order shipped", timestamp: new Date("2025-10-28T09:15:00"), icon: "package" },
      { status: "In transit", timestamp: new Date("2025-10-28T14:20:00"), icon: "truck" }
    ],
    fees: {
      itemPrice: 45.00,
      shippingFee: 5.50,
      serviceFee: 4.50,
      total: 40.50
    },
    purchaseCost: 25.00,
    quantity: 1,
    bundle: {
      isBundle: false,
    }
  },
  {
    id: "2",
    orderId: "VIN-2025-001189",
    type: "sale",
    accountId: "account2",
    accountName: "TrendyBoutique",
    accountInitial: "T",
    title: "Summer Bundle: Zara Blouse + H&M Skirt + Accessories",
    sku: "VM-BUNDLE-001189",
    price: 45.00,
    status: "label_sent",
    category: "in_progress",
    thumbnail: "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=400",
    imageUrl: "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=400",
    buyer: {
      name: "Emma Dubois",
      username: "@emma_d"
    },
    createdAt: new Date("2025-10-26T16:45:00"),
    updatedAt: new Date("2025-10-27T08:30:00"),
    shippingAddress: {
      street: "45 Avenue des Champs",
      city: "Lyon",
      postalCode: "69001",
      country: "France"
    },
    timeline: [
      { status: "Order created", timestamp: new Date("2025-10-26T16:45:00"), icon: "check" },
      { status: "Label sent to seller", timestamp: new Date("2025-10-27T08:30:00"), icon: "mail" }
    ],
    fees: {
      itemPrice: 45.00,
      shippingFee: 5.50,
      serviceFee: 4.50,
      total: 40.50
    },
    purchaseCost: 18.00,
    quantity: 3,
    bundle: {
      isBundle: true,
      items: [
        {
          title: "Zara White Cotton Blouse Size M",
          sku: "VM-20251015-0023",
          thumbnail: "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=400"
        },
        {
          title: "H&M Floral Print Skirt Size S",
          sku: "VM-20251015-0024",
          thumbnail: "https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=400"
        },
        {
          title: "Gold Statement Necklace",
          sku: "VM-20251015-0025",
          thumbnail: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=400"
        }
      ]
    }
  },
  {
    id: "3",
    orderId: "VIN-2025-001156",
    type: "sale",
    accountId: "account1",
    accountName: "Alice's Closet",
    accountInitial: "A",
    title: "Nike Air Max 90 Sneakers - Size 42",
    sku: "VM-20251020-0045",
    price: 85.00,
    status: "delivered",
    category: "finished",
    thumbnail: "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=400",
    imageUrl: "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=400",
    buyer: {
      name: "Lucas Bernard",
      username: "@lucas_b"
    },
    createdAt: new Date("2025-10-20T11:20:00"),
    updatedAt: new Date("2025-10-25T16:10:00"),
    shippingAddress: {
      street: "8 Boulevard Saint-Germain",
      city: "Paris",
      postalCode: "75005",
      country: "France"
    },
    timeline: [
      { status: "Order created", timestamp: new Date("2025-10-20T11:20:00"), icon: "check" },
      { status: "Label sent to seller", timestamp: new Date("2025-10-20T18:00:00"), icon: "mail" },
      { status: "Order shipped", timestamp: new Date("2025-10-21T10:30:00"), icon: "package" },
      { status: "In transit", timestamp: new Date("2025-10-22T14:00:00"), icon: "truck" },
      { status: "Delivered", timestamp: new Date("2025-10-25T16:10:00"), icon: "check-circle" }
    ],
    fees: {
      itemPrice: 85.00,
      shippingFee: 6.50,
      serviceFee: 8.50,
      total: 76.50
    },
    purchaseCost: 45.00,
    quantity: 1,
    bundle: {
      isBundle: false,
    }
  },
  {
    id: "4",
    orderId: "VIN-2025-001098",
    type: "purchase",
    source: "vinted",
    accountId: "account3",
    accountName: "Minimal Style",
    accountInitial: "M",
    title: "H&M Black Leather Jacket - Size L",
    price: 65.00,
    status: "delivered",
    category: "finished",
    thumbnail: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400",
    imageUrl: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400",
    buyer: {
      name: "Chloé Rousseau",
      username: "@chloe_r"
    },
    createdAt: new Date("2025-10-18T09:15:00"),
    updatedAt: new Date("2025-10-24T11:45:00"),
    shippingAddress: {
      street: "22 Rue Voltaire",
      city: "Marseille",
      postalCode: "13001",
      country: "France"
    },
    timeline: [
      { status: "Order created", timestamp: new Date("2025-10-18T09:15:00"), icon: "check" },
      { status: "Label sent to seller", timestamp: new Date("2025-10-18T14:30:00"), icon: "mail" },
      { status: "Order shipped", timestamp: new Date("2025-10-19T08:00:00"), icon: "package" },
      { status: "In transit", timestamp: new Date("2025-10-20T10:00:00"), icon: "truck" },
      { status: "Delivered", timestamp: new Date("2025-10-24T11:45:00"), icon: "check-circle" }
    ],
    fees: {
      itemPrice: 65.00,
      shippingFee: 5.50,
      serviceFee: 6.50,
      total: 58.50
    },
    trackingUrl: "https://www.vinted.com/tracking/123456789"
  },
  {
    id: "5",
    orderId: "VIN-2025-001067",
    type: "sale",
    accountId: "account2",
    accountName: "TrendyBoutique",
    accountInitial: "T",
    title: "Mango Floral Summer Dress Size S",
    sku: "VM-20251015-0089",
    price: 38.00,
    status: "cancelled_buyer",
    category: "cancelled",
    thumbnail: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400",
    imageUrl: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400",
    buyer: {
      name: "Marie Laurent",
      username: "@marie_l"
    },
    createdAt: new Date("2025-10-15T13:30:00"),
    updatedAt: new Date("2025-10-16T09:20:00"),
    timeline: [
      { status: "Order created", timestamp: new Date("2025-10-15T13:30:00"), icon: "check" },
      { status: "Cancelled by buyer", timestamp: new Date("2025-10-16T09:20:00"), icon: "x-circle" }
    ],
    fees: {
      itemPrice: 38.00,
      shippingFee: 4.50,
      serviceFee: 0,
      total: 0
    },
    purchaseCost: 20.00,
    quantity: 1,
    bundle: {
      isBundle: false,
    }
  },
  {
    id: "6",
    orderId: "VIN-2025-001235",
    type: "sale",
    accountId: "account1",
    accountName: "Alice's Closet",
    accountInitial: "A",
    title: "Adidas Originals Track Jacket - Black & White",
    sku: "VM-20251027-0098",
    price: 52.00,
    status: "waiting_label",
    category: "in_progress",
    thumbnail: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400",
    imageUrl: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400",
    buyer: {
      name: "Thomas Girard",
      username: "@thomas_g"
    },
    createdAt: new Date("2025-10-29T08:15:00"),
    updatedAt: new Date("2025-10-29T08:15:00"),
    timeline: [
      { status: "Order created", timestamp: new Date("2025-10-29T08:15:00"), icon: "check" }
    ],
    fees: {
      itemPrice: 52.00,
      shippingFee: 5.50,
      serviceFee: 5.20,
      total: 46.80
    },
    purchaseCost: 28.00,
    quantity: 1,
    bundle: {
      isBundle: false,
    }
  },
  {
    id: "7",
    orderId: "VIN-2025-001201",
    type: "purchase",
    source: "manual",
    accountId: "account3",
    accountName: "Minimal Style",
    accountInitial: "M",
    title: "COS Minimalist Grey Wool Coat Size M",
    price: 120.00,
    status: "shipped",
    category: "in_progress",
    thumbnail: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=400",
    imageUrl: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=400",
    buyer: {
      name: "Julie Moreau",
      username: "@julie_m"
    },
    createdAt: new Date("2025-10-25T14:20:00"),
    updatedAt: new Date("2025-10-27T10:30:00"),
    shippingAddress: {
      street: "15 Rue de Rivoli",
      city: "Paris",
      postalCode: "75001",
      country: "France"
    },
    timeline: [
      { status: "Order created", timestamp: new Date("2025-10-25T14:20:00"), icon: "check" },
      { status: "Label sent to seller", timestamp: new Date("2025-10-26T09:00:00"), icon: "mail" },
      { status: "Order shipped", timestamp: new Date("2025-10-27T10:30:00"), icon: "package" }
    ],
    fees: {
      itemPrice: 120.00,
      shippingFee: 7.50,
      serviceFee: 12.00,
      total: 108.00
    },
    trackingNumber: "123456789",
    trackingCarrier: "DHL"
  },
  {
    id: "8",
    orderId: "VIN-2025-001145",
    type: "purchase",
    source: "vinted",
    accountId: "account1",
    accountName: "Alice's Closet",
    accountInitial: "A",
    title: "Uniqlo Blue Denim Shirt Size M",
    price: 28.00,
    status: "delivered",
    category: "finished",
    thumbnail: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400",
    imageUrl: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400",
    buyer: {
      name: "Paul Lefevre",
      username: "@paul_l"
    },
    createdAt: new Date("2025-10-19T10:30:00"),
    updatedAt: new Date("2025-10-23T15:20:00"),
    timeline: [
      { status: "Order created", timestamp: new Date("2025-10-19T10:30:00"), icon: "check" },
      { status: "Label sent to seller", timestamp: new Date("2025-10-19T16:00:00"), icon: "mail" },
      { status: "Order shipped", timestamp: new Date("2025-10-20T09:00:00"), icon: "package" },
      { status: "In transit", timestamp: new Date("2025-10-21T11:00:00"), icon: "truck" },
      { status: "Delivered", timestamp: new Date("2025-10-23T15:20:00"), icon: "check-circle" }
    ],
    fees: {
      itemPrice: 28.00,
      shippingFee: 4.50,
      serviceFee: 2.80,
      total: 25.20
    },
    trackingUrl: "https://www.vinted.com/tracking/987654321"
  },
  {
    id: "9",
    orderId: "VIN-2025-001088",
    type: "sale",
    accountId: "account2",
    accountName: "TrendyBoutique",
    accountInitial: "T",
    title: "Bershka Crop Top with Embroidery Size S",
    sku: "VM-20251017-0088",
    price: 15.00,
    status: "shipped",
    category: "in_progress",
    thumbnail: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=400",
    imageUrl: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=400",
    buyer: {
      name: "Laura Petit",
      username: "@laura_p"
    },
    createdAt: new Date("2025-10-17T11:45:00"),
    updatedAt: new Date("2025-10-28T13:00:00"),
    timeline: [
      { status: "Order created", timestamp: new Date("2025-10-17T11:45:00"), icon: "check" },
      { status: "Label sent to seller", timestamp: new Date("2025-10-17T17:00:00"), icon: "mail" },
      { status: "Order shipped", timestamp: new Date("2025-10-18T10:00:00"), icon: "package" }
    ],
    fees: {
      itemPrice: 15.00,
      shippingFee: 4.00,
      serviceFee: 1.50,
      total: 13.50
    },
    purchaseCost: 8.00,
    quantity: 1,
    bundle: {
      isBundle: false,
    }
  },
  {
    id: "10",
    orderId: "VIN-2025-001042",
    type: "sale",
    accountId: "account3",
    accountName: "Minimal Style",
    accountInitial: "M",
    title: "Massimo Dutti Linen Trousers Beige Size 40",
    sku: "VM-20251014-0042",
    price: 45.00,
    status: "cancelled_seller",
    category: "cancelled",
    thumbnail: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=400",
    imageUrl: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=400",
    buyer: {
      name: "Antoine Blanc",
      username: "@antoine_b"
    },
    createdAt: new Date("2025-10-14T15:00:00"),
    updatedAt: new Date("2025-10-15T10:30:00"),
    timeline: [
      { status: "Order created", timestamp: new Date("2025-10-14T15:00:00"), icon: "check" },
      { status: "Cancelled by seller", timestamp: new Date("2025-10-15T10:30:00"), icon: "x-circle" }
    ],
    fees: {
      itemPrice: 45.00,
      shippingFee: 5.00,
      serviceFee: 0,
      total: 0
    },
    purchaseCost: 22.00,
    quantity: 1,
    bundle: {
      isBundle: false,
    }
  },
  {
    id: "11",
    orderId: "VIN-2025-001250",
    type: "sale",
    accountId: "account2",
    accountName: "TrendyBoutique",
    accountInitial: "T",
    title: "ASOS Floral Midi Dress Size M",
    sku: "VM-20251030-0112",
    price: 32.00,
    status: "waiting_label",
    category: "in_progress",
    thumbnail: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400",
    imageUrl: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400",
    buyer: {
      name: "Isabelle Moreau",
      username: "@isabelle_m"
    },
    createdAt: new Date("2025-10-30T09:00:00"),
    updatedAt: new Date("2025-10-30T09:00:00"),
    timeline: [
      { status: "Order created", timestamp: new Date("2025-10-30T09:00:00"), icon: "check" }
    ],
    fees: {
      itemPrice: 32.00,
      shippingFee: 4.50,
      serviceFee: 3.20,
      total: 28.80
    },
    purchaseCost: 15.00,
    quantity: 1,
    bundle: {
      isBundle: false,
    }
  },
  {
    id: "12",
    orderId: "VIN-2025-001199",
    type: "purchase",
    source: "vinted",
    accountId: "account1",
    accountName: "Alice's Closet",
    accountInitial: "A",
    title: "Vintage Champion Hoodie - Grey Size L",
    price: 38.00,
    status: "in_transit",
    category: "in_progress",
    thumbnail: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400",
    imageUrl: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400",
    buyer: {
      name: "Marc Dupont",
      username: "@marc_d"
    },
    createdAt: new Date("2025-10-26T14:30:00"),
    updatedAt: new Date("2025-10-28T11:20:00"),
    timeline: [
      { status: "Order created", timestamp: new Date("2025-10-26T14:30:00"), icon: "check" },
      { status: "Payment sent", timestamp: new Date("2025-10-26T14:35:00"), icon: "credit-card" },
      { status: "Order shipped", timestamp: new Date("2025-10-27T10:00:00"), icon: "package" },
      { status: "In transit", timestamp: new Date("2025-10-28T11:20:00"), icon: "truck" }
    ],
    fees: {
      itemPrice: 38.00,
      shippingFee: 5.00,
      serviceFee: 3.80,
      total: 46.80
    },
    trackingUrl: "https://www.vinted.com/tracking/555666777"
  }
];