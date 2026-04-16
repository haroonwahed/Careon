import { useState } from "react";
import { X, HelpCircle } from "lucide-react";
import { Language } from "../../lib/i18n";

interface AddAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, url: string) => void;
  language: Language;
  type: "products" | "vendors" | "publics";
}

export function AddAnalysisModal({
  isOpen,
  onClose,
  onAdd,
  language,
  type,
}: AddAnalysisModalProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && url.trim()) {
      onAdd(name.trim(), url.trim());
      setName("");
      setUrl("");
      onClose();
    }
  };

  const getTitle = () => {
    switch (type) {
      case "products":
        return language === "fr" ? "Ajouter une analyse produit" : "Add product analysis";
      case "vendors":
        return language === "fr" ? "Ajouter une analyse vendeur" : "Add vendor analysis";
      case "publics":
        return language === "fr" ? "Ajouter une catégorie" : "Add category";
    }
  };

  const getUrlPlaceholder = () => {
    switch (type) {
      case "products":
        return "https://www.vinted.fr/catalog/...";
      case "vendors":
        return "https://www.vinted.fr/member/...";
      case "publics":
        return "https://www.vinted.fr/catalog/...";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-md rounded-2xl dark:bg-[#0E0E14] bg-card border dark:border-[rgba(168,85,247,0.25)] border-border shadow-2xl"
        style={{
          boxShadow:
            "0 0 0 1px rgba(139,92,246,0.25), 0 20px 60px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b dark:border-[rgba(168,85,247,0.15)] border-border">
          <h2 className="text-lg dark:text-[#E7E7F0] text-foreground">
            {getTitle()}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg dark:text-[#9CA3AF] text-muted-foreground hover:dark:bg-[#1A1A24] hover:bg-muted/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name input */}
          <div>
            <label className="block text-sm dark:text-[#E7E7F0] text-foreground mb-2">
              {language === "fr" ? "Nom de l'analyse" : "Analysis name"}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                language === "fr"
                  ? "Ex: Pull d'hiver Boutique Italiana"
                  : "Ex: Winter sweater Italian Shop"
              }
              className="w-full px-4 py-2.5 rounded-xl dark:bg-[#1A1A24] bg-muted border dark:border-[rgba(168,85,247,0.20)] border-border dark:text-[#E7E7F0] text-foreground placeholder:dark:text-[#9CA3AF] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              required
            />
          </div>

          {/* URL input */}
          <div>
            <label className="block text-sm dark:text-[#E7E7F0] text-foreground mb-2">
              {language === "fr" ? "URL Vinted" : "Vinted URL"}
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={getUrlPlaceholder()}
              className="w-full px-4 py-2.5 rounded-xl dark:bg-[#1A1A24] bg-muted border dark:border-[rgba(168,85,247,0.20)] border-border dark:text-[#E7E7F0] text-foreground placeholder:dark:text-[#9CA3AF] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              required
            />
            <button
              type="button"
              className="flex items-center gap-1.5 mt-2 text-xs dark:text-primary text-primary hover:underline"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              {language === "fr" ? "Comment trouver l'URL ?" : "How to find the URL?"}
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl dark:bg-[#1A1A24] bg-muted border dark:border-[rgba(168,85,247,0.20)] border-border dark:text-[#E7E7F0] text-foreground transition-all duration-200 hover:dark:bg-[#242430] hover:bg-muted/70"
            >
              {language === "fr" ? "Annuler" : "Cancel"}
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl dark:bg-primary bg-primary dark:text-white text-white font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                boxShadow: "0 0 20px rgba(139,92,246,0.3)",
              }}
            >
              {language === "fr" ? "Ajouter" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
