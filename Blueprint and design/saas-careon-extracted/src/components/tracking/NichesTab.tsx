import { useState } from "react";
import { Search, Filter, Download, ExternalLink } from "lucide-react";
import { Language, formatCurrency } from "../../lib/i18n";

interface Niche {
  id: string;
  name: string;
  avgPrice: number;
  productsAnalyzed: number;
  saleRate: number;
  salesPerDay: number;
  addsPerDay: number;
  saleTime: number;
}

interface NichesTabProps {
  language: Language;
}

// Mock data
const mockNiches: Niche[] = [
  {
    id: "1",
    name: "Pull en laine vintage",
    avgPrice: 28.5,
    productsAnalyzed: 145,
    saleRate: 72,
    salesPerDay: 12.4,
    addsPerDay: 18.2,
    saleTime: 8,
  },
  {
    id: "2",
    name: "Veste en jean Levi's",
    avgPrice: 45.0,
    productsAnalyzed: 98,
    saleRate: 65,
    salesPerDay: 8.1,
    addsPerDay: 11.5,
    saleTime: 12,
  },
  {
    id: "3",
    name: "Robe d'été fleurie",
    avgPrice: 22.0,
    productsAnalyzed: 203,
    saleRate: 78,
    salesPerDay: 15.7,
    addsPerDay: 20.8,
    saleTime: 6,
  },
  {
    id: "4",
    name: "Sneakers Nike vintage",
    avgPrice: 65.0,
    productsAnalyzed: 76,
    saleRate: 58,
    salesPerDay: 5.2,
    addsPerDay: 9.1,
    saleTime: 15,
  },
  {
    id: "5",
    name: "Sac à main cuir",
    avgPrice: 38.5,
    productsAnalyzed: 112,
    saleRate: 61,
    salesPerDay: 7.3,
    addsPerDay: 10.4,
    saleTime: 10,
  },
];

export function NichesTab({ language }: NichesTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredNiches = mockNiches.filter((niche) =>
    niche.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredNiches.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedNiches = filteredNiches.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  return (
    <div className="p-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 dark:text-[#9CA3AF] text-muted-foreground" />
          <input
            type="text"
            placeholder={
              language === "fr" ? "Rechercher une niche..." : "Search niche..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl dark:bg-[#1A1A24] bg-muted border dark:border-[rgba(168,85,247,0.20)] border-border dark:text-[#E7E7F0] text-foreground placeholder:dark:text-[#9CA3AF] placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl dark:bg-[#1A1A24] bg-muted border dark:border-[rgba(168,85,247,0.20)] border-border dark:text-[#E7E7F0] text-foreground text-sm transition-all duration-200 hover:dark:bg-[#242430] hover:bg-muted/70">
            <Filter className="w-4 h-4" />
            <span>{language === "fr" ? "Filtres" : "Filters"}</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl dark:bg-[#1A1A24] bg-muted border dark:border-[rgba(168,85,247,0.20)] border-border dark:text-[#E7E7F0] text-foreground text-sm transition-all duration-200 hover:dark:bg-[#242430] hover:bg-muted/70">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">
              {language === "fr" ? "Exporter" : "Export"}
            </span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border dark:border-[rgba(168,85,247,0.25)] border-border dark:bg-[#0E0E14] bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b dark:border-[rgba(168,85,247,0.15)] border-border">
              <th className="text-left px-6 py-4 text-xs font-semibold dark:text-[#9CA3AF] text-muted-foreground uppercase tracking-wide">
                {language === "fr" ? "Niche" : "Niche"}
              </th>
              <th className="text-right px-6 py-4 text-xs font-semibold dark:text-[#9CA3AF] text-muted-foreground uppercase tracking-wide">
                {language === "fr" ? "Prix moyen" : "Avg price"}
              </th>
              <th className="text-right px-6 py-4 text-xs font-semibold dark:text-[#9CA3AF] text-muted-foreground uppercase tracking-wide">
                {language === "fr" ? "Produits" : "Products"}
              </th>
              <th className="text-right px-6 py-4 text-xs font-semibold dark:text-[#9CA3AF] text-muted-foreground uppercase tracking-wide">
                {language === "fr" ? "% vente" : "Sale rate"}
              </th>
              <th className="text-right px-6 py-4 text-xs font-semibold dark:text-[#9CA3AF] text-muted-foreground uppercase tracking-wide">
                {language === "fr" ? "Ventes/j" : "Sales/day"}
              </th>
              <th className="text-right px-6 py-4 text-xs font-semibold dark:text-[#9CA3AF] text-muted-foreground uppercase tracking-wide">
                {language === "fr" ? "Ajouts/j" : "Adds/day"}
              </th>
              <th className="text-right px-6 py-4 text-xs font-semibold dark:text-[#9CA3AF] text-muted-foreground uppercase tracking-wide">
                {language === "fr" ? "Temps vente" : "Sale time"}
              </th>
              <th className="text-right px-6 py-4 text-xs font-semibold dark:text-[#9CA3AF] text-muted-foreground uppercase tracking-wide">
                {language === "fr" ? "Action" : "Action"}
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedNiches.map((niche, index) => (
              <tr
                key={niche.id}
                className={`
                  border-b dark:border-[rgba(168,85,247,0.10)] border-border last:border-0
                  hover:dark:bg-[#1A1A24] hover:bg-muted/30 transition-colors
                `}
              >
                <td className="px-6 py-4">
                  <span className="text-sm dark:text-[#E7E7F0] text-foreground">
                    {niche.name}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-sm dark:text-[#E7E7F0] text-foreground tabular-nums">
                    {formatCurrency(niche.avgPrice, language)}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-sm dark:text-[#E7E7F0] text-foreground tabular-nums">
                    {niche.productsAnalyzed}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span
                    className={`text-sm tabular-nums ${
                      niche.saleRate >= 70
                        ? "dark:text-green-400 text-green-600"
                        : niche.saleRate >= 60
                        ? "dark:text-orange-400 text-orange-600"
                        : "dark:text-red-400 text-red-600"
                    }`}
                  >
                    {niche.saleRate}%
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-sm dark:text-[#E7E7F0] text-foreground tabular-nums">
                    {niche.salesPerDay.toFixed(1)}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-sm dark:text-[#E7E7F0] text-foreground tabular-nums">
                    {niche.addsPerDay.toFixed(1)}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-sm dark:text-[#E7E7F0] text-foreground tabular-nums">
                    {niche.saleTime}j
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="inline-flex items-center gap-1.5 text-sm dark:text-primary text-primary hover:underline">
                    {language === "fr" ? "Voir les ventes" : "View sales"}
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 mt-4">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-2 rounded-lg dark:bg-[#1A1A24] bg-muted border dark:border-[rgba(168,85,247,0.20)] border-border dark:text-[#E7E7F0] text-foreground text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:dark:bg-[#242430] hover:bg-muted/70"
          >
            {language === "fr" ? "Précédent" : "Previous"}
          </button>
          <span className="text-sm dark:text-[#9CA3AF] text-muted-foreground px-3 tabular-nums">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-2 rounded-lg dark:bg-[#1A1A24] bg-muted border dark:border-[rgba(168,85,247,0.20)] border-border dark:text-[#E7E7F0] text-foreground text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:dark:bg-[#242430] hover:bg-muted/70"
          >
            {language === "fr" ? "Suivant" : "Next"}
          </button>
        </div>
      )}
    </div>
  );
}
