import { Clock, CheckCircle2, Calendar, XCircle } from "lucide-react";

interface KPIData {
  nieuwe: number;
  wachtOpReactie: number;
  intakeGepland: number;
  afgewezen: number;
}

interface ProviderKPIStripProps {
  data: KPIData;
}

export function ProviderKPIStrip({ data }: ProviderKPIStripProps) {
  const kpis = [
    {
      id: "nieuwe",
      label: "Nieuwe casussen",
      value: data.nieuwe,
      icon: Clock,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/30"
    },
    {
      id: "wacht",
      label: "Wacht op reactie",
      value: data.wachtOpReactie,
      icon: Clock,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30"
    },
    {
      id: "gepland",
      label: "Intake gepland",
      value: data.intakeGepland,
      icon: Calendar,
      color: "text-green-400",
      bg: "bg-green-500/10",
      border: "border-green-500/30"
    },
    {
      id: "afgewezen",
      label: "Afgewezen",
      value: data.afgewezen,
      icon: XCircle,
      color: "text-muted-foreground",
      bg: "bg-muted/10",
      border: "border-muted-foreground/20"
    }
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        
        return (
          <div
            key={kpi.id}
            className={`
              premium-card p-5 border-2 transition-all hover:scale-[1.02]
              ${kpi.bg} ${kpi.border}
            `}
          >
            <div className="flex items-start justify-between mb-3">
              <Icon size={20} className={kpi.color} />
              <span className={`text-3xl font-bold ${kpi.color}`}>
                {kpi.value}
              </span>
            </div>
            <p className="text-sm font-medium text-foreground">
              {kpi.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}
