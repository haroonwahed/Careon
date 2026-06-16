import type { ReactNode } from "react";
import { AlertTriangle, Calendar, Clock, ExternalLink, FileText, User } from "lucide-react";
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
  /** Primary blocker preventing workflow progress */
  blocker?: string | null;
  /** Hard deadline for this case (ISO date string or human label) */
  deadline?: string | null;
  /** Current step owner label */
  owner?: string | null;
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
    tone === "critical" ? "font-semibold text-[var(--care-badge-red-text)]"
      : tone === "warning" ? "font-semibold text-[var(--care-badge-amber-text)]"
        : tone === "neutral" ? "font-medium text-foreground"
          : "text-muted-foreground",
  );

  return (
    <div className="flex min-w-0 gap-2.5">
      <span className="mt-0.5 shrink-0 text-muted-foreground/60" aria-hidden>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="care-text-eyebrow text-muted-foreground/60">{label}</p>
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
  const hasContent = blocker || deadline || owner || requiredDecision || contact || linkedProvider || recentAuditEvent || extraItems?.length;

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
        <h2 className="mb-4 care-text-eyebrow text-muted-foreground/70">
          {heading}
        </h2>
      )}

      <div className="space-y-4">
        {blocker && (
          <RailSection
            icon={<AlertTriangle size={14} />}
            label="Blokkade"
            value={blocker}
            tone="critical"
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

        {deadline && (
          <RailSection
            icon={<Calendar size={14} />}
            label="Deadline"
            value={deadline}
            tone="neutral"
          />
        )}

        {owner && (
          <RailSection
            icon={<User size={14} />}
            label="Eigenaar"
            value={owner}
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
          <div className="border-t border-border/40 pt-3">
            <p className="mb-2 care-text-eyebrow text-muted-foreground/60">
              Laatste activiteit
            </p>
            <div className="flex min-w-0 gap-2.5">
              <span className="mt-0.5 shrink-0 text-muted-foreground/60" aria-hidden>
                <Clock size={14} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-foreground">{recentAuditEvent.label}</p>
                {recentAuditEvent.source && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{recentAuditEvent.source}</p>
                )}
                {recentAuditEvent.timestamp && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground/60">{recentAuditEvent.timestamp}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
