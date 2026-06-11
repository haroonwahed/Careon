import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
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
  CareAlertCard,
  CareFilterTabButton,
  CareFilterTabGroup,
  CareMetaChip,
  CarePageScaffold,
  CarePrimaryList,
  CareQueueInlineAction,
  CareSearchFiltersBar,
  CareSectionHeader,
  CareWorkListCard,
  CareWorkRow,
  EmptyState,
  ErrorState,
  LoadingState,
  OPERATIONAL_QUEUE_HEADER_GRID_CLASS,
  PrimaryActionButton,
} from "./CareDesignPrimitives";

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
  searchText: string;
};

const RESPONSE_FILTERS: Array<{ key: ResponseFilterKey; label: string }> = [
  { key: "all", label: "Alle reacties" },
  { key: "waiting", label: "Wacht op aanbiederreactie" },
  { key: "approved", label: "Goedgekeurd" },
  { key: "rejected", label: "Afgewezen" },
  { key: "info_requested", label: "Aanvullende informatie gevraagd" },
  { key: "reminder_needed", label: "Herinnering nodig" },
  { key: "expired", label: "Verlopen reactie" },
];

const RESPONSE_STATUS_ORDER: Record<ResponseStatusKey, number> = {
  reminder_needed: 0,
  info_requested: 1,
  waiting: 2,
  rejected: 3,
  approved: 4,
  expired: 5,
};

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
  caseItem: SpaCase,
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
    return caseItem.wachttijd >= 3
      ? `Nog geen reactie na ${caseItem.wachttijd} dagen.`
      : "Nog geen reactie ontvangen.";
  }
  if (statusKey === "expired") {
    return providerComment || "Reactie verlopen of vervangen.";
  }
  return providerComment || "Nog geen reactie ontvangen.";
}

function responseTone(statusKey: ResponseStatusKey): "critical" | "warning" | "info" {
  switch (statusKey) {
    case "approved":
      return "info";
    case "waiting":
      return "warning";
    case "rejected":
    case "info_requested":
    case "reminder_needed":
      return "warning";
    case "expired":
      return "critical";
  }
}

function responseIcon(statusKey: ResponseStatusKey) {
  switch (statusKey) {
    case "approved":
      return <CheckCircle2 size={18} aria-hidden />;
    case "rejected":
      return <XCircle size={18} aria-hidden />;
    case "info_requested":
      return <FileQuestion size={18} aria-hidden />;
    case "reminder_needed":
    case "waiting":
      return <Clock3 size={18} aria-hidden />;
    case "expired":
      return <RefreshCw size={18} aria-hidden />;
  }
}

function normalizeCaseForReason(caseItem: SpaCase | undefined): SpaCase {
  if (caseItem) {
    return caseItem;
  }
  return {
    id: "",
    title: "",
    owner: "",
    regio: "",
    zorgtype: "",
    wachttijd: 0,
    status: "provider_beoordeling",
    urgency: "normal",
    problems: [],
    systemInsight: "",
    recommendedAction: "",
    urgencyValidated: false,
    urgencyDocumentPresent: false,
    urgencyGrantedDate: null,
    waitlistBucket: 0,
    intakeStartDate: null,
    arrangementTypeCode: "",
    arrangementProvider: "",
    arrangementEndDate: null,
  };
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

function emptyStateSecondaryAction(
  onNavigateToMatching?: () => void,
  onNavigateToCasussen?: () => void,
) {
  const handler = onNavigateToMatching ?? onNavigateToCasussen;
  if (!handler) {
    return undefined;
  }
  return (
    <CareQueueInlineAction type="button" onClick={handler}>
      {onNavigateToMatching ? "Bekijk matching" : "Bekijk casussen"}
    </CareQueueInlineAction>
  );
}

function responseCardCopy(row: AanbiederreactieRow): string {
  if (row.statusKey === "approved") {
    return `${row.providerName} heeft de casus goedgekeurd. Leg de volgende stap vast.`;
  }
  if (row.statusKey === "rejected") {
    return `${row.providerName} heeft de casus afgewezen. Zoek een passend alternatief.`;
  }
  if (row.statusKey === "info_requested") {
    return `${row.providerName} vraagt aanvullende informatie om verder te kunnen.`;
  }
  if (row.statusKey === "reminder_needed") {
    return `${row.providerName} heeft nog niet gereageerd. Verstuur een herinnering of volg op.`;
  }
  if (row.statusKey === "expired") {
    return `${row.providerName} heeft een verlopen of vervangen reactie. Bekijk de toelichting.`;
  }
  return `${row.providerName} wacht nog op reactie. Volg de casus op zodat de doorstroom niet stilvalt.`;
}

function attentionTitleForRows(count: number, statusKey: ResponseStatusKey): string {
  const noun = count === 1 ? "casus" : "casussen";
  switch (statusKey) {
    case "approved":
      return `${count} ${noun} ${count === 1 ? "is" : "zijn"} goedgekeurd`;
    case "rejected":
      return `${count} ${noun} ${count === 1 ? "is" : "zijn"} afgewezen`;
    case "info_requested":
      return `${count} ${noun} ${count === 1 ? "vraagt" : "vragen"} aanvullende informatie`;
    case "expired":
      return `${count} ${noun} ${count === 1 ? "heeft" : "hebben"} een verlopen reactie`;
    case "reminder_needed":
      return `${count} ${noun} ${count === 1 ? "vraagt" : "vragen"} een herinnering`;
    case "waiting":
    default:
      return `${count} ${noun} ${count === 1 ? "wacht" : "wachten"} op aanbiederreactie`;
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

  const topRow = visibleRows[0] ?? null;
  const loading = casesLoading || evaluationsLoading;
  const headerAction = onNavigateToMatching && visibleRows.length > 0 ? (
    <Button
      type="button"
      variant="outline"
      className="h-10 rounded-xl border-border/70 bg-background/20 px-4 text-[14px] font-medium text-foreground hover:bg-muted/25"
      onClick={onNavigateToMatching}
    >
      Bekijk matching
    </Button>
  ) : null;

  const attentionCard = topRow ? (
    <CareAlertCard
      density="compact"
      tone={responseTone(topRow.statusKey) === "info" ? "info" : "warning"}
      icon={responseIcon(topRow.statusKey)}
      metric={null}
      showMetric={false}
      title={attentionTitleForRows(visibleRows.length, topRow.statusKey)}
      description={responseCardCopy(topRow)}
      primaryAction={(
        <PrimaryActionButton
          type="button"
          className="h-10 rounded-full px-5 text-[13px] font-semibold"
          onClick={() => onCaseClick(topRow.caseId)}
        >
          {topRow.nextActionLabel}
          <ArrowRight size={16} aria-hidden className="ml-2" />
        </PrimaryActionButton>
      )}
    />
  ) : undefined;

  const rowCountLabel = `${visibleRows.length} casus${visibleRows.length === 1 ? "" : "sen"}`;

  return (
    <CarePageScaffold
      archetype="queue"
      className="pb-4"
      title="Aanbiederreactie"
      subtitle="Volg goedkeuringen, afwijzingen en informatievragen van aanbieders op."
      actions={headerAction}
      workflow={(
        <CareFilterTabGroup aria-label="Reactiestatus" className="overflow-x-auto">
          {RESPONSE_FILTERS.map((filter) => (
            <CareFilterTabButton
              key={filter.key}
              selected={statusFilter === filter.key}
              accentSelected
              onClick={() => setStatusFilter(filter.key)}
            >
              {filter.label} ({counts[filter.key]})
            </CareFilterTabButton>
          ))}
        </CareFilterTabGroup>
      )}
      filters={(
        <CareSearchFiltersBar
          variant="workspace"
          className="px-0"
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Zoek casus, aanbieder of regio..."
          showSecondaryFiltersToggle={false}
        />
      )}
      dominantAction={attentionCard}
    >
      {loading && <LoadingState title="Aanbiederreacties laden…" copy="De opvolgstatus wordt opgehaald." />}

      {!loading && error && (
        <ErrorState
          title="Aanbiederreacties konden niet worden geladen"
          copy={error}
          action={<Button variant="outline" onClick={refetch}>Opnieuw proberen</Button>}
        />
      )}

      {!loading && !error && visibleRows.length === 0 && (
        <EmptyState
          title="Geen openstaande aanbiederreacties"
          copy="Er zijn geen aanvragen die nu een reactie of opvolging van een aanbieder vragen."
          action={emptyStateSecondaryAction(onNavigateToMatching, _onNavigateToCasussen)}
        />
      )}

      {!loading && !error && visibleRows.length > 0 && (
        <div className="space-y-3">
          <CareSectionHeader
            title="Werkvoorraad"
            meta={<CareMetaChip>{rowCountLabel}</CareMetaChip>}
          />
          <CareWorkListCard
            testId="aanbiederreactie-worklist"
            header={(
              <div className={cn(OPERATIONAL_QUEUE_HEADER_GRID_CLASS, "min-w-[56rem]")}>
                <span>Urgentie</span>
                <span>Casus</span>
                <span>Aanbieder</span>
                <span>Status</span>
                <span>Laatste activiteit</span>
                <span>Volgende actie</span>
              </div>
            )}
          >
            <CarePrimaryList>
              {visibleRows.map((row) => (
                <CareWorkRow
                  key={row.caseId}
                  testId={`aanbiederreactie-row-${row.caseId}`}
                  density="operational"
                  accentTone={row.accentTone}
                  leading={(
                    <CareMetaChip className="h-6 px-2 text-[11px] font-semibold text-foreground">
                      {row.urgencyLabel}
                    </CareMetaChip>
                  )}
                  title={(
                    <div className="min-w-0">
                      <span className="block truncate text-[12.5px] font-semibold leading-tight text-foreground">
                        {row.caseId}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] leading-tight text-muted-foreground">
                        {row.caseTitle}
                      </span>
                    </div>
                  )}
                  titleAriaLabel={`Open casus ${row.caseId} voor ${row.providerName}`}
                  context={(
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <CareMetaChip className="max-w-full truncate">{row.providerName}</CareMetaChip>
                      <CareMetaChip className="max-w-full truncate">{row.region}</CareMetaChip>
                    </div>
                  )}
                  status={(
                    <div className="space-y-1">
                      <CareMetaChip className="max-w-full truncate text-[11px] font-semibold text-foreground">
                        {row.statusLabel}
                      </CareMetaChip>
                      <p className="max-w-full text-[11px] leading-snug text-muted-foreground">
                        {row.reasonLabel}
                      </p>
                    </div>
                  )}
                  owner={(
                    <div className="space-y-0.5">
                      <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Laatste activiteit
                      </p>
                      <p className="text-[11px] leading-snug text-foreground/90">{row.lastActivityLabel}</p>
                      {row.exactActivityLabel ? (
                        <p className="text-[10px] leading-snug text-muted-foreground">{row.exactActivityLabel}</p>
                      ) : null}
                    </div>
                  )}
                  nextAction={(
                    <div className="space-y-0.5">
                      <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Volgende actie
                      </p>
                      <p className="text-[11px] leading-snug text-foreground/90">{row.nextActionLabel}</p>
                    </div>
                  )}
                  actionLabel={row.nextActionLabel}
                  onOpen={() => onCaseClick(row.caseId)}
                  onAction={(event) => {
                    event.stopPropagation();
                    onCaseClick(row.caseId);
                  }}
                  actionVariant="ghost"
                />
              ))}
            </CarePrimaryList>
          </CareWorkListCard>
        </div>
      )}
    </CarePageScaffold>
  );
}
