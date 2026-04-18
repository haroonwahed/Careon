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

import { useState } from "react";
import { 
  Search,
  Filter,
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
import { Input } from "../ui/input";

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

const mockDocuments: Document[] = [
  {
    id: "DOC-001",
    name: "Intake formulier - R.W. 14 jaar",
    type: "intake",
    linkedTo: { type: "casus", id: "C-001", name: "Jeugd 14 – Complex gedrag" },
    uploadDate: "16 apr 2026, 14:23",
    uploadedBy: "Jane Doe",
    status: "actief",
    fileSize: "2.3 MB",
    fileType: "PDF"
  },
  {
    id: "DOC-002",
    name: "Plaatsingscontract Jeugdzorg Amsterdam Noord",
    type: "contract",
    linkedTo: { type: "aanbieder", id: "P-12", name: "Jeugdzorg Amsterdam Noord" },
    uploadDate: "15 apr 2026, 09:45",
    uploadedBy: "Mark van den Berg",
    status: "actief",
    fileSize: "1.8 MB",
    fileType: "PDF"
  },
  {
    id: "DOC-003",
    name: "Psychologisch rapport - M.K.",
    type: "beoordeling",
    linkedTo: { type: "casus", id: "C-005", name: "Jeugd 13 – Trauma & angststoornis" },
    uploadDate: "14 apr 2026, 11:12",
    uploadedBy: "Dr. P. Bakker",
    status: "actief",
    fileSize: "4.1 MB",
    fileType: "PDF"
  },
  {
    id: "DOC-004",
    name: "Capaciteitsrapport Q1 2026",
    type: "rapport",
    linkedTo: { type: "gemeente", id: "G-01", name: "Utrecht" },
    uploadDate: "10 apr 2026, 16:30",
    uploadedBy: "Lisa de Vries",
    status: "actief",
    fileSize: "890 KB",
    fileType: "PDF"
  },
  {
    id: "DOC-005",
    name: "Intake formulier - L.B. 11 jaar",
    type: "intake",
    linkedTo: { type: "casus", id: "C-002", name: "Jeugd 11 – Licht verstandelijke beperking" },
    uploadDate: "8 apr 2026, 13:45",
    uploadedBy: "Jane Doe",
    status: "actief",
    fileSize: "1.9 MB",
    fileType: "PDF"
  },
  {
    id: "DOC-006",
    name: "Oude beoordeling - Gearchiveerd",
    type: "beoordeling",
    linkedTo: { type: "geen" },
    uploadDate: "2 mrt 2026, 10:15",
    uploadedBy: "John Smith",
    status: "gearchiveerd",
    fileSize: "3.2 MB",
    fileType: "PDF"
  }
];

const documentTypeConfig: Record<DocumentType, { label: string; color: string; icon: any }> = {
  intake: { label: "Intake", color: "text-purple-500", icon: FileText },
  contract: { label: "Contract", color: "text-blue-500", icon: FileCheck },
  rapport: { label: "Rapport", color: "text-amber-500", icon: File },
  beoordeling: { label: "Beoordeling", color: "text-green-500", icon: FileText },
  overig: { label: "Overig", color: "text-muted-foreground", icon: File }
};

const linkedEntityConfig: Record<LinkedEntity, { label: string; color: string }> = {
  casus: { label: "Casus", color: "text-primary" },
  aanbieder: { label: "Aanbieder", color: "text-blue-500" },
  gemeente: { label: "Gemeente", color: "text-green-500" },
  geen: { label: "Niet gekoppeld", color: "text-muted-foreground" }
};

export function DocumentenPage() {
  const [documents, setDocuments] = useState<Document[]>(mockDocuments);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">
            Documenten
          </h1>
          <p className="text-muted-foreground">
            Beheer en bekijk documenten · {activeCount} actief · {filteredDocuments.length} resultaten
          </p>
        </div>
        <Button
          className="bg-primary hover:bg-primary/90 gap-2"
          onClick={() => setLastActionMessage("Uploaddialoog volgt in volgende integratiestap")}
        >
          <Upload size={16} />
          Upload document
        </Button>
      </div>

      {lastActionMessage && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
          {lastActionMessage}
        </div>
      )}

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
              placeholder="Zoek documenten, casus ID, cliënt..."
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
                onChange={(e) => setTypeFilter(e.target.value as DocumentType | "all")}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm"
              >
                <option value="all">Alle types</option>
                <option value="intake">Intake</option>
                <option value="contract">Contract</option>
                <option value="rapport">Rapport</option>
                <option value="beoordeling">Beoordeling</option>
                <option value="overig">Overig</option>
              </select>
            </div>

            {/* Linked To Filter */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">
                Gekoppeld aan
              </label>
              <select
                value={linkedToFilter}
                onChange={(e) => setLinkedToFilter(e.target.value as LinkedEntity | "all")}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm"
              >
                <option value="all">Alles</option>
                <option value="casus">Casus</option>
                <option value="aanbieder">Aanbieder</option>
                <option value="gemeente">Gemeente</option>
                <option value="geen">Niet gekoppeld</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as DocumentStatus | "all")}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm"
              >
                <option value="all">Alle statussen</option>
                <option value="actief">Actief</option>
                <option value="gearchiveerd">Gearchiveerd</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Document List */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Table */}
        <div className={selectedDocument ? "xl:col-span-2" : "xl:col-span-3"}>
          <div className="premium-card overflow-hidden">
            {/* Table Header */}
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

            {/* Table Rows */}
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

            {/* Empty State */}
            {filteredDocuments.length === 0 && (
              <div className="p-12 text-center">
                <FileText size={48} className="mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold mb-2">Geen documenten gevonden</h3>
                <p className="text-sm text-muted-foreground">
                  Pas je filters aan of upload een nieuw document
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Preview Panel */}
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
    </div>
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
    <div className="premium-card p-5 space-y-4 sticky top-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <h3 className="font-semibold">Document preview</h3>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={onClose}
        >
          <X size={16} />
        </Button>
      </div>

      {/* Preview (Mock) */}
      <div className="aspect-[3/4] bg-muted/30 rounded-lg border border-border flex items-center justify-center">
        <div className="text-center">
          <FileText size={48} className="mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">PDF Preview</p>
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
          Open in nieuw tabblad
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
