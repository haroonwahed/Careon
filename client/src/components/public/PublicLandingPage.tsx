import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Layers3,
  ShieldCheck,
  Users,
  Workflow,
  Clock3,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../ui/utils";
import { CareOnHeroOrchestrationVisual } from "../landing/CareOnHeroOrchestrationVisual";
import { LOGIN_URL, REGISTER_URL } from "../../lib/routes";

interface PublicLandingPageProps {
  onThemeToggle: () => void;
}

const navLinks = [
  { label: "Waarom CareOn", href: "#waarom" },
  { label: "Werkstroom", href: "#oplossing" },
  { label: "Voor wie", href: "#voor-wie" },
  { label: "Over ons", href: "#over-ons" },
  { label: "Resources", href: "#resources" },
] as const;

const valueCards = [
  {
    icon: Layers3,
    title: "Eén gedeelde waarheid",
    copy: "Aanvraag, status en eigenaar blijven synchroon.",
  },
  {
    icon: ShieldCheck,
    title: "Auditbaar beslissen",
    copy: "Elke stap blijft herleidbaar voor gemeente en aanbieder.",
  },
  {
    icon: Workflow,
    title: "Doorstroom zonder ruis",
    copy: "Minder handovers, minder wachten, minder losse afspraken.",
  },
  {
    icon: Users,
    title: "Rolzuivere samenwerking",
    copy: "Gemeente en aanbieder werken in dezelfde keten, met eigen verantwoordelijkheid.",
  },
] as const;

const problemCards = [
  {
    icon: CircleAlert,
    title: "Versnipperde context",
    copy: "Aanvraag, opvolging en escalaties staan nog te vaak in losse systemen.",
  },
  {
    icon: Clock3,
    title: "Te veel wachttijd",
    copy: "Reacties en afstemming kosten onnodig tijd tussen de stappen.",
  },
  {
    icon: ShieldCheck,
    title: "Besluitvorming zonder herleiding",
    copy: "Het is niet altijd duidelijk waarom een route gekozen is.",
  },
] as const;

const workflowStepperSteps = [
  {
    step: "01",
    title: "Aanmelding",
    copy: "Casus vastleggen en compleet maken.",
    state: "Compleet maken",
  },
  {
    step: "02",
    title: "Matching",
    copy: "Passende aanbieders met uitlegbare afwegingen.",
    state: "Adviserend",
  },
  {
    step: "03",
    title: "Aanbiederreactie",
    copy: "Accepteren, afwijzen of verduidelijking vragen.",
    state: "Reactie",
  },
  {
    step: "04",
    title: "Plaatsing",
    copy: "Plaatsing bevestigen en voorbereiden.",
    state: "Bevestiging",
  },
  {
    step: "05",
    title: "Intake",
    copy: "Overdracht afronden en intake plannen.",
    state: "Start zorg",
  },
] as const;

const workflowValueCards = [
  {
    title: "Eén gedeeld proces",
    copy: "Gemeente en aanbieder werken vanuit dezelfde status en volgende actie.",
  },
  {
    title: "Uitlegbare keuzes",
    copy: "Matching toont waarom een route passend is, zonder de menselijke beslissing over te nemen.",
  },
  {
    title: "Minder overdrachtsruis",
    copy: "Eigenaarschap, status en vervolgstap blijven zichtbaar tijdens de hele flow.",
  },
] as const;

const workflowPrinciples = [
  {
    title: "Eén context",
    copy: "Vraag, status en vervolgstap blijven zichtbaar in dezelfde werkruimte.",
  },
  {
    title: "Rolzuiver",
    copy: "Iedere actor ziet alleen wat nodig is voor de eigen taak.",
  },
  {
    title: "Herleidbaar",
    copy: "Elke stap blijft uitlegbaar en auditbaar zonder het proces zwaar te maken.",
  },
  {
    title: "Minder wachttijd",
    copy: "Eigenaarschap en volgende actie blijven duidelijk tussen partijen.",
  },
] as const;

const audiencePanels = [
  {
    title: "Gemeente",
    eyebrow: "Financiering en arrangement",
    copy: "Beoordeel compatibiliteit, bewaak tempo en houd de coördinatie over de vervolgstap.",
    bullets: ["Eén overzicht per aanvraag", "Duidelijke validatie", "Auditbare afweging"],
  },
  {
    title: "Zorgaanbieder",
    eyebrow: "Capaciteit en beoordeling",
    copy: "Zie alleen de relevante aanvraag en reageer met de context die nodig is.",
    bullets: ["Begrensde toegang", "Duidelijke status", "Eenduidige opvolging"],
  },
] as const;

const partnerBrands = [
  {
    primary: "Gemeente",
    secondary: "Rotterdam",
    logoSrc: "/partners/logo-gemeente-rotterdam.png",
    logoClassName: "mix-blend-multiply brightness-125 contrast-110",
  },
  {
    primary: "Gemeente",
    secondary: "Amsterdam",
    logoSrc: "/partners/logo-gemeente-amsterdam.png",
  },
  {
    primary: "Gemeente",
    secondary: "Utrecht",
    logoSrc: "/partners/logo-gemeente-utrecht.svg",
  },
  {
    primary: "Gemeente",
    secondary: "Den Haag",
    logoSrc: "/partners/logo-gemeente-den-haag.svg",
  },
  {
    primary: "Ymere",
    secondary: "wonen, leven, groeien",
    logoSrc: "/partners/logo-ymere.png",
    logoClassName: "mix-blend-multiply brightness-125 contrast-110",
  },
  {
    primary: "Enver",
    secondary: "jeugd en opvoedhulp",
    logoSrc: "/partners/logo-enver.png",
    logoClassName: "mix-blend-multiply brightness-125 contrast-110",
  },
  { primary: "Leger des Heils", secondary: "", logoSrc: "/partners/logo-leger-des-heils.svg" },
] as const;

const partnerMarqueeBrands = [...partnerBrands, ...partnerBrands] as const;

const faqItems = [
  {
    question: "Voor wie is CareOn bedoeld?",
    answer:
      "Voor gemeenten en zorgaanbieders die coördinatie, tempo en verantwoording in dezelfde werkstroom willen brengen.",
  },
  {
    question: "Vervangt CareOn bestaande systemen?",
    answer:
      "Nee. CareOn werkt als een operationele laag boven bestaande processen en bronnen.",
  },
  {
    question: "Hoe werkt matching?",
    answer:
      "CareOn vergelijkt inhoud, capaciteit, regio en urgentie. De uiteindelijke keuze blijft menselijk.",
  },
  {
    question: "Welke gegevens ziet een aanbieder?",
    answer:
      "Alleen context die nodig is na een gekoppelde aanvraag.",
  },
  {
    question: "Is CareOn geschikt voor een pilot?",
    answer:
      "Ja. Begin klein met één gemeente, enkele aanbieders en een beperkte aanvraagset.",
  },
] as const;

const resources = [
  {
    title: "Implementatie",
    copy: "Start met één gemeente en een beperkte keten.",
  },
  {
    title: "Privacy",
    copy: "Lees hoe we met zorgdata en toegang omgaan.",
  },
  {
    title: "Contact",
    copy: "Plan een gesprek over je huidige proces.",
  },
] as const;

function SectionHeading({
  eyebrow,
  title,
  copy,
}: {
  eyebrow?: string;
  title: string;
  copy?: string;
}) {
  return (
    <div className="max-w-3xl space-y-3">
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{eyebrow}</p>
      ) : null}
      <h2 className="text-balance text-3xl font-semibold tracking-tight text-slate-100 sm:text-4xl">{title}</h2>
      {copy ? <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">{copy}</p> : null}
    </div>
  );
}

function LandingPill({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-700/80 bg-slate-900/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200">
      {children}
    </span>
  );
}

function IconBadge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-slate-700/80 bg-slate-900/70 text-slate-200",
        className,
      )}
    >
      {children}
    </div>
  );
}

function HoverPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-[28px] border border-slate-800/80 bg-slate-950/55 backdrop-blur-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:border-slate-700/90 hover:bg-slate-900/70 hover:shadow-[0_24px_60px_rgba(2,6,23,0.35)]",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),transparent_30%),radial-gradient(circle_at_top_right,rgba(124,58,237,0.09),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.035),transparent_40%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative">{children}</div>
    </div>
  );
}

export function PublicLandingPage({ onThemeToggle: _onThemeToggle }: PublicLandingPageProps) {
  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-56 bg-[linear-gradient(0deg,rgba(3,7,18,0.96),transparent_100%)]" />
      </div>

      <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-[#070b12]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <a href="/" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700/80 bg-slate-900/80 shadow-[0_1px_0_rgba(255,255,255,0.03)]">
              <ShieldCheck size={20} className="text-slate-200" />
            </div>
            <div>
              <div className="text-base font-semibold tracking-tight text-white sm:text-lg">CareOn</div>
              <div className="text-xs text-slate-400 sm:text-sm">Operationele coördinatie voor gemeenten en zorgaanbieders</div>
            </div>
          </a>

          <nav className="hidden items-center gap-7 lg:flex" aria-label="Hoofdnavigatie">
            {navLinks.map((link) => (
              <a
                key={link.label}
                className="inline-flex items-center gap-1 text-sm text-slate-300 transition-colors hover:text-white"
                href={link.href}
              >
                {link.label}
                {link.label === "Resources" ? <ChevronDown size={14} className="translate-y-px text-slate-500" /> : null}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href={LOGIN_URL}
              className="inline-flex h-11 items-center rounded-2xl border border-slate-700/80 bg-transparent px-4 text-sm font-medium text-slate-100 transition-colors hover:bg-white/5"
            >
              Inloggen
            </a>
            <a
              href={REGISTER_URL}
              className="hidden h-11 items-center rounded-2xl bg-slate-100 px-5 text-sm font-semibold text-slate-950 transition-transform hover:-translate-y-0.5 sm:inline-flex"
            >
              Plan een gesprek
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 pb-16 pt-0 sm:px-6 lg:px-8">
        <section
          className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 overflow-x-clip pb-0 pt-6 lg:min-h-[min(60vh,720px)] lg:pt-8"
          aria-label="Introductie"
        >
          <div className="pointer-events-none absolute inset-0 bg-[#070b12]" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_86%_26%,rgba(148,163,184,0.04),transparent_32%),radial-gradient(circle_at_24%_14%,rgba(124,58,237,0.04),transparent_24%)]" />
          <div className="pointer-events-none absolute inset-x-0 top-[34%] h-px bg-gradient-to-r from-transparent via-violet-300/12 to-transparent" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-x-0 top-[54%] h-px bg-gradient-to-r from-transparent via-violet-300/10 to-transparent" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-x-0 top-[54%] h-16 bg-[radial-gradient(circle_at_20%_50%,rgba(124,58,237,0.06),transparent_16%),radial-gradient(circle_at_74%_50%,rgba(124,58,237,0.09),transparent_18%)] opacity-70" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-b from-transparent via-[#070b12]/30 to-[#070b12]" aria-hidden="true" />

          <div className="relative z-10 mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:items-center">
              <div className="max-w-[600px] space-y-5">
                <div className="space-y-4">
                  <LandingPill>Operationele coördinatie</LandingPill>
                  <div className="space-y-4">
                    <h1 className="max-w-[600px] text-balance text-[clamp(2.55rem,3.25vw,3.9rem)] font-semibold tracking-[-0.06em] text-white leading-[0.98]">
                      Aanvraag, validatie en plaatsing in één gecontroleerde{" "}
                      <span className="text-violet-200">werkstroom</span>.
                    </h1>
                    <p className="max-w-lg text-[15px] leading-7 text-slate-300 sm:text-[17px]">
                      CareOn helpt gemeenten en zorgaanbieders dezelfde stappen te volgen, met auditabele
                      besluitvorming, duidelijke eigenaarschap en minder wachttijd.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-0">
                  <a
                    href="#oplossing"
                    className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/8 bg-white/92 px-4 text-sm font-semibold text-slate-950 shadow-[0_8px_24px_rgba(124,58,237,0.12)] transition duration-200 hover:-translate-y-0.5 hover:bg-white"
                  >
                    Bekijk de werkstroom
                    <ArrowRight size={16} />
                  </a>
                  <a
                    href={REGISTER_URL}
                    className="inline-flex h-11 items-center rounded-2xl border border-slate-700/70 bg-white/[0.03] px-4 text-sm font-semibold text-slate-100 transition-colors duration-200 hover:bg-white/[0.06]"
                  >
                    Plan een gesprek
                  </a>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-3">
                  <div className="rounded-[1.35rem] border border-white/6 bg-white/[0.025] px-3 py-2.5 backdrop-blur-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Status</p>
                    <p className="mt-1 text-[13px] font-medium text-slate-100">Eén gedeeld proces</p>
                  </div>
                  <div className="rounded-[1.35rem] border border-white/6 bg-white/[0.025] px-3 py-2.5 backdrop-blur-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Context</p>
                    <p className="mt-1 text-[13px] font-medium text-slate-100">Gemeente en aanbieder</p>
                  </div>
                  <div className="rounded-[1.35rem] border border-white/6 bg-white/[0.025] px-3 py-2.5 backdrop-blur-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Uitkomst</p>
                    <p className="mt-1 text-[13px] font-medium text-slate-100">Bevestigde overdracht</p>
                  </div>
                </div>
              </div>

              <CareOnHeroOrchestrationVisual />
            </div>
          </div>
        </section>

        <section className="pb-6 pt-4 sm:pt-6 lg:pb-8 lg:pt-8" aria-label="Waardecriteria">
          <div className="grid gap-3 lg:grid-cols-4">
            {valueCards.map((card) => {
              const Icon = card.icon;
              return (
                <HoverPanel key={card.title} className="flex h-full items-start gap-3 px-4 py-3 sm:px-5 sm:py-4">
                  <IconBadge className="mt-0.5">
                    <Icon size={16} />
                  </IconBadge>
                  <div className="min-w-0 pt-0.5">
                    <h2 className="text-[14px] font-semibold leading-tight text-white transition-colors group-hover:text-white">
                      {card.title}
                    </h2>
                    <p className="mt-1 text-[12px] leading-snug text-slate-300 transition-colors group-hover:text-slate-200">
                      {card.copy}
                    </p>
                  </div>
                </HoverPanel>
              );
            })}
          </div>
        </section>

        <section className="group py-14 sm:py-16">
          <p className="text-center text-sm text-slate-400 transition-colors group-hover:text-slate-300">
            Gebouwd met gemeenten en zorgaanbieders in dezelfde keten
          </p>
          <div className="relative mt-6 overflow-hidden">
            <div
              className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#070b12] to-transparent"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#070b12] to-transparent"
              aria-hidden="true"
            />
            <div className="flex w-max items-center gap-10 py-2 [animation:partner-marquee_34s_linear_infinite] motion-reduce:animate-none group-hover:[animation-play-state:paused]">
              {partnerMarqueeBrands.map(({ primary, secondary, logoSrc, logoClassName }: any, index) => (
                <div
                  key={`${primary}-${secondary}-${index}`}
                  className="flex min-w-[156px] items-center justify-center px-2 text-center text-slate-400 transition-transform duration-300 hover:-translate-y-0.5"
                >
                  {logoSrc ? (
                    <div className="flex flex-col items-center gap-2">
                      <img
                        src={logoSrc}
                        alt={`${primary} ${secondary}`.trim()}
                        className={`h-7 w-auto opacity-70 grayscale transition duration-300 hover:opacity-100 hover:grayscale-0 ${logoClassName ?? ""}`}
                        loading="lazy"
                        decoding="async"
                      />
                      {secondary ? <div className="text-xs leading-4 text-slate-500 transition-colors group-hover:text-slate-400">{secondary}</div> : null}
                    </div>
                  ) : (
                    <div>
                      <div className="text-[16px] font-semibold tracking-tight text-slate-300 transition-colors group-hover:text-slate-200">{primary}</div>
                      {secondary ? <div className="mt-1 text-sm leading-5 text-slate-500 transition-colors group-hover:text-slate-400">{secondary}</div> : null}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <style>{`
              @keyframes partner-marquee {
                from { transform: translateX(0); }
                to { transform: translateX(-50%); }
              }
            `}</style>
          </div>
        </section>

        <section id="waarom" className="scroll-mt-24 border-t border-slate-800/80 pt-16 pb-14">
          <SectionHeading
            eyebrow="Waarom"
            title="Versnippering vertraagt veilige zorgbesluiten."
            copy="Zonder een gedeelde werkstroom raken aanvraag, validatie en opvolging uit elkaar. Dan gaat tijd verloren en neemt de herleidbaarheid af."
          />

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {problemCards.map((card) => {
              const Icon = card.icon;
              return (
                <HoverPanel key={card.title} className="rounded-[24px] p-6">
                  <IconBadge>
                    <Icon size={16} />
                  </IconBadge>
                  <h3 className="mt-5 text-lg font-semibold text-white transition-colors group-hover:text-white">{card.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300 transition-colors group-hover:text-slate-200">{card.copy}</p>
                </HoverPanel>
              );
            })}
          </div>
        </section>

        <section id="oplossing" className="scroll-mt-24 border-t border-slate-800/80 py-16">
          <SectionHeading
            eyebrow="Werkstroom"
            title="Eén operationele laag boven de keten."
            copy="Gemeenten en zorgaanbieders werken in dezelfde context, met heldere rolafbakening en minder overdrachtsruis."
          />

          <div className="mt-10 grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <HoverPanel className="rounded-[28px] p-6 md:p-7">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Gedeelde werkstroom</p>
                  <h3 className="mt-2 text-xl font-semibold text-white">Twee partijen, één regielaag.</h3>
                </div>
                <span className="hidden rounded-full border border-slate-800/80 bg-white/[0.02] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400 sm:inline-flex">
                  Overzicht
                </span>
              </div>

              <div className="mt-6 rounded-[26px] border border-slate-800/80 bg-[#0a1020]/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] sm:p-5">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <div className="flex flex-col items-start gap-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/80 px-3 py-2 text-sm font-medium text-slate-100">
                      <span className="flex h-2 w-2 rounded-full bg-slate-500" />
                      Gemeente
                    </div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Aanvraag en validatie</p>
                  </div>

                  <div className="relative flex h-full items-center justify-center px-1 sm:px-2">
                    <div className="h-px w-8 bg-slate-700/70 sm:w-10" />
                    <div className="mx-2 h-2.5 w-2.5 rounded-full border border-violet-300/40 bg-violet-300/15 shadow-[0_0_0_4px_rgba(124,58,237,0.06)]" />
                    <div className="h-px w-8 bg-slate-700/70 sm:w-10" />
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/80 px-3 py-2 text-sm font-medium text-slate-100">
                      <span className="flex h-2 w-2 rounded-full bg-slate-500" />
                      Zorgaanbieder
                    </div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Reactie en uitvoering</p>
                  </div>
                </div>

                <div className="mt-5 flex flex-col items-center">
                  <div className="h-7 w-px bg-slate-700/70" aria-hidden="true" />
                  <div className="rounded-[22px] border border-slate-700/80 bg-slate-950/80 px-4 py-4 text-center shadow-[0_10px_30px_rgba(2,6,23,0.22)] sm:px-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-200/90">CareOn regielaag</p>
                    <p className="mt-1 text-sm font-semibold text-white">Status · Eigenaarschap · Audit · Volgende actie</p>
                  </div>
                  <div className="h-7 w-px bg-slate-700/70" aria-hidden="true" />
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-4">
                  {["Status", "Eigenaarschap", "Audit", "Volgende actie"].map((item) => (
                    <div
                      key={item}
                      className="rounded-full border border-slate-800/80 bg-white/[0.02] px-3 py-2 text-center text-[11px] font-medium uppercase tracking-[0.12em] text-slate-300"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </HoverPanel>

            <HoverPanel className="rounded-[28px] p-6 md:p-7">
              <div className="border-b border-slate-800/80 pb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Werkstroomprincipes</p>
                <h3 className="mt-2 text-lg font-semibold text-white">Wat de laag zichtbaar houdt.</h3>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {workflowPrinciples.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-slate-800/80 bg-white/[0.02] px-4 py-4 transition-colors hover:border-slate-700/90 hover:bg-white/[0.035]"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{item.copy}</p>
                  </div>
                ))}
              </div>
            </HoverPanel>
          </div>
        </section>

        <section id="hoe-het-werkt" className="scroll-mt-24 border-t border-slate-800/80 py-14 sm:py-16">
          <SectionHeading
            eyebrow="Hoe het werkt"
            title="Van aanvraag naar bevestigde overdracht"
            copy="CareOn brengt gemeenten en zorgaanbieders samen in één gecontroleerde werkstroom, met duidelijke eigenaarschap, uitlegbare keuzes en minder overdrachtsruis."
          />

          <div className="mt-8 overflow-hidden rounded-[28px] border border-slate-800/80 bg-slate-950/55 shadow-[0_18px_50px_rgba(2,6,23,0.28)]">
            <div className="relative grid gap-px bg-slate-800/80 lg:grid-cols-5">
              <div
                className="pointer-events-none absolute left-6 right-6 top-10 hidden h-px bg-gradient-to-r from-transparent via-slate-600/80 to-transparent lg:block"
                aria-hidden="true"
              />
              {workflowStepperSteps.map((step, index) => (
                <div
                  key={step.title}
                  className="relative bg-[#0a1020] px-4 py-4 transition-colors duration-200 hover:bg-slate-900/80 sm:px-5 sm:py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex shrink-0 items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-2xl border text-[11px] font-semibold ${
                          index === 1
                            ? "border-violet-300/30 bg-slate-950 text-violet-100 shadow-[0_0_0_1px_rgba(124,58,237,0.16)]"
                            : "border-slate-700/80 bg-slate-900/80 text-slate-200"
                        }`}
                      >
                        {step.step}
                      </div>
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.12em] ${
                          index === 1
                            ? "border-violet-300/25 bg-slate-950 text-violet-200"
                            : "border-slate-700/80 bg-slate-900/80 text-slate-400"
                        }`}
                      >
                        {step.state}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 min-w-0">
                    <p className="text-[13px] font-semibold text-white sm:text-sm">{step.title}</p>
                    <p className="mt-1.5 max-w-[17rem] text-[13px] leading-5 text-slate-300 sm:mt-2 sm:text-sm sm:leading-6">
                      {step.copy}
                    </p>
                  </div>

                  {index < workflowStepperSteps.length - 1 ? (
                    <div
                      className="pointer-events-none absolute right-0 top-7 hidden h-px w-3 translate-x-1/2 bg-slate-700/70 lg:block"
                      aria-hidden="true"
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {workflowValueCards.map((card) => (
              <HoverPanel key={card.title} className="rounded-[22px] p-4 sm:p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{card.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{card.copy}</p>
              </HoverPanel>
            ))}
          </div>
        </section>

        <section id="voor-wie" className="scroll-mt-24 border-t border-slate-800/80 py-16">
          <SectionHeading
            eyebrow="Voor wie"
            title="Rolzuivere samenwerking zonder losse werkvloeren."
            copy="De gemeente bewaakt de financiering en arrangementen. De aanbieder ziet een begrensde aanvraag. CareOn houdt dat verschil helder."
          />

          <div className="mt-12 grid gap-4 lg:grid-cols-2">
            {audiencePanels.map((panel) => (
              <HoverPanel key={panel.title} className="rounded-[28px] p-6 md:p-7">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{panel.eyebrow}</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">{panel.title}</h3>
                <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300">{panel.copy}</p>
                <div className="mt-5 grid gap-2">
                  {panel.bullets.map((bullet) => (
                    <div key={bullet} className="flex items-center gap-2 rounded-2xl border border-slate-800/80 bg-white/[0.02] px-3 py-2.5 transition-colors group-hover:border-slate-700/90 group-hover:bg-white/[0.035]">
                      <CheckCircle2 size={14} className="text-violet-200" />
                      <span className="text-sm text-slate-200">{bullet}</span>
                    </div>
                  ))}
                </div>
              </HoverPanel>
            ))}
          </div>
        </section>

        <section className="border-t border-slate-800/80 py-16">
          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr] lg:items-stretch">
            <HoverPanel className="rounded-[28px] p-6 md:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Waarom dit landt</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">Sneller duidelijkheid, minder herstelwerk, meer vertrouwen.</h3>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                CareOn helpt teams sneller tot een gedeelde beslissing te komen, met minder afstemming achteraf en
                meer grip op waarom een route gekozen is.
              </p>
            </HoverPanel>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-3">
              {[
                ["Sneller duidelijk", "Teams zien eerder wat nodig is om verder te kunnen."],
                ["Minder herstelwerk", "Minder losse afstemming en minder dubbele uitleg."],
                ["Meer vertrouwen", "Beslissingen blijven uitlegbaar voor alle betrokkenen."],
              ].map(([title, copy]) => (
                <HoverPanel key={title} className="rounded-[24px] p-5 md:p-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{copy}</p>
                </HoverPanel>
              ))}
            </div>
          </div>
        </section>

        <section id="resources" className="border-t border-slate-800/80 py-16">
          <SectionHeading
            eyebrow="Resources"
            title="Praktische informatie om van start te gaan."
            copy="Van pilotopzet tot contactinformatie."
          />

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {resources.map((item) => (
              <HoverPanel key={item.title} className="rounded-[24px] p-6">
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{item.copy}</p>
              </HoverPanel>
            ))}
          </div>
        </section>

        <section id="pilot" className="border-t border-slate-800/80 py-16">
          <HoverPanel className="rounded-[32px] p-8 md:p-10">
            <SectionHeading
              eyebrow="Pilot"
              title="Start klein. Leer snel. Schaal verantwoord."
              copy="Begin met één gemeente, enkele aanbieders en een beperkte set aanvragen. Meet waar vertraging ontstaat en verbeter de keten stap voor stap."
            />

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={REGISTER_URL}
                className="inline-flex h-12 items-center gap-2 rounded-2xl bg-slate-100 px-5 text-sm font-semibold text-slate-950 transition-transform hover:-translate-y-0.5"
              >
                Plan een gesprek
                <ArrowRight size={16} />
              </a>
              <a
                href="#resources"
                className="inline-flex h-12 items-center rounded-2xl border border-slate-700/80 bg-transparent px-5 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/5"
              >
                Bekijk pilotaanpak
              </a>
            </div>
          </HoverPanel>
        </section>

        <section className="border-t border-slate-800/80 py-16">
          <SectionHeading eyebrow="FAQ" title="Veelgestelde vragen." />

          <div className="mt-8 space-y-3">
            {faqItems.map((item) => (
              <details key={item.question} className="group rounded-[24px] border border-slate-800/80 bg-slate-950/55 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-700/90 hover:bg-slate-900/70 hover:shadow-[0_24px_60px_rgba(2,6,23,0.35)]">
                <summary className="cursor-pointer list-none text-base font-semibold text-white outline-none">
                  <span className="flex items-center justify-between gap-4">
                    {item.question}
                    <span className="text-violet-200 transition-transform group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section id="over-ons" className="scroll-mt-24 border-t border-slate-800/80 py-16">
          <SectionHeading
            eyebrow="Over ons"
            title="Een operationele laag voor veilige coördinatie."
            copy="CareOn is gebouwd voor gemeenten en zorgaanbieders die een helder, auditbaar en rustig proces willen. We brengen de werkstroom boven de bestaande keten, zonder de menselijke beslissing over te nemen."
          />

          <div className="mt-10 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <HoverPanel className="rounded-[28px] p-6 md:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Waar we voor staan</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                Minder ruis, meer herleiding, duidelijke volgende stappen.
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                We ontwerpen CareOn om vraag, validatie, beoordeling en overdracht in één gecontroleerde omgeving te
                houden. Dat helpt teams sneller te handelen zonder de keten onduidelijker te maken.
              </p>
            </HoverPanel>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {[
                ["Werkstroom eerst", "Het systeem stuurt op de volgende actie, niet op losse data."],
                ["Rolzuiver", "Gemeente en aanbieder zien en doen alleen wat bij hun taak hoort."],
              ].map(([title, copy]) => (
                <HoverPanel key={title} className="rounded-[24px] p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{copy}</p>
                </HoverPanel>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800/80 bg-[#060910]">
        <div className="mx-auto grid max-w-[1440px] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8">
          <div className="space-y-4">
            <a href="/" className="inline-flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-700/80 bg-slate-900/80">
                <ShieldCheck size={18} className="text-slate-200" />
              </div>
              <div>
                <div className="text-base font-semibold text-white">CareOn</div>
                <div className="text-sm text-slate-400">Operationele coördinatie voor gemeenten en zorgaanbieders</div>
              </div>
            </a>
            <p className="max-w-2xl text-sm leading-7 text-slate-400">
              CareOn helpt gemeenten en zorgaanbieders van aanvraag tot intake met meer grip, minder vertraging en
              beter verklaarbare beslissingen.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Waarom CareOn", "#waarom"],
              ["Werkstroom", "#oplossing"],
              ["Voor gemeenten", "#voor-wie"],
              ["Voor aanbieders", "#voor-wie"],
              ["Privacy", "#resources"],
              ["Contact", "#resources"],
            ].map(([label, href]) => (
              <a key={label} href={href} className="text-sm text-slate-300 transition-colors hover:text-white">
                {label}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
