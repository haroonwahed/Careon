import { useState } from "react";
import { CheckCircle2, Edit3, ChevronDown, ChevronUp, AlertTriangle, Info } from "lucide-react";

type ClassificationStatus = "SYSTEM_PROPOSED" | "CONFIRMED" | "OVERRIDDEN" | "NEEDS_REVIEW";

interface ClassificationCriterion {
  label: string;
  value: string;
  signal: "neutraal" | "verhogend";
  toelichting: string;
}

interface ClassificationRationale {
  criteria: ClassificationCriterion[];
  explanation: string;
  proposed_at?: string;
}

interface ClassificationPanelProps {
  complexity?: string;
  complexityStatus?: string;
  complexityConfirmedBy?: string | null;
  complexityOverrideReason?: string;
  careIntensity?: string;
  careIntensityStatus?: string;
  careIntensityConfirmedBy?: string | null;
  careIntensityOverrideReason?: string;
  urgency?: string;
  riskLevel?: string;
  classificationRationale?: ClassificationRationale;
  role?: string;
  onClassificationAction?: (
    field: "complexity" | "care_intensity",
    action: "confirm" | "override",
    value?: string,
    reason?: string
  ) => Promise<void>;
}

const COMPLEXITY_LABELS: Record<string, string> = {
  ENKELVOUDIG: "Enkelvoudig",
  MEERVOUDIG: "Meervoudig",
  HOOGCOMPLEX: "Hoogcomplex",
};

const CARE_INTENSITY_LABELS: Record<string, string> = {
  LICHT: "Licht",
  REGULIER: "Regulier",
  INTENSIEF: "Intensief",
};

const URGENCY_LABELS: Record<string, string> = {
  LOW: "Laag",
  MEDIUM: "Normaal",
  HIGH: "Hoog",
  CRISIS: "Crisis",
};

const RISK_LABELS: Record<string, string> = {
  GEEN_BIJZONDER_RISICO: "Geen bijzonder risico",
  VERHOOGD_RISICO: "Verhoogd risico",
  ACUUT_RISICO: "Acuut risico",
  // legacy fallbacks
  LOW: "Laag",
  MEDIUM: "Middel",
  HIGH: "Hoog",
  CRITICAL: "Kritiek",
};

const STATUS_ICON: Record<ClassificationStatus, React.ReactNode> = {
  SYSTEM_PROPOSED: <Info size={11} className="text-amber-500" />,
  CONFIRMED: <CheckCircle2 size={11} className="text-emerald-500" />,
  OVERRIDDEN: <Edit3 size={11} className="text-blue-500" />,
  NEEDS_REVIEW: <AlertTriangle size={11} className="text-orange-500" />,
};

const STATUS_LABEL: Record<ClassificationStatus, string> = {
  SYSTEM_PROPOSED: "Systeemvoorstel",
  CONFIRMED: "Bevestigd",
  OVERRIDDEN: "Handmatig gewijzigd",
  NEEDS_REVIEW: "Nog te beoordelen",
};

const STATUS_COLOR: Record<ClassificationStatus, string> = {
  SYSTEM_PROPOSED: "text-amber-500",
  CONFIRMED: "text-emerald-500",
  OVERRIDDEN: "text-blue-500",
  NEEDS_REVIEW: "text-orange-500",
};

function OverrideModal({
  field,
  options,
  onConfirm,
  onCancel,
}: {
  field: "complexity" | "care_intensity";
  options: Record<string, string>;
  onConfirm: (value: string, reason: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-popover border border-border rounded-xl shadow-2xl w-full max-w-sm p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          {field === "complexity" ? "Complexiteit wijzigen" : "Zorgintensiteit wijzigen"}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Nieuwe classificatie</label>
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Selecteer...</option>
              {Object.entries(options).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Reden <span className="text-red-400">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Verplicht: geef een korte toelichting op de wijziging..."
              className="mt-1 w-full rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              rows={3}
            />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button
            onClick={onCancel}
            className="flex-1 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted/30 transition-colors"
          >
            Annuleren
          </button>
          <button
            disabled={!value || !reason.trim()}
            onClick={() => value && reason.trim() && onConfirm(value, reason.trim())}
            className="flex-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Wijzigen
          </button>
        </div>
      </div>
    </div>
  );
}

function ClassificationField({
  label,
  displayValue,
  status,
  confirmedBy,
  overrideReason,
  rationale,
  canEdit,
  options,
  field,
  onConfirm,
  onOverride,
}: {
  label: string;
  displayValue?: string;
  status?: string;
  confirmedBy?: string | null;
  overrideReason?: string;
  rationale?: ClassificationRationale;
  canEdit: boolean;
  options: Record<string, string>;
  field: "complexity" | "care_intensity";
  onConfirm: () => void;
  onOverride: () => void;
}) {
  const [showRationale, setShowRationale] = useState(false);
  const typedStatus = status as ClassificationStatus | undefined;

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">{label}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-foreground">
          {displayValue ?? <span className="text-muted-foreground italic text-xs">Nog niet bepaald</span>}
        </span>
        {typedStatus && (
          <span className={`flex items-center gap-1 text-[10px] font-medium ${STATUS_COLOR[typedStatus] ?? "text-muted-foreground"}`}>
            {STATUS_ICON[typedStatus]}
            {STATUS_LABEL[typedStatus]}
          </span>
        )}
      </div>

      {confirmedBy && (
        <p className="text-[10px] text-muted-foreground/70">Door: {confirmedBy}</p>
      )}
      {overrideReason && (
        <p className="text-[10px] text-muted-foreground/70 italic">Reden: {overrideReason}</p>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        {rationale && (
          <button
            onClick={() => setShowRationale((s) => !s)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {showRationale ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            Onderbouwing
          </button>
        )}
        {canEdit && typedStatus === "SYSTEM_PROPOSED" && (
          <button
            onClick={onConfirm}
            className="text-[10px] font-medium text-emerald-500 hover:text-emerald-400 transition-colors"
          >
            Bevestig voorstel
          </button>
        )}
        {canEdit && (
          <button
            onClick={onOverride}
            className="text-[10px] font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Wijzig
          </button>
        )}
      </div>

      {showRationale && rationale && (
        <div className="mt-2 p-2.5 rounded-lg bg-muted/15 border border-border/50 space-y-2">
          <p
            className="text-[11px] text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: rationale.explanation }}
          />
          {rationale.criteria.filter((c) => c.signal === "verhogend").length > 0 && (
            <ul className="space-y-1">
              {rationale.criteria
                .filter((c) => c.signal === "verhogend")
                .map((c, i) => (
                  <li key={i} className="text-[10px] text-muted-foreground/80 flex items-start gap-1.5">
                    <span className="mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500/70" />
                    <span><strong>{c.label}:</strong> {c.toelichting}</span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function ClassificationPanel({
  complexity,
  complexityStatus,
  complexityConfirmedBy,
  complexityOverrideReason,
  careIntensity,
  careIntensityStatus,
  careIntensityConfirmedBy,
  careIntensityOverrideReason,
  urgency,
  riskLevel,
  classificationRationale,
  role,
  onClassificationAction,
}: ClassificationPanelProps) {
  const [overrideModal, setOverrideModal] = useState<null | "complexity" | "care_intensity">(null);
  const [busy, setBusy] = useState(false);

  const canEdit = (role === "gemeente" || role === "admin") && !!onClassificationAction;

  const handleConfirm = async (field: "complexity" | "care_intensity") => {
    if (!onClassificationAction || busy) return;
    setBusy(true);
    try {
      await onClassificationAction(field, "confirm");
    } finally {
      setBusy(false);
    }
  };

  const handleOverride = async (field: "complexity" | "care_intensity", value: string, reason: string) => {
    if (!onClassificationAction || busy) return;
    setBusy(true);
    try {
      await onClassificationAction(field, "override", value, reason);
      setOverrideModal(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {overrideModal && (
        <OverrideModal
          field={overrideModal}
          options={overrideModal === "complexity" ? COMPLEXITY_LABELS : CARE_INTENSITY_LABELS}
          onConfirm={(value, reason) => handleOverride(overrideModal, value, reason)}
          onCancel={() => setOverrideModal(null)}
        />
      )}

      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        <ClassificationField
          label="Complexiteit"
          displayValue={complexity ? (COMPLEXITY_LABELS[complexity] ?? complexity) : undefined}
          status={complexityStatus}
          confirmedBy={complexityConfirmedBy}
          overrideReason={complexityOverrideReason}
          rationale={classificationRationale}
          canEdit={canEdit}
          options={COMPLEXITY_LABELS}
          field="complexity"
          onConfirm={() => handleConfirm("complexity")}
          onOverride={() => setOverrideModal("complexity")}
        />

        <ClassificationField
          label="Zorgintensiteit"
          displayValue={careIntensity ? (CARE_INTENSITY_LABELS[careIntensity] ?? careIntensity) : undefined}
          status={careIntensityStatus}
          confirmedBy={careIntensityConfirmedBy}
          overrideReason={careIntensityOverrideReason}
          rationale={classificationRationale}
          canEdit={canEdit}
          options={CARE_INTENSITY_LABELS}
          field="care_intensity"
          onConfirm={() => handleConfirm("care_intensity")}
          onOverride={() => setOverrideModal("care_intensity")}
        />

        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Urgentie</p>
          <span className="text-sm font-semibold text-foreground">
            {urgency
              ? (URGENCY_LABELS[urgency] ?? urgency)
              : <span className="text-muted-foreground italic text-xs">Niet gespecificeerd</span>}
          </span>
        </div>

        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Risico</p>
          <span className="text-sm font-semibold text-foreground">
            {riskLevel
              ? (RISK_LABELS[riskLevel] ?? riskLevel)
              : <span className="text-muted-foreground italic text-xs">Niet gespecificeerd</span>}
          </span>
        </div>
      </div>
    </>
  );
}
