/**
 * @deprecated Use `CareBadge` from CareDesignPrimitives.
 * This component is retained for backwards compatibility only.
 */
import type { RiskLevel } from "../../lib/careTypes";
import { Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import { cn } from "../ui/utils";

interface RiskBadgeProps {
  risk?: RiskLevel;
  level?: RiskLevel;
  showIcon?: boolean;
  size?: "sm" | "md";
}

const RISK_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  high:   { bg: "var(--care-badge-red-bg)",   text: "var(--care-badge-red-text)",   border: "var(--care-badge-red-bg)" },
  medium: { bg: "var(--care-badge-amber-bg)", text: "var(--care-badge-amber-text)", border: "var(--care-badge-amber-bg)" },
  low:    { bg: "var(--care-badge-green-bg)", text: "var(--care-badge-green-text)", border: "var(--care-badge-green-bg)" },
  none:   { bg: "var(--care-badge-muted-bg)", text: "var(--care-badge-muted-text)", border: "var(--border)" },
};

const RISK_CONFIG: Record<string, { label: string; Icon: typeof Shield }> = {
  high:   { label: "Hoog risico",     Icon: ShieldAlert },
  medium: { label: "Gemiddeld risico", Icon: Shield },
  low:    { label: "Laag risico",     Icon: ShieldCheck },
  none:   { label: "Geen risico",     Icon: ShieldCheck },
};

const SIZE_CLASS = {
  sm: "px-2 py-0.5 text-xs gap-1",
  md: "px-2.5 py-1 text-sm gap-1.5",
};
const ICON_SIZE = { sm: 12, md: 14 };

export function RiskBadge({ risk, level, showIcon = true, size = "md" }: RiskBadgeProps) {
  const riskLevel = risk || level;
  if (!riskLevel) return null;
  const config = RISK_CONFIG[riskLevel];
  const style = RISK_STYLE[riskLevel];
  if (!config || !style) return null;
  const { Icon } = config;

  return (
    <div
      className={cn("inline-flex items-center rounded-md border font-medium", SIZE_CLASS[size])}
      style={{ backgroundColor: style.bg, color: style.text, borderColor: style.border }}
    >
      {showIcon && <Icon size={ICON_SIZE[size]} aria-hidden />}
      <span>{config.label}</span>
    </div>
  );
}
