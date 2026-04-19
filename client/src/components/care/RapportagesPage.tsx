import { useMemo, useState } from "react";
import { ChevronDown, Download, Eye, FileBarChart2, Filter, Search, TrendingUp, CalendarClock, ShieldCheck } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { toast } from "sonner@2.0.3";

type ReportCategory = "doorstroom" | "kwaliteit" | "compliance";

type ReportStatus = "ready" | "building";

interface ReportTemplate {
  id: string;
  title: string;
  description: string;
  category: ReportCategory;
  lastRun: string;
  frequency: string;
  status: ReportStatus;
}

interface ExportHistoryItem {
  id: string;
  templateId: string;
  label: string;
  format: "csv" | "pdf";
  exportedAt: string;
  source: "auto" | "manual";
}

const reportTemplates: ReportTemplate[] = [
  {
    id: "RPT-001",
    title: "Doorstroomoverzicht",
    description: "Wachttijd, bottlenecks en doorlooptijd per fase.",
    category: "doorstroom",
    lastRun: "Vandaag 08:30",
    frequency: "Dagelijks",
    status: "ready"
  },
  {
    id: "RPT-002",
    title: "Matchkwaliteit",
    description: "Acceptatie, afwijzingsredenen en outcome-indicatoren.",
    category: "kwaliteit",
    lastRun: "Gisteren 17:00",
    frequency: "Wekelijks",
    status: "ready"
  },
  {
    id: "RPT-003",
    title: "Audit en compliance",
    description: "Autorisaties, wijzigingen en audittrail-controles.",
    category: "compliance",
    lastRun: "16 apr 2026",
    frequency: "Maandelijks",
    status: "building"
  }
];

const exportHistory: ExportHistoryItem[] = [
  {
    id: "EXP-001",
    templateId: "RPT-001",
    label: "Doorstroomoverzicht",
    format: "csv",
    exportedAt: "Vandaag 09:15",
    source: "auto",
  },
  {
    id: "EXP-002",
    templateId: "RPT-002",
    label: "Matchkwaliteit",
    format: "pdf",
    exportedAt: "16 apr 2026 17:02",
    source: "auto",
  },
];

function buildReportContent(report: ReportTemplate, sourceLabel: string) {
  return [
    `Rapport: ${report.title}`,
    `Categorie: ${report.category}`,
    `Bron: ${sourceLabel}`,
    `Laatste run: ${report.lastRun}`,
    `Frequentie: ${report.frequency}`,
    "",
    report.description,
    "",
    "Dit is een demo-export in de frontend.",
  ].join("\n");
}

function triggerTextDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function RapportagesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory | "all">("all");
  const [historyItems, setHistoryItems] = useState<ExportHistoryItem[]>(exportHistory);
  const [previewReport, setPreviewReport] = useState<ReportTemplate | null>(null);
  const [previewSource, setPreviewSource] = useState<string>("Template");
  const [previewOpen, setPreviewOpen] = useState(false);

  const filteredReports = useMemo(() => {
    return reportTemplates.filter((report) => {
      if (selectedCategory !== "all" && report.category !== selectedCategory) {
        return false;
      }
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return report.title.toLowerCase().includes(query) || report.description.toLowerCase().includes(query);
      }
      return true;
    });
  }, [searchQuery, selectedCategory]);

  const readyCount = reportTemplates.filter((report) => report.status === "ready").length;

  const formatExportedNow = () => {
    const now = new Date();
    return now.toLocaleString("nl-NL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const appendHistoryItem = (report: ReportTemplate, format: "csv" | "pdf") => {
    const entry: ExportHistoryItem = {
      id: `EXP-${Date.now()}`,
      templateId: report.id,
      label: report.title,
      format,
      exportedAt: formatExportedNow(),
      source: "manual",
    };
    setHistoryItems((previous) => [entry, ...previous].slice(0, 8));
  };

  const handleDownloadTemplate = (report: ReportTemplate, sourceLabel = "Template") => {
    if (report.status !== "ready") {
      toast.warning("Deze rapportage wordt nog opgebouwd en is nog niet te downloaden.");
      return;
    }

    const now = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const extension = report.category === "kwaliteit" ? "pdf" : "csv";
    const mimeType = extension === "pdf" ? "application/pdf" : "text/csv;charset=utf-8";
    const filename = `${report.title.toLowerCase().replace(/\s+/g, "-")}-${now}.${extension}`;
    const content = buildReportContent(report, sourceLabel);

    triggerTextDownload(filename, content, mimeType);
    appendHistoryItem(report, extension as "csv" | "pdf");
    toast.success(`${report.title} is gedownload.`);
  };

  const handleViewTemplate = (report: ReportTemplate, sourceLabel = "Template") => {
    if (report.status !== "ready") {
      toast.warning("Deze rapportage is nog niet beschikbaar om te bekijken.");
      return;
    }

    setPreviewReport(report);
    setPreviewSource(sourceLabel);
    setPreviewOpen(true);
  };

  const handleHistoryDownload = (entry: ExportHistoryItem) => {
    const report = reportTemplates.find((template) => template.id === entry.templateId);
    if (!report) {
      toast.error("Rapporttemplate niet gevonden voor deze export.");
      return;
    }
    handleDownloadTemplate(report, "Exportgeschiedenis");
  };

  const handleHistoryView = (entry: ExportHistoryItem) => {
    const report = reportTemplates.find((template) => template.id === entry.templateId);
    if (!report) {
      toast.error("Rapporttemplate niet gevonden voor deze export.");
      return;
    }
    handleViewTemplate(report, "Exportgeschiedenis");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2 text-3xl font-semibold text-foreground">Rapportages</h1>
        <p className="text-sm text-muted-foreground">
          Genereer stuurinformatie voor doorstroom, kwaliteit en compliance.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="premium-card p-5">
          <div className="mb-2 flex items-center gap-2 text-muted-foreground">
            <FileBarChart2 size={16} />
            <span className="text-xs font-semibold uppercase tracking-[0.08em]">Actieve templates</span>
          </div>
          <p className="text-2xl font-semibold text-foreground">{reportTemplates.length}</p>
        </div>
        <div className="premium-card p-5">
          <div className="mb-2 flex items-center gap-2 text-muted-foreground">
            <TrendingUp size={16} />
            <span className="text-xs font-semibold uppercase tracking-[0.08em]">Direct beschikbaar</span>
          </div>
          <p className="text-2xl font-semibold text-foreground">{readyCount}</p>
        </div>
        <div className="premium-card p-5">
          <div className="mb-2 flex items-center gap-2 text-muted-foreground">
            <CalendarClock size={16} />
            <span className="text-xs font-semibold uppercase tracking-[0.08em]">Laatste run</span>
          </div>
          <p className="text-2xl font-semibold text-foreground">Vandaag</p>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-muted/35 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Zoek rapportage..."
              className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm text-foreground"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-muted-foreground" />
            <div className="relative">
            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value as ReportCategory | "all")}
              className="h-10 appearance-none rounded-xl border border-border bg-card pl-3 pr-8 text-sm text-foreground"
            >
              <option value="all">Alle categorieen</option>
              <option value="doorstroom">Doorstroom</option>
              <option value="kwaliteit">Kwaliteit</option>
              <option value="compliance">Compliance</option>
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {filteredReports.map((report) => (
          <article key={report.id} className="premium-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {report.category}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  report.status === "ready"
                    ? "border border-green-border bg-green-light text-green-base"
                    : "border border-yellow-border bg-yellow-light text-yellow-base"
                }`}
              >
                {report.status === "ready" ? "Klaar" : "Wordt opgebouwd"}
              </span>
            </div>

            <h2 className="text-lg font-semibold text-foreground">{report.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{report.description}</p>

            <div className="mt-4 space-y-1 text-xs text-muted-foreground">
              <p>Laatste run: {report.lastRun}</p>
              <p>Frequentie: {report.frequency}</p>
            </div>

            <div className="mt-5 flex items-center gap-2">
              <Button
                size="sm"
                className="gap-2"
                disabled={report.status !== "ready"}
                onClick={() => handleDownloadTemplate(report)}
              >
                <Download size={14} />
                Download
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={report.status !== "ready"}
                onClick={() => handleViewTemplate(report)}
              >
                Bekijken
              </Button>
            </div>
          </article>
        ))}
      </section>

      <Dialog
        open={previewOpen && previewReport !== null}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) {
            setPreviewReport(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          {previewReport && (
            <>
              <DialogHeader>
                <DialogTitle>Preview · {previewReport.title}</DialogTitle>
                <DialogDescription>Bron: {previewSource}</DialogDescription>
              </DialogHeader>

              <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground leading-6">
                <p><span className="text-foreground font-medium">Categorie:</span> {previewReport.category}</p>
                <p><span className="text-foreground font-medium">Laatste run:</span> {previewReport.lastRun}</p>
                <p><span className="text-foreground font-medium">Frequentie:</span> {previewReport.frequency}</p>
                <p className="mt-2 text-foreground">{previewReport.description}</p>
              </div>

              <DialogFooter>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => handleDownloadTemplate(previewReport, "Preview")}
                >
                  <Download size={13} />
                  Download
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPreviewOpen(false)}>
                  Sluiten
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {filteredReports.length === 0 && (
        <div className="premium-card p-10 text-center text-sm text-muted-foreground">
          Geen rapportages gevonden voor de huidige filters.
        </div>
      )}

      <section className="premium-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck size={16} className="text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Exportgeschiedenis</h3>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Historiek van eerder uitgevoerde exports. Je kunt items opnieuw downloaden of bekijken.
        </p>
        <div className="space-y-2 text-sm">
          {historyItems.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2">
              <div>
                <p className="text-foreground">{entry.label} - {entry.format.toUpperCase()}</p>
                <p className="text-xs text-muted-foreground">
                  {entry.exportedAt}{entry.source === "manual" ? " · handmatig" : " · automatisch"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 px-2.5 text-xs"
                  onClick={() => handleHistoryView(entry)}
                >
                  <Eye size={13} />
                  Bekijken
                </Button>
                <Button
                  size="sm"
                  className="h-8 gap-1.5 px-2.5 text-xs"
                  onClick={() => handleHistoryDownload(entry)}
                >
                  <Download size={13} />
                  Download
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
