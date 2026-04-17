type StatusType = 
  | "nieuw" 
  | "in-beoordeling" 
  | "geaccepteerd" 
  | "intake-gepland" 
  | "afgewezen"
  | "wacht-op-reactie";

interface StatusBadgeProps {
  status: StatusType;
  size?: "sm" | "md";
}

const statusConfig: Record<StatusType, {
  label: string;
  color: string;
  bg: string;
  border: string;
}> = {
  "nieuw": {
    label: "Nieuw",
    color: "text-blue-300",
    bg: "bg-blue-500/15",
    border: "border-blue-500/40"
  },
  "in-beoordeling": {
    label: "In beoordeling",
    color: "text-amber-300",
    bg: "bg-amber-500/15",
    border: "border-amber-500/40"
  },
  "geaccepteerd": {
    label: "Geaccepteerd",
    color: "text-green-300",
    bg: "bg-green-500/15",
    border: "border-green-500/40"
  },
  "intake-gepland": {
    label: "Intake gepland",
    color: "text-purple-300",
    bg: "bg-purple-500/15",
    border: "border-purple-500/40"
  },
  "afgewezen": {
    label: "Afgewezen",
    color: "text-muted-foreground",
    bg: "bg-muted/20",
    border: "border-muted-foreground/30"
  },
  "wacht-op-reactie": {
    label: "Wacht op reactie",
    color: "text-amber-300",
    bg: "bg-amber-500/15",
    border: "border-amber-500/40"
  }
};

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <span className={`
      inline-flex items-center gap-1.5 rounded-md border font-medium
      ${config.color} ${config.bg} ${config.border}
      ${size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"}
    `}>
      {status === "nieuw" && (
        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
      )}
      {config.label}
    </span>
  );
}
