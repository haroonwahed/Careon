export type ListingStatus = "queued" | "posting" | "active" | "failed" | "ended" | "paused";

export interface Listing {
  id: string;
  listingId: string; // Vinted listing ID
  sku: string;
  title: string;
  photoUrl: string;
  accountName: string;
  price: number;
  status: ListingStatus;
  createdAt: Date;
  lastSync: Date;
  errorMessage?: string;
}

export const MOCK_LISTINGS: Listing[] = [
  {
    id: "list-001",
    listingId: "VT-2847361829",
    sku: "VM-20251029-7F3C",
    title: "Vintage Levi's 501 Jeans - Dark Wash - W32 L34",
    photoUrl: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=400",
    accountName: "Boutique Alice",
    price: 45.00,
    status: "active",
    createdAt: new Date("2025-10-27T14:20:00"),
    lastSync: new Date("2025-10-29T12:15:00"),
  },
  {
    id: "list-002",
    listingId: "VT-2847361830",
    sku: "VM-20251029-7F3C",
    title: "Vintage Levi's 501 Jeans - Dark Wash - W32 L34",
    photoUrl: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=400",
    accountName: "Frip Tim",
    price: 45.00,
    status: "active",
    createdAt: new Date("2025-10-27T14:21:00"),
    lastSync: new Date("2025-10-29T12:16:00"),
  },
  {
    id: "list-003",
    listingId: "VT-2847294718",
    sku: "VM-20251028-K9P2",
    title: "Ralph Lauren Cable Knit Sweater - Navy - Size M",
    photoUrl: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=400",
    accountName: "Margo Vintage",
    price: 35.00,
    status: "active",
    createdAt: new Date("2025-10-26T11:45:00"),
    lastSync: new Date("2025-10-29T11:20:00"),
  },
  {
    id: "list-004",
    listingId: "VT-2847523901",
    sku: "VM-20251027-Q7M5",
    title: "Carhartt Work Pants - Brown - W34 L32",
    photoUrl: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=400",
    accountName: "Boutique Alice",
    price: 42.00,
    status: "active",
    createdAt: new Date("2025-10-25T10:15:00"),
    lastSync: new Date("2025-10-29T10:45:00"),
  },
  {
    id: "list-005",
    listingId: "VT-2846872034",
    sku: "VM-20251026-R8W4",
    title: "Nike Air Max Sneakers - White/Grey - US 10",
    photoUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400",
    accountName: "Frip Tim",
    price: 65.00,
    status: "failed",
    createdAt: new Date("2025-10-26T16:30:00"),
    lastSync: new Date("2025-10-26T16:30:00"),
    errorMessage: "Image quality requirements not met",
  },
  {
    id: "list-006",
    listingId: "VT-2848192847",
    sku: "VM-20251024-L3R9",
    title: "Patagonia Fleece Jacket - Green - Size L",
    photoUrl: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400",
    accountName: "Margo Vintage",
    price: 52.00,
    status: "paused",
    createdAt: new Date("2025-10-24T09:30:00"),
    lastSync: new Date("2025-10-28T15:00:00"),
  },
];
