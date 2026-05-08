import { FileText, Download, Eye, File, FileSpreadsheet, Image } from "lucide-react";
import { Button } from "../ui/button";

interface Document {
  id: string;
  name: string;
  type: "pdf" | "docx" | "xlsx" | "image" | "other";
  size: string;
  uploadedAt: string;
  uploadedBy?: string;
}

interface DocumentSectionProps {
  documents: Document[];
  onPreview?: (documentId: string) => void;
  onDownload?: (documentId: string) => void;
}

const documentTypeConfig = {
  pdf: {
    icon: FileText,
    color: "text-red-400",
    bg: "bg-red-500/10"
  },
  docx: {
    icon: FileText,
    color: "text-blue-400",
    bg: "bg-blue-500/10"
  },
  xlsx: {
    icon: FileSpreadsheet,
    color: "text-green-400",
    bg: "bg-green-500/10"
  },
  image: {
    icon: Image,
    color: "text-purple-400",
    bg: "bg-purple-500/10"
  },
  other: {
    icon: File,
    color: "text-muted-foreground",
    bg: "bg-muted/20"
  }
};

export function DocumentSection({ 
  documents, 
  onPreview, 
  onDownload 
}: DocumentSectionProps) {
  if (documents.length === 0) {
    return (
      <div className="panel-surface p-4">
        <h3 className="text-base font-semibold text-foreground mb-4">
          Documenten & bestanden
        </h3>
        
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
            <FileText size={32} className="text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mb-2">
            Geen documenten beschikbaar
          </p>
          <p className="text-xs text-muted-foreground">
            Er zijn nog geen documenten toegevoegd aan deze casus
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-surface p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-foreground">
          Documenten & bestanden
        </h3>
        <span className="text-sm text-muted-foreground">
          {documents.length} {documents.length === 1 ? 'bestand' : 'bestanden'}
        </span>
      </div>

      <div className="space-y-2">
        {documents.map((doc) => {
          const config = documentTypeConfig[doc.type];
          const Icon = config.icon;

          return (
            <div
              key={doc.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-muted-foreground/20 hover:bg-muted/30 transition-colors group"
            >
              {/* Icon */}
              <div className={`
                w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                ${config.bg}
              `}>
                <Icon size={20} className={config.color} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {doc.name}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{doc.size}</span>
                  <span>•</span>
                  <span>{doc.uploadedAt}</span>
                  {doc.uploadedBy && (
                    <>
                      <span>•</span>
                      <span>{doc.uploadedBy}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {onPreview && (
                  <button
                    onClick={() => onPreview(doc.id)}
                    className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    title="Bekijken"
                  >
                    <Eye size={16} className="text-muted-foreground hover:text-foreground" />
                  </button>
                )}
                {onDownload && (
                  <button
                    onClick={() => onDownload(doc.id)}
                    className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    title="Downloaden"
                  >
                    <Download size={16} className="text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
