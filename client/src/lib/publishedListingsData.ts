export interface ListingAnalytics {
  views: number;
  favorites: number;
  offers: number;
  avgOfferPrice: number;
  bestOfferPrice: number;
  lowestOfferPrice: number;
  viewsHistory: { date: Date; value: number }[];
  favoritesHistory: { date: Date; value: number }[];
  offersHistory: { date: Date; value: number }[];
  viewsTrend: number; // % change vs previous period
  favoritesTrend: number;
}

export interface PublishedListing {
  id: string;
  sku: string;
  title: string;
  description: string;
  category: string;
  brand: string;
  condition: string;
  material: string;
  size: string;
  price: number;
  packageSize: "small" | "medium" | "large";
  photos: string[];
  photoCount: number; // For insights
  accountId: string;
  accountName: string;
  vintedListingId: string;
  vintedUrl: string;
  status: "active" | "sold";
  publishedDate: Date;
  lastSyncDate: Date;
  analytics: ListingAnalytics;
  boostActive: boolean;
  isHidden: boolean;
}

export interface ListingInsight {
  id: string;
  type: "photos" | "oldListing" | "lowEngagement" | "offersLow" | "missingBrand" | "shortDescription" | "hidden" | "boostActive";
  severity: "info" | "warning" | "critical";
  data?: Record<string, any>; // Additional data for the insight (e.g., { days: 20, percent: 30 })
}

export type ListingStatusType = "active" | "boostActive" | "hidden" | "needsRepost" | "lowPhotos" | "sold";

export interface ListingStatus {
  type: ListingStatusType;
  priority: number; // Higher = more important
}

// Helper to get all statuses for a listing
export function getListingStatuses(listing: PublishedListing): ListingStatus[] {
  const statuses: ListingStatus[] = [];
  
  if (listing.status === "sold") {
    statuses.push({ type: "sold", priority: 100 });
    return statuses; // Sold overrides everything
  }
  
  if (listing.isHidden) {
    statuses.push({ type: "hidden", priority: 90 });
  }
  
  const daysOld = Math.floor((Date.now() - listing.publishedDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysOld > 14) {
    statuses.push({ type: "needsRepost", priority: 80 });
  }
  
  if (listing.photoCount < 3) {
    statuses.push({ type: "lowPhotos", priority: 70 });
  }
  
  if (listing.boostActive) {
    statuses.push({ type: "boostActive", priority: 60 });
  }
  
  if (statuses.length === 0) {
    statuses.push({ type: "active", priority: 0 });
  }
  
  return statuses.sort((a, b) => b.priority - a.priority);
}

// Helper to get primary status (highest priority)
export function getPrimaryStatus(listing: PublishedListing): ListingStatusType {
  const statuses = getListingStatuses(listing);
  return statuses[0].type;
}

// Helper function to generate analytics history
function generateHistory(days: number, baseValue: number, variance: number): { date: Date; value: number }[] {
  const history: { date: Date; value: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const value = Math.max(0, baseValue + Math.floor((Math.random() - 0.5) * variance));
    history.push({ date, value });
  }
  return history;
}

// Create date from days ago
function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

// Mock data - 12 active listings
export const mockPublishedListings: PublishedListing[] = [
  {
    id: "listing_001",
    sku: "VM-328",
    title: "Sac à main marron chocolat effet clouté",
    description: "Magnifique sac à main en simili-cuir marron chocolat avec effet clouté. Porté seulement quelques fois, état impeccable. Dimensions: 30x25x10cm. Bretelle ajustable. Fermeture zippée avec poche intérieure.",
    category: "Sacs",
    brand: "",
    condition: "veryGood",
    material: "Simili-cuir",
    size: "Unique",
    price: 34.99,
    packageSize: "medium",
    photos: [
      "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=400&h=400&fit=crop",
    ],
    photoCount: 2, // Low photos
    accountId: "acc_001",
    accountName: "Boutique Alice",
    vintedListingId: "vinted_328",
    vintedUrl: "https://vinted.fr/items/328",
    status: "active",
    publishedDate: new Date("2025-12-23"),
    lastSyncDate: new Date(),
    analytics: {
      views: 61,
      favorites: 25,
      offers: 3,
      avgOfferPrice: 30.00,
      bestOfferPrice: 32.00,
      lowestOfferPrice: 28.00,
      viewsHistory: generateHistory(30, 2, 3),
      favoritesHistory: generateHistory(30, 0.8, 2),
      offersHistory: generateHistory(30, 0.1, 0.5),
      viewsTrend: 15.2,
      favoritesTrend: 12.5,
    },
    boostActive: false,
    isHidden: false,
  },
  {
    id: "listing_002",
    sku: "VM-216",
    title: "Sweat à capuche Zadig&Voltaire noir (taille S)",
    description: "Sweat à capuche de la marque Zadig&Voltaire en excellent état. Couleur noir. Taille S. Coupe moderne et confortable. Logo brodé discret. Très peu porté, comme neuf.",
    category: "Sweats",
    brand: "Zadig&Voltaire",
    condition: "veryGood",
    material: "Coton",
    size: "S",
    price: 130.00,
    packageSize: "medium",
    photos: [
      "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1620799139834-6b8f844fbe61?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=400&fit=crop",
    ],
    photoCount: 6, // Boost active
    accountId: "acc_001",
    accountName: "Boutique Alice",
    vintedListingId: "vinted_216",
    vintedUrl: "https://vinted.fr/items/216",
    status: "active",
    publishedDate: new Date("2025-12-22"),
    lastSyncDate: new Date(),
    analytics: {
      views: 84,
      favorites: 28,
      offers: 5,
      avgOfferPrice: 115.00,
      bestOfferPrice: 125.00,
      lowestOfferPrice: 105.00,
      viewsHistory: generateHistory(30, 2.8, 4),
      favoritesHistory: generateHistory(30, 0.9, 2),
      offersHistory: generateHistory(30, 0.15, 0.6),
      viewsTrend: 22.3,
      favoritesTrend: 18.7,
    },
    boostActive: true,
    isHidden: false,
  },
  {
    id: "listing_003",
    sku: "VM-334",
    title: "Pull col roulé gris (taille M)",
    description: "Pull col roulé en maille grise. Taille M. Parfait pour l'hiver. État impeccable, aucun défaut. Très doux et confortable.",
    category: "Pulls",
    brand: "",
    condition: "veryGood",
    material: "Maille acrylique",
    size: "M",
    price: 24.99,
    packageSize: "medium",
    photos: [
      "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1620799140188-3b2a02fd9a77?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&h=400&fit=crop",
    ],
    photoCount: 5, // Active
    accountId: "acc_001",
    accountName: "Boutique Alice",
    vintedListingId: "vinted_334",
    vintedUrl: "https://vinted.fr/items/334",
    status: "active",
    publishedDate: new Date("2025-12-22"),
    lastSyncDate: new Date(),
    analytics: {
      views: 233,
      favorites: 38,
      offers: 4,
      avgOfferPrice: 22.10,
      bestOfferPrice: 24.00,
      lowestOfferPrice: 20.00,
      viewsHistory: generateHistory(30, 7.8, 8),
      favoritesHistory: generateHistory(30, 1.3, 3),
      offersHistory: generateHistory(30, 0.13, 0.5),
      viewsTrend: 28.5,
      favoritesTrend: 14.2,
    },
    boostActive: false,
    isHidden: false,
  },
  {
    id: "listing_004",
    sku: "VM-222",
    title: "Pull Isabel Marant gris à paillette rose pâle (taille S)",
    description: "Superbe pull Isabel Marant en gris chiné avec de délicates paillettes rose pâle. Taille S. État excellent. Pièce unique et élégante, parfaite pour les fêtes. Très doux au toucher.",
    category: "Pulls",
    brand: "Isabel Marant",
    condition: "veryGood",
    material: "Laine mélangée",
    size: "S",
    price: 130.00,
    packageSize: "medium",
    photos: [
      "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1620799140188-3b2a02fd9a77?w=400&h=400&fit=crop",
    ],
    photoCount: 5, // Boost active
    accountId: "acc_001",
    accountName: "Boutique Alice",
    vintedListingId: "vinted_222",
    vintedUrl: "https://vinted.fr/items/222",
    status: "active",
    publishedDate: new Date("2025-12-22"),
    lastSyncDate: new Date(),
    analytics: {
      views: 125,
      favorites: 51,
      offers: 9,
      avgOfferPrice: 112.00,
      bestOfferPrice: 125.00,
      lowestOfferPrice: 95.00,
      viewsHistory: generateHistory(30, 4.2, 5),
      favoritesHistory: generateHistory(30, 1.7, 3),
      offersHistory: generateHistory(30, 0.3, 1),
      viewsTrend: 18.9,
      favoritesTrend: 25.3,
    },
    boostActive: true,
    isHidden: false,
  },
  {
    id: "listing_005",
    sku: "VM-901",
    title: "Nike Air Max 90 sneakers (EU 42)",
    description: "Nike Air Max 90 en blanc et gris. Pointure EU 42 / US 9. Portées quelques fois seulement, état quasi neuf. Semelle en excellent état. Boîte d'origine non fournie. Design iconique et intemporel.",
    category: "Baskets",
    brand: "Nike",
    condition: "veryGood",
    material: "Cuir, Mesh",
    size: "EU 42",
    price: 89.99,
    packageSize: "medium",
    photos: [
      "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1605348532760-6753d2c43329?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=400&h=400&fit=crop",
    ],
    photoCount: 4, // Needs repost (old)
    accountId: "acc_001",
    accountName: "Boutique Alice",
    vintedListingId: "vinted_901",
    vintedUrl: "https://vinted.fr/items/901",
    status: "active",
    publishedDate: daysAgo(16), // 10 Dec - old listing
    lastSyncDate: new Date(),
    analytics: {
      views: 432,
      favorites: 126,
      offers: 12,
      avgOfferPrice: 74.50,
      bestOfferPrice: 82.00,
      lowestOfferPrice: 65.00,
      viewsHistory: generateHistory(30, 14.4, 12),
      favoritesHistory: generateHistory(30, 4.2, 5),
      offersHistory: generateHistory(30, 0.4, 1),
      viewsTrend: -8.5,
      favoritesTrend: -5.2,
    },
    boostActive: false,
    isHidden: false,
  },
  {
    id: "listing_006",
    sku: "VM-517",
    title: "Chemise Ralph Lauren Lin Rose (taille M)",
    description: "Chemise Ralph Lauren en lin rose pâle. Taille M. Parfaite pour l'été. État excellent. Logo brodé discret. Coupe classique et élégante.",
    category: "Chemises",
    brand: "Ralph Lauren",
    condition: "veryGood",
    material: "Lin",
    size: "M",
    price: 40.00,
    packageSize: "medium",
    photos: [
      "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1598032895397-e5e8f29e9b4e?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&h=400&fit=crop",
    ],
    photoCount: 4, // Active
    accountId: "acc_001",
    accountName: "Boutique Alice",
    vintedListingId: "vinted_517",
    vintedUrl: "https://vinted.fr/items/517",
    status: "active",
    publishedDate: daysAgo(12), // 14 Dec
    lastSyncDate: new Date(),
    analytics: {
      views: 98,
      favorites: 14,
      offers: 2,
      avgOfferPrice: 35.00,
      bestOfferPrice: 37.00,
      lowestOfferPrice: 33.00,
      viewsHistory: generateHistory(30, 3.3, 4),
      favoritesHistory: generateHistory(30, 0.5, 1),
      offersHistory: generateHistory(30, 0.07, 0.3),
      viewsTrend: 10.5,
      favoritesTrend: 5.8,
    },
    boostActive: false,
    isHidden: false,
  },
  {
    id: "listing_007",
    sku: "VM-777",
    title: "Veste cuir vintage (taille M)",
    description: "Veste en cuir véritable vintage. Taille M. Couleur noire. Style biker classique. Quelques signes d'usure qui ajoutent au charme vintage. Doublure en parfait état. Fermeture éclair fonctionnelle.",
    category: "Vestes",
    brand: "",
    condition: "good",
    material: "Cuir véritable",
    size: "M",
    price: 95.00,
    packageSize: "large",
    photos: [
      "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1520975954732-35dd22299614?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&h=400&fit=crop",
    ],
    photoCount: 6, // Hidden + Needs repost
    accountId: "acc_001",
    accountName: "Boutique Alice",
    vintedListingId: "vinted_777",
    vintedUrl: "https://vinted.fr/items/777",
    status: "active",
    publishedDate: daysAgo(23), // 03 Dec
    lastSyncDate: new Date(),
    analytics: {
      views: 310,
      favorites: 63,
      offers: 11,
      avgOfferPrice: 82.00,
      bestOfferPrice: 92.00,
      lowestOfferPrice: 70.00,
      viewsHistory: generateHistory(30, 10.3, 10),
      favoritesHistory: generateHistory(30, 2.1, 3),
      offersHistory: generateHistory(30, 0.37, 1),
      viewsTrend: 5.2,
      favoritesTrend: 8.1,
    },
    boostActive: false,
    isHidden: true, // Hidden listing
  },
  {
    id: "listing_008",
    sku: "VM-112",
    title: "Jupe plissée noire (taille S)",
    description: "Jupe plissée noire élégante. Taille S. Parfait état.",
    category: "Jupes",
    brand: "",
    condition: "veryGood",
    material: "Polyester",
    size: "S",
    price: 18.00,
    packageSize: "small",
    photos: [
      "https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=400&h=400&fit=crop",
    ],
    photoCount: 1, // Low photos
    accountId: "acc_001",
    accountName: "Boutique Alice",
    vintedListingId: "vinted_112",
    vintedUrl: "https://vinted.fr/items/112",
    status: "active",
    publishedDate: new Date("2025-12-21"),
    lastSyncDate: new Date(),
    analytics: {
      views: 52,
      favorites: 9,
      offers: 0,
      avgOfferPrice: 0,
      bestOfferPrice: 0,
      lowestOfferPrice: 0,
      viewsHistory: generateHistory(30, 1.7, 2),
      favoritesHistory: generateHistory(30, 0.3, 1),
      offersHistory: generateHistory(30, 0, 0),
      viewsTrend: 8.3,
      favoritesTrend: 4.5,
    },
    boostActive: false,
    isHidden: false,
  },
  {
    id: "listing_009",
    sku: "VM-431",
    title: "Boots cuir marron (EU 37)",
    description: "Bottines en cuir marron véritable. Pointure EU 37. Talon de 5cm. Fermeture éclair latérale. Très confortables et élégantes. Parfaites pour l'automne et l'hiver. État excellent.",
    category: "Chaussures",
    brand: "",
    condition: "veryGood",
    material: "Cuir",
    size: "EU 37",
    price: 48.00,
    packageSize: "medium",
    photos: [
      "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1605812860427-4024433a70fd?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400&h=400&fit=crop",
    ],
    photoCount: 5, // Boost active
    accountId: "acc_001",
    accountName: "Boutique Alice",
    vintedListingId: "vinted_431",
    vintedUrl: "https://vinted.fr/items/431",
    status: "active",
    publishedDate: daysAgo(17), // 09 Dec
    lastSyncDate: new Date(),
    analytics: {
      views: 168,
      favorites: 42,
      offers: 6,
      avgOfferPrice: 42.00,
      bestOfferPrice: 46.00,
      lowestOfferPrice: 38.00,
      viewsHistory: generateHistory(30, 5.6, 6),
      favoritesHistory: generateHistory(30, 1.4, 2.5),
      offersHistory: generateHistory(30, 0.2, 0.7),
      viewsTrend: 12.8,
      favoritesTrend: 16.2,
    },
    boostActive: true,
    isHidden: false,
  },
  {
    id: "listing_010",
    sku: "VM-624",
    title: "Cardigan rose mohair (taille M)",
    description: "Cardigan en mohair rose pâle. Taille M. Très doux et confortable. Boutons nacrés. État impeccable, comme neuf. Parfait pour les journées fraîches.",
    category: "Cardigans",
    brand: "",
    condition: "veryGood",
    material: "Mohair",
    size: "M",
    price: 29.00,
    packageSize: "medium",
    photos: [
      "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1620799140188-3b2a02fd9a77?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=400&h=400&fit=crop",
    ],
    photoCount: 4, // Active
    accountId: "acc_001",
    accountName: "Boutique Alice",
    vintedListingId: "vinted_624",
    vintedUrl: "https://vinted.fr/items/624",
    status: "active",
    publishedDate: new Date("2025-12-20"),
    lastSyncDate: new Date(),
    analytics: {
      views: 76,
      favorites: 11,
      offers: 2,
      avgOfferPrice: 25.00,
      bestOfferPrice: 27.00,
      lowestOfferPrice: 23.00,
      viewsHistory: generateHistory(30, 2.5, 3),
      favoritesHistory: generateHistory(30, 0.4, 1),
      offersHistory: generateHistory(30, 0.07, 0.3),
      viewsTrend: 18.5,
      favoritesTrend: 11.2,
    },
    boostActive: false,
    isHidden: false,
  },
  {
    id: "listing_011",
    sku: "VM-501",
    title: "Jean Levi's 501 (W30 L32)",
    description: "Jean Levi's 501 classique. Taille W30 L32. Couleur bleu délavé. État excellent, aucun défaut. Coupe droite iconique. Authentique vintage des années 90.",
    category: "Jeans",
    brand: "Levi's",
    condition: "veryGood",
    material: "Denim 100% coton",
    size: "W30 L32",
    price: 34.99,
    packageSize: "medium",
    photos: [
      "https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1542272454315-7957fa89be87?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1542272454315-4c01d7abdf4a?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1475178626620-a4d074967452?w=400&h=400&fit=crop",
    ],
    photoCount: 4, // Active (12 days = not yet 14)
    accountId: "acc_001",
    accountName: "Boutique Alice",
    vintedListingId: "vinted_501",
    vintedUrl: "https://vinted.fr/items/501",
    status: "active",
    publishedDate: daysAgo(14), // 12 Dec
    lastSyncDate: new Date(),
    analytics: {
      views: 175,
      favorites: 58,
      offers: 8,
      avgOfferPrice: 30.00,
      bestOfferPrice: 34.00,
      lowestOfferPrice: 26.00,
      viewsHistory: generateHistory(30, 5.8, 6),
      favoritesHistory: generateHistory(30, 1.9, 3),
      offersHistory: generateHistory(30, 0.27, 0.8),
      viewsTrend: 14.3,
      favoritesTrend: 19.5,
    },
    boostActive: false,
    isHidden: false,
  },
  {
    id: "listing_012",
    sku: "VM-845",
    title: "Manteau laine camel (taille S)",
    description: "Manteau en laine mélangée couleur camel. Taille S. Coupe longue élégante. Fermeture boutonnée. Poches latérales. État excellent. Parfait pour l'hiver.",
    category: "Manteaux",
    brand: "",
    condition: "veryGood",
    material: "Laine mélangée",
    size: "S",
    price: 79.00,
    packageSize: "large",
    photos: [
      "https://images.unsplash.com/photo-1539533113208-f6df8cc8b543?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1544441892-794166f1e3be?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1548126032-079166e0e2f8?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1539533113208-f6df8cc8b543?w=400&h=400&fit=crop",
    ],
    photoCount: 5, // Needs repost
    accountId: "acc_001",
    accountName: "Boutique Alice",
    vintedListingId: "vinted_845",
    vintedUrl: "https://vinted.fr/items/845",
    status: "active",
    publishedDate: daysAgo(28), // 28 Nov - old listing
    lastSyncDate: new Date(),
    analytics: {
      views: 214,
      favorites: 47,
      offers: 9,
      avgOfferPrice: 68.00,
      bestOfferPrice: 76.00,
      lowestOfferPrice: 60.00,
      viewsHistory: generateHistory(30, 7.1, 7),
      favoritesHistory: generateHistory(30, 1.6, 2.5),
      offersHistory: generateHistory(30, 0.3, 0.9),
      viewsTrend: -3.5,
      favoritesTrend: -1.8,
    },
    boostActive: false,
    isHidden: false,
  },
  // Sold listings
  {
    id: "listing_sold_001",
    sku: "VM-198",
    title: "Robe H&M fleurie (taille M)",
    description: "Robe d'été H&M avec motif fleuri. Taille M. État excellent.",
    category: "Robes",
    brand: "H&M",
    condition: "veryGood",
    material: "Coton",
    size: "M",
    price: 22.00,
    packageSize: "small",
    photos: [
      "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1585487000143-3eb89895fa99?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=400&h=400&fit=crop",
    ],
    photoCount: 3,
    accountId: "acc_001",
    accountName: "Boutique Alice",
    vintedListingId: "vinted_198",
    vintedUrl: "https://vinted.fr/items/198",
    status: "sold",
    publishedDate: daysAgo(8),
    lastSyncDate: new Date(),
    analytics: {
      views: 142,
      favorites: 31,
      offers: 6,
      avgOfferPrice: 20.00,
      bestOfferPrice: 22.00,
      lowestOfferPrice: 18.00,
      viewsHistory: generateHistory(30, 4.7, 5),
      favoritesHistory: generateHistory(30, 1, 2),
      offersHistory: generateHistory(30, 0.2, 0.6),
      viewsTrend: 0,
      favoritesTrend: 0,
    },
    boostActive: false,
    isHidden: false,
  },
  {
    id: "listing_sold_002",
    sku: "VM-765",
    title: "Baskets Adidas Superstar (EU 40)",
    description: "Baskets Adidas Superstar blanches avec bandes noires. Pointure EU 40. Bon état.",
    category: "Baskets",
    brand: "Adidas",
    condition: "good",
    material: "Cuir",
    size: "EU 40",
    price: 55.00,
    packageSize: "medium",
    photos: [
      "https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=400&h=400&fit=crop",
    ],
    photoCount: 2,
    accountId: "acc_001",
    accountName: "Boutique Alice",
    vintedListingId: "vinted_765",
    vintedUrl: "https://vinted.fr/items/765",
    status: "sold",
    publishedDate: daysAgo(15),
    lastSyncDate: new Date(),
    analytics: {
      views: 256,
      favorites: 67,
      offers: 11,
      avgOfferPrice: 50.00,
      bestOfferPrice: 55.00,
      lowestOfferPrice: 45.00,
      viewsHistory: generateHistory(30, 8.5, 8),
      favoritesHistory: generateHistory(30, 2.2, 3),
      offersHistory: generateHistory(30, 0.37, 1),
      viewsTrend: 0,
      favoritesTrend: 0,
    },
    boostActive: false,
    isHidden: false,
  },
  {
    id: "listing_sold_003",
    sku: "VM-442",
    title: "Écharpe Zara en laine (beige)",
    description: "Écharpe longue Zara en laine beige. Très douce et chaude. État impeccable.",
    category: "Accessoires",
    brand: "Zara",
    condition: "veryGood",
    material: "Laine",
    size: "Unique",
    price: 15.00,
    packageSize: "small",
    photos: [
      "https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?w=400&h=400&fit=crop",
    ],
    photoCount: 1,
    accountId: "acc_001",
    accountName: "Boutique Alice",
    vintedListingId: "vinted_442",
    vintedUrl: "https://vinted.fr/items/442",
    status: "sold",
    publishedDate: daysAgo(6),
    lastSyncDate: new Date(),
    analytics: {
      views: 89,
      favorites: 22,
      offers: 3,
      avgOfferPrice: 13.00,
      bestOfferPrice: 15.00,
      lowestOfferPrice: 12.00,
      viewsHistory: generateHistory(30, 3, 3),
      favoritesHistory: generateHistory(30, 0.7, 1.5),
      offersHistory: generateHistory(30, 0.1, 0.4),
      viewsTrend: 0,
      favoritesTrend: 0,
    },
    boostActive: false,
    isHidden: false,
  },
  {
    id: "listing_sold_004",
    sku: "VM-310",
    title: "Chemisier blanc Mango (taille S)",
    description: "Chemisier blanc Mango en parfait état. Taille S. Élégant et polyvalent.",
    category: "Chemises",
    brand: "Mango",
    condition: "veryGood",
    material: "Polyester",
    size: "S",
    price: 28.00,
    packageSize: "small",
    photos: [
      "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1598032895397-e5e8f29e9b4e?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&h=400&fit=crop",
    ],
    photoCount: 4,
    accountId: "acc_001",
    accountName: "Boutique Alice",
    vintedListingId: "vinted_310",
    vintedUrl: "https://vinted.fr/items/310",
    status: "sold",
    publishedDate: daysAgo(10),
    lastSyncDate: new Date(),
    analytics: {
      views: 167,
      favorites: 38,
      offers: 7,
      avgOfferPrice: 25.00,
      bestOfferPrice: 28.00,
      lowestOfferPrice: 22.00,
      viewsHistory: generateHistory(30, 5.6, 5),
      favoritesHistory: generateHistory(30, 1.3, 2),
      offersHistory: generateHistory(30, 0.23, 0.7),
      viewsTrend: 0,
      favoritesTrend: 0,
    },
    boostActive: false,
    isHidden: false,
  },
];

// Helper function to generate insights for a listing
export function generateInsights(listing: PublishedListing): ListingInsight[] {
  const insights: ListingInsight[] = [];
  
  // Check for hidden status
  if (listing.isHidden) {
    insights.push({
      id: `insight_${listing.id}_hidden`,
      type: "hidden",
      severity: "warning",
    });
  }
  
  // Check listing age
  const daysOld = Math.floor((Date.now() - listing.publishedDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysOld > 14 && listing.status === "active") {
    insights.push({
      id: `insight_${listing.id}_old`,
      type: "oldListing",
      severity: "critical",
      data: { days: daysOld },
    });
  }
  
  // Check photo count
  if (listing.photoCount < 3) {
    insights.push({
      id: `insight_${listing.id}_photos`,
      type: "photos",
      severity: "warning",
      data: { percent: 40 },
    });
  }
  
  // Check for active boost
  if (listing.boostActive) {
    const boostEndDate = new Date();
    boostEndDate.setDate(boostEndDate.getDate() + 7); // Assume 7 days
    insights.push({
      id: `insight_${listing.id}_boost`,
      type: "boostActive",
      severity: "info",
      data: { date: boostEndDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) },
    });
  }
  
  // Check engagement (high views but low favorites)
  const favoritesRate = listing.analytics.favorites / listing.analytics.views;
  if (listing.analytics.views > 100 && favoritesRate < 0.15) {
    insights.push({
      id: `insight_${listing.id}_engagement`,
      type: "lowEngagement",
      severity: "info",
    });
  }
  
  // Check offers vs price
  if (listing.analytics.offers > 5) {
    const offerDifference = ((listing.price - listing.analytics.avgOfferPrice) / listing.price) * 100;
    if (offerDifference > 15) {
      insights.push({
        id: `insight_${listing.id}_offers`,
        type: "offersLow",
        severity: "warning",
        data: { percent: Math.round(offerDifference) },
      });
    }
  }
  
  // Check for missing brand
  if (!listing.brand) {
    insights.push({
      id: `insight_${listing.id}_brand`,
      type: "missingBrand",
      severity: "info",
    });
  }
  
  // Check description length
  if (listing.description.length < 80) {
    insights.push({
      id: `insight_${listing.id}_description`,
      type: "shortDescription",
      severity: "info",
      data: { percent: 30 },
    });
  }
  
  return insights;
}