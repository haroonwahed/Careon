import { useState } from "react";
import { SidebarExtended, Page } from "./SidebarExtended";
import { Language } from "../lib/i18n";

export function SidebarDemo() {
  const [activePage, setActivePage] = useState<Page>("dashboard");
  const [variant, setVariant] = useState<"soft" | "max">("soft");
  const [language, setLanguage] = useState<Language>("fr");

  const handleGlobalRefresh = async () => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
  };

  const handleCollapse = () => {
    console.log("Collapse sidebar");
  };

  return (
    <div className="min-h-screen dark:bg-[#0A0A0F] bg-background">
      {/* Variant Switcher */}
      <div className="fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => setVariant("soft")}
          className={`px-4 py-2 rounded-lg text-sm transition-all ${
            variant === "soft"
              ? "dark:bg-primary bg-primary dark:text-white text-white"
              : "dark:bg-[#1A1A24] bg-muted dark:text-[#E7E7F0] text-foreground"
          }`}
        >
          Compact Soft
        </button>
        <button
          onClick={() => setVariant("max")}
          className={`px-4 py-2 rounded-lg text-sm transition-all ${
            variant === "max"
              ? "dark:bg-primary bg-primary dark:text-white text-white"
              : "dark:bg-[#1A1A24] bg-muted dark:text-[#E7E7F0] text-foreground"
          }`}
        >
          Compact Max
        </button>
        <button
          onClick={() => setLanguage(language === "fr" ? "en" : "fr")}
          className="px-4 py-2 rounded-lg text-sm dark:bg-[#1A1A24] bg-muted dark:text-[#E7E7F0] text-foreground"
        >
          {language === "fr" ? "🇫🇷 FR" : "🇬🇧 EN"}
        </button>
      </div>

      {/* Sidebar */}
      <SidebarExtended
        activePage={activePage}
        onPageChange={setActivePage}
        language={language}
        onGlobalRefresh={handleGlobalRefresh}
        onCollapse={handleCollapse}
        variant={variant}
      />

      {/* Main Content */}
      <div className="ml-56 p-8">
        <div className="max-w-4xl">
          <h1 className="text-2xl dark:text-[#E7E7F0] text-foreground mb-4">
            Sidebar Extended - {variant === "soft" ? "Compact Soft" : "Compact Max"}
          </h1>
          
          <div
            className="rounded-2xl border dark:border-[rgba(168,85,247,0.25)] border-border dark:bg-[#0E0E14] bg-card p-8"
            style={{
              boxShadow: "0 0 0 1px rgba(168,85,247,0.25), 0 0 28px rgba(168,85,247,0.10)",
            }}
          >
            <h2 className="text-xl dark:text-[#E7E7F0] text-foreground mb-4">
              Active Page: {activePage}
            </h2>
            
            <div className="space-y-4 text-sm dark:text-[#9CA3AF] text-muted-foreground">
              <div>
                <h3 className="text-base dark:text-[#E7E7F0] text-foreground mb-2">
                  Variante actuelle: <span className="dark:text-primary text-primary">{variant === "soft" ? "Compact Soft" : "Compact Max"}</span>
                </h3>
                <p className="leading-relaxed">
                  {variant === "soft" 
                    ? "Version proche du design actuel, avec des espacements confortables mais réduits de ~15-20%. Toutes les sections sont visibles sans scroll sur un écran laptop standard (1080p+)."
                    : "Version ultra-dense avec espacements réduits de ~30-35%. Maximum de compacité tout en conservant le style premium Vintsy. Idéale pour les écrans plus petits ou pour maximiser l'espace de contenu."
                  }
                </p>
              </div>

              <div>
                <h3 className="text-base dark:text-[#E7E7F0] text-foreground mb-2">Sections visibles</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>COMPTES - Compte Launcher</li>
                  <li>PRINCIPAL - Dashboard, Notifications, Messages</li>
                  <li>VENTE-ACHAT - Mes commandes</li>
                  <li>ANNONCES - Stock Manager, Publisher, Published</li>
                  <li>TRACKING - Produits, Vendeurs, Publiques</li>
                  <li>PARAMÈTRES - Settings</li>
                  <li>Footer - Actualiser tout + Réduire la barre</li>
                </ul>
              </div>

              <div>
                <h3 className="text-base dark:text-[#E7E7F0] text-foreground mb-2">Différences techniques</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b dark:border-[rgba(168,85,247,0.15)] border-border">
                        <th className="text-left py-2 dark:text-[#E7E7F0] text-foreground">Élément</th>
                        <th className="text-left py-2 dark:text-[#E7E7F0] text-foreground">Compact Soft</th>
                        <th className="text-left py-2 dark:text-[#E7E7F0] text-foreground">Compact Max</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-[rgba(168,85,247,0.10)] divide-border">
                      <tr>
                        <td className="py-2">Container padding</td>
                        <td className="py-2">py-4</td>
                        <td className="py-2 dark:text-primary text-primary">py-3</td>
                      </tr>
                      <tr>
                        <td className="py-2">Section gap</td>
                        <td className="py-2">mb-4</td>
                        <td className="py-2 dark:text-primary text-primary">mb-3</td>
                      </tr>
                      <tr>
                        <td className="py-2">Item height</td>
                        <td className="py-2">h-9 (36px)</td>
                        <td className="py-2 dark:text-primary text-primary">h-8 (32px)</td>
                      </tr>
                      <tr>
                        <td className="py-2">Item gap</td>
                        <td className="py-2">gap-1</td>
                        <td className="py-2 dark:text-primary text-primary">gap-0.5</td>
                      </tr>
                      <tr>
                        <td className="py-2">Label size</td>
                        <td className="py-2">text-[13px]</td>
                        <td className="py-2 dark:text-primary text-primary">text-[12px]</td>
                      </tr>
                      <tr>
                        <td className="py-2">Section title size</td>
                        <td className="py-2">text-[10px]</td>
                        <td className="py-2 dark:text-primary text-primary">text-[9px]</td>
                      </tr>
                      <tr>
                        <td className="py-2">Icon size</td>
                        <td className="py-2">w-4 h-4</td>
                        <td className="py-2 dark:text-primary text-primary">w-3.5 h-3.5</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-6 p-4 rounded-lg dark:bg-primary/10 bg-primary/5 border dark:border-primary/20 border-primary/30">
                <p className="text-sm dark:text-primary text-primary">
                  💡 <strong>Recommandation:</strong> La variante <strong>Compact Soft</strong> est optimale pour un usage quotidien, 
                  offrant un bon équilibre entre densité et confort visuel. La variante <strong>Compact Max</strong> 
                  est idéale pour les écrans plus petits ou lorsque l'on souhaite maximiser l'espace de contenu.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
