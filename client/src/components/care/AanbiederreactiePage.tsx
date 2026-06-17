import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileQuestion,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../ui/utils";
import { useCases, type SpaCase } from "../../hooks/useCases";
import {
  useProviderEvaluations,
  type ProviderEvaluation,
} from "../../hooks/useProviderEvaluations";
import {
  CareQueueInlineAction,
  EmptyState,
  ErrorState,
  LoadingState,
} from "./CareDesignPrimitives";
import {
  CareCommandShell,
  CareMetricStrip,
  CareMetricCard,
  CareWorklist,
  CareWorklistTabs,
  CareWorklistToolbar,
  CareWorklistColumnHeader,
  CareWorklistBody,
  CareWorklistRow,
  CareWorklistRowAction,
  CareWorklistPagination,
  ROW_ACTION_CLASSES,
} from "./CareCommandPrimitives";
import { CareSlaCountdown } from "./CareSlaCountdown";
import { SLA_TARGET_HOURS } from "../../lib/careSla";

interface AanbiederreactiePageProps {
  role: "gemeente" | "zorgaanbieder" | "admin";
  onCaseClick: (caseId: string) => void;
  onNavigateToMatching?: () => void;
  onNavigateToPlaatsingen?: () => void;
  onNavigateToCasussen?: () => void;
}

type ResponseFilterKey = "all" | ResponseStatusKey;
type ResponseStatusKey =
  | "waiting"
  | "approved"
  | "rejected"
  | "info_requested"
  | "reminder_needed"
  | "expired";

type AanbiederreactieRow = {
  caseId: string;
  caseTitle: string;
  providerName: string;
  region: string;
  urgencyLabel: string;
  statusKey: ResponseStatusKey;
  statusLabel: string;
  reasonLabel: string;
  lastActivityLabel: string;
  nextActionLabel: string;
  exactActivityLabel: string | null;
  accentTone: "critical" | "warning" | "neutral";
  /** Elapsed hours against the 72h provider-response SLA; null when not awaiting a reaction. */
  slaElapsedHours: number | null;
  searchText: string;
};

const RESPONSE_FILTERS: Array<{ key: ResponseFilterKey; label: string }> = [
  { key: "all", label: "Alle reacties" },
  { key: "waiting", label: "Wacht op reactie" },
  { key: "approved", label: "Goedgekeurd" },
  { key: "rejected", label: "Afgewezen" },
  { key: "info_requested", label: "Informatie gevraagd" },
  { key: "reminder_needed", label: "Herinnering nodig" },
  { key: "expired", label: "Verlopen" },
];

const RESPONSE_STATUS_ORDER: Record<ResponseStatusKey, number> = {
  reminder_needed: 0,
  info_requested: 1,
  waiting: 2,
  rejected: 3,
  approved: 4,
  expired: 5,
};

const AANBIEDER_COLS = "minmax(11rem,1.8fr) minmax(9rem,1.3fr) minmax(10rem,1.5fr) minmax(8rem,1fr) minmax(9rem,1fr)";

function formatRelativeDays(days: number): string {
  if (days <= 0) {
    return "Vandaag";
  }
  return `${days} dag${days === 1 ? "" : "en"} geleden`;
}

function formatExactTimestamp(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function urgencyLabel(caseItem: SpaCase): string {
  return caseItem.placementPressureLabel ?? (caseItem.urgency === "critical"
    ? "Spoed"
    : caseItem.urgency === "warning"
      ? "Hoog"
      : caseItem.urgency === "normal"
        ? "Normaal"
        : "Laag");
}

function responseStatusFromEvaluation(
  evaluation: ProviderEvaluation | undefined,
  fallbackDays: number,
): ResponseStatusKey {
  if (!evaluation) {
    return fallbackDays >= 3 ? "reminder_needed" : "waiting";
  }

  switch (evaluation.status) {
    case "ACCEPTED":
      return "approved";
    case "REJECTED":
      return "rejected";
    case "INFO_REQUESTED":
      return "info_requested";
    case "CANCELLED":
    case "SUPERSEDED":
      return "expired";
    case "PENDING":
    default:
      return evaluation.daysPending >= 3 ? "reminder_needed" : "waiting";
  }
}

function responseStatusLabel(statusKey: ResponseStatusKey): string {
  switch (statusKey) {
    case "waiting":
      return "Wacht op aanbiederreactie";
    case "approved":
      return "Goedgekeurd";
    case "rejected":
      return "Afgewezen";
    case "info_requested":
      return "Aanvullende informatie gevraagd";
    case "reminder_needed":
      return "Herinnering nodig";
    case "expired":
      return "Verlopen reactie";
  }
}

function responseNextActionLabel(statusKey: ResponseStatusKey): string {
  switch (statusKey) {
    case "waiting":
      return "Volg aanbiederreactie op";
    case "approved":
      return "Bevestig plaatsing";
    case "rejected":
      return "Selecteer andere aanbieder";
    case "info_requested":
      return "Vraag gegevens op";
    case "reminder_needed":
      return "Verstuur herinnering";
    case "expired":
      return "Bekijk toelichting";
  }
}

function responseReasonLabel(
  caseItem: SpaCase | undefined,
  evaluation: ProviderEvaluation | undefined,
  statusKey: ResponseStatusKey,
): string {
  const providerComment = evaluation?.providerComment?.trim();
  const infoRequest = evaluation?.informationRequestComment?.trim();

  if (statusKey === "approved") {
    return providerComment || "Aanbieder heeft de casus goedgekeurd.";
  }
  if (statusKey === "rejected") {
    return providerComment || "Afwijzing vastgelegd, opvolging nodig.";
  }
  if (statusKey === "info_requested") {
    return infoRequest || providerComment || "Aanvullende informatie gevraagd.";
  }
  if (statusKey === "reminder_needed") {
    return (caseItem?.wachttijd ?? 0) >= 3
      ? `Nog geen reactie na ${caseItem?.wachttijd ?? 0} dagen.`
      : "Nog geen reactie ontvangen.";
  }
  if (statusKey === "expired") {
    return providerComment || "Reactie verlopen of vervangen.";
  }
  return providerComment || "Nog geen reactie ontvangen.";
}

function normalizeCaseForReason(caseItem: SpaCase | undefined): SpaCase | undefined {
  return caseItem;
}

export function buildAanbiederreactieRows(
  cases: SpaCase[],
  evaluations: ProviderEvaluation[],
): AanbiederreactieRow[] {
  const evaluationsByCaseId = new Map(evaluations.map((evaluation) => [evaluation.caseId, evaluation]));
  const candidateCaseIds = new Set<string>();

  for (const caseItem of cases) {
    if (caseItem.status === "provider_beoordeling") {
      candidateCaseIds.add(caseItem.id);
    }
  }
  for (const evaluation of evaluations) {
    candidateCaseIds.add(evaluation.caseId);
  }

  const rows: AanbiederreactieRow[] = [];

  for (const caseId of candidateCaseIds) {
    const caseItem = cases.find((item) => item.id === caseId);
    const evaluation = evaluationsByCaseId.get(caseId);
    if (!caseItem && !evaluation) {
      continue;
    }

    const fallbackDays = caseItem?.wachttijd ?? evaluation?.daysPending ?? 0;
    const statusKey = responseStatusFromEvaluation(evaluation, fallbackDays);
    const providerName =
      evaluation?.providerName?.trim() ||
      caseItem?.arrangementProvider?.trim() ||
      "Aanbieder onbekend";
    const region = caseItem?.regio?.trim() || evaluation?.region?.trim() || "Onbekende regio";
    const caseTitle = evaluation?.caseTitle?.trim() || caseItem?.title?.trim() || "Aanvraag";
    const daysSinceActivity = evaluation?.daysPending ?? caseItem?.wachttijd ?? 0;
    const updatedExact = formatExactTimestamp(evaluation?.respondedAt || evaluation?.updatedAt || evaluation?.requestedAt);

    rows.push({
      caseId,
      caseTitle,
      providerName,
      region,
      urgencyLabel: caseItem ? urgencyLabel(caseItem) : "Normaal",
      statusKey,
      statusLabel: responseStatusLabel(statusKey),
      reasonLabel: responseReasonLabel(normalizeCaseForReason(caseItem), evaluation, statusKey),
      lastActivityLabel: formatRelativeDays(daysSinceActivity),
      nextActionLabel: responseNextActionLabel(statusKey),
      exactActivityLabel: updatedExact,
      slaElapsedHours:
        statusKey === "waiting" || statusKey === "reminder_needed"
          ? daysSinceActivity * 24
          : null,
      accentTone: statusKey === "approved"
        ? "neutral"
        : statusKey === "expired" || statusKey === "rejected"
          ? "critical"
          : "warning",
      searchText: [
        caseId,
        caseTitle,
        providerName,
        region,
        statusKey,
        responseStatusLabel(statusKey),
        responseReasonLabel(normalizeCaseForReason(caseItem), evaluation, statusKey),
        responseNextActionLabel(statusKey),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    });
  }

  return rows.sort((left, right) => {
    const leftRank = RESPONSE_STATUS_ORDER[left.statusKey];
    const rightRank = RESPONSE_STATUS_ORDER[right.statusKey];
    return (
      leftRank - rightRank ||
      left.providerName.localeCompare(right.providerName, "nl") ||
      left.caseId.localeCompare(right.caseId, "nl")
    );
  });
}

function responseStatusChipClass(statusKey: ResponseStatusKey): string {
  switch (statusKey) {
    case "approved":
      return "border border-care-success-border bg-care-success-bg text-care-success-text";
    case "rejected":
    case "expired":
      return "border border-care-urgent-border bg-care-urgent-bg text-care-urgent-text";
    case "reminder_needed":
    case "waiting":
    case "info_requested":
      return "border border-care-warning-border bg-care-warning-bg text-care-warning-text";
    default:
      return "border border-border/60 bg-muted/30 text-muted-foreground";
  }
}

function responseStatusIcon(statusKey: ResponseStatusKey) {
  switch (statusKey) {
    case "approved":
      return <CheckCircle2 size={11} className="shrink-0" aria-hidden />;
    case "rejected":
      return <XCircle size={11} className="shrink-0" aria-hidden />;
    case "info_requested":
      return <FileQuestion size={11} className="shrink-0" aria-hidden />;
    case "reminder_needed":
    case "waiting":
      return <Clock3 size={11} className="shrink-0" aria-hidden />;
    case "expired":
      return <RefreshCw size={11} className="shrink-0" aria-hidden />;
  }
}

export function AanbiederreactiePage({
  role: _role,
  onCaseClick,
  onNavigateToMatching,
  onNavigateToPlaatsingen: _onNavigateToPlaatsingen,
  onNavigateToCasussen: _onNavigateToCasussen,
}: AanbiederreactiePageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ResponseFilterKey>("all");

  const { cases, loading: casesLoading, error, refetch } = useCases({ q: "" });
  const { evaluations, loading: evaluationsLoading } = useProviderEvaluations();

  const rows = useMemo(() => buildAanbiederreactieRows(cases, evaluations), [cases, evaluations]);
  const counts = useMemo(
    () => rows.reduce<Record<ResponseFilterKey, number>>(
      (acc, row) => {
        acc.all += 1;
        acc[row.statusKey] += 1;
        return acc;
      },
      {
        all: 0,
        waiting: 0,
        approved: 0,
        rejected: 0,
        info_requested: 0,
        reminder_needed: 0,
        expired: 0,
      },
    ),
    [rows],
  );

  const visibleRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.statusKey !== statusFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      return row.searchText.includes(query);
    });
  }, [rows, searchQuery, statusFilter]);

  const loading = casesLoading || evaluationsLoading;

  const tabs = RESPONSE_FILTERS.map((f) => ({ id: f.key, label: f.label, count: counts[f.key] }));

  return (
    <CareCommandShell
      title="Aanbiederreactie"
      actions={onNavigateToMatching && visibleRows.length > 0 ? (
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-[10px] border-border/70 bg-background/20 px-4 text-[13px] font-medium text-foreground hover:bg-muted/25"
          onClick={onNavigateToMatching}
        >
          Bekijk matching
        </Button>
      ) : undefined}
    >
      <CareMetricStrip>
        <CareMetricCard
          value={counts.reminder_needed}
          label="Herinnering nodig"
          tone="urgent"
          isActive={statusFilter === "reminder_needed"}
          onClick={() => setStatusFilter(statusFilter === "reminder_needed" ? "all" : "reminder_needed")}
        />
        <CareMetricCard
          value={counts.waiting}
          label="Wacht op reactie"
          tone="warning"
          isActive={statusFilter === "waiting"}
          onClick={() => setStatusFilter(statusFilter === "waiting" ? "all" : "waiting")}
        />
        <CareMetricCard
          value={counts.expired}
          label="Verlopen"
          tone="urgent"
          isActive={statusFilter === "expired"}
          onClick={() => setStatusFilter(statusFilter === "expired" ? "all" : "expired")}
        />
      </CareMetricStrip>

      {loading && <LoadingState title="Aanbiederreacties laden…" copy="De opvolgstatus wordt opgehaald." />}

      {!loading && error && (
        <ErrorState
          title="Aanbiederreacties konden niet worden geladen"
          copy={error}
          action={<Button variant="outline" onClick={refetch}>Opnieuw proberen</Button>}
        />
      )}

      {!loading && !error && rows.length === 0 && (
        <EmptyState
          title="Geen openstaande aanbiederreacties"
          copy="Er zijn geen aanvragen die nu een reactie of opvolging van een aanbieder vragen."
          action={onNavigateToMatching ? (
            <CareQueueInlineAction type="button" onClick={onNavigateToMatching}>Bekijk matching</CareQueueInlineAction>
          ) : undefined}
        />
      )}

      {!loading && !error && rows.length > 0 && (
        <CareWorklist testId="aanbiederreactie-worklist">
          <CareWorklistTabs
            tabs={tabs}
            activeId={statusFilter}
            onChange={(id) => setStatusFilter(id as ResponseFilterKey)}
          />

          <CareWorklistToolbar
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Zoek casus, aanbieder of regio..."
          />

          <div className="overflow-x-auto">
            <CareWorklistColumnHeader
              columns={["Casus", "Aanbieder", "Status", "Laatste activiteit", "Volgende actie"]}
              cols={AANBIEDER_COLS}
              minWidth="840px"
            />
            <CareWorklistBody>
              {visibleRows.length === 0 ? (
                <div className="px-6 py-8 text-center text-[13px] text-muted-foreground">
                  Geen reacties in dit filter.
                </div>
              ) : visibleRows.map((row) => {
                const accentTone = row.accentTone === "critical" ? "urgent" as const
                  : row.accentTone === "warning" ? "warning" as const
                  : "neutral" as const;
                return (
                  <CareWorklistRow
                    key={row.caseId}
                    testId={`aanbiederreactie-row-${row.caseId}`}
                    cols={AANBIEDER_COLS}
                    minWidth="840px"
                    accentTone={accentTone}
                    onRowClick={() => onCaseClick(row.caseId)}
                  >
                    {/* Casus */}
                    <div className="min-w-0">
                      <span className="block truncate text-[13px] font-medium leading-tight text-foreground">
                        {row.caseId}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] leading-tight text-muted-foreground">
                        {row.caseTitle}
                      </span>
                    </div>

                    {/* Aanbieder + Regio */}
                    <div className="min-w-0 flex flex-col gap-1">
                      <span className="inline-flex w-fit max-w-full items-center rounded-full border border-border/60 bg-card/35 px-1.5 py-0.5 text-[11px] text-foreground truncate">
                        {row.providerName}
                      </span>
                      <span className="text-[11px] text-muted-foreground truncate">{row.region}</span>
                    </div>

                    {/* Status + reden + SLA */}
                    <div className="min-w-0 space-y-1">
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium", responseStatusChipClass(row.statusKey))}>
                        {responseStatusIcon(row.statusKey)}
                        <span className="truncate">{row.statusLabel}</span>
                      </span>
                      <p className="text-[11px] leading-snug text-muted-foreground line-clamp-2">{row.reasonLabel}</p>
                      {row.slaElapsedHours != null && (
                        <CareSlaCountdown
                          elapsedHours={row.slaElapsedHours}
                          targetHours={SLA_TARGET_HOURS.providerResponse}
                        />
                      )}
                    </div>

                    {/* Laatste activiteit */}
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-foreground/90">{row.lastActivityLabel}</p>
                      {row.exactActivityLabel && (
                        <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{row.exactActivityLabel}</p>
                      )}
                    </div>

                    {/* Volgende actie */}
                    <CareWorklistRowAction>
                      <button
                        type="button"
                        className={ROW_ACTION_CLASSES.default}
                        onClick={(e) => { e.stopPropagation(); onCaseClick(row.caseId); }}
                      >
                        {row.nextActionLabel}
                        <ChevronRight size={12} className="shrink-0 opacity-60" aria-hidden />
                      </button>
                    </CareWorklistRowAction>
                  </CareWorklistRow>
                );
              })}
            </CareWorklistBody>
          </div>

          <CareWorklistPagination count={visibleRows.length} singular="reactie" plural="reacties" />
        </CareWorklist>
      )}
    </CareCommandShell>
  );
}
