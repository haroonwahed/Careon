import { useState } from "react";
import { Download, Filter } from "lucide-react";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";

export type DateRange = "today" | "yesterday" | "7days" | "30days" | "90days" | "ytd";

interface PageHeaderProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  selectedAccounts: string[];
  onAccountsChange: (accounts: string[]) => void;
}

const ACCOUNTS = ["Boutique Alice", "Frip Tim", "Margo Vintage"];

export function PageHeader({
  dateRange,
  onDateRangeChange,
  selectedAccounts,
  onAccountsChange,
}: PageHeaderProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  const handleAccountToggle = (account: string) => {
    if (selectedAccounts.includes(account)) {
      onAccountsChange(selectedAccounts.filter((a) => a !== account));
    } else {
      onAccountsChange([...selectedAccounts, account]);
    }
  };

  const handleSelectAll = () => {
    if (selectedAccounts.length === ACCOUNTS.length) {
      onAccountsChange([]);
    } else {
      onAccountsChange([...ACCOUNTS]);
    }
  };

  return (
    <div className="border-b border-border bg-background pb-6 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 sm:gap-6 mb-6">
        <div>
          <h1 className="text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            {dateRange === "today" 
              ? "24-hour hourly analytics from midnight to midnight"
              : dateRange === "yesterday"
              ? "Previous day analytics with hourly breakdown"
              : "Multi-account overview: revenue, sales, margin"
            }
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <Select value={dateRange} onValueChange={(val) => onDateRangeChange(val as DateRange)}>
            <SelectTrigger className="w-full sm:w-[180px] rounded-2xl">
              <SelectValue />
            </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="7days">Last 7 days</SelectItem>
                <SelectItem value="30days">Last 30 days</SelectItem>
                <SelectItem value="90days">Last 90 days</SelectItem>
                <SelectItem value="ytd">Year to date</SelectItem>
            </SelectContent>
          </Select>
          
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="rounded-2xl gap-2">
                <Filter className="h-4 w-4" />
                Accounts ({selectedAccounts.length})
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 rounded-2xl p-4" align="end">
              <div className="space-y-4">
                <h4 className="mb-3">Filter by Account</h4>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="select-all"
                    checked={selectedAccounts.length === ACCOUNTS.length}
                    onCheckedChange={handleSelectAll}
                  />
                  <Label htmlFor="select-all" className="cursor-pointer">
                    Select all
                  </Label>
                </div>
                
                <div className="border-t border-border pt-3 space-y-3">
                  {ACCOUNTS.map((account) => (
                    <div key={account} className="flex items-center space-x-2">
                      <Checkbox
                        id={account}
                        checked={selectedAccounts.includes(account)}
                        onCheckedChange={() => handleAccountToggle(account)}
                      />
                      <Label htmlFor={account} className="cursor-pointer">
                        {account}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
          
          <Button variant="outline" className="rounded-2xl gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>
    </div>
  );
}
