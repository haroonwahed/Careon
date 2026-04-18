import { useMemo, useState } from "react";
import { Download, FileBarChart2, Filter, Search, TrendingUp, CalendarClock, ShieldCheck } from "lucide-react";
import { Button } from "../ui/button";

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

export function RapportagesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory | "all">("all");

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
            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value as ReportCategory | "all")}
              className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground"
            >
              <option value="all">Alle categorieen</option>
              <option value="doorstroom">Doorstroom</option>
              <option value="kwaliteit">Kwaliteit</option>
              <option value="compliance">Compliance</option>
            </select>
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
              <Button size="sm" className="gap-2" disabled={report.status !== "ready"}>
                <Download size={14} />
                Download
              </Button>
              <Button size="sm" variant="outline">
                Bekijken
              </Button>
            </div>
          </article>
        ))}
      </section>

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
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2">
            <span className="text-foreground">Doorstroomoverzicht - CSV</span>
            <span className="text-muted-foreground">Vandaag 09:15</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2">
            <span className="text-foreground">Matchkwaliteit - PDF</span>
            <span className="text-muted-foreground">16 apr 2026 17:02</span>
          </div>
        </div>
      </section>
    </div>
  );
}
