export interface Favorite {
  id: string;
  itemId: string;
  itemTitle: string;
  itemSku?: string;
  itemPrice: number;
  itemThumbnail: string;
  accountId: string;
  accountName: string;
  accountInitial: string;
  userHandle: string;
  userName: string;
  timestamp: Date;
}

export const mockFavorites: Favorite[] = [
  {
    id: "fav-demo",
    itemId: "T-17",
    itemTitle: "Pull noir ajouré boutons dorés (taille M) | T-17",
    itemSku: "T-17",
    itemPrice: 34.90,
    itemThumbnail: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=400",
    accountId: "account1",
    accountName: "Alice's Closet",
    accountInitial: "A",
    userHandle: "@marie-annelabest",
    userName: "Marie-Anne L.",
    timestamp: new Date("2025-10-31T11:45:00"),
  },
  {
    id: "fav-1",
    itemId: "item-001",
    itemTitle: "Vintage Levi's 501 Jeans - Medium Blue Wash",
    itemSku: "VM-20251028-0012",
    itemPrice: 45.00,
    itemThumbnail: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=400",
    accountId: "account1",
    accountName: "Alice's Closet",
    accountInitial: "A",
    userHandle: "@marie_vintage",
    userName: "Marie V.",
    timestamp: new Date("2025-10-31T10:30:00"),
  },
  {
    id: "fav-2",
    itemId: "item-002",
    itemTitle: "Nike Air Max 90 Sneakers - Size 42",
    itemSku: "VM-20251020-0045",
    itemPrice: 85.00,
    itemThumbnail: "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=400",
    accountId: "account1",
    accountName: "Alice's Closet",
    accountInitial: "A",
    userHandle: "@sneakerhead_tom",
    userName: "Tom R.",
    timestamp: new Date("2025-10-31T09:15:00"),
  },
  {
    id: "fav-3",
    itemId: "item-003",
    itemTitle: "Zara White Cotton Blouse Size M",
    itemPrice: 22.00,
    itemThumbnail: "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=400",
    accountId: "account2",
    accountName: "TrendyBoutique",
    accountInitial: "T",
    userHandle: "@sophie_style",
    userName: "Sophie M.",
    timestamp: new Date("2025-10-31T08:45:00"),
  },
  {
    id: "fav-4",
    itemId: "item-004",
    itemTitle: "H&M Black Leather Jacket - Size L",
    itemPrice: 65.00,
    itemThumbnail: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400",
    accountId: "account3",
    accountName: "Minimal Style",
    accountInitial: "M",
    userHandle: "@lucas_fashion",
    userName: "Lucas B.",
    timestamp: new Date("2025-10-30T18:20:00"),
  },
  {
    id: "fav-5",
    itemId: "item-005",
    itemTitle: "Adidas Originals Track Jacket - Black & White",
    itemSku: "VM-20251027-0098",
    itemPrice: 52.00,
    itemThumbnail: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400",
    accountId: "account1",
    accountName: "Alice's Closet",
    accountInitial: "A",
    userHandle: "@emma_active",
    userName: "Emma D.",
    timestamp: new Date("2025-10-30T16:10:00"),
  },
  {
    id: "fav-6",
    itemId: "item-006",
    itemTitle: "Mango Floral Summer Dress Size S",
    itemSku: "VM-20251015-0089",
    itemPrice: 38.00,
    itemThumbnail: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400",
    accountId: "account2",
    accountName: "TrendyBoutique",
    accountInitial: "T",
    userHandle: "@chloe_chic",
    userName: "Chloé R.",
    timestamp: new Date("2025-10-30T14:30:00"),
  },
  {
    id: "fav-7",
    itemId: "item-007",
    itemTitle: "COS Minimalist Grey Wool Coat Size M",
    itemPrice: 120.00,
    itemThumbnail: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=400",
    accountId: "account3",
    accountName: "Minimal Style",
    accountInitial: "M",
    userHandle: "@julie_minimal",
    userName: "Julie M.",
    timestamp: new Date("2025-10-30T11:50:00"),
  },
  {
    id: "fav-8",
    itemId: "item-008",
    itemTitle: "Uniqlo Blue Denim Shirt Size M",
    itemPrice: 28.00,
    itemThumbnail: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400",
    accountId: "account1",
    accountName: "Alice's Closet",
    accountInitial: "A",
    userHandle: "@paul_casual",
    userName: "Paul L.",
    timestamp: new Date("2025-10-29T20:15:00"),
  },
  {
    id: "fav-9",
    itemId: "item-009",
    itemTitle: "Bershka Crop Top with Embroidery Size S",
    itemPrice: 15.00,
    itemThumbnail: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=400",
    accountId: "account2",
    accountName: "TrendyBoutique",
    accountInitial: "T",
    userHandle: "@laura_young",
    userName: "Laura P.",
    timestamp: new Date("2025-10-29T17:40:00"),
  },
  {
    id: "fav-10",
    itemId: "item-010",
    itemTitle: "Massimo Dutti Linen Trousers Beige Size 40",
    itemPrice: 45.00,
    itemThumbnail: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=400",
    accountId: "account3",
    accountName: "Minimal Style",
    accountInitial: "M",
    userHandle: "@antoine_elegance",
    userName: "Antoine B.",
    timestamp: new Date("2025-10-29T15:20:00"),
  },
];

export function getTimeAgo(date: Date): string {
  const now = new Date("2025-10-31T12:00:00"); // Current time for consistency
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) {
    return `${diffMins} min ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays === 1) {
    return "Yesterday";
  } else {
    return `${diffDays}d ago`;
  }
}
