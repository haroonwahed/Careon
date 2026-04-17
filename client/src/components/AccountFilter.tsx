import { useState } from "react";
import { Filter } from "lucide-react";
import { Button } from "./ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { Language, t } from "../lib/i18n";

export interface Account {
  id: string;
  name: string;
  initial: string;
}

export const ACCOUNTS: Account[] = [
  { id: "account1", name: "Boutique Alice", initial: "A" },
  { id: "account2", name: "Frip Tim", initial: "T" },
  { id: "account3", name: "Margo Vintage", initial: "M" },
];

interface AccountFilterProps {
  selectedAccounts: string[];
  onAccountsChange: (accounts: string[]) => void;
  mode?: "all" | "selected";
  onModeChange?: (mode: "all" | "selected") => void;
  variant?: "compact" | "full";
  showChips?: boolean;
  language: Language;
}

export function AccountFilter({
  selectedAccounts,
  onAccountsChange,
  mode = "all",
  onModeChange,
  variant = "compact",
  showChips = false,
  language,
}: AccountFilterProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  const handleAccountToggle = (accountId: string) => {
    if (selectedAccounts.includes(accountId)) {
      onAccountsChange(selectedAccounts.filter((id) => id !== accountId));
    } else {
      onAccountsChange([...selectedAccounts, accountId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedAccounts.length === ACCOUNTS.length) {
      onAccountsChange([]);
    } else {
      onAccountsChange(ACCOUNTS.map((a) => a.id));
    }
  };

  const getButtonLabel = () => {
    if (mode === "all") {
      return t(language, "filters.accounts.all");
    }
    
    if (selectedAccounts.length === 0) {
      return t(language, "filters.accounts.noAccounts");
    }
    
    if (selectedAccounts.length === 1) {
      const account = ACCOUNTS.find((a) => a.id === selectedAccounts[0]);
      return variant === "compact" ? account?.initial : account?.name;
    }
    
    return t(language, "filters.accounts.selected", { count: selectedAccounts.length });
  };

  // Show account chips alongside the filter
  const renderAccountChips = () => {
    if (!showChips || mode === "all" || selectedAccounts.length === 0) {
      return null;
    }

    return (
      <div className="flex items-center gap-1 ml-2">
        {selectedAccounts.map((accountId) => {
          const account = ACCOUNTS.find((a) => a.id === accountId);
          return (
            <span
              key={accountId}
              className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-primary/10 text-primary text-[10px] border border-primary/20"
            >
              {account?.initial}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border dark:border-[rgba(168,85,247,0.30)] border-border dark:bg-card/50 bg-background dark:hover:bg-[rgba(139,92,246,0.15)] hover:bg-primary/10 dark:hover:border-[rgba(168,85,247,0.50)] hover:border-primary/40 dark:text-foreground text-foreground h-10 px-4 py-2 ${variant === "compact" ? "rounded-2xl" : "rounded-xl"}`}
          >
            <Filter className="h-4 w-4" />
            {getButtonLabel()}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-4 rounded-2xl" align="start">
          <div className="space-y-4">
            <h4 className="mb-3">{t(language, "filters.accounts.title")}</h4>

            {onModeChange && (
              <>
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="filter-all"
                    checked={mode === "all"}
                    onChange={() => onModeChange("all")}
                    className="w-4 h-4 accent-primary"
                  />
                  <Label htmlFor="filter-all" className="cursor-pointer">
                    {t(language, "filters.accounts.all")}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="filter-selected"
                    checked={mode === "selected"}
                    onChange={() => onModeChange("selected")}
                    className="w-4 h-4 accent-primary"
                  />
                  <Label htmlFor="filter-selected" className="cursor-pointer">
                    {t(language, "common.selectedAccounts")}
                  </Label>
                </div>
              </>
            )}

            {(mode === "selected" || !onModeChange) && (
              <div className="pt-3 border-t border-border space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all-accounts"
                    checked={selectedAccounts.length === ACCOUNTS.length}
                    onCheckedChange={handleSelectAll}
                  />
                  <Label
                    htmlFor="select-all-accounts"
                    className="cursor-pointer text-muted-foreground"
                  >
                    {t(language, "filters.accounts.selectAll")}
                  </Label>
                </div>
                {ACCOUNTS.map((account) => (
                  <div key={account.id} className="flex items-center gap-2">
                    <Checkbox
                      id={account.id}
                      checked={selectedAccounts.includes(account.id)}
                      onCheckedChange={() => handleAccountToggle(account.id)}
                    />
                    <Label
                      htmlFor={account.id}
                      className="cursor-pointer flex items-center gap-2"
                    >
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-primary/10 text-primary text-[10px] border border-primary/20">
                        {account.initial}
                      </span>
                      {account.name}
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
      
      {renderAccountChips()}
    </div>
  );
}