import { useState, useMemo } from "react";
import {
  X,
  ChevronRight,
  Calendar,
  User,
  FileText,
  Clock,
  CheckCircle2,
  Upload,
  Settings,
  Eye,
  ExternalLink,
} from "lucide-react";
import { Button } from "../ui/button";
import {
  CareInfoPopover,
  EmptyState,
  ErrorState,
  LoadingState,
} from "./CareDesignPrimitives";
import {
  CareCommandShell,
  CareMetricStrip,
  CareMetricCard,
  CareWorklistToolbar,
  CareWorklistFilterPanel,
} from "./CareCommandPrimitives";
import { useAuditLog } from "../../hooks/useAuditLog";
import { tokens } from "../../design/tokens";
import { AUDIT_ACTION_LABELS } from "../../lib/auditActionLabels";

type EntityType = "casus" | "aanbiederreactie" | "matching" | "plaatsing" | "intake" | "document" | "gebruiker" | "instellingen";
type ActionType = "aangemaakt" | "gewijzigd" | "verwijderd" | "bevestigd" | "toegewezen" | "geupload" | "bekeken";

interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  actionType: ActionType;
  entityType: EntityType;
  entityId?: string;
  entityName: string;
  userId: string;
  userName: string;
  userRole: string;
  description: string;
  changes?: { field: string; before: string; after: string }[];
  metadata?: Record<string, any>;
}

const entityTypeConfig: Record<EntityType, { label: string; icon: any; color: string }> = {
  casus: { label: "Casus", icon: FileText, color: "text-care-brand-text" },
  aanbiederreactie: { label: "Aanbiederreactie", icon: FileText, color: "text-care-info-text" },
  matching: { label: "Matching", icon: CheckCircle2, color: "text-care-success-text" },
  plaatsing: { label: "Plaatsing", icon: CheckCircle2, color: "text-care-success-text" },
  intake: { label: "Intake", icon: FileText, color: "text-care-warning-text" },
  document: { label: "Document", icon: Upload, color: "text-cyan-500" },
  gebruiker: { label: "Gebruiker", icon: User, color: "text-pink-500" },
  instellingen: { label: "Instellingen", icon: Settings, color: "text-slate-500" },
};

const actionTypeConfig: Record<ActionType, { label: string; color: string }> = {
  aangemaakt: { label: "Aangemaakt", color: "text-care-success-text" },
  gewijzigd: { label: "Gewijzigd", color: "text-care-info-text" },
  verwijderd: { label: "Verwijderd", color: "text-care-urgent-text" },
  bevestigd: { label: "Bevestigd", color: "text-care-success-text" },
  toegewezen: { label: "Toegewezen", color: "text-care-warning-text" },
  geupload: { label: "Geüpload", color: "text-cyan-500" },
  bekeken: { label: "Bekeken", color: "text-slate-500" },
};

interface AudittrailPageProps {
  onOpenEntity?: (entry: AuditEntry) => void;
}

const auditListShell = "overflow-hidden rounded-[16px] border border-border/55 bg-card/30";

export function AudittrailPage({ onOpenEntity }: AudittrailPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const [typeFilter, setTypeFilter] = useState<EntityType | "all">("all");
  const [actionFilter, setActionFilter] = useState<ActionType | "all">("all");
  const [userFilter, setUserFilter] = useState<string>("all");

  const { entries: apiEntries, loading, error, refetch } = useAuditLog({ q: searchQuery });

  // @ts-ignore
  const mappedEntries: AuditEntry[] = apiEntries.map((e) => ({
    id: e.id,
    timestamp: e.timestamp,
    action: AUDIT_ACTION_LABELS[e.action] ?? e.action,
    actionType: (["aangemaakt", "gewijzigd", "verwijderd", "bevestigd", "toegewezen", "geupload", "bekeken"].includes(e.action)
      ? e.action
      : "gewijzigd") as ActionType,
    entityType: (["casus", "aanbiederreactie", "matching", "plaatsing", "intake", "document", "gebruiker", "instellingen"].includes(e.modelName?.toLowerCase() ?? "")
      ? e.modelName!.toLowerCase()
      : "casus") as EntityType,
    entityId: e.objectId ?? undefined,
    entityName: e.objectRepr ?? "",
    userId: e.userEmail ?? e.userName ?? "",
    userName: e.userName ?? "",
    userRole: e.userEmail ? `(${e.userEmail})` : "",
    description: e.changes
      ? `${Object.keys(e.changes).length} veld${Object.keys(e.changes).length === 1 ? "" : "en"} gewijzigd`
      : "",
    changes: e.changes
      ? Object.entries(e.changes).map(([field, val]) => ({
          field,
          before: String((val as any).old ?? ""),
          after: String((val as any).new ?? ""),
        }))
      : undefined,
  }));

  const uniqueUsers = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of mappedEntries) {
      if (e.userId && !seen.has(e.userId)) {
        seen.set(e.userId, e.userName || e.userId);
      }
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [mappedEntries]);

  const groupByDate = (entries: AuditEntry[]) => {
    const groups: Record<string, AuditEntry[]> = { Vandaag: [], Gisteren: [], Eerder: [] };
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    entries.forEach((entry) => {
      const entryDate = new Date(entry.timestamp);
      if (entryDate.toDateString() === today.toDateString()) groups["Vandaag"].push(entry);
      else if (entryDate.toDateString() === yesterday.toDateString()) groups["Gisteren"].push(entry);
      else groups["Eerder"].push(entry);
    });
    return groups;
  };

  const filteredEntries = mappedEntries.filter((entry) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        entry.action.toLowerCase().includes(query) ||
        entry.entityName.toLowerCase().includes(query) ||
        entry.entityId?.toLowerCase().includes(query) ||
        entry.userName.toLowerCase().includes(query) ||
        entry.description.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }
    if (typeFilter !== "all" && entry.entityType !== typeFilter) return false;
    if (actionFilter !== "all" && entry.actionType !== actionFilter) return false;
    if (userFilter !== "all" && entry.userId !== userFilter) return false;
    return true;
  });

  const groupedEntries = groupByDate(filteredEntries);
  const totalEntries = filteredEntries.length;
  const todayCount = groupedEntries["Vandaag"].length;
  const distinctUsers = new Set(filteredEntries.map((e) => e.userId).filter(Boolean)).size;
  const filtersActive = typeFilter !== "all" || actionFilter !== "all" || userFilter !== "all";
  const clearFilters = () => { setSearchQuery(""); setTypeFilter("all"); setActionFilter("all"); setUserFilter("all"); };

  return (
    <CareCommandShell
      title={
        <span className="inline-flex flex-wrap items-center gap-2">
          Audittrail
          <CareInfoPopover ariaLabel="Uitleg audittrail" testId="audittrail-page-info">
            <p className="text-muted-foreground">Traceerbare gebeurtenissen voor compliance en onderzoek — alleen-lezen.</p>
          </CareInfoPopover>
        </span>
      }
    >
      <CareMetricStrip>
        <CareMetricCard value={totalEntries} label="Activiteiten" tone={totalEntries === 0 ? "warning" : "neutral"} />
        <CareMetricCard value={todayCount} label="Vandaag" tone="neutral" />
        <CareMetricCard value={distinctUsers} label="Gebruikers" tone="neutral" />
      </CareMetricStrip>

      <CareWorklistToolbar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Zoeken op casus-ID, gebruiker of actie..."
        filtersActive={filtersActive}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters((v) => !v)}
        rightSlot={
          filtersActive ? (
            <button
              type="button"
              onClick={clearFilters}
              className="shrink-0 rounded-[10px] border border-border/60 bg-card/30 px-2.5 py-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Wis filters
            </button>
          ) : undefined
        }
      />

      <CareWorklistFilterPanel open={showFilters}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as EntityType | "all")}
              className="h-10 w-full rounded-[10px] border border-border/80 bg-background px-3 text-sm text-foreground"
            >
              <option value="all">Alle types</option>
              <option value="casus">Casus</option>
              <option value="aanbiederreactie">Aanbiederreactie</option>
              <option value="matching">Matching</option>
              <option value="plaatsing">Plaatsing</option>
              <option value="intake">Intake</option>
              <option value="document">Document</option>
              <option value="gebruiker">Gebruiker</option>
              <option value="instellingen">Instellingen</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">Actie</label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value as ActionType | "all")}
              className="h-10 w-full rounded-[10px] border border-border/80 bg-background px-3 text-sm text-foreground"
            >
              <option value="all">Alle acties</option>
              <option value="aangemaakt">Aangemaakt</option>
              <option value="gewijzigd">Gewijzigd</option>
              <option value="verwijderd">Verwijderd</option>
              <option value="bevestigd">Bevestigd</option>
              <option value="toegewezen">Toegewezen</option>
              <option value="geupload">Geupload</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">Gebruiker</label>
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="h-10 w-full rounded-[10px] border border-border/80 bg-background px-3 text-sm text-foreground"
            >
              <option value="all">Alle gebruikers</option>
              {uniqueUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>
      </CareWorklistFilterPanel>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className={selectedEntry ? "xl:col-span-2" : "xl:col-span-3"}>
          <div className={auditListShell}>
            {loading && <LoadingState title="Auditlog laden…" copy="Activiteitenlijst wordt opgebouwd." />}
            {!loading && error && (
              <ErrorState
                title="Kon auditlog niet laden"
                copy={error}
                action={<Button variant="outline" size="sm" onClick={refetch}>Opnieuw proberen</Button>}
              />
            )}
            {!loading && !error && (
              <>
                {Object.entries(groupedEntries).map(([group, entries]) => {
                  if (entries.length === 0) return null;
                  return (
                    <div key={group}>
                      <div className="px-4 py-3 bg-muted/30 border-b border-border">
                        <h3 className="text-sm font-medium text-foreground">{group}</h3>
                      </div>
                      <div className="divide-y divide-border">
                        {entries.map((entry) => (
                          <AuditEntryRow
                            key={entry.id}
                            entry={entry}
                            isSelected={selectedEntry?.id === entry.id}
                            onSelect={() => setSelectedEntry(entry)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
                {totalEntries === 0 && (
                  <EmptyState
                    title="Geen activiteiten"
                    copy="Er zijn geen auditregels die passen bij de huidige filters."
                    action={filtersActive ? <Button variant="outline" size="sm" onClick={clearFilters}>Wis filters</Button> : undefined}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {selectedEntry && (
          <div className="xl:col-span-1">
            <AuditDetailPanel entry={selectedEntry} onOpenEntity={onOpenEntity} onClose={() => setSelectedEntry(null)} />
          </div>
        )}
      </div>
    </CareCommandShell>
  );
}

function AuditEntryRow({
  entry,
  isSelected,
  onSelect,
}: {
  entry: AuditEntry;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const typeConfig = entityTypeConfig[entry.entityType];
  const actionConfig = actionTypeConfig[entry.actionType];
  const TypeIcon = typeConfig.icon;

  const formatTime = (timestamp: string) =>
    new Date(timestamp).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      className={`p-4 cursor-pointer transition-colors hover:bg-muted/50 ${isSelected ? "bg-primary/5 border-l-4 border-primary" : ""}`}
      onClick={onSelect}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-16 pt-0.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock size={12} />
            <span className="font-medium">{formatTime(entry.timestamp)}</span>
          </div>
        </div>
        <div className={`flex-shrink-0 ${typeConfig.color} mt-0.5`}>
          <TypeIcon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-foreground">{entry.action}</span>
            <span className={`text-xs font-medium ${actionConfig.color}`}>{actionConfig.label}</span>
          </div>
          <p className="text-sm text-muted-foreground mb-1 truncate">{entry.entityName}</p>
          {entry.description && (
            <p className="text-sm text-muted-foreground mb-2">{entry.description}</p>
          )}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <User size={12} />
            <span>{entry.userName}{entry.userRole ? <span className="text-muted-foreground/60"> {entry.userRole}</span> : null}</span>
          </div>
        </div>
        <div className="flex-shrink-0 text-muted-foreground">
          <ChevronRight size={16} />
        </div>
      </div>
    </div>
  );
}

function AuditDetailPanel({
  entry,
  onOpenEntity,
  onClose,
}: {
  entry: AuditEntry;
  onOpenEntity?: (entry: AuditEntry) => void;
  onClose: () => void;
}) {
  const typeConfig = entityTypeConfig[entry.entityType];
  const actionConfig = actionTypeConfig[entry.actionType];
  const TypeIcon = typeConfig.icon;

  const formatFullTimestamp = (timestamp: string) =>
    new Date(timestamp).toLocaleString("nl-NL", {
      day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });

  return (
    <div
      className="rounded-[16px] border border-border/55 bg-card/30 p-4 space-y-3 sticky"
      style={{ top: tokens.layout.edgeZero }}
    >
      <div className="flex items-start justify-between">
        <h3 className="font-medium">Activiteit details</h3>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onClose}><X size={16} /></Button>
      </div>

      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className={typeConfig.color}><TypeIcon size={24} /></div>
          <div>
            <h4 className="font-medium text-foreground">{entry.action}</h4>
            <span className={`text-xs font-medium ${actionConfig.color}`}>{actionConfig.label}</span>
          </div>
        </div>
      </div>

      <div className="p-3 bg-muted/30 rounded-[10px]">
        <div className="flex items-center gap-2 text-sm">
          <Calendar size={14} className="text-muted-foreground" />
          <span className="text-muted-foreground">{formatFullTimestamp(entry.timestamp)}</span>
        </div>
      </div>

      {entry.description && (
        <div>
          <span className="text-xs font-medium text-muted-foreground">Beschrijving</span>
          <p className="text-sm mt-1">{entry.description}</p>
        </div>
      )}

      <div>
        <span className="text-xs font-medium text-muted-foreground">Gerelateerde entiteit</span>
        <div className="mt-2 p-3 bg-muted/30 rounded-[10px] hover:bg-muted/50 cursor-pointer transition-colors group">
          <div className="flex items-center justify-between">
            <div>
              <span className={`text-xs font-medium ${typeConfig.color}`}>{typeConfig.label}</span>
              {entry.entityId && <p className="text-sm font-medium mt-0.5">{entry.entityId}</p>}
              <p className="text-xs text-muted-foreground mt-0.5">{entry.entityName}</p>
            </div>
            <ExternalLink size={14} className="text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
        </div>
      </div>

      <div>
        <span className="text-xs font-medium text-muted-foreground">Uitgevoerd door</span>
        <div className="mt-2 p-3 bg-muted/30 rounded-[10px]">
          <div className="flex items-center gap-2">
            <User size={14} className="text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{entry.userName}</p>
              {entry.userRole && <p className="text-xs text-muted-foreground">{entry.userRole}</p>}
            </div>
          </div>
        </div>
      </div>

      {entry.changes && entry.changes.length > 0 && (
        <div>
          <span className="text-xs font-medium text-muted-foreground">Wijzigingen</span>
          <div className="mt-2 space-y-3">
            {entry.changes.map((change, idx) => (
              <div key={idx} className="p-3 bg-muted/30 rounded-[10px] space-y-2">
                <div className="text-xs font-medium text-foreground">{change.field}</div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Voor:</span>
                    <span className="text-sm font-medium text-care-urgent-text/80">{change.before || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Na:</span>
                    <span className="text-sm font-medium text-care-success-text">{change.after}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {entry.metadata && Object.keys(entry.metadata).length > 0 && (
        <div>
          <span className="text-xs font-medium text-muted-foreground">Extra informatie</span>
          <div className="mt-2 space-y-2">
            {Object.entries(entry.metadata).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1").trim()}:</span>
                <span className="font-medium">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pt-4 border-t border-border">
        <Button variant="outline" className="w-full gap-2" onClick={() => onOpenEntity?.(entry)}>
          <Eye size={16} />
          Bekijk {typeConfig.label.toLowerCase()}
        </Button>
      </div>
    </div>
  );
}
