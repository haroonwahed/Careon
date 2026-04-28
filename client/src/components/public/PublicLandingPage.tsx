import {
  ArrowRight,
  CheckCircle2,
  FileText,
  MapPin,
  ShieldCheck,
  Sparkles,
  SunMedium,
  Users,
  Workflow,
  Clock3,
  CircleAlert,
} from "lucide-react";
import { LOGIN_URL, REGISTER_URL } from "../../lib/routes";

interface PublicLandingPageProps {
  onThemeToggle: () => void;
}

const featureCards = [
  {
    icon: Workflow,
    title: "Casus -> Samenvatting -> Matching",
    copy: "Een strak regiepad met verklaarbare voorstellen, geen losse dashboardpanelen.",
  },
  {
    icon: Users,
    title: "Aanbieder beoordeling",
    copy: "Beoordeling door aanbieder op fit, capaciteit en risico, met redencodes vastgelegd.",
  },
  {
    icon: CheckCircle2,
    title: "Plaatsing en intake",
    copy: "Plaatsing en intake starten pas na acceptatie, zodat overdracht traceerbaar blijft.",
  },
];

const trustRows = [
  "Audittrail vanaf de casus",
  "Rolgebaseerde toegang",
  "Werkstroom per volgende beste actie",
];

export function PublicLandingPage({
  onThemeToggle,
}: PublicLandingPageProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/70 bg-card/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-4">
          <a href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="text-base font-semibold leading-tight">Careon</div>
              <div className="text-sm text-muted-foreground">Regieplatform voor gemeenten en zorgaanbieders</div>
            </div>
          </a>

          <div className="hidden items-center gap-6 md:flex">
            <a className="text-sm text-muted-foreground transition-colors hover:text-foreground" href="#flow">
              Werkstroom
            </a>
            <a className="text-sm text-muted-foreground transition-colors hover:text-foreground" href="#modules">
              Modules
            </a>
            <a className="text-sm text-muted-foreground transition-colors hover:text-foreground" href="#trust">
              Vertrouwen
            </a>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onThemeToggle}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-muted/70 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Wissel thema"
            >
              <SunMedium size={18} />
            </button>
            <a
              href={LOGIN_URL}
              className="hidden h-11 items-center rounded-2xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/60 md:inline-flex"
            >
              Inloggen
            </a>
            <a
              href={REGISTER_URL}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5"
            >
              Start direct
              <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-6 py-8 lg:py-10">
        <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-stretch">
          <div className="rounded-[32px] border border-border bg-card p-6 shadow-sm lg:p-10">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <CircleAlert size={13} />
              Regieplatform voor gemeenten en zorgaanbieders
            </div>
            <h1 className="max-w-xl text-5xl font-semibold tracking-tight lg:text-6xl">Van casus tot intake in één regieomgeving</h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground lg:text-xl">
              Beheer casussen, samenvatting, matching, beoordeling door aanbieder, plaatsing en intake vanuit één centrale omgeving met één duidelijke volgende stap.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={REGISTER_URL}
                className="inline-flex h-12 items-center gap-2 rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5"
              >
                Start direct
                <ArrowRight size={16} />
              </a>
              <a
                href={REGISTER_URL}
                className="inline-flex h-12 items-center rounded-2xl border border-border bg-card px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/60"
              >
                Account aanmaken
              </a>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {[
                ["Casus", "Bron van waarheid"],
                ["Samenvatting", "Kern, urgentie, hiaten"],
                ["Matching", "Verklaarbare voorstellen"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-border bg-muted/40 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
                  <div className="mt-2 text-base font-semibold text-foreground">{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[32px] border border-border bg-card p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-primary">
                <Sparkles size={15} />
                Workflow in beeld
              </div>
              <div className="rounded-[28px] border border-border bg-muted/35 p-5">
                <div className="space-y-3">
                  {[
                    { step: "1", title: "Casus", copy: "Minimale intake en bron van waarheid." },
                    { step: "2", title: "Samenvatting", copy: "Context, urgentie en hiaten zichtbaar." },
                    { step: "3", title: "Matching", copy: "Verklaarbare aanbevelingen per aanbieder." },
                    { step: "4", title: "Aanbieder beoordeling", copy: "Beoordeling door aanbieder op fit, capaciteit en risico." },
                    { step: "5", title: "Plaatsing", copy: "Pas na acceptatie en bevestigde overdracht." },
                    { step: "6", title: "Intake", copy: "Start van het zorgtraject na plaatsing." },
                  ].map((item) => (
                    <div key={item.step} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                        {item.step}
                      </div>
                      <div>
                        <div className="font-semibold">{item.title}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{item.copy}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-border bg-card p-6 shadow-sm">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-border bg-muted/30 p-4">
                  <MapPin size={18} className="text-primary" />
                  <p className="mt-3 text-sm font-semibold">Gemeente</p>
                  <p className="mt-1 text-sm text-muted-foreground">Utrecht, Amsterdam en regionale sturing</p>
                </div>
                <div className="rounded-2xl border border-border bg-muted/30 p-4">
                  <ShieldCheck size={18} className="text-primary" />
                  <p className="mt-3 text-sm font-semibold">Veilig</p>
                  <p className="mt-1 text-sm text-muted-foreground">RBAC, audittrail en rolgrenzen ingebouwd</p>
                </div>
                <div className="rounded-2xl border border-border bg-muted/30 p-4">
                  <Clock3 size={18} className="text-primary" />
                  <p className="mt-3 text-sm font-semibold">Tijdig</p>
                  <p className="mt-1 text-sm text-muted-foreground">Signalen en SLA’s sturen de volgende stap</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="flow" className="mt-6 grid gap-4 lg:grid-cols-3">
          {featureCards.map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.title} className="rounded-[26px] border border-border bg-card p-6 shadow-sm">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon size={18} />
                </div>
                <h2 className="mt-5 text-xl font-semibold">{card.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{card.copy}</p>
              </article>
            );
          })}
        </section>

        <section id="modules" className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
          <div className="rounded-[26px] border border-border bg-card p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Module-overzicht</p>
            <div className="mt-4 space-y-3">
              {[
                { title: "Casussen", copy: "Eerste intake en bron van waarheid." },
                { title: "Matching", copy: "Verklaarbare aanbevelingen per aanbieder." },
                { title: "Aanbieder beoordeling", copy: "Acceptatie / afwijzing en redencodes." },
                { title: "Plaatsing & intake", copy: "Pas na acceptatie en bevestigde overdracht." },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3 rounded-2xl border border-border bg-muted/30 p-4">
                  <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
                    <FileText size={14} />
                  </div>
                  <div>
                    <div className="font-semibold">{item.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{item.copy}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div id="trust" className="rounded-[26px] border border-border bg-card p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Vertrouwen</p>
            <h2 className="mt-3 text-2xl font-semibold">Zorgregie met controle op elke stap</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Alle kernacties zijn traceerbaar vanaf de casus. De publieke ervaring blijft rustig; de werkstroom
              verschijnt pas wanneer je de Regiekamer opent.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {trustRows.map((row) => (
                <div key={row} className="rounded-2xl border border-border bg-muted/30 p-4 text-sm font-medium">
                  {row}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
