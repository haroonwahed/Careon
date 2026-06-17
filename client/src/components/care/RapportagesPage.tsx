import { useMemo, useState } from "react";
import { Construction, Download, Eye, ShieldCheck } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { FieldHelperBox } from "../ui/form";
import { toast } from "sonner";
import { tokens } from "../../design/tokens";
import { CareBadge, CareInfoPopover } from "./CareDesignPrimitives";
import {
  CareCommandShell,
  CareMetricStrip,
  CareMetricCard,
  CareWorklistToolbar,
  CareWorklistFilterPanel,
} from "./CareCommandPrimitives";

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
    status: "ready",
  },
  {
    id: "RPT-002",
    title: "Matchkwaliteit",
    description: "Acceptatie, afwijzingsredenen en outcome-indicatoren.",
    category: "kwaliteit",
    lastRun: "Gisteren 17:00",
    frequency: "Wekelijks",
    status: "ready",
  },
  {
    id: "RPT-003",
    title: "Audit en compliance",
    description: "Autorisaties, wijzigingen en audittrail-controles.",
    category: "compliance",
    lastRun: "Live auditlog",
    frequency: "Op aanvraag",
    status: "ready",
  },
];

const exportHistory: ExportHistoryItem[] = [];

export function RapportagesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory | "all">("all");
  const [historyItems] = useState<ExportHistoryItem[]>(exportHistory);
  const [previewReport, setPreviewReport] = useState<ReportTemplate | null>(null);
  const [previewSource, setPreviewSource] = useState<string>("Template");
  const [previewOpen, setPreviewOpen] = useState(false);

  const filteredReports = useMemo(() => {
    return reportTemplates.filter((report) => {
      if (selectedCategory !== "all" && report.category !== selectedCategory) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return report.title.toLowerCase().includes(query) || report.description.toLowerCase().includes(query);
      }
      return true;
    });
  }, [searchQuery, selectedCategory]);

  const readyCount = reportTemplates.filter((r) => r.status === "ready").length;
  const firstReadyReport = filteredReports.find((r) => r.status === "ready") ?? reportTemplates.find((r) => r.status === "ready") ?? null;

  const handleDownloadTemplate = (report: ReportTemplate, _sourceLabel = "Template") => {
    if (report.status !== "ready") {
      toast.warning("Deze rapportage wordt nog klaargezet en is nog niet te downloaden.");
      return;
    }
    if (report.id === "RPT-003") {
      const url = "/care/api/audit-log/export/?format=csv";
      const a = document.createElement("a");
      a.href = url;
      a.download = "audit-log.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Audit-export gestart.");
      return;
    }
    toast.info(`Exportfunctie voor "${report.title}" is in ontwikkeling. Exports worden binnenkort via de server beschikbaar gesteld.`);
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
    const report = reportTemplates.find((t) => t.id === entry.templateId);
    if (!report) { toast.error("Rapporttemplate niet gevonden voor deze export."); return; }
    handleDownloadTemplate(report, "Exportgeschiedenis");
  };

  const handleHistoryView = (entry: ExportHistoryItem) => {
    const report = reportTemplates.find((t) => t.id === entry.templateId);
    if (!report) { toast.error("Rapporttemplate niet gevonden voor deze export."); return; }
    handleViewTemplate(report, "Exportgeschiedenis");
  };

  return (
    <CareCommandShell
      title={
        <span className="inline-flex flex-wrap items-center gap-2">
          Rapportages
          <CareInfoPopover ariaLabel="Uitleg rapportages" testId="rapportages-page-info">
            <p className="text-muted-foreground">Stuurinformatie voor doorstroom, kwaliteit en compliance — automatisch klaargezet.</p>
          </CareInfoPopover>
        </span>
      }
      subtitle={`${reportTemplates.length} templates · ${readyCount} exporteerbaar`}
      actions={
        <Button variant="ghost" onClick={() => handleViewTemplate(firstReadyReport ?? reportTemplates[0])} className="gap-2">
          <Eye size={16} />
          Voorvertoning
        </Button>
      }
    >
      <CareMetricStrip>
        <CareMetricCard
          value={readyCount}
          label="Klaar voor export"
          tone="neutral"
        />
        <CareMetricCard
          value={reportTemplates.length - readyCount}
          label="In voorbereiding"
          tone={reportTemplates.length - readyCount > 0 ? "warning" : "neutral"}
        />
        <CareMetricCard
          value={historyItems.length}
          label="Exportgeschiedenis"
          tone="neutral"
        />
      </CareMetricStrip>

      <div className="mb-4 flex items-start gap-3 rounded-[10px] border bg-care-warning-bg text-care-warning-text border-care-warning-border px-4 py-3 text-sm">
        <Construction size={16} className="mt-0.5 shrink-0" />
        <span><strong>Audit en compliance</strong> exporteert live vanuit het auditlog. Doorstroom- en matchkwaliteitsrapporten zijn <strong>in ontwikkeling</strong>.</span>
      </div>

      <div className="space-y-6">
        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-foreground">Exportcatalogus</h2>
            <CareBadge tone="muted">{filteredReports.length} rapportages</CareBadge>
          </div>

          <CareWorklistToolbar
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Zoek rapportage..."
            filtersActive={selectedCategory !== "all"}
            showFilters={showFilters}
            onToggleFilters={() => setShowFilters((v) => !v)}
          />

          <CareWorklistFilterPanel open={showFilters}>
            <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground" style={{ maxWidth: "20rem" }}>
              Categorie
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as ReportCategory | "all")}
                className="h-10 w-full rounded-[10px] border border-border/80 bg-background px-3 text-sm text-foreground"
              >
                <option value="all">Alle categorieen</option>
                <option value="doorstroom">Doorstroom</option>
                <option value="kwaliteit">Kwaliteit</option>
                <option value="compliance">Compliance</option>
              </select>
            </label>
          </CareWorklistFilterPanel>

          <section className="mt-3 grid gap-4 xl:grid-cols-3">
            {filteredReports.map((report) => (
              <article key={report.id} className="rounded-[16px] border border-border/70 bg-card/55 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <CareBadge tone="muted" className="uppercase tracking-[0.08em]">{report.category}</CareBadge>
                  <CareBadge tone={report.status === "ready" ? "emerald" : "amber"}>
                    {report.status === "ready" ? "Klaar" : "Wordt klaargezet"}
                  </CareBadge>
                </div>
                <h2 className="text-lg font-medium text-foreground">{report.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{report.description}</p>
                <div className="mt-4 space-y-1 text-xs text-muted-foreground">
                  <p>Laatste run: {report.lastRun}</p>
                  <p>Frequentie: {report.frequency}</p>
                </div>
                <div className="mt-5 flex items-center gap-2">
                  <Button size="sm" className="gap-2" disabled={report.status !== "ready"} onClick={() => handleDownloadTemplate(report)}>
                    <Download size={14} />
                    Download
                  </Button>
                  <Button size="sm" variant="outline" disabled={report.status !== "ready"} onClick={() => handleViewTemplate(report)}>
                    Bekijken
                  </Button>
                </div>
              </article>
            ))}
          </section>

          {filteredReports.length === 0 && (
            <div className="rounded-[16px] border border-border/70 bg-card/55 p-4 text-center text-sm text-muted-foreground">
              Geen rapportages gevonden voor de huidige filters.
            </div>
          )}
        </div>

        <Dialog
          open={previewOpen && previewReport !== null}
          onOpenChange={(open) => { setPreviewOpen(open); if (!open) setPreviewReport(null); }}
        >
          <DialogContent className="sm:max-w-none" style={{ maxWidth: tokens.layout.dialogNarrowMaxWidth }}>
            {previewReport && (
              <>
                <DialogHeader>
                  <DialogTitle>Preview · {previewReport.title}</DialogTitle>
                  <DialogDescription>Bron: {previewSource}</DialogDescription>
                </DialogHeader>
                <div className="rounded-[16px] border border-border bg-card p-3 text-sm text-muted-foreground leading-6">
                  <p><span className="text-foreground font-medium">Categorie:</span> {previewReport.category}</p>
                  <p><span className="text-foreground font-medium">Laatste run:</span> {previewReport.lastRun}</p>
                  <p><span className="text-foreground font-medium">Frequentie:</span> {previewReport.frequency}</p>
                  <p className="mt-2 text-foreground">{previewReport.description}</p>
                </div>
                <DialogFooter>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleDownloadTemplate(previewReport, "Preview")}>
                    <Download size={13} />
                    Download
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setPreviewOpen(false)}>Sluiten</Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        <section className="rounded-[16px] border border-border/70 bg-card/55 p-4">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck size={16} className="text-primary" />
            <h3 className="text-sm font-medium text-foreground">Exportgeschiedenis</h3>
          </div>
          <FieldHelperBox className="mb-3 mt-0">
            Historiek van eerder uitgevoerde exports. Je kunt items opnieuw downloaden of bekijken.
          </FieldHelperBox>
          <div className="space-y-2 text-sm">
            {historyItems.length === 0 && (
              <p className="text-sm text-muted-foreground">Geen exports in de geschiedenis.</p>
            )}
            {historyItems.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between rounded-[16px] border border-border bg-card px-3 py-2">
                <div>
                  <p className="text-foreground">{entry.label} - {entry.format.toUpperCase()}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.exportedAt}{entry.source === "manual" ? " · handmatig" : " · automatisch"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-8 gap-1.5 px-2.5 text-xs" onClick={() => handleHistoryView(entry)}>
                    <Eye size={13} />
                    Bekijken
                  </Button>
                  <Button size="sm" className="h-8 gap-1.5 px-2.5 text-xs" onClick={() => handleHistoryDownload(entry)}>
                    <Download size={13} />
                    Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </CareCommandShell>
  );
}
