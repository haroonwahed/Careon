import { useState, useEffect, useRef } from "react";
import {
  Upload,
  Download,
  Eye,
  Link2,
  Archive,
  FileText,
  File,
  FileCheck,
  X,
  Calendar,
  User,
  ExternalLink
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
import { useDocuments } from "../../hooks/useDocuments";
import { tokens } from "../../design/tokens";

type DocumentType = "intake" | "contract" | "rapport" | "beoordeling" | "overig";
type LinkedEntity = "casus" | "aanbieder" | "gemeente" | "geen";
type DocumentStatus = "actief" | "gearchiveerd";

interface Document {
  id: string;
  name: string;
  type: DocumentType;
  linkedTo: { type: LinkedEntity; id?: string; name?: string };
  uploadDate: string;
  uploadedBy: string;
  status: DocumentStatus;
  fileSize: string;
  fileType: string;
  hasStoredFile: boolean;
  externalHandoffReference?: string;
}

const documentTypeConfig: Record<DocumentType, { label: string; color: string; icon: any }> = {
  intake: { label: "Intake", color: "text-care-brand-text", icon: FileText },
  contract: { label: "Contract", color: "text-care-info-text", icon: FileCheck },
  rapport: { label: "Rapport", color: "text-care-warning-text", icon: File },
  beoordeling: { label: "Aanbieder beoordeling", color: "text-care-success-text", icon: FileText },
  overig: { label: "Overig", color: "text-muted-foreground", icon: File },
};

const linkedEntityConfig: Record<LinkedEntity, { label: string; color: string }> = {
  casus: { label: "Casus", color: "text-care-info-text" },
  aanbieder: { label: "Aanbieder", color: "text-care-info-text" },
  gemeente: { label: "Gemeente", color: "text-care-success-text" },
  geen: { label: "Niet gekoppeld", color: "text-muted-foreground" },
};

export function DocumentenPage() {
  const { documents: apiDocuments, loading, error, refetch } = useDocuments({ q: "" });

  const [documents, setDocuments] = useState<Document[]>([]);
  const prevKeyRef = useRef<string>("");
  useEffect(() => {
    const key = apiDocuments.map((d) => d.id).join(",");
    if (key !== prevKeyRef.current) {
      prevKeyRef.current = key;
      // @ts-ignore
      setDocuments(apiDocuments.map((d) => ({
        id: d.id,
        name: d.name,
        type: (d.type as DocumentType) || ("overig" as DocumentType),
        linkedTo: {
          type: (d.linkedCaseId ? "casus" : "geen") as LinkedEntity,
          id: d.linkedCaseId ?? undefined,
          name: d.linkedCaseName ?? undefined,
        },
        uploadDate: new Date(d.uploadDate).toLocaleDateString("nl-NL"),
        uploadedBy: d.uploadedBy,
        status: (d.status === "archived" ? "gearchiveerd" : "actief") as DocumentStatus,
        fileSize: d.fileSize,
        fileType: d.mimeType.split("/")[1]?.toUpperCase() ?? d.mimeType,
        hasStoredFile: d.hasStoredFile,
        externalHandoffReference: d.externalHandoffReference,
      })));
    }
  }, [apiDocuments]);

  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [lastActionMessage, setLastActionMessage] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<DocumentType | "all">("all");
  const [linkedToFilter, setLinkedToFilter] = useState<LinkedEntity | "all">("all");
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | "all">("all");

  const filteredDocuments = documents.filter((doc) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        doc.name.toLowerCase().includes(query) ||
        doc.linkedTo.id?.toLowerCase().includes(query) ||
        doc.linkedTo.name?.toLowerCase().includes(query) ||
        doc.uploadedBy.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }
    if (typeFilter !== "all" && doc.type !== typeFilter) return false;
    if (linkedToFilter !== "all" && doc.linkedTo.type !== linkedToFilter) return false;
    if (statusFilter !== "all" && doc.status !== statusFilter) return false;
    return true;
  });

  const activeCount = documents.filter((d) => d.status === "actief").length;
  const linkedCount = documents.filter((d) => d.linkedTo.type !== "geen").length;
  const recentCount = apiDocuments.filter((d) => {
    const uploaded = new Date(d.uploadDate);
    const diffDays = Math.floor((Date.now() - uploaded.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  }).length;

  const filtersActive = typeFilter !== "all" || linkedToFilter !== "all" || statusFilter !== "all";
  const clearFilters = () => { setTypeFilter("all"); setLinkedToFilter("all"); setStatusFilter("all"); setSearchQuery(""); };

  const handleView = (document: Document) => {
    setSelectedDocument(document);
    setLastActionMessage(`Preview geopend voor ${document.id}`);
  };

  const handleDownload = (document: Document) => {
    setLastActionMessage(`Download gestart voor ${document.id}`);
  };

  const handleLink = (document: Document) => {
    if (document.linkedTo.type !== "geen") {
      setLastActionMessage(`${document.id} is al gekoppeld`);
      return;
    }
    setLastActionMessage("Selecteer een casus vanuit het casusoverzicht om dit document aan te koppelen.");
  };

  const handleArchive = (document: Document) => {
    const updatedDocument = { ...document, status: "gearchiveerd" as const };
    setDocuments((current) => current.map((item) => (item.id === document.id ? updatedDocument : item)));
    if (selectedDocument?.id === document.id) setSelectedDocument(updatedDocument);
    setLastActionMessage(`${document.id} gearchiveerd`);
  };

  return (
    <CareCommandShell
      title={
        <span className="inline-flex flex-wrap items-center gap-2">
          Documenten
          <CareInfoPopover ariaLabel="Uitleg documenten" testId="documenten-page-info">
            <p className="text-muted-foreground">Zoek en beheer documenten gekoppeld aan casussen.</p>
          </CareInfoPopover>
        </span>
      }
    >
      <CareMetricStrip>
        <CareMetricCard value={activeCount} label="Actieve documenten" tone={activeCount === 0 ? "warning" : "neutral"} />
        <CareMetricCard value={linkedCount} label="Gekoppeld" tone="neutral" />
        <CareMetricCard value={recentCount} label="Recent (7d)" tone="neutral" />
      </CareMetricStrip>

      {lastActionMessage && (
        <div className="rounded-[10px] border border-border/70 bg-muted/30 px-3 py-2 text-sm text-foreground">
          {lastActionMessage}
        </div>
      )}

      <CareWorklistToolbar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Zoeken op document, casus-ID of gebruiker..."
        filtersActive={filtersActive}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters((v) => !v)}
      />

      <CareWorklistFilterPanel open={showFilters}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as DocumentType | "all")}
              className="h-10 w-full rounded-[10px] border border-border/80 bg-background px-3 text-sm text-foreground"
            >
              <option value="all">Alle types</option>
              <option value="intake">Intake</option>
              <option value="contract">Contract</option>
              <option value="rapport">Rapport</option>
              <option value="beoordeling">Aanbieder beoordeling</option>
              <option value="overig">Overig</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">Gekoppeld aan</label>
            <select
              value={linkedToFilter}
              onChange={(e) => setLinkedToFilter(e.target.value as LinkedEntity | "all")}
              className="h-10 w-full rounded-[10px] border border-border/80 bg-background px-3 text-sm text-foreground"
            >
              <option value="all">Alles</option>
              <option value="casus">Casus</option>
              <option value="aanbieder">Aanbieder</option>
              <option value="gemeente">Gemeente</option>
              <option value="geen">Niet gekoppeld</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as DocumentStatus | "all")}
              className="h-10 w-full rounded-[10px] border border-border/80 bg-background px-3 text-sm text-foreground"
            >
              <option value="all">Alle statussen</option>
              <option value="actief">Actief</option>
              <option value="gearchiveerd">Gearchiveerd</option>
            </select>
          </div>
        </div>
      </CareWorklistFilterPanel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className={selectedDocument ? "xl:col-span-2" : "xl:col-span-3"}>
          <div className="overflow-hidden rounded-[20px] border border-border/60 bg-card/45 shadow-sm">
            <div className="sticky top-0 z-10 grid grid-cols-12 gap-4 border-b border-border/60 bg-card/75 px-4 py-3 backdrop-blur">
              <div className="col-span-4 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Document</div>
              <div className="col-span-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Type</div>
              <div className="col-span-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Gekoppeld aan</div>
              <div className="col-span-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Upload</div>
              <div className="col-span-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Acties</div>
            </div>

            <div className="divide-y divide-border/40">
              {filteredDocuments.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  document={doc}
                  isSelected={selectedDocument?.id === doc.id}
                  onSelect={() => setSelectedDocument(doc)}
                  onView={() => handleView(doc)}
                  onDownload={() => handleDownload(doc)}
                  onLink={() => handleLink(doc)}
                  onArchive={() => handleArchive(doc)}
                />
              ))}
            </div>

            {loading && <LoadingState title="Documenten laden…" copy="Bestandenlijst wordt opgebouwd." />}
            {!loading && error && (
              <ErrorState
                title="Kon documenten niet laden"
                copy={error}
                action={<Button variant="outline" size="sm" onClick={refetch}>Opnieuw proberen</Button>}
              />
            )}
            {!loading && !error && filteredDocuments.length === 0 && (
              <EmptyState
                title="Geen documenten"
                copy="Er zijn geen documenten die passen bij de huidige filters."
                action={<Button variant="outline" onClick={clearFilters}>Wis filters</Button>}
              />
            )}
          </div>
        </div>

        {selectedDocument && (
          <div className="xl:col-span-1">
            <DocumentPreview
              document={selectedDocument}
              onDownload={() => handleDownload(selectedDocument)}
              onLink={() => handleLink(selectedDocument)}
              onArchive={() => handleArchive(selectedDocument)}
              onClose={() => setSelectedDocument(null)}
            />
          </div>
        )}
      </div>
    </CareCommandShell>
  );
}

function DocumentRow({
  document,
  isSelected,
  onSelect,
  onView,
  onDownload,
  onLink,
  onArchive,
}: {
  document: Document;
  isSelected: boolean;
  onSelect: () => void;
  onView: () => void;
  onDownload: () => void;
  onLink: () => void;
  onArchive: () => void;
}) {
  const typeConfig = documentTypeConfig[document.type];
  const linkedConfig = linkedEntityConfig[document.linkedTo.type];
  const TypeIcon = typeConfig.icon;

  return (
    <div
      className={`grid grid-cols-12 gap-4 px-4 py-4 cursor-pointer transition-colors hover:bg-muted/35 ${isSelected ? "border-l-4 border-primary bg-primary/5" : ""}`}
      onClick={onSelect}
    >
      <div className="col-span-4">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 ${typeConfig.color}`}><TypeIcon size={18} /></div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">{document.name}</p>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              {document.hasStoredFile ? (
                <span>{document.fileType} · {document.fileSize}</span>
              ) : (
                <span>Extern opgeslagen</span>
              )}
              {document.externalHandoffReference && (
                <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">Externe handoff</span>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="col-span-2">
        <span className={`text-sm font-medium ${typeConfig.color}`}>{typeConfig.label}</span>
      </div>
      <div className="col-span-2">
        {document.linkedTo.type !== "geen" ? (
          <div>
            <span className={`text-xs font-medium ${linkedConfig.color}`}>{linkedConfig.label}</span>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{document.linkedTo.id}</p>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Niet gekoppeld</span>
        )}
      </div>
      <div className="col-span-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
          <Calendar size={12} />
          <span>{document.uploadDate.split(",")[0]}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <User size={12} />
          <span>{document.uploadedBy}</span>
        </div>
      </div>
      <div className="col-span-2">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); onView(); }}><Eye size={14} /></Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); onDownload(); }}><Download size={14} /></Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); onLink(); }}><Link2 size={14} /></Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-care-urgent-text" onClick={(e) => { e.stopPropagation(); onArchive(); }}><Archive size={14} /></Button>
        </div>
      </div>
    </div>
  );
}

function DocumentPreview({
  document,
  onDownload,
  onLink,
  onArchive,
  onClose,
}: {
  document: Document;
  onDownload: () => void;
  onLink: () => void;
  onArchive: () => void;
  onClose: () => void;
}) {
  const typeConfig = documentTypeConfig[document.type];
  const linkedConfig = linkedEntityConfig[document.linkedTo.type];

  return (
    <div className="sticky space-y-3 rounded-[20px] border border-border/60 bg-card/45 p-4 shadow-sm backdrop-blur" style={{ top: tokens.layout.edgeZero }}>
      <div className="flex items-start justify-between">
        <h3 className="care-text-heading">Document</h3>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onClose}><X size={16} /></Button>
      </div>

      <div className="aspect-[3/4] rounded-[16px] border border-border/60 bg-muted/30 flex items-center justify-center">
        <div className="text-center">
          <FileText size={48} className="mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">Documentweergave</p>
        </div>
      </div>

      <div className="space-y-3 text-sm">
        <div>
          <span className="text-muted-foreground">Naam</span>
          <p className="font-medium mt-1">{document.name}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-muted-foreground text-xs">Type</span>
            <p className={`font-medium mt-1 ${typeConfig.color}`}>{typeConfig.label}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Bestand</span>
            <p className="font-medium mt-1">{document.hasStoredFile ? document.fileType : "Extern opgeslagen"}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-muted-foreground text-xs">Grootte</span>
            <p className="font-medium mt-1">{document.hasStoredFile ? document.fileSize : "Niet lokaal opgeslagen"}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Status</span>
            <p className="font-medium mt-1">{document.status === "actief" ? "Actief" : "Gearchiveerd"}</p>
          </div>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Upload datum</span>
          <p className="font-medium mt-1">{document.uploadDate}</p>
        </div>
        {document.externalHandoffReference && (
          <div>
            <span className="text-muted-foreground text-xs">Externe handoff</span>
            <p className="font-medium mt-1 break-all">{document.externalHandoffReference}</p>
          </div>
        )}
        <div>
          <span className="text-muted-foreground text-xs">Geüpload door</span>
          <p className="font-medium mt-1">{document.uploadedBy}</p>
        </div>
        {document.linkedTo.type !== "geen" && (
          <div>
            <span className="text-muted-foreground text-xs">Gekoppeld aan</span>
            <div className="mt-1 rounded-[10px] border border-border/60 bg-muted/25 p-3">
              <span className={`text-xs font-medium ${linkedConfig.color}`}>{linkedConfig.label}</span>
              <p className="text-sm font-medium mt-0.5">{document.linkedTo.id}</p>
              {document.linkedTo.name && <p className="text-xs text-muted-foreground mt-0.5">{document.linkedTo.name}</p>}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-border/60 pt-4">
        {document.hasStoredFile ? (
          <>
            <Button className="w-full bg-primary hover:bg-primary/90 gap-2" onClick={onDownload}><Download size={16} />Download</Button>
            <Button variant="outline" className="w-full gap-2" onClick={onDownload}><ExternalLink size={16} />Bekijk in nieuw tabblad</Button>
          </>
        ) : (
          <div className="rounded-[10px] border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
            Geen lokaal bestand opgeslagen. Gebruik de externe handoffreferentie voor veilige uitwisseling buiten CareOn.
          </div>
        )}
        {document.linkedTo.type === "geen" && document.hasStoredFile && (
          <Button variant="outline" className="w-full gap-2" onClick={onLink}><Link2 size={16} />Koppel aan casus</Button>
        )}
        <Button variant="outline" className="w-full gap-2 text-care-urgent-text hover:text-care-urgent-text/80" onClick={onArchive}><Archive size={16} />Archiveer</Button>
      </div>
    </div>
  );
}
