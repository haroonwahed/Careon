/**
 * AudittrailPage - System Activity Log
 * 
 * Purpose: Full traceability of all system actions
 * - Compliance and transparency
 * - Investigation and dispute resolution
 * - Read-only activity log
 * 
 * This is NOT a workflow page - strictly audit logging.
 */

import { useState } from "react";
import { 
  Search,
  Filter,
  X,
  ChevronRight,
  Calendar,
  User,
  FileText,
  Clock,
  AlertCircle,
  CheckCircle2,
  Edit,
  Trash2,
  UserPlus,
  Upload,
  Settings,
  Eye,
  ExternalLink
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useAuditLog } from "../../hooks/useAuditLog";
import { Loader2 } from "lucide-react";

type EntityType = "casus" | "beoordeling" | "matching" | "plaatsing" | "intake" | "document" | "gebruiker" | "instellingen";
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
  changes?: {
    field: string;
    before: string;
    after: string;
  }[];
  metadata?: Record<string, any>;
}


const entityTypeConfig: Record<EntityType, { label: string; icon: any; color: string }> = {
  casus: { label: "Casus", icon: FileText, color: "text-purple-500" },
  beoordeling: { label: "Aanbieder Beoordeling", icon: FileText, color: "text-blue-500" },
  matching: { label: "Matching", icon: CheckCircle2, color: "text-green-500" },
  plaatsing: { label: "Plaatsing", icon: CheckCircle2, color: "text-emerald-500" },
  intake: { label: "Intake", icon: FileText, color: "text-amber-500" },
  document: { label: "Document", icon: Upload, color: "text-cyan-500" },
  gebruiker: { label: "Gebruiker", icon: User, color: "text-pink-500" },
  instellingen: { label: "Instellingen", icon: Settings, color: "text-slate-500" }
};

const actionTypeConfig: Record<ActionType, { label: string; color: string }> = {
  aangemaakt: { label: "Aangemaakt", color: "text-green-500" },
  gewijzigd: { label: "Gewijzigd", color: "text-blue-500" },
  verwijderd: { label: "Verwijderd", color: "text-red-500" },
  bevestigd: { label: "Bevestigd", color: "text-emerald-500" },
  toegewezen: { label: "Toegewezen", color: "text-amber-500" },
  geupload: { label: "Geüpload", color: "text-cyan-500" },
  bekeken: { label: "Bekeken", color: "text-slate-500" }
};

interface AudittrailPageProps {
  onOpenEntity?: (entry: AuditEntry) => void;
}

export function AudittrailPage({ onOpenEntity }: AudittrailPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  
  // Filters
  const [typeFilter, setTypeFilter] = useState<EntityType | "all">("all");
  const [actionFilter, setActionFilter] = useState<ActionType | "all">("all");
  const [userFilter, setUserFilter] = useState<string>("all");

  const { entries: apiEntries, loading, error, refetch } = useAuditLog({ q: searchQuery });

  // Map SpaAuditEntry → internal AuditEntry shape
  const mappedEntries: AuditEntry[] = apiEntries.map(e => ({
    id: e.id,
    timestamp: e.timestamp,
    action: e.action,
    actionType: (["aangemaakt","gewijzigd","verwijderd","bevestigd","toegewezen","geupload","bekeken"]
      .includes(e.action) ? e.action : "gewijzigd") as ActionType,
    entityType: (["casus","beoordeling","matching","plaatsing","intake","document","gebruiker","instellingen"]
      .includes(e.modelName?.toLowerCase() ?? "") ? e.modelName!.toLowerCase() : "casus") as EntityType,
    entityId: e.objectId ?? undefined,
    entityName: e.objectRepr ?? "",
    userId: e.userEmail ?? e.userName ?? "",
    userName: e.userName ?? "",
    userRole: "",
    description: e.action,
    changes: e.changes
      ? Object.entries(e.changes).map(([field, val]) => ({
          field,
          before: String((val as any).old ?? ""),
          after: String((val as any).new ?? ""),
        }))
      : undefined,
  }));

  // Group by date
  const groupByDate = (entries: AuditEntry[]) => {
    const groups: { [key: string]: AuditEntry[] } = {
      "Vandaag": [],
      "Gisteren": [],
      "Eerder": []
    };

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    entries.forEach(entry => {
      const entryDate = new Date(entry.timestamp);
      const isToday = entryDate.toDateString() === today.toDateString();
      const isYesterday = entryDate.toDateString() === yesterday.toDateString();

      if (isToday) {
        groups["Vandaag"].push(entry);
      } else if (isYesterday) {
        groups["Gisteren"].push(entry);
      } else {
        groups["Eerder"].push(entry);
      }
    });

    return groups;
  };

  // Filter entries
  const filteredEntries = mappedEntries.filter(entry => {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold text-foreground mb-1">
          Audittrail
        </h1>
        <p className="text-sm text-muted-foreground">
          {totalEntries} activiteiten geregistreerd
        </p>
      </div>

      {/* Search & Filters */}
      <div className="premium-card p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search 
              size={18} 
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" 
            />
            <Input
              placeholder="Zoek op casus ID, gebruiker, actie..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {/* Filter Toggle */}
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={`gap-2 ${showFilters ? "border-primary/50 text-primary" : ""}`}
          >
            <Filter size={16} />
            Filters
            {showFilters && <X size={14} />}
          </Button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
            {/* Type Filter */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">
                Type
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as EntityType | "all")}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm"
              >
                <option value="all">Alle types</option>
                <option value="casus">Casus</option>
                <option value="beoordeling">Aanbieder Beoordeling</option>
                <option value="matching">Matching</option>
                <option value="plaatsing">Plaatsing</option>
                <option value="intake">Intake</option>
                <option value="document">Document</option>
                <option value="gebruiker">Gebruiker</option>
                <option value="instellingen">Instellingen</option>
              </select>
            </div>

            {/* Action Filter */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">
                Actie
              </label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value as ActionType | "all")}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm"
              >
                <option value="all">Alle acties</option>
                <option value="aangemaakt">Aangemaakt</option>
                <option value="gewijzigd">Gewijzigd</option>
                <option value="verwijderd">Verwijderd</option>
                <option value="bevestigd">Bevestigd</option>
                <option value="toegewezen">Toegewezen</option>
                <option value="geupload">Geüpload</option>
              </select>
            </div>

            {/* User Filter */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">
                Gebruiker
              </label>
              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm"
              >
                <option value="all">Alle gebruikers</option>
                <option value="U-001">Jane Doe</option>
                <option value="U-002">Mark van den Berg</option>
                <option value="U-003">Dr. P. Bakker</option>
                <option value="U-004">Lisa de Vries</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Activity List */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main List */}
        <div className={selectedEntry ? "xl:col-span-2" : "xl:col-span-3"}>
          <div className="premium-card overflow-hidden">
            {loading && (
              <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                <Loader2 size={18} className="animate-spin" />
                <span>Auditlog laden…</span>
              </div>
            )}
            {error && (
              <div className="p-6 text-center text-destructive space-y-2">
                <p>Kon auditlog niet laden: {error}</p>
                <button className="text-sm underline" onClick={refetch}>Opnieuw proberen</button>
              </div>
            )}
            {!loading && !error && (<>
            {Object.entries(groupedEntries).map(([group, entries]) => {
              if (entries.length === 0) return null;
              
              return (
                <div key={group}>
                  {/* Group Header */}
                  <div className="px-4 py-3 bg-muted/30 border-b border-border">
                    <h3 className="text-sm font-semibold text-foreground">
                      {group}
                    </h3>
                  </div>

                  {/* Group Entries */}
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

            {/* Empty State */}
            {totalEntries === 0 && (
              <div className="p-12 text-center">
                <AlertCircle size={48} className="mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold mb-2">Geen activiteiten gevonden</h3>
                <p className="text-sm text-muted-foreground">
                  Geen activiteiten gevonden binnen deze selectie
                </p>
              </div>
            )}
          </>)}
          </div>
        </div>

        {/* Detail Panel */}
        {selectedEntry && (
          <div className="xl:col-span-1">
            <AuditDetailPanel
              entry={selectedEntry}
              onOpenEntity={onOpenEntity}
              onClose={() => setSelectedEntry(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Audit Entry Row Component
function AuditEntryRow({ 
  entry, 
  isSelected,
  onSelect 
}: { 
  entry: AuditEntry;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const typeConfig = entityTypeConfig[entry.entityType];
  const actionConfig = actionTypeConfig[entry.actionType];
  const TypeIcon = typeConfig.icon;

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("nl-NL", { 
      hour: "2-digit", 
      minute: "2-digit" 
    });
  };

  return (
    <div 
      className={`
        p-4 cursor-pointer transition-colors
        hover:bg-muted/50
        ${isSelected ? "bg-primary/5 border-l-4 border-primary" : ""}
      `}
      onClick={onSelect}
    >
      <div className="flex items-start gap-4">
        {/* Timestamp */}
        <div className="flex-shrink-0 w-16 pt-0.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock size={12} />
            <span className="font-medium">{formatTime(entry.timestamp)}</span>
          </div>
        </div>

        {/* Icon */}
        <div className={`flex-shrink-0 ${typeConfig.color} mt-0.5`}>
          <TypeIcon size={18} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Action */}
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-foreground">
              {entry.action}
            </span>
            <span className={`text-xs font-medium ${actionConfig.color}`}>
              {actionConfig.label}
            </span>
          </div>

          {/* Entity */}
          <p className="text-sm text-muted-foreground mb-1 truncate">
            {entry.entityName}
          </p>

          {/* Description */}
          <p className="text-sm text-muted-foreground mb-2">
            {entry.description}
          </p>

          {/* User */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <User size={12} />
            <span>
              {entry.userName} <span className="text-muted-foreground/60">({entry.userRole})</span>
            </span>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex-shrink-0 text-muted-foreground">
          <ChevronRight size={16} />
        </div>
      </div>
    </div>
  );
}

// Audit Detail Panel Component
function AuditDetailPanel({ 
  entry, 
  onOpenEntity,
  onClose 
}: { 
  entry: AuditEntry;
  onOpenEntity?: (entry: AuditEntry) => void;
  onClose: () => void;
}) {
  const typeConfig = entityTypeConfig[entry.entityType];
  const actionConfig = actionTypeConfig[entry.actionType];
  const TypeIcon = typeConfig.icon;

  const formatFullTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString("nl-NL", { 
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit", 
      minute: "2-digit",
      second: "2-digit"
    });
  };

  return (
    <div className="premium-card p-5 space-y-4 sticky top-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <h3 className="font-semibold">Activiteit details</h3>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={onClose}
        >
          <X size={16} />
        </Button>
      </div>

      {/* Action */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className={`${typeConfig.color}`}>
            <TypeIcon size={24} />
          </div>
          <div>
            <h4 className="font-semibold text-foreground">
              {entry.action}
            </h4>
            <span className={`text-xs font-medium ${actionConfig.color}`}>
              {actionConfig.label}
            </span>
          </div>
        </div>
      </div>

      {/* Timestamp */}
      <div className="p-3 bg-muted/30 rounded-lg">
        <div className="flex items-center gap-2 text-sm">
          <Calendar size={14} className="text-muted-foreground" />
          <span className="text-muted-foreground">
            {formatFullTimestamp(entry.timestamp)}
          </span>
        </div>
      </div>

      {/* Description */}
      <div>
        <span className="text-xs font-medium text-muted-foreground">Beschrijving</span>
        <p className="text-sm mt-1">{entry.description}</p>
      </div>

      {/* Entity */}
      <div>
        <span className="text-xs font-medium text-muted-foreground">Gerelateerde entiteit</span>
        <div className="mt-2 p-3 bg-muted/30 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group">
          <div className="flex items-center justify-between">
            <div>
              <span className={`text-xs font-medium ${typeConfig.color}`}>
                {typeConfig.label}
              </span>
              {entry.entityId && (
                <p className="text-sm font-medium mt-0.5">
                  {entry.entityId}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">
                {entry.entityName}
              </p>
            </div>
            <ExternalLink size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </div>
      </div>

      {/* User */}
      <div>
        <span className="text-xs font-medium text-muted-foreground">Uitgevoerd door</span>
        <div className="mt-2 p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2">
            <User size={14} className="text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{entry.userName}</p>
              <p className="text-xs text-muted-foreground">{entry.userRole}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Changes */}
      {entry.changes && entry.changes.length > 0 && (
        <div>
          <span className="text-xs font-medium text-muted-foreground">Wijzigingen</span>
          <div className="mt-2 space-y-3">
            {entry.changes.map((change, idx) => (
              <div key={idx} className="p-3 bg-muted/30 rounded-lg space-y-2">
                <div className="text-xs font-semibold text-foreground">
                  {change.field}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Voor:</span>
                    <span className="text-sm font-medium text-red-500/80">
                      {change.before || "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Na:</span>
                    <span className="text-sm font-medium text-green-500">
                      {change.after}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      {entry.metadata && Object.keys(entry.metadata).length > 0 && (
        <div>
          <span className="text-xs font-medium text-muted-foreground">Extra informatie</span>
          <div className="mt-2 space-y-2">
            {Object.entries(entry.metadata).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}:
                </span>
                <span className="font-medium">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="pt-4 border-t border-border">
        <Button 
          variant="outline" 
          className="w-full gap-2"
          onClick={() => onOpenEntity?.(entry)}
        >
          <Eye size={16} />
          Bekijk {typeConfig.label.toLowerCase()}
        </Button>
      </div>
    </div>
  );
}
