import { Euro, Package, TrendingUp, Hash } from "lucide-react";
import { KPICard } from "./KPICard";
import { Product } from "../lib/stockData";
import { Language, t } from "../lib/i18n";

interface InventorySummaryProps {
  products: Product[];
  language: Language;
}

export function InventorySummary({ products, language }: InventorySummaryProps) {
  // Calculate inventory value (cost) = Σ purchaseCost × quantity
  const inventoryCostValue = products.reduce((sum, product) => {
    const cost = product.purchaseCost || 0;
    const qty = product.quantity || 1;
    return sum + (cost * qty);
  }, 0);

  // Calculate inventory value (resale) = Σ price × quantity
  const inventoryResaleValue = products.reduce((sum, product) => {
    const price = product.price || 0;
    const qty = product.quantity || 1;
    return sum + (price * qty);
  }, 0);

  // Calculate potential gross margin
  const potentialMarginValue = inventoryResaleValue - inventoryCostValue;
  const potentialMarginPercent = inventoryResaleValue > 0
    ? ((potentialMarginValue / inventoryResaleValue) * 100)
    : 0;
  
  // Calculate total quantity
  const totalQuantity = products.reduce((sum, product) => {
    return sum + (product.quantity || 1);
  }, 0);

  const formatCurrency = (value: number) => {
    const locale = language === "fr" ? "fr-FR" : "en-GB";
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <KPICard
        label={t(language, "stock.summary.inventoryValueCost")}
        value={formatCurrency(inventoryCostValue)}
        subtitle={language === "fr" ? "Basé sur coût d'achat × quantité" : "Based on purchase cost × quantity"}
        icon={Euro}
      />
      
      <KPICard
        label={t(language, "stock.summary.inventoryValueResale")}
        value={formatCurrency(inventoryResaleValue)}
        subtitle={language === "fr" ? "Basé sur prix de vente × quantité" : "Based on list price × quantity"}
        icon={Package}
      />
      
      <KPICard
        label={t(language, "stock.summary.potentialMargin")}
        value={formatCurrency(potentialMarginValue)}
        subtitle={language === "fr" 
          ? `${potentialMarginPercent.toFixed(1)}% de marge • Si tous les articles vendus au prix affiché`
          : `${potentialMarginPercent.toFixed(1)}% margin • If all items sold at list price`
        }
        icon={TrendingUp}
      />
      
      <KPICard
        label={language === "fr" ? "Quantité totale" : "Total quantity"}
        value={totalQuantity.toString()}
        subtitle={language === "fr" ? "Total d'articles en stock" : "Total items in stock"}
        icon={Hash}
      />
    </div>
  );
}