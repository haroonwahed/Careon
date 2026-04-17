import { useState } from "react";
import { Search, ExternalLink, ChevronDown } from "lucide-react";
import { Language, formatCurrency } from "../../lib/i18n";
import { Badge } from "../ui/badge";

interface Product {
  id: string;
  title: string;
  brand: string;
  size: string;
  condition: string;
  material: string;
  color: string;
  price: number;
  images: string[];
  addedDate: string;
  soldDate?: string;
  status: "sold" | "removed" | "unsold";
  url: string;
}

interface HistoryTabProps {
  language: Language;
}

// Mock data
const mockProducts: Product[] = [
  {
    id: "1",
    title: "Pull en laine vintage années 80",
    brand: "Vintage",
    size: "M",
    condition: "Très bon état",
    material: "Laine",
    color: "Beige",
    price: 28.0,
    images: ["https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=400&h=400&fit=crop"],
    addedDate: "15 déc. 2024",
    soldDate: "22 déc. 2024",
    status: "sold",
    url: "https://vinted.fr",
  },
  {
    id: "2",
    title: "Veste en jean Levi's 501",
    brand: "Levi's",
    size: "L",
    condition: "Bon état",
    material: "Denim",
    color: "Bleu",
    price: 45.0,
    images: ["https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=400&fit=crop"],
    addedDate: "12 déc. 2024",
    soldDate: "20 déc. 2024",
    status: "sold",
    url: "https://vinted.fr",
  },
  {
    id: "3",
    title: "Robe d'été à fleurs",
    brand: "Zara",
    size: "S",
    condition: "Neuf avec étiquette",
    material: "Coton",
    color: "Multicolore",
    price: 22.0,
    images: ["https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400&h=400&fit=crop"],
    addedDate: "18 déc. 2024",
    status: "unsold",
    url: "https://vinted.fr",
  },
  {
    id: "4",
    title: "Sneakers Nike Air Max 90",
    brand: "Nike",
    size: "42",
    condition: "Bon état",
    material: "Cuir synthétique",
    color: "Blanc",
    price: 65.0,
    images: ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop"],
    addedDate: "10 déc. 2024",
    soldDate: "25 déc. 2024",
    status: "sold",
    url: "https://vinted.fr",
  },
];

export function HistoryTab({ language }: HistoryTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<"sold" | "removed" | "unsold">("sold");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProducts = mockProducts.filter(
    (p) =>
      p.status === activeSubTab &&
      (p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.brand.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="p-6">
      {/* Sub-tabs */}
      <div className="flex items-center gap-2 mb-6 border-b dark:border-[rgba(168,85,247,0.15)] border-border">
        <button
          onClick={() => setActiveSubTab("sold")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeSubTab === "sold"
              ? "dark:text-primary text-primary dark:border-primary border-primary"
              : "dark:text-[#9CA3AF] text-muted-foreground border-transparent hover:dark:text-[#E7E7F0] hover:text-foreground"
          }`}
        >
          {language === "fr" ? "Ventes" : "Sold"}
        </button>
        <button
          onClick={() => setActiveSubTab("removed")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeSubTab === "removed"
              ? "dark:text-primary text-primary dark:border-primary border-primary"
              : "dark:text-[#9CA3AF] text-muted-foreground border-transparent hover:dark:text-[#E7E7F0] hover:text-foreground"
          }`}
        >
          {language === "fr" ? "Retirés" : "Removed"}
        </button>
        <button
          onClick={() => setActiveSubTab("unsold")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeSubTab === "unsold"
              ? "dark:text-primary text-primary dark:border-primary border-primary"
              : "dark:text-[#9CA3AF] text-muted-foreground border-transparent hover:dark:text-[#E7E7F0] hover:text-foreground"
          }`}
        >
          {language === "fr" ? "Invendus" : "Unsold"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <select className="px-4 py-2.5 rounded-xl dark:bg-[#1A1A24] bg-muted border dark:border-[rgba(168,85,247,0.20)] border-border dark:text-[#E7E7F0] text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
            <option>{language === "fr" ? "Toutes les marques" : "All brands"}</option>
            <option>Nike</option>
            <option>Zara</option>
            <option>Levi's</option>
          </select>

          <select className="px-4 py-2.5 rounded-xl dark:bg-[#1A1A24] bg-muted border dark:border-[rgba(168,85,247,0.20)] border-border dark:text-[#E7E7F0] text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
            <option>{language === "fr" ? "Tous les états" : "All conditions"}</option>
            <option>{language === "fr" ? "Neuf" : "New"}</option>
            <option>{language === "fr" ? "Très bon" : "Very good"}</option>
            <option>{language === "fr" ? "Bon" : "Good"}</option>
          </select>

          <select className="px-4 py-2.5 rounded-xl dark:bg-[#1A1A24] bg-muted border dark:border-[rgba(168,85,247,0.20)] border-border dark:text-[#E7E7F0] text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
            <option>{language === "fr" ? "Plus récent" : "Most recent"}</option>
            <option>{language === "fr" ? "Plus ancien" : "Oldest"}</option>
            <option>{language === "fr" ? "Prix croissant" : "Price ascending"}</option>
            <option>{language === "fr" ? "Prix décroissant" : "Price descending"}</option>
          </select>
        </div>

        <div className="relative flex-1 w-full sm:w-auto sm:max-w-xs ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 dark:text-[#9CA3AF] text-muted-foreground" />
          <input
            type="text"
            placeholder={
              language === "fr" ? "Rechercher..." : "Search..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl dark:bg-[#1A1A24] bg-muted border dark:border-[rgba(168,85,247,0.20)] border-border dark:text-[#E7E7F0] text-foreground placeholder:dark:text-[#9CA3AF] placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* Products grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredProducts.map((product) => (
          <ProductCard key={product.id} product={product} language={language} />
        ))}
      </div>

      {/* Empty state */}
      {filteredProducts.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm dark:text-[#9CA3AF] text-muted-foreground">
            {language === "fr" ? "Aucun produit trouvé" : "No products found"}
          </p>
        </div>
      )}
    </div>
  );
}

function ProductCard({ product, language }: { product: Product; language: Language }) {
  const getStatusBadge = () => {
    switch (product.status) {
      case "sold":
        return (
          <Badge className="dark:bg-green-500/20 bg-green-500/10 dark:text-green-400 text-green-600 border-0 text-xs">
            {language === "fr" ? "Vendu" : "Sold"}
          </Badge>
        );
      case "removed":
        return (
          <Badge className="dark:bg-orange-500/20 bg-orange-500/10 dark:text-orange-400 text-orange-600 border-0 text-xs">
            {language === "fr" ? "Retiré" : "Removed"}
          </Badge>
        );
      case "unsold":
        return (
          <Badge className="dark:bg-yellow-500/20 bg-yellow-500/10 dark:text-yellow-400 text-yellow-600 border-0 text-xs">
            {language === "fr" ? "En ligne" : "Online"}
          </Badge>
        );
    }
  };

  return (
    <div
      className="rounded-xl border dark:border-[rgba(168,85,247,0.20)] border-border dark:bg-[#0E0E14] bg-card overflow-hidden hover:dark:border-[rgba(168,85,247,0.35)] hover:border-border/80 transition-all duration-200"
      style={{
        boxShadow: "0 0 0 1px rgba(168,85,247,0.15)",
      }}
    >
      <div className="flex gap-4 p-4">
        {/* Images */}
        <div className="flex-shrink-0">
          <div className="w-32 h-32 rounded-lg overflow-hidden dark:bg-[#1A1A24] bg-muted">
            <img
              src={product.images[0]}
              alt={product.title}
              className="w-full h-full object-cover"
            />
          </div>
          {product.images.length > 1 && (
            <div className="flex gap-1 mt-2">
              {product.images.slice(1, 4).map((img, i) => (
                <div
                  key={i}
                  className="w-9 h-9 rounded overflow-hidden dark:bg-[#1A1A24] bg-muted"
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <h4 className="text-sm dark:text-[#E7E7F0] text-foreground line-clamp-2 pr-2">
              {product.title}
            </h4>
            {getStatusBadge()}
          </div>

          <div className="text-2xl dark:text-primary text-primary font-semibold mb-3 tabular-nums">
            {formatCurrency(product.price, language)}
          </div>

          <div className="space-y-1.5 mb-3">
            <InfoRow
              label={language === "fr" ? "Marque" : "Brand"}
              value={product.brand}
            />
            <InfoRow
              label={language === "fr" ? "Taille" : "Size"}
              value={product.size}
            />
            <InfoRow
              label={language === "fr" ? "État" : "Condition"}
              value={product.condition}
            />
            <InfoRow
              label={language === "fr" ? "Matière" : "Material"}
              value={product.material}
            />
            <InfoRow
              label={language === "fr" ? "Couleur" : "Color"}
              value={product.color}
            />
          </div>

          <div className="flex items-center justify-between text-xs dark:text-[#9CA3AF] text-muted-foreground">
            <div>
              <span>
                {language === "fr" ? "Ajoutée le" : "Added on"} {product.addedDate}
              </span>
              {product.soldDate && (
                <>
                  <span className="mx-2">•</span>
                  <span>
                    {language === "fr" ? "Vendue le" : "Sold on"} {product.soldDate}
                  </span>
                </>
              )}
            </div>
          </div>

          <a
            href={product.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-3 text-sm dark:text-primary text-primary hover:underline"
          >
            {language === "fr" ? "Voir sur Vinted" : "View on Vinted"}
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center text-xs">
      <span className="dark:text-[#9CA3AF] text-muted-foreground w-20">
        {label}
      </span>
      <span className="dark:text-[#E7E7F0] text-foreground">{value}</span>
    </div>
  );
}
