import { AlertTriangle, ArrowRight, CheckCircle2, Clock } from "lucide-react";

export type ActionPanelSeverity = "critical" | "warning" | "stable";

export interface ActionPanelItem {
  key: string;
  title: string;
  description?: string;
  count: number;
  severity: ActionPanelSeverity;
  ctaLabel: string;
  showWhenZero?: boolean;
  onSelect: () => void;
}

interface ActionPanelProps {
  items: ActionPanelItem[];
}

interface SeverityGroup {
  key: ActionPanelSeverity;
  title: string;
  rowClass: string;
  badgeClass: string;
  icon: JSX.Element;
}

const severityGroups: SeverityGroup[] = [
  {
    key: "critical",
    title: "Critisch",
    rowClass: "border-destructive/30 bg-destructive/10 hover:border-destructive/50",
    badgeClass: "border-destructive/30 bg-destructive/10 text-destructive",
    icon: <AlertTriangle size={14} className="text-destructive" />,
  },
  {
    key: "warning",
    title: "Actie vereist",
    rowClass: "border-amber-500/30 bg-amber-500/10 hover:border-amber-400/45",
    badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    icon: <Clock size={14} className="text-amber-200" />,
  },
  {
    key: "stable",
    title: "Stabiel",
    rowClass: "border-emerald-500/30 bg-emerald-500/10 hover:border-emerald-400/45",
    badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    icon: <CheckCircle2 size={14} className="text-emerald-200" />,
  },
];

export function ActionPanel({ items }: ActionPanelProps) {
  const visibleItems = items.filter((item) => item.count > 0 || item.showWhenZero);

  const grouped = severityGroups
    .map((group) => ({
      group,
      items: visibleItems
        .filter((item) => item.severity === group.key)
        .sort((a, b) => b.count - a.count),
    }))
    .filter((section) => section.items.length > 0);

  if (grouped.length === 0) {
    return (
      <section className="premium-card border border-border p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <CheckCircle2 size={14} className="text-green-base" />
          Wat vraagt aandacht?
        </div>
        <p className="text-sm text-muted-foreground">Geen directe acties nodig. Doorstroom is stabiel.</p>
      </section>
    );
  }

  return (
    <section className="premium-card border border-border p-4">
      <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <AlertTriangle size={14} />
        Wat vraagt aandacht?
      </div>

      <div className="space-y-4">
        {grouped.map(({ group, items: groupItems }) => (
          <div key={group.key} className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {group.icon}
              <span>{group.title}</span>
            </div>

            <div className="space-y-2">
              {groupItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.onSelect}
                  className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${group.rowClass}`}
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    {item.description ? (
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${group.badgeClass}`}>
                      {item.count}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors">
                      {item.ctaLabel}
                      <ArrowRight size={12} />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
