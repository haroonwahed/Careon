export type ProductStatus = "draft" | "publishing" | "published" | "failed" | "archived";
export type ProductCondition = "new_with_tags" | "new" | "excellent" | "good" | "fair";
export type PackageSize = "small" | "medium" | "large";
export type SKUMode = "auto" | "manual";

export interface Product {
  id: string;
  sku: string;
  title: string;
  description: string;
  photos: string[];
  category: string;
  brand: string;
  condition: ProductCondition;
  material: string[];
  colors: string[]; // Colors of the product
  size: string;
  price: number;
  purchaseCost?: number; // COGS - cost of goods sold
  lastPrice?: number; // Minimum/last price used by offer bots & auto-accept bots
  quantity?: number; // Inventory quantity, default 1
  packageSize: PackageSize;
  status: ProductStatus;
  publishedTo: string[]; // Account names
  internalNotes?: string;
  createdAt: Date;
  updatedAt: Date;
  publishHistory: PublishAttempt[];
}

export interface PublishAttempt {
  accountName: string;
  timestamp: Date;
  status: "success" | "failed";
  error?: string;
}

// Generate SKU
export function generateSKU(): string {
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let random = '';
  for (let i = 0; i < 4; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `VM-${dateStr}-${random}`;
}

// Mock data
export const MOCK_PRODUCTS: Product[] = [
  {
    id: "prod-001",
    sku: "VM-20251029-7F3C",
    title: "Vintage Levi's 501 Jeans - Dark Wash - W32 L34",
    description: "Classic Levi's 501 jeans in excellent condition. Dark indigo wash with minimal fading. Iconic button fly and straight leg cut. Perfect for casual wear.",
    photos: [
      "https://images.unsplash.com/photo-1542272604-787c3835535d?w=400",
      "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=400",
    ],
    category: "Men's Clothing > Jeans",
    brand: "Levi's",
    condition: "excellent",
    material: ["Cotton", "Denim"],
    colors: ["Dark Indigo"],
    size: "W32 L34 (EU 32/34)",
    price: 45.00,
    purchaseCost: 18.50,
    lastPrice: 38.00,
    quantity: 1,
    packageSize: "medium",
    status: "published",
    publishedTo: ["Boutique Alice", "Frip Tim"],
    createdAt: new Date("2025-10-25T10:30:00"),
    updatedAt: new Date("2025-10-27T14:20:00"),
    publishHistory: [
      {
        accountName: "Boutique Alice",
        timestamp: new Date("2025-10-27T14:20:00"),
        status: "success",
      },
      {
        accountName: "Frip Tim",
        timestamp: new Date("2025-10-27T14:21:00"),
        status: "success",
      },
    ],
  },
  {
    id: "prod-002",
    sku: "VM-20251028-K9P2",
    title: "Ralph Lauren Cable Knit Sweater - Navy - Size M",
    description: "Beautiful navy blue cable knit sweater from Ralph Lauren. 100% cotton. Iconic pony logo. Warm and comfortable, perfect for autumn/winter.",
    photos: [
      "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=400",
    ],
    category: "Men's Clothing > Sweaters",
    brand: "Ralph Lauren",
    condition: "good",
    material: ["Cotton"],
    colors: ["Navy"],
    size: "M (EU M)",
    price: 35.00,
    purchaseCost: 12.00,
    lastPrice: 28.00,
    quantity: 1,
    packageSize: "medium",
    status: "published",
    publishedTo: ["Margo Vintage"],
    createdAt: new Date("2025-10-24T09:15:00"),
    updatedAt: new Date("2025-10-26T11:45:00"),
    publishHistory: [
      {
        accountName: "Margo Vintage",
        timestamp: new Date("2025-10-26T11:45:00"),
        status: "success",
      },
    ],
  },
  {
    id: "prod-003",
    sku: "VM-20251029-B4H1",
    title: "Vintage Adidas Track Jacket - Black/White - Size L",
    description: "Retro Adidas track jacket with iconic three stripes. Black with white stripes. Full zip closure. Great vintage piece in excellent condition.",
    photos: [
      "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400",
    ],
    category: "Men's Clothing > Jackets",
    brand: "Adidas",
    condition: "excellent",
    material: ["Polyester"],
    colors: ["Black", "White"],
    size: "L (EU L)",
    price: 38.00,
    purchaseCost: 15.00,
    quantity: 2,
    packageSize: "medium",
    status: "draft",
    publishedTo: [],
    internalNotes: "Check zipper before shipping",
    createdAt: new Date("2025-10-29T08:00:00"),
    updatedAt: new Date("2025-10-29T08:00:00"),
    publishHistory: [],
  },
  {
    id: "prod-004",
    sku: "VM-20251027-Q7M5",
    title: "Carhartt Work Pants - Brown - W34 L32",
    description: "Authentic Carhartt work pants in brown. Heavy-duty construction. Multiple pockets including hammer loop. Perfect for work or streetwear.",
    photos: [
      "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=400",
    ],
    category: "Men's Clothing > Pants",
    brand: "Carhartt",
    condition: "good",
    material: ["Cotton Canvas"],
    colors: ["Brown"],
    size: "W34 L32 (EU 34/32)",
    price: 42.00,
    purchaseCost: 20.00,
    quantity: 1,
    packageSize: "medium",
    status: "published",
    publishedTo: ["Boutique Alice"],
    createdAt: new Date("2025-10-23T15:30:00"),
    updatedAt: new Date("2025-10-25T10:15:00"),
    publishHistory: [
      {
        accountName: "Boutique Alice",
        timestamp: new Date("2025-10-25T10:15:00"),
        status: "success",
      },
    ],
  },
  {
    id: "prod-005",
    sku: "VM-20251029-N3X8",
    title: "Tommy Hilfiger Polo Shirt - Red - Size XL",
    description: "Classic Tommy Hilfiger polo in vibrant red. Logo embroidery on chest. Short sleeves. Great condition with minimal wear.",
    photos: [
      "https://images.unsplash.com/photo-1586363104862-3a5e2ab60d99?w=400",
    ],
    category: "Men's Clothing > Polo Shirts",
    brand: "Tommy Hilfiger",
    condition: "excellent",
    material: ["Cotton Piqué"],
    colors: ["Red"],
    size: "XL (EU XL)",
    price: 28.00,
    purchaseCost: 8.50,
    quantity: 1,
    packageSize: "small",
    status: "draft",
    publishedTo: [],
    createdAt: new Date("2025-10-29T09:45:00"),
    updatedAt: new Date("2025-10-29T09:45:00"),
    publishHistory: [],
  },
  {
    id: "prod-006",
    sku: "VM-20251026-R8W4",
    title: "Nike Air Max Sneakers - White/Grey - US 10",
    description: "Classic Nike Air Max sneakers. White leather with grey accents. Visible air cushioning. Light wear on soles, uppers in great shape.",
    photos: [
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400",
    ],
    category: "Men's Shoes > Sneakers",
    brand: "Nike",
    condition: "good",
    material: ["Leather", "Synthetic"],
    colors: ["White", "Grey"],
    size: "US 10 (EU 44)",
    price: 65.00,
    purchaseCost: 32.00,
    quantity: 1,
    packageSize: "large",
    status: "failed",
    publishedTo: [],
    internalNotes: "Failed to publish - retry with better photos",
    createdAt: new Date("2025-10-22T14:00:00"),
    updatedAt: new Date("2025-10-26T16:30:00"),
    publishHistory: [
      {
        accountName: "Frip Tim",
        timestamp: new Date("2025-10-26T16:30:00"),
        status: "failed",
        error: "Image quality too low",
      },
    ],
  },
];

export const CATEGORIES = [
  "Men's Clothing > Jeans",
  "Men's Clothing > Sweaters",
  "Men's Clothing > Jackets",
  "Men's Clothing > Pants",
  "Men's Clothing > Polo Shirts",
  "Men's Clothing > T-Shirts",
  "Men's Clothing > Shirts",
  "Men's Shoes > Sneakers",
  "Men's Shoes > Boots",
  "Women's Clothing > Dresses",
  "Women's Clothing > Jeans",
  "Women's Clothing > Tops",
  "Women's Shoes > Heels",
  "Women's Shoes > Boots",
  "Accessories > Bags",
  "Accessories > Hats",
];

export const BRANDS = [
  "Levi's",
  "Ralph Lauren",
  "Adidas",
  "Nike",
  "Carhartt",
  "Tommy Hilfiger",
  "Lacoste",
  "Fred Perry",
  "The North Face",
  "Patagonia",
  "Vintage",
  "Unbranded",
];

export const CONDITIONS: { value: ProductCondition; label: string }[] = [
  { value: "new_with_tags", label: "New with tags" },
  { value: "new", label: "New" },
  { value: "excellent", label: "Excellent" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
];

export const PACKAGE_SIZES: { value: PackageSize }[] = [
  { value: "small" },
  { value: "medium" },
  { value: "large" },
];