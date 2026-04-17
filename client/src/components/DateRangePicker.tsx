import { useState, useEffect } from "react";
import { Calendar as CalendarIcon, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { Language, t, formatDate } from "../lib/i18n";

export type DateRangePreset =
  | "today"
  | "yesterday"
  | "last7d"
  | "last30d"
  | "last60d"
  | "last90d"
  | "last2mo"
  | "last3mo"
  | "last6mo"
  | "last12mo"
  | "last365d"
  | "ytd"
  | "custom";

export type DateRangeMode = "fixed" | "rolling";

interface DateRangePickerProps {
  value: DateRangePreset;
  onChange: (preset: DateRangePreset) => void;
  mode: DateRangeMode;
  onModeChange: (mode: DateRangeMode) => void;
  customFrom?: Date;
  customTo?: Date;
  onCustomRangeChange?: (from: Date, to: Date) => void;
  language: Language;
}

export function DateRangePicker({
  value,
  onChange,
  mode,
  onModeChange,
  customFrom,
  customTo,
  onCustomRangeChange,
  language,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [tempPreset, setTempPreset] = useState(value);
  const [tempMode, setTempMode] = useState(mode);
  const [tempFrom, setTempFrom] = useState<Date | undefined>(customFrom);
  const [tempTo, setTempTo] = useState<Date | undefined>(customTo);
  
  // Calendar months state - show previous month and current month by default
  const today = new Date();
  const [rightMonth, setRightMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [leftMonth, setLeftMonth] = useState(new Date(today.getFullYear(), today.getMonth() - 1, 1));

  // Initialize default selection to current month if no custom range
  useEffect(() => {
    if (!tempFrom && !tempTo) {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      setTempFrom(startOfMonth);
      setTempTo(today);
    }
  }, []);

  const presets = [
    { id: "today" as DateRangePreset, label: `${t(language, "range.today")} (24h)` },
    { id: "yesterday" as DateRangePreset, label: t(language, "range.yesterday") },
    { id: "last7d" as DateRangePreset, label: t(language, "range.last7d") },
    { id: "last30d" as DateRangePreset, label: t(language, "range.last30d") },
    { id: "last60d" as DateRangePreset, label: t(language, "range.last60d") },
    { id: "last90d" as DateRangePreset, label: t(language, "range.last90d") },
    { id: "last2mo" as DateRangePreset, label: t(language, "range.last2mo") },
    { id: "last3mo" as DateRangePreset, label: t(language, "range.last3mo") },
    { id: "last6mo" as DateRangePreset, label: t(language, "range.last6mo") },
    { id: "last12mo" as DateRangePreset, label: t(language, "range.last12mo") },
    { id: "last365d" as DateRangePreset, label: t(language, "range.last365d") },
    { id: "ytd" as DateRangePreset, label: t(language, "range.ytd") },
  ];

  const getDisplayLabel = () => {
    if (value === "custom" && customFrom && customTo) {
      return `${formatDate(customFrom, language, { day: "numeric", month: "short" })} - ${formatDate(customTo, language, { day: "numeric", month: "short" })}`;
    }
    const preset = presets.find((p) => p.id === value);
    return preset?.label || t(language, "range.selectDates");
  };

  const handlePresetClick = (presetId: DateRangePreset) => {
    setTempPreset(presetId);
    
    // Auto-populate dates for presets
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    if (presetId === "today") {
      setTempFrom(now);
      setTempTo(now);
    } else if (presetId === "yesterday") {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      setTempFrom(yesterday);
      setTempTo(yesterday);
    } else if (presetId === "last7d") {
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      setTempFrom(sevenDaysAgo);
      setTempTo(now);
    } else if (presetId === "last30d") {
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      setTempFrom(thirtyDaysAgo);
      setTempTo(now);
    } else if (presetId === "last90d") {
      const ninetyDaysAgo = new Date(now);
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      setTempFrom(ninetyDaysAgo);
      setTempTo(now);
    } else if (presetId === "last2mo") {
      const twoMonthsAgo = new Date(now);
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      setTempFrom(twoMonthsAgo);
      setTempTo(now);
    } else if (presetId === "last60d") {
      const sixtyDaysAgo = new Date(now);
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      setTempFrom(sixtyDaysAgo);
      setTempTo(now);
    } else if (presetId === "last3mo") {
      const threeMonthsAgo = new Date(now);
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      setTempFrom(threeMonthsAgo);
      setTempTo(now);
    } else if (presetId === "last6mo") {
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      setTempFrom(sixMonthsAgo);
      setTempTo(now);
    } else if (presetId === "last12mo") {
      const twelveMonthsAgo = new Date(now);
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      setTempFrom(twelveMonthsAgo);
      setTempTo(now);
    } else if (presetId === "last365d") {
      const threeHundredSixtyFiveDaysAgo = new Date(now);
      threeHundredSixtyFiveDaysAgo.setDate(threeHundredSixtyFiveDaysAgo.getDate() - 365);
      setTempFrom(threeHundredSixtyFiveDaysAgo);
      setTempTo(now);
    } else if (presetId === "ytd") {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      setTempFrom(yearStart);
      setTempTo(now);
    }
  };

  const handleApply = () => {
    onChange(tempPreset);
    onModeChange(tempMode);
    if (tempFrom && tempTo && onCustomRangeChange) {
      onCustomRangeChange(tempFrom, tempTo);
    }
    setOpen(false);
  };

  const handleCancel = () => {
    setTempPreset(value);
    setTempMode(mode);
    setTempFrom(customFrom);
    setTempTo(customTo);
    setOpen(false);
  };

  const navigateMonthLeft = (direction: "prev" | "next") => {
    const newLeft = new Date(leftMonth);
    newLeft.setMonth(newLeft.getMonth() + (direction === "next" ? 1 : -1));
    setLeftMonth(newLeft);
    
    const newRight = new Date(newLeft);
    newRight.setMonth(newRight.getMonth() + 1);
    setRightMonth(newRight);
  };

  const navigateMonthRight = (direction: "prev" | "next") => {
    const newRight = new Date(rightMonth);
    newRight.setMonth(newRight.getMonth() + (direction === "next" ? 1 : -1));
    setRightMonth(newRight);
    
    const newLeft = new Date(newRight);
    newLeft.setMonth(newLeft.getMonth() - 1);
    setLeftMonth(newLeft);
  };

  const handleDayClick = (date: Date) => {
    setTempPreset("custom");
    
    if (!tempFrom || (tempFrom && tempTo)) {
      // Start new selection
      setTempFrom(date);
      setTempTo(undefined);
    } else if (tempFrom && !tempTo) {
      // Complete selection
      if (date >= tempFrom) {
        setTempTo(date);
      } else {
        setTempTo(tempFrom);
        setTempFrom(date);
      }
    }
  };

  const isInRange = (date: Date) => {
    if (!tempFrom || !tempTo) return false;
    return date >= tempFrom && date <= tempTo;
  };

  const isRangeStart = (date: Date) => {
    if (!tempFrom) return false;
    return date.toDateString() === tempFrom.toDateString();
  };

  const isRangeEnd = (date: Date) => {
    if (!tempTo) return false;
    return date.toDateString() === tempTo.toDateString();
  };

  const renderCalendar = (month: Date, onNavigate: (dir: "prev" | "next") => void) => {
    const monthName = month.toLocaleDateString(language === "fr" ? "fr-FR" : "en-GB", { 
      month: "long", 
      year: "numeric" 
    });
    
    // Get days in month
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
    const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    
    // Get day of week for first day (0 = Sunday, adjust to Monday = 0)
    let firstDayOfWeek = firstDay.getDay();
    if (language === "fr") {
      firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // Monday = 0
    }
    
    const daysInMonth = lastDay.getDate();
    const days = [];
    
    // Fill leading empty days
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="h-9 w-9" />);
    }
    
    // Fill actual days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(month.getFullYear(), month.getMonth(), day);
      const isStart = isRangeStart(date);
      const isEnd = isRangeEnd(date);
      const inRange = isInRange(date);
      const isToday = date.toDateString() === new Date().toDateString();
      
      days.push(
        <button
          key={day}
          onClick={() => handleDayClick(date)}
          className={`
            h-9 w-9 
            flex items-center justify-center
            text-sm
            relative 
            ${
              isStart || isEnd
                ? "dark:bg-[#8B5CF6] bg-primary dark:text-white text-primary-foreground rounded-full z-10 font-medium"
                : inRange
                ? "dark:bg-[rgba(139,92,246,0.18)] bg-primary/10 dark:text-[#E5E7EB] text-foreground rounded-lg"
                : "dark:text-[#E5E7EB] text-foreground dark:hover:bg-[rgba(139,92,246,0.10)] hover:bg-primary/10 rounded-lg"
            } 
            ${isToday && !isStart && !isEnd ? "ring-1 ring-inset dark:ring-[#8B5CF6] ring-primary" : ""}
          `}
          style={{ lineHeight: "1" }}
        >
          {day}
        </button>
      );
    }
    
    // Weekday headers
    const weekdays = language === "fr" 
      ? ["L", "M", "M", "J", "V", "S", "D"]
      : ["M", "T", "W", "T", "F", "S", "S"];
    
    return (
      <div className="flex-1">
        {/* Month header */}
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onNavigate("prev")}
            className="h-8 w-8 dark:text-[#9CA3AF] text-muted-foreground rounded-lg dark:hover:bg-[rgba(139,92,246,0.10)] hover:bg-primary/10"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h4 className="dark:text-[#E5E7EB] text-foreground capitalize" style={{ fontSize: "13px", fontWeight: 600 }}>
            {monthName}
          </h4>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onNavigate("next")}
            className="h-8 w-8 dark:text-[#9CA3AF] text-muted-foreground rounded-lg dark:hover:bg-[rgba(139,92,246,0.10)] hover:bg-primary/10"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1.5 mb-2">
          {weekdays.map((day, i) => (
            <div
              key={i}
              className="h-9 w-9 flex items-center justify-center dark:text-[#9CA3AF] text-muted-foreground uppercase"
              style={{ fontSize: "11px", fontWeight: 500, lineHeight: "1" }}
            >
              {day}
            </div>
          ))}
        </div>
        
        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {days}
        </div>
      </div>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full sm:w-[300px] justify-start gap-2 rounded-2xl dark:border-[rgba(168,85,247,0.25)] dark:bg-[#0E0E14] dark:hover:bg-[#12121A]"
          style={{
            boxShadow: "0 0 0 1px rgba(168,85,247,0.15)",
          }}
        >
          <CalendarIcon className="h-4 w-4 dark:text-[#8B5CF6] text-primary" />
          <span className="dark:text-[#E7E7F0] text-foreground">
            {getDisplayLabel()}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 rounded-2xl dark:border-[rgba(168,85,247,0.25)] dark:bg-[#0E0E14] border-border"
        align="start"
        style={{
          boxShadow: "0 0 0 1px rgba(168,85,247,0.25), 0 0 28px rgba(168,85,247,0.10)",
        }}
      >
        <div className="flex">
          {/* Left sidebar - Presets */}
          <div className="w-[200px] border-r dark:border-[rgba(168,85,247,0.25)] border-border p-4">
            <div className="space-y-1">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handlePresetClick(preset.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors ${
                    tempPreset === preset.id
                      ? "dark:bg-[rgba(139,92,246,0.15)] bg-primary/10 dark:text-[#C7B8FF] text-primary"
                      : "dark:text-[#9CA3AF] text-muted-foreground dark:hover:bg-[rgba(139,92,246,0.10)] hover:bg-primary/10"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{preset.label}</span>
                    {tempPreset === preset.id && (
                      <Check className="h-4 w-4 dark:text-[#8B5CF6]" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right content - Calendars and controls */}
          <div className="p-6 space-y-4 w-[660px]">
            {/* Period type toggle */}
            <div className="flex items-center justify-between pb-4 border-b dark:border-[rgba(168,85,247,0.25)] border-border">
              <Label
                htmlFor="mode-toggle"
                className="dark:text-[#9CA3AF] text-muted-foreground text-sm"
              >
                {language === "fr" ? "Type de période" : "Period type"}
              </Label>
              <div className="flex items-center gap-3">
                <span
                  className={`text-sm ${
                    tempMode === "fixed"
                      ? "dark:text-[#E7E7F0] text-foreground"
                      : "dark:text-[#9CA3AF] text-muted-foreground"
                  }`}
                >
                  {t(language, "range.fixed")}
                </span>
                <Switch
                  id="mode-toggle"
                  checked={tempMode === "rolling"}
                  onCheckedChange={(checked) =>
                    setTempMode(checked ? "rolling" : "fixed")
                  }
                />
                <span
                  className={`text-sm ${
                    tempMode === "rolling"
                      ? "dark:text-[#E7E7F0] text-foreground"
                      : "dark:text-[#9CA3AF] text-muted-foreground"
                  }`}
                >
                  {t(language, "range.rolling")}
                </span>
              </div>
            </div>

            {/* Inline dual calendars */}
            <div className="flex gap-6">
              {renderCalendar(leftMonth, navigateMonthLeft)}
              {renderCalendar(rightMonth, navigateMonthRight)}
            </div>

            {/* Custom dates display (read-only pills) */}
            <div className="flex items-center gap-3 pt-2">
              <div className="flex items-center gap-2 flex-1">
                <Label className="dark:text-[#9CA3AF] text-muted-foreground text-xs">
                  {t(language, "range.from")}
                </Label>
                <div className="flex-1 px-3 py-2 rounded-xl dark:bg-[rgba(139,92,246,0.1)] bg-primary/5 dark:text-[#C7B8FF] text-primary text-sm">
                  {tempFrom ? formatDate(tempFrom, language, { day: "numeric", month: "short", year: "numeric" }) : "—"}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-1">
                <Label className="dark:text-[#9CA3AF] text-muted-foreground text-xs">
                  {t(language, "range.to")}
                </Label>
                <div className="flex-1 px-3 py-2 rounded-xl dark:bg-[rgba(139,92,246,0.1)] bg-primary/5 dark:text-[#C7B8FF] text-primary text-sm">
                  {tempTo ? formatDate(tempTo, language, { day: "numeric", month: "short", year: "numeric" }) : "—"}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t dark:border-[rgba(168,85,247,0.25)] border-border">
              <Button
                variant="ghost"
                onClick={handleCancel}
                className="rounded-xl dark:text-[#9CA3AF]"
              >
                {t(language, "range.cancel")}
              </Button>
              <Button
                onClick={handleApply}
                className="rounded-xl dark:bg-[#8B5CF6] dark:hover:bg-[#7C3AED] dark:text-white"
              >
                {t(language, "range.apply")}
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}