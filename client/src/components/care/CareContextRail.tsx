import type { ReactNode } from "react";
import { AlertTriangle, Calendar, Clock, ExternalLink, FileText, Flag, User } from "lucide-react";
import { cn } from "../ui/utils";

/**
 * Persistent right-side context rail for the Casuswerkruimte.
 * Shows: blocker, deadline, owner, required decision, contact, linked provider, recent audit event.
 *
 * Rendered beside the main workspace in the master-detail-context layout.
 * On narrow viewports, collapses to a bottom sheet trigger (not implemented here — caller decides).
 */

export interface CareContextRailItem {
  label: string;
  value: string;
  /** When provided, wraps the value in a link */
  href?: string;
  /** Tone colours the value text */
  tone?: "critical" | "warning" | "neutral" | "muted";
}

export interface CareContextRailAuditEvent {
  label: string;
  source?: string;
  timestamp?: string;
}

export interface CareContextRailProps {
  /** Primary blocker preventing workflow progress — shown as a warning badge at the bottom */
  blocker?: string | null;
  /** Hard deadline for this case (ISO date string or human label) */
  deadline?: string | null;
  /** Current step owner label */
  owner?: string | null;
  /** Priority label (e.g. "Normaal", "Hoog", "Spoed") */
  priority?: string | null;
  /** Priority dot colour — defaults to neutral */
  priorityTone?: "critical" | "warning" | "neutral";
  /** Time elapsed in current status (e.g. "47 uur") */
  elapsed?: string | null;
  /** Decision that must be made to unblock */
  requiredDecision?: string | null;
  /** Primary contact name or label */
  contact?: string | null;
  /** Linked provider name */
  linkedProvider?: string | null;
  /** Link to the linked provider detail */
  linkedProviderHref?: string;
  /** Most recent audit event */
  recentAuditEvent?: CareContextRailAuditEvent | null;
  /** Additional arbitrary items */
  extraItems?: CareContextRailItem[];
  className?: string;
  /** Rendered as the rail heading (defaults to "Casuscontext") */
  heading?: ReactNode;
  testId?: string;
}

function RailSection({
  icon,
  label,
  value,
  tone,
  href,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: CareContextRailItem["tone"];
  href?: string;
}) {
  const valueClass = cn(
    "mt-0.5 break-words text-[13px] leading-snug",
    tone === "critical" ? "font-semibold text-care-urgent-text"
      : tone === "warning" ? "font-semibold text-care-warning-text"
        : tone === "neutral" ? "font-medium text-foreground"
          : "text-muted-foreground",
  );

  return (
    <div className="flex min-w-0 gap-2.5">
      <span className="mt-0.5 shrink-0 text-muted-foreground/60" aria-hidden>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium leading-none tracking-wide text-muted-foreground/60">{label}</p>
        {href ? (
          <a
            href={href}
            className={cn(valueClass, "hover:text-primary hover:underline")}
            target="_blank"
            rel="noreferrer"
          >
            {value}
            <ExternalLink size={10} className="ml-1 inline" aria-hidden />
          </a>
        ) : (
          <p className={valueClass}>{value}</p>
        )}
      </div>
    </div>
  );
}

export function CareContextRail({
  blocker,
  deadline,
  owner,
  priority,
  priorityTone = "neutral",
  elapsed,
  requiredDecision,
  contact,
  linkedProvider,
  linkedProviderHref,
  recentAuditEvent,
  extraItems,
  className,
  heading = "Casuscontext",
  testId,
}: CareContextRailProps) {
  const hasContent = blocker || deadline || owner || priority || elapsed || requiredDecision || contact || linkedProvider || recentAuditEvent || extraItems?.length;

  if (!hasContent) {
    return (
      <aside
        data-testid={testId ?? "care-context-rail"}
        className={cn(
          "flex min-h-[120px] items-center justify-center rounded-xl border border-border/50 bg-card/30 p-4 text-center",
          className,
        )}
        aria-label="Casuscontext"
      >
        <p className="text-[12px] text-muted-foreground">Geen aanvullende context beschikbaar.</p>
      </aside>
    );
  }

  const priorityDotClass =
    priorityTone === "critical" ? "bg-care-urgent-solid"
    : priorityTone === "warning" ? "bg-care-warning-solid"
    : "bg-muted-foreground/40";

  return (
    <aside
      data-testid={testId ?? "care-context-rail"}
      className={cn(
        "rounded-xl border border-border/50 bg-card/30 p-4",
        className,
      )}
      aria-label="Casuscontext"
    >
      {heading && (
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          {heading}
        </h2>
      )}

      <div className="space-y-4">
        {owner && (
          <RailSection
            icon={<User size={14} />}
            label="Eigenaar"
            value={owner}
            tone="neutral"
          />
        )}

        {priority && (
          <div className="flex min-w-0 gap-2.5">
            <span className="mt-0.5 shrink-0 text-muted-foreground/60" aria-hidden><Flag size={14} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium leading-none tracking-wide text-muted-foreground/60">Prioriteit</p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className={cn("h-2 w-2 shrink-0 rounded-full", priorityDotClass)} aria-hidden />
                <p className="text-[13px] font-medium leading-snug text-foreground">{priority}</p>
              </div>
            </div>
          </div>
        )}

        {elapsed && (
          <RailSection
            icon={<Clock size={14} />}
            label="Tijd in huidige status"
            value={elapsed}
            tone="neutral"
          />
        )}

        {deadline && (
          <RailSection
            icon={<Calendar size={14} />}
            label="Deadline"
            value={deadline}
            tone="neutral"
          />
        )}

        {contact && (
          <RailSection
            icon={<User size={14} />}
            label="Contact"
            value={contact}
          />
        )}

        {linkedProvider && (
          <RailSection
            icon={<ExternalLink size={14} />}
            label="Gekoppelde aanbieder"
            value={linkedProvider}
            href={linkedProviderHref}
            tone="neutral"
          />
        )}

        {requiredDecision && (
          <RailSection
            icon={<FileText size={14} />}
            label="Vereiste beslissing"
            value={requiredDecision}
            tone="warning"
          />
        )}

        {extraItems?.map((item) => (
          <RailSection
            key={item.label}
            icon={<FileText size={14} />}
            label={item.label}
            value={item.value}
            tone={item.tone}
            href={item.href}
          />
        ))}

        {recentAuditEvent && (
          <RailSection
            icon={<Calendar size={14} />}
            label="Laatste activiteit"
            value={recentAuditEvent.label}
            tone="neutral"
          />
        )}

        {blocker && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-care-warning-border bg-care-warning-bg px-3 py-2">
            <AlertTriangle size={13} className="shrink-0 text-care-warning-text" aria-hidden />
            <p className="text-[12px] font-medium text-care-warning-text">{blocker}</p>
          </div>
        )}
      </div>
    </aside>
  );
}
