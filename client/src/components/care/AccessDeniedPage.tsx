import { Button } from "../ui/button";
import {
  CarePageScaffold,
  ErrorState,
  PrimaryActionButton,
} from "./CareDesignPrimitives";
import { SPA_DASHBOARD_URL } from "../../lib/routes";

type AccessDeniedStatus = 403 | 404 | 500;

function parseStatus(raw: string | null): AccessDeniedStatus {
  if (raw === "404" || raw === "500") {
    return Number(raw) as AccessDeniedStatus;
  }
  return 403;
}

const COPY: Record<
  AccessDeniedStatus,
  { title: string; message: string; hint?: string }
> = {
  403: {
    title: "Geen toegang",
    message:
      "Deze pagina hoort niet bij jouw rol of je mist de juiste toegang.",
    hint: "Vraag een beheerder om je rol of organisatielidmaatschap te controleren.",
  },
  404: {
    title: "Pagina niet gevonden",
    message: "Deze pagina bestaat niet of is niet beschikbaar binnen jouw rol.",
  },
  500: {
    title: "Er ging iets mis",
    message: "Probeer het opnieuw of ga terug naar het overzicht.",
  },
};

export type AccessDeniedPageProps = {
  onGoDashboard?: () => void;
  onGoCasussen?: () => void;
};

export function AccessDeniedPage({ onGoDashboard, onGoCasussen }: AccessDeniedPageProps) {
  const params =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const status = parseStatus(params.get("status"));
  const nextPath = params.get("next");
  const copy = COPY[status];

  const goDashboard = () => {
    if (onGoDashboard) {
      onGoDashboard();
      return;
    }
    window.location.assign(SPA_DASHBOARD_URL);
  };

  return (
    <CarePageScaffold
      archetype="worklist"
      className="pb-8"
      title={copy.title}
      subtitle={copy.message}
      subtitleInfoTestId="access-denied-info"
      subtitleAriaLabel={`Uitleg: ${copy.title}`}
    >
      <ErrorState
        title={copy.title}
        copy={
          <div className="space-y-2">
            <p>{copy.message}</p>
            {copy.hint ? <p className="text-muted-foreground">{copy.hint}</p> : null}
            {nextPath ? (
              <p className="text-[12px] text-muted-foreground">
                Gevraagde route: <span className="font-mono text-foreground">{nextPath}</span>
              </p>
            ) : null}
          </div>
        }
        action={
          <div className="flex flex-wrap gap-2">
            <PrimaryActionButton type="button" onClick={goDashboard}>
              Naar dashboard
            </PrimaryActionButton>
            {onGoCasussen ? (
              <Button type="button" variant="outline" className="rounded-xl" onClick={onGoCasussen}>
                Naar casussen
              </Button>
            ) : null}
          </div>
        }
      />
    </CarePageScaffold>
  );
}
