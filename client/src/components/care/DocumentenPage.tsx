/**
 * DocumentenPage - Document Management
 * 
 * Purpose: View and manage uploaded documents
 * - Find documents quickly
 * - Link to casussen/providers
 * - Access and download files
 * 
 * This is NOT a workflow page - just clean document management.
 */

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
  ChevronDown,
  Calendar,
  User,
  ExternalLink
} from "lucide-react";
import { Button } from "../ui/button";
import {
  CareAttentionBar,
  CareInfoPopover,
  CareMetaChip,
  CarePageScaffold,
  CareSection,
  CareSectionBody,
  CareSectionHeader,
  CareSearchFiltersBar,
  EmptyState,
  ErrorState,
  LoadingState,
  PrimaryActionButton,
} from "./CareDesignPrimitives";
import { useDocuments } from "../../hooks/useDocuments";
import { tokens } from "../../design/tokens";

type DocumentType = "intake" | "contract" | "rapport" | "beoordeling" | "overig";
type LinkedEntity = "casus" | "aanbieder" | "gemeente" | "geen";
type DocumentStatus = "actief" | "gearchiveerd";

interface Document {
  id: string;
  name: string;
  type: DocumentType;
  linkedTo: {
    type: LinkedEntity;
    id?: string;
    name?: string;
  };
  uploadDate: string;
  uploadedBy: string;
  status: DocumentStatus;
  fileSize: string;
  fileType: string;
}


const documentTypeConfig: Record<DocumentType, { label: string; color: string; icon: any }> = {
  intake: { label: "Intake", color: "text-purple-500", icon: FileText },
  contract: { label: "Contract", color: "text-blue-500", icon: FileCheck },
  rapport: { label: "Rapport", color: "text-amber-500", icon: File },
  beoordeling: { label: "Aanbieder beoordeling", color: "text-green-500", icon: FileText },
  overig: { label: "Overig", color: "text-muted-foreground", icon: File }
};

const linkedEntityConfig: Record<LinkedEntity, { label: string; color: string }> = {
  casus: { label: "Casus", color: "text-primary" },
  aanbieder: { label: "Aanbieder", color: "text-blue-500" },
  gemeente: { label: "Gemeente", color: "text-green-500" },
  geen: { label: "Niet gekoppeld", color: "text-muted-foreground" }
};

export function DocumentenPage() {
  const { documents: apiDocuments, loading, error, refetch } = useDocuments({ q: "" });

  // Map SpaDocument → internal Document shape
  const [documents, setDocuments] = useState<Document[]>([]);
  const prevKeyRef = useRef<string>("");
  useEffect(() => {
    const key = apiDocuments.map(d => d.id).join(",");
    if (key !== prevKeyRef.current) {
      prevKeyRef.current = key;
      setDocuments(apiDocuments.map(d => ({
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
      })));
    }
  }, [apiDocuments]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [lastActionMessage, setLastActionMessage] = useState<string>("");
  
  // Filters
  const [typeFilter, setTypeFilter] = useState<DocumentType | "all">("all");
  const [linkedToFilter, setLinkedToFilter] = useState<LinkedEntity | "all">("all");
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | "all">("all");

  // Filter documents
  const filteredDocuments = documents.filter(doc => {
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

  const activeCount = documents.filter(d => d.status === "actief").length;
  const linkedCount = documents.filter(d => d.linkedTo.type !== "geen").length;
  const recentCount = apiDocuments.filter(d => {
    const uploaded = new Date(d.uploadDate);
    const diffDays = Math.floor((Date.now() - uploaded.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  }).length;

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

    const updatedDocument = {
      ...document,
      linkedTo: {
        type: "casus" as const,
        id: "C-2026-0956",
        name: "Casus C-2026-0956"
      }
    };

    setDocuments((currentDocuments) =>
      currentDocuments.map((item) => (item.id === document.id ? updatedDocument : item))
    );
    setSelectedDocument(updatedDocument);
    setLastActionMessage(`${document.id} gekoppeld aan casus`);
  };

  const handleArchive = (document: Document) => {
    const updatedDocument = { ...document, status: "gearchiveerd" as const };
    setDocuments((currentDocuments) =>
      currentDocuments.map((item) => (item.id === document.id ? updatedDocument : item))
    );
    if (selectedDocument?.id === document.id) {
      setSelectedDocument(updatedDocument);
    }
    setLastActionMessage(`${document.id} gearchiveerd`);
  };

  return (
    <CarePageScaffold
      archetype="worklist"
      className="pb-8"
      title={
        <span className="inline-flex flex-wrap items-center gap-2">
          Documenten
          <CareInfoPopover ariaLabel="Uitleg documenten" testId="documenten-page-info">
            <p className="text-muted-foreground">Zoek en beheer dossierdocumenten en koppelingen naar casussen.</p>
          </CareInfoPopover>
        </span>
      }
      dominantAction={
        <CareAttentionBar
          tone={activeCount === 0 ? "warning" : "info"}
          icon={<FileText size={16} />}
          message={
            activeCount === 0
              ? "Geen actieve documenten gevonden"
              : activeCount === 1
                ? "1 actief document — controle nodig"
                : `${activeCount} actieve documenten — controle nodig`
          }
          action={
            <PrimaryActionButton onClick={() => setShowFilters((current) => !current)}>
              Upload
            </PrimaryActionButton>
          }
        />
      }
    >

      {lastActionMessage && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
          {lastActionMessage}
        </div>
      )}
      <CareSection>
        <CareSectionHeader
          title="Werklijst"
          meta={<CareMetaChip>{filteredDocuments.length} resultaten · {activeCount} actief · {linkedCount} gekoppeld · {recentCount} recent</CareMetaChip>}
        />
        <CareSectionBody className="space-y-4">
        <CareSearchFiltersBar
          className="px-0"
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Zoeken op document, casus ID of gebruiker..."
          showSecondaryFilters={showFilters}
          onToggleSecondaryFilters={() => setShowFilters((current) => !current)}
          secondaryFiltersLabel="Filters"
          secondaryFilters={
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-xs font-medium text-muted-foreground">Type</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as DocumentType | "all")}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
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
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
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
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                >
                  <option value="all">Alle statussen</option>
                  <option value="actief">Actief</option>
                  <option value="gearchiveerd">Gearchiveerd</option>
                </select>
              </div>
            </div>
          }
        />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className={selectedDocument ? "xl:col-span-2" : "xl:col-span-3"}>
          <div className="panel-surface overflow-hidden">
            <div className="grid grid-cols-12 gap-4 p-4 border-b border-border bg-muted/30">
              <div className="col-span-4 text-xs font-semibold text-muted-foreground uppercase">
                Document
              </div>
              <div className="col-span-2 text-xs font-semibold text-muted-foreground uppercase">
                Type
              </div>
              <div className="col-span-2 text-xs font-semibold text-muted-foreground uppercase">
                Gekoppeld aan
              </div>
              <div className="col-span-2 text-xs font-semibold text-muted-foreground uppercase">
                Upload
              </div>
              <div className="col-span-2 text-xs font-semibold text-muted-foreground uppercase">
                Acties
              </div>
            </div>

            <div className="divide-y divide-border">
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

            {loading && (
              <LoadingState title="Documenten laden…" copy="Bestandenlijst wordt opgebouwd." />
            )}
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
                  action={(
                    <Button variant="outline" onClick={() => {
                      setSearchQuery("");
                      setTypeFilter("all");
                      setLinkedToFilter("all");
                      setStatusFilter("all");
                    }}
                    >
                      Wis filters
                    </Button>
                  )}
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
      </CareSectionBody>
      </CareSection>
    </CarePageScaffold>
  );
}

// Document Row Component
function DocumentRow({ 
  document, 
  isSelected,
  onSelect,
  onView,
  onDownload,
  onLink,
  onArchive
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
      className={`
        grid grid-cols-12 gap-4 p-4 cursor-pointer transition-colors
        hover:bg-muted/50
        ${isSelected ? "bg-primary/5 border-l-4 border-primary" : ""}
      `}
      onClick={onSelect}
    >
      {/* Document Name */}
      <div className="col-span-4">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 ${typeConfig.color}`}>
            <TypeIcon size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">
              {document.name}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {document.fileType} · {document.fileSize}
            </p>
          </div>
        </div>
      </div>

      {/* Type */}
      <div className="col-span-2">
        <span className={`text-sm font-medium ${typeConfig.color}`}>
          {typeConfig.label}
        </span>
      </div>

      {/* Linked To */}
      <div className="col-span-2">
        {document.linkedTo.type !== "geen" ? (
          <div>
            <span className={`text-xs font-medium ${linkedConfig.color}`}>
              {linkedConfig.label}
            </span>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {document.linkedTo.id}
            </p>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">
            Niet gekoppeld
          </span>
        )}
      </div>

      {/* Upload Info */}
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

      {/* Actions */}
      <div className="col-span-2">
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={(e) => {
              e.stopPropagation();
              onView();
            }}
          >
            <Eye size={14} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
          >
            <Download size={14} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={(e) => {
              e.stopPropagation();
              onLink();
            }}
          >
            <Link2 size={14} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500"
            onClick={(e) => {
              e.stopPropagation();
              onArchive();
            }}
          >
            <Archive size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Preview Panel Component
function DocumentPreview({ 
  document, 
  onDownload,
  onLink,
  onArchive,
  onClose 
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
    <div className="panel-surface p-4 space-y-3 sticky" style={{ top: tokens.layout.edgeZero }}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <h3 className="font-semibold">Document</h3>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={onClose}
        >
          <X size={16} />
        </Button>
      </div>

      <div className="aspect-[3/4] bg-muted/30 rounded-lg border border-border flex items-center justify-center">
        <div className="text-center">
          <FileText size={48} className="mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">Documentweergave</p>
        </div>
      </div>

      {/* Metadata */}
      <div className="space-y-3 text-sm">
        <div>
          <span className="text-muted-foreground">Naam</span>
          <p className="font-medium mt-1">{document.name}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-muted-foreground text-xs">Type</span>
            <p className={`font-medium mt-1 ${typeConfig.color}`}>
              {typeConfig.label}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Bestand</span>
            <p className="font-medium mt-1">{document.fileType}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-muted-foreground text-xs">Grootte</span>
            <p className="font-medium mt-1">{document.fileSize}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Status</span>
            <p className="font-medium mt-1">
              {document.status === "actief" ? "Actief" : "Gearchiveerd"}
            </p>
          </div>
        </div>

        <div>
          <span className="text-muted-foreground text-xs">Upload datum</span>
          <p className="font-medium mt-1">{document.uploadDate}</p>
        </div>

        <div>
          <span className="text-muted-foreground text-xs">Geüpload door</span>
          <p className="font-medium mt-1">{document.uploadedBy}</p>
        </div>

        {document.linkedTo.type !== "geen" && (
          <div>
            <span className="text-muted-foreground text-xs">Gekoppeld aan</span>
            <div className="mt-1 p-2 bg-muted/30 rounded-lg">
              <span className={`text-xs font-medium ${linkedConfig.color}`}>
                {linkedConfig.label}
              </span>
              <p className="text-sm font-medium mt-0.5">
                {document.linkedTo.id}
              </p>
              {document.linkedTo.name && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {document.linkedTo.name}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-4 border-t border-border">
        <Button className="w-full bg-primary hover:bg-primary/90 gap-2" onClick={onDownload}>
          <Download size={16} />
          Download
        </Button>
        <Button variant="outline" className="w-full gap-2" onClick={onDownload}>
          <ExternalLink size={16} />
          Bekijk in nieuw tabblad
        </Button>
        {document.linkedTo.type === "geen" && (
          <Button variant="outline" className="w-full gap-2" onClick={onLink}>
            <Link2 size={16} />
            Koppel aan casus
          </Button>
        )}
        <Button variant="outline" className="w-full gap-2 text-red-500 hover:text-red-600" onClick={onArchive}>
          <Archive size={16} />
          Archiveer
        </Button>
      </div>
    </div>
  );
}
