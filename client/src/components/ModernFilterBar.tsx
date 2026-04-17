import { Search, Calendar, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Language, t } from "../lib/i18n";
import { AccountFilter } from "./AccountFilter";
import { DateRangePicker } from "./DateRangePicker";
import { DateRange } from "./PageHeader";

interface ModernFilterBarProps {
  // Search
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  
  // Date Range
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
  showDatePicker?: boolean;
  
  // Account Filter
  selectedAccounts?: string[];
  availableAccounts?: string[];
  onAccountsChange?: (accounts: string[]) => void;
  showAccountFilter?: boolean;
  singleAccountMode?: boolean;
  
  // Refresh
  onRefresh?: () => void | Promise<void>;
  isRefreshing?: boolean;
  
  // Other
  language: Language;
  rightActions?: React.ReactNode;
}

export function ModernFilterBar({
  searchValue = "",
  searchPlaceholder,
  onSearchChange,
  dateRange,
  onDateRangeChange,
  showDatePicker = false,
  selectedAccounts = [],
  availableAccounts = [],
  onAccountsChange,
  showAccountFilter = false,
  singleAccountMode = false,
  onRefresh,
  isRefreshing = false,
  language,
  rightActions,
}: ModernFilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
      {/* Left: Search */}
      {onSearchChange && (
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 dark:text-muted-foreground text-muted-foreground" />
          <Input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder || t(language, "filters.search")}
            className="pl-9 h-10 rounded-xl dark:bg-card bg-card dark:border-input border-input"
          />
        </div>
      )}
      
      {/* Middle: Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Account Filter */}
        {showAccountFilter && onAccountsChange && (
          <AccountFilter
            selectedAccounts={selectedAccounts}
            availableAccounts={availableAccounts}
            onAccountsChange={onAccountsChange}
            language={language}
            singleMode={singleAccountMode}
          />
        )}
        
        {/* Date Range Picker */}
        {showDatePicker && dateRange && onDateRangeChange && (
          <DateRangePicker
            value={dateRange}
            onChange={onDateRangeChange}
            language={language}
          />
        )}
        
        {/* Refresh Button */}
        {onRefresh && (
          <Button
            variant="outline"
            size="default"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-10 px-4 rounded-xl dark:bg-card bg-card dark:border-input border-input dark:hover:bg-surface-hover hover:bg-muted/50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            {t(language, "filters.refresh")}
          </Button>
        )}
      </div>
      
      {/* Right: Custom Actions */}
      {rightActions && (
        <div className="flex items-center gap-2 ml-auto">
          {rightActions}
        </div>
      )}
    </div>
  );
}
