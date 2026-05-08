import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  ChevronDown,
  FileText,
  Layers3,
  MapPin,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
  Clock3,
} from "lucide-react";
import { CareOnHeroOrchestrationVisual } from "../landing/CareOnHeroOrchestrationVisual";
import { LOGIN_URL, REGISTER_URL } from "../../lib/routes";

interface PublicLandingPageProps {
  onThemeToggle: () => void;
}

const navLinks = [
  { label: "Waarom CareOn", href: "#waarom" },
  { label: "Oplossing", href: "#oplossing" },
  { label: "Voor wie", href: "#voor-wie" },
  { label: "Over ons", href: "#over-ons" },
  { label: "Resources", href: "#resources" },
] as const;

const valueCards = [
  {
    icon: Layers3,
    title: "Eén centrale regie",
    copy: "Alle stappen in één proces.",
  },
  {
    icon: Shield,
    title: "Minder risico",
    copy: "Besluiten met context.",
  },
  {
    icon: Workflow,
    title: "Sneller passende zorg",
    copy: "Minder wachttijd.",
  },
  {
    icon: Users,
    title: "Samen sterker",
    copy: "Gemeente en aanbieder verbonden.",
  },
] as const;

const problemCards = [
  {
    icon: CircleAlert,
    title: "Geen gedeeld overzicht",
    copy: "Casussen staan verspreid over systemen.",
  },
  {
    icon: Clock3,
    title: "Traag matchingsproces",
    copy: "Aanbieders reageren traag of onvolledig.",
  },
  {
    icon: ShieldCheck,
    title: "Beperkte auditbaarheid",
    copy: "Besluiten zijn lastig te herleiden.",
  },
] as const;

const howItWorks = [
  {
    icon: FileText,
    title: "Casus vastleggen",
    copy: "De casus start het dossier.",
  },
  {
    icon: Sparkles,
    title: "Automatisch structureren",
    copy: "Samenvatting wordt automatisch verwerkt.",
  },
  {
    icon: Search,
    title: "Passende aanbieders vergelijken",
    copy: "Fit, capaciteit en risico blijven zichtbaar.",
  },
  {
    icon: CheckCircle2,
    title: "Plaatsing & intake opvolgen",
    copy: "Door tot bevestigde plaatsing en intake.",
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

const faqItems = [
  {
    question: "Voor wie is CareOn bedoeld?",
    answer:
      "Voor gemeenten en zorgaanbieders die regie, tempo en verantwoording willen versterken.",
  },
  {
    question: "Vervangt CareOn bestaande systemen?",
    answer:
      "Nee. CareOn werkt als regielaag boven bestaande processen en bronnen.",
  },
  {
    question: "Hoe werkt matching?",
    answer:
      "CareOn vergelijkt inhoud, capaciteit, regio en urgentie. De gemeente valideert.",
  },
  {
    question: "Welke gegevens ziet een aanbieder?",
    answer:
      "Alleen context die nodig is na een gekoppelde aanvraag.",
  },
  {
    question: "Is CareOn geschikt voor een pilot?",
    answer:
      "Ja. Begin klein met één gemeente, enkele aanbieders en een beperkte casusset.",
  },
] as const;

const resources = [
  {
    title: "Implementatie",
    copy: "Start met een beperkte keten.",
  },
  {
    title: "Privacy",
    copy: "Lees hoe we met zorgdata omgaan.",
  },
  {
    title: "Contact",
    copy: "Plan een gesprek over je proces.",
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
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300/85">{eyebrow}</p>
      ) : null}
      <h2 className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        {title}
      </h2>
      {copy ? <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">{copy}</p> : null}
    </div>
  );
}

function LandingPill({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-200">
      {children}
    </span>
  );
}

export function PublicLandingPage({ onThemeToggle: _onThemeToggle }: PublicLandingPageProps) {
  return (
    <div className="min-h-screen bg-[#050816] text-slate-100">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute left-[-10rem] top-[-8rem] h-[28rem] w-[28rem] rounded-full bg-violet-600/12 blur-3xl" />
        <div className="absolute right-[-8rem] top-[10rem] h-[24rem] w-[24rem] rounded-full bg-indigo-500/12 blur-3xl" />
        <div className="absolute bottom-[-10rem] left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-fuchsia-500/8 blur-3xl" />
      </div>

      <header className="sticky top-0 z-20 border-b border-white/8 bg-[#050816]/82 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <a href="/" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/45 bg-white/[0.02] shadow-[0_0_28px_rgba(139,92,246,0.18)]">
              <Sparkles size={20} className="text-violet-200" />
            </div>
            <div>
              <div className="text-base font-semibold tracking-tight text-white sm:text-lg">CareOn</div>
              <div className="text-xs text-slate-400 sm:text-sm">Regieplatform voor gemeenten en zorgaanbieders</div>
            </div>
          </a>

          <nav className="hidden items-center gap-7 lg:flex" aria-label="Hoofdnavigatie">
            {navLinks.map((link) => (
              <a key={link.label} className="inline-flex items-center gap-1 text-sm text-slate-300 transition-colors hover:text-white" href={link.href}>
                {link.label}
                {link.label === "Resources" ? <ChevronDown size={14} className="translate-y-px text-slate-400" /> : null}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href={LOGIN_URL}
              className="inline-flex h-11 items-center rounded-2xl border border-white/12 bg-white/3 px-4 text-sm font-medium text-white transition-colors hover:bg-white/8"
            >
              Inloggen
            </a>
            <a
              href={REGISTER_URL}
              className="inline-flex h-11 items-center rounded-2xl bg-[linear-gradient(135deg,#7c3aed,#8b5cf6_55%,#a78bfa)] px-5 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(124,58,237,0.28)] transition-transform hover:-translate-y-0.5"
            >
              Plan een demo
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 pb-16 pt-0 sm:px-6 lg:px-8">
        <section
          className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 overflow-x-clip pb-0 pt-3 lg:min-h-[min(72vh,880px)] lg:pt-5"
          aria-label="Introductie"
        >
          <div className="pointer-events-none absolute inset-0 bg-[#050816]" aria-hidden="true" />
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_88%_68%_at_76%_30%,rgba(124,58,237,0.11),transparent_54%),radial-gradient(ellipse_52%_42%_at_94%_16%,rgba(99,102,241,0.07),transparent_48%)]"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-b from-transparent via-[#050816]/25 to-[#050816]"
            aria-hidden="true"
          />

          <div className="relative z-10 mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
            <div className="relative z-10 max-w-[640px] space-y-7">
              <div className="space-y-5">
                <LandingPill>REGIE OVER DE ZORGKETEN</LandingPill>
                <div className="h-1 w-14 rounded-full bg-violet-400/80 shadow-[0_0_16px_rgba(168,85,247,0.6)]" aria-hidden="true" />
                <div className="space-y-5">
                  <h1 className="max-w-[680px] text-balance text-[clamp(3.9rem,5vw,5rem)] font-semibold tracking-[-0.06em] text-white leading-[0.98]">
                    Van casus tot intake.
                    <span className="block text-[#bda2ff]">Eén regieomgeving.</span>
                  </h1>
                  <p className="max-w-xl text-lg leading-7 text-slate-300 sm:text-xl">
                    Grip op elke stap in de jeugdzorgketen.
                    <span className="block">Voor snellere beslissingen en betere zorg.</span>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <a
                  href="#hoe-het-werkt"
                  className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#7c3aed,#8b5cf6_55%,#a78bfa)] px-5 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(124,58,237,0.28)] transition-transform hover:-translate-y-0.5"
                >
                  Bekijk hoe het werkt
                  <ArrowRight size={16} />
                </a>
                <a
                  href={REGISTER_URL}
                  className="inline-flex h-12 items-center rounded-2xl border border-white/12 bg-white/4 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/9"
                >
                  Plan een demo
                </a>
              </div>
            </div>
          </div>

          <CareOnHeroOrchestrationVisual />
        </section>

        <section className="-mt-2 pb-4 pt-0 lg:-mt-12" aria-label="Waardecriteria">
          <div className="relative overflow-hidden rounded-[24px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.026),rgba(255,255,255,0.038))] backdrop-blur-sm">
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 h-32 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/16 blur-3xl"
              aria-hidden="true"
            />
            <div className="grid gap-0 lg:grid-cols-4">
              {valueCards.map((card, index) => {
                const Icon = card.icon;
                return (
                  <article
                    key={card.title}
                    className={`flex items-start gap-3 py-2.5 pl-3 pr-3 md:py-3 md:pl-3.5 md:pr-3.5 ${index < valueCards.length - 1 ? "border-b border-white/8 lg:border-b-0 lg:border-r lg:border-white/8" : ""}`}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-400/10 text-violet-200">
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <h2 className="text-[14px] font-semibold leading-tight text-white">{card.title}</h2>
                      <p className="mt-0.5 text-[12px] leading-snug text-slate-300">{card.copy}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mt-8 border-t border-white/8 pt-8 pb-6 lg:mt-10 lg:pt-10 lg:pb-8">
          <p className="text-center text-sm text-slate-400">Gebouwd voor en samen met gemeenten en zorgaanbieders</p>
          <div className="relative mt-5 overflow-hidden">
            <div
              className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[#050816] to-transparent"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[#050816] to-transparent"
              aria-hidden="true"
            />
            <div className="flex w-max items-center gap-10 py-2 [animation:partner-marquee_34s_linear_infinite] motion-reduce:animate-none">
              {[...partnerBrands, ...partnerBrands].map(({ primary, secondary, logoSrc, logoClassName }, index) => (
                <div
                  key={`${primary}-${secondary}-${index}`}
                  className="flex min-w-[156px] items-center justify-center px-2 text-center text-slate-400"
                >
                  {logoSrc ? (
                    <div className="flex flex-col items-center gap-2">
                      <img
                        src={logoSrc}
                        alt={`${primary} ${secondary}`.trim()}
                        className={`h-7 w-auto opacity-80 grayscale transition hover:opacity-100 hover:grayscale-0 ${logoClassName ?? ""}`}
                        loading="lazy"
                        decoding="async"
                      />
                      {secondary ? <div className="text-xs leading-4 text-slate-500">{secondary}</div> : null}
                    </div>
                  ) : (
                    <div>
                      <div className="text-[16px] font-semibold tracking-tight text-slate-300">{primary}</div>
                      {secondary ? <div className="mt-1 text-sm leading-5 text-slate-500">{secondary}</div> : null}
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

        <section id="waarom" className="scroll-mt-24 border-t border-white/8 pt-20 pb-16">
          <SectionHeading
            eyebrow="Probleem"
            title="Zorgtoewijzing loopt vast door versnippering."
            copy="Casussen, opvolging en escalaties zitten verspreid over systemen. Daardoor ontstaat vertraging en ontbreekt één operationeel beeld."
          />

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {problemCards.map((card) => {
              const Icon = card.icon;
              return (
                <article key={card.title} className="landing-hover-card rounded-[28px] border border-white/10 bg-white/[0.035] p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-400/10 text-violet-200">
                    <Icon size={18} />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold text-white">{card.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{card.copy}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section id="oplossing" className="scroll-mt-24 border-t border-white/8 py-16">
          <SectionHeading
            eyebrow="Oplossing"
            title="Eén operationele laag boven de zorgketen."
            copy="Van casus tot intake met gecontroleerde regie, matching en plaatsing."
          />

          <div className="relative mt-10 overflow-hidden py-4">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_48%_56%,rgba(124,58,237,0.18),transparent_42%),radial-gradient(circle_at_70%_54%,rgba(99,102,241,0.10),transparent_26%)]"
              aria-hidden="true"
            />

            <div className="relative hidden lg:block">
              {/* aspect-[1200/176] keeps the same scale as viewBox so label % lines up with SVG geometry (no letterboxing). */}
              <svg
                className="aspect-[1200/176] w-full"
                viewBox="0 0 1200 176"
                preserveAspectRatio="xMidYMid meet"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="care-flow-main" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="rgba(167,139,250,0.12)" />
                    <stop offset="46%" stopColor="rgba(167,139,250,0.72)" />
                    <stop offset="100%" stopColor="rgba(167,139,250,0.14)" />
                  </linearGradient>
                  <filter id="care-flow-node-glow-high" x="-80%" y="-80%" width="260%" height="260%">
                    <feGaussianBlur stdDeviation="2.2" result="b" />
                    <feMerge>
                      <feMergeNode in="b" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <filter id="care-flow-node-glow-low" x="-70%" y="-70%" width="240%" height="240%">
                    <feGaussianBlur stdDeviation="1.4" result="b" />
                    <feMerge>
                      <feMergeNode in="b" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                <path
                  id="care-flow-main-path"
                  d="M 70 96 Q 174 82 278 90 Q 382 98 486 88 Q 590 86 694 94 Q 798 100 902 90 Q 1006 88 1110 92"
                  fill="none"
                  stroke="url(#care-flow-main)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {(
                  [
                    { emphasis: "low" as const, cx: 70, cy: 96 },
                    { emphasis: "high" as const, cx: 278, cy: 90 },
                    { emphasis: "high" as const, cx: 486, cy: 88 },
                    { emphasis: "high" as const, cx: 694, cy: 94 },
                    { emphasis: "high" as const, cx: 902, cy: 90 },
                    { emphasis: "low" as const, cx: 1110, cy: 92 },
                  ] as const
                ).map((n, i) =>
                  n.emphasis === "high" ? (
                    <circle
                      key={i}
                      cx={n.cx}
                      cy={n.cy}
                      r={6}
                      fill="rgba(196,181,253,0.92)"
                      filter="url(#care-flow-node-glow-high)"
                    />
                  ) : (
                    <circle
                      key={i}
                      cx={n.cx}
                      cy={n.cy}
                      r={4.25}
                      fill="rgba(196,181,253,0.72)"
                      filter="url(#care-flow-node-glow-low)"
                    />
                  ),
                )}

                <circle r="5.2" fill="rgba(196,181,253,0.96)">
                  <animateMotion dur="6.8s" repeatCount="indefinite">
                    <mpath href="#care-flow-main-path" />
                  </animateMotion>
                  <animate attributeName="opacity" values="0;0.95;0.95;0" keyTimes="0;0.12;0.86;1" dur="6.8s" repeatCount="indefinite" />
                </circle>
              </svg>

              <div className="pointer-events-none absolute inset-0">
                {[
                  { label: "Casus", emphasis: "low" as const, vx: 70, vy: 96, confirmed: false },
                  { label: "Matching", emphasis: "high" as const, vx: 278, vy: 90, confirmed: false },
                  { label: "Gemeentelijke validatie", emphasis: "high" as const, vx: 486, vy: 88, confirmed: false },
                  { label: "Aanbieder beoordeling", emphasis: "high" as const, vx: 694, vy: 94, confirmed: false },
                  { label: "Plaatsing", emphasis: "high" as const, vx: 902, vy: 90, confirmed: false },
                  { label: "Intake", emphasis: "low" as const, vx: 1110, vy: 92, confirmed: true },
                ].map((step) => (
                  <div
                    key={step.label}
                    className="absolute flex flex-col items-center"
                    style={{
                      left: `${(step.vx / 1200) * 100}%`,
                      /* ~11 viewBox units below node center clears SVG dot (r≤6) + gap */
                      top: `${((step.vy + 11) / 176) * 100}%`,
                      transform: "translateX(-50%)",
                    }}
                  >
                    <p className="text-center text-[12px] font-medium tracking-tight text-slate-200">{step.label}</p>
                    {step.automated ? (
                      <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-400">
                        <Sparkles size={10} className="text-violet-200/70" />
                        Automatisch
                      </span>
                    ) : null}
                    {step.confirmed ? (
                      <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-emerald-300/85">
                        <CheckCircle2 size={10} />
                        Bevestigd
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="relative grid gap-4 sm:grid-cols-2 lg:hidden">
              {[
                { label: "Casus", automated: false, confirmed: false, emphasis: false },
                { label: "Matching", automated: false, confirmed: false, emphasis: true },
                { label: "Gemeentelijke validatie", automated: false, confirmed: false, emphasis: true },
                { label: "Aanbieder beoordeling", automated: false, confirmed: false, emphasis: true },
                { label: "Plaatsing", automated: false, confirmed: false, emphasis: true },
                { label: "Intake", automated: false, confirmed: true, emphasis: false },
              ].map((step, index) => (
                <div
                  key={step.label}
                  className={`relative rounded-xl border px-3 py-3 ${
                    step.emphasis
                      ? "border-violet-300/34 bg-violet-400/[0.11]"
                      : "border-white/12 bg-white/[0.025]"
                  } ${index % 2 === 1 ? "sm:translate-y-6" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full ${
                        step.emphasis ? "h-3 w-3 bg-violet-300/90 shadow-[0_0_16px_rgba(124,58,237,0.45)]" : "h-2.5 w-2.5 bg-violet-200/70"
                      }`}
                    />
                    <p className="text-[13px] font-medium text-slate-200">{step.label}</p>
                  </div>
                  {step.automated ? (
                    <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-400">
                      <Sparkles size={10} className="text-violet-200/70" />
                      Automatisch
                    </span>
                  ) : null}
                  {step.confirmed ? (
                    <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-emerald-300/85">
                      <CheckCircle2 size={10} />
                      Bevestigd
                    </span>
                  ) : null}
                </div>
              ))}
            </div>

          </div>
        </section>

        <section id="hoe-het-werkt" className="scroll-mt-24 border-t border-white/8 py-16">
          <SectionHeading
            eyebrow="Hoe het werkt"
            title="Van signaal naar beslissing."
          />

          <div className="mt-10 grid gap-4 lg:grid-cols-4">
            {howItWorks.map((step, index) => {
              const Icon = step.icon;
              return (
                <article key={step.title} className="landing-hover-card rounded-[28px] border border-white/10 bg-white/[0.035] p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-400/10 text-violet-200">
                      <Icon size={18} />
                    </div>
                    <span className="text-sm font-semibold text-violet-200">0{index + 1}</span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{step.copy}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section id="voor-wie" className="scroll-mt-24 border-t border-white/8 py-16">
          <SectionHeading
            eyebrow="Voor wie"
            title="Regie die past bij de rol aan tafel."
            copy="Gemeente behoudt volledige context. Aanbieder ziet alleen relevante aanvraag."
          />

          <div className="relative mt-12 overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,14,34,0.94),rgba(7,11,28,0.88))] p-8 md:p-10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_24%_32%,rgba(124,58,237,0.14),transparent_38%),radial-gradient(circle_at_84%_52%,rgba(56,189,248,0.06),transparent_34%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(148,163,184,0)_0%,rgba(148,163,184,0.05)_46%,rgba(148,163,184,0)_100%)]" />

            <div className="relative grid gap-10 lg:grid-cols-[4.2fr_7.8fr] lg:gap-14">
              <div id="gemeenten" className="space-y-6 pt-1 scroll-mt-24">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-100/95">Gemeente</p>
                <p className="max-w-sm text-[27px] font-semibold leading-[1.06] tracking-[-0.025em] text-white">Gemeente behoudt volledige context.</p>
                <p className="max-w-xs text-sm text-slate-400">Zichtbaarheid verschilt per ketenpartner.</p>
              </div>

              <div id="aanbieders" className="relative -mt-1 overflow-hidden rounded-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.012))] p-6 md:p-7 scroll-mt-24">
                <div className="pointer-events-none absolute inset-0 rounded-[28px] border border-white/8" />
                <div className="pointer-events-none absolute left-[7%] top-[16%] h-[62%] w-[58%] rounded-[20px] bg-violet-400/[0.05]" />
                <div className="pointer-events-none absolute right-[8%] top-[22%] h-[54%] w-[32%] rounded-[18px] bg-cyan-300/[0.035]" />
                <div className="pointer-events-none absolute inset-x-[6%] top-[33%] h-px bg-[linear-gradient(90deg,rgba(148,163,184,0),rgba(148,163,184,0.18),rgba(148,163,184,0))]" />
                <div className="pointer-events-none absolute inset-x-[16%] top-[58%] h-px bg-[linear-gradient(90deg,rgba(148,163,184,0),rgba(148,163,184,0.14),rgba(148,163,184,0))]" />

                <div className="relative grid min-h-[192px] grid-rows-[auto_1fr] gap-5">
                  <div className="flex items-start justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-100/90">Casusinformatie</p>
                    <span className="rounded-[18px] border border-emerald-300/24 bg-emerald-300/[0.07] px-2.5 py-1 text-[10px] font-medium text-emerald-200">
                      toegang begrensd
                    </span>
                  </div>

                  <div className="grid grid-cols-[1.2fr_0.8fr] gap-4">
                    <div className="rounded-[20px] bg-violet-400/[0.06] p-3.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-100/85">Volledige casusinformatie</p>
                      <div className="mt-2 space-y-1.5 text-[11px] text-slate-300">
                        <p>Casus: JZ-4821</p>
                        <p>Status: Matching klaar</p>
                        <p>Regio: Utrecht</p>
                        <p>Risico: middel</p>
                      </div>
                    </div>

                    <div className="rounded-[20px] bg-white/[0.016] p-3.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300">Alleen relevante aanvraag</p>
                      <div className="mt-2 space-y-1.5 text-[11px] text-slate-300">
                        <p>Aanvraag: Plaatsing</p>
                        <p>Urgentie: Middel</p>
                        <p className="text-emerald-200/90">Toegang: Gekoppeld</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-white/8 py-16">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div className="space-y-4">
              <SectionHeading
                eyebrow="Product preview"
                title="Operationele regie zonder dashboard-chaos."
                copy="Zie blokkades, routing en volgende acties zonder ruis of overbelasting."
              />
              <p className="max-w-md text-sm leading-7 text-slate-300">
                Eén scenario: een route blokkeert, een alternatief wordt verklaarbaar aanbevolen, een pad wordt
                geaccepteerd en de volgende gemeentelijke actie wordt direct zichtbaar.
              </p>
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/24 bg-violet-400/[0.08] px-4 py-2 text-xs font-medium text-violet-100">
                Next best action: bevestig aanbevolen plaatsingsroute
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,14,34,0.9),rgba(7,12,30,0.82))] p-6 md:p-7">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_56%,rgba(124,58,237,0.16),transparent_40%),radial-gradient(circle_at_72%_42%,rgba(56,189,248,0.1),transparent_32%)]" />
              <div className="relative">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-200/90">Operationeel moment</p>
                <h3 className="mt-2 text-lg font-semibold text-white">Gemeente stuurt op één gecontroleerde plaatsingsbeslissing.</h3>

                <svg className="mt-6 h-[220px] w-full" viewBox="0 0 860 220" aria-hidden="true">
                  <defs>
                    <linearGradient id="care-preview-active" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="rgba(167,139,250,0.2)" />
                      <stop offset="46%" stopColor="rgba(167,139,250,0.82)" />
                      <stop offset="100%" stopColor="rgba(52,211,153,0.65)" />
                    </linearGradient>
                    <linearGradient id="care-preview-blocked" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="rgba(251,191,36,0.08)" />
                      <stop offset="45%" stopColor="rgba(251,191,36,0.58)" />
                      <stop offset="100%" stopColor="rgba(251,191,36,0.08)" />
                    </linearGradient>
                  </defs>

                  <path d="M 84 124 C 198 112, 286 86, 378 92 C 482 98, 566 138, 708 126" fill="none" stroke="url(#care-preview-active)" strokeWidth="2.4" />
                  <path d="M 82 126 C 196 146, 270 166, 360 154 C 448 144, 526 128, 640 148" fill="none" stroke="url(#care-preview-blocked)" strokeWidth="1.6" opacity="0.6" />

                  <circle cx="84" cy="124" r="8" fill="rgba(196,181,253,0.9)" />
                  <circle cx="378" cy="92" r="10" fill="rgba(167,139,250,0.95)" />
                  <circle cx="708" cy="126" r="8.5" fill="rgba(74,222,128,0.9)" className="careon-preview-accept-glow" />
                  <circle cx="640" cy="148" r="6" fill="rgba(251,191,36,0.88)" className="careon-preview-blocker-glow" />

                  <circle r="5.2" fill="rgba(196,181,253,0.98)">
                    <animateMotion dur="5.8s" repeatCount="indefinite" path="M 84 124 C 198 112, 286 86, 378 92 C 482 98, 566 138, 708 126" />
                    <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.16;0.82;1" dur="5.8s" repeatCount="indefinite" />
                  </circle>
                </svg>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">Aanbevolen route</p>
                    <p className="mt-1 text-sm text-slate-200">Plaatsing bij De Brug met verklaarbare matchfit.</p>
                  </div>
                  <div className="rounded-xl border border-violet-300/24 bg-violet-400/[0.09] px-3 py-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-violet-200/90">Volgende actie</p>
                    <p className="mt-1 text-sm text-violet-100">Gemeente bevestigt doorzetting naar intake.</p>
                  </div>
                </div>
              </div>

              <style>{`
                @keyframes careonPreviewBlockerGlow {
                  0%, 100% { opacity: 0.62; box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.25); }
                  50% { opacity: 1; box-shadow: 0 0 0 6px rgba(251, 191, 36, 0); }
                }

                @keyframes careonPreviewAcceptGlow {
                  0%, 100% { opacity: 0.78; transform: scale(1); }
                  50% { opacity: 1; transform: scale(1.08); }
                }

                .careon-preview-blocker-glow {
                  animation: careonPreviewBlockerGlow 3.4s ease-in-out infinite;
                }

                .careon-preview-accept-glow {
                  animation: careonPreviewAcceptGlow 3.1s ease-in-out infinite;
                }
              `}</style>
            </div>
          </div>
        </section>

        <section id="resources" className="border-t border-white/8 py-16">
          <SectionHeading
            eyebrow="Resources"
            title="Praktische informatie om van start te gaan."
            copy="Van pilotopzet tot contactinformatie."
          />

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {resources.map((item) => (
              <article key={item.title} className="landing-hover-card rounded-[28px] border border-white/10 bg-white/[0.035] p-6">
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{item.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="pilot" className="border-t border-white/8 py-16">
          <div className="rounded-[36px] border border-violet-400/20 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.2),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] p-8 md:p-10">
            <SectionHeading
              eyebrow="Pilot"
              title="Start klein. Leer snel. Schaal verantwoord."
              copy="Begin met één gemeente, enkele aanbieders en een beperkte set casussen. Meet waar vertraging ontstaat en verbeter de keten stap voor stap."
            />

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={REGISTER_URL}
                className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#7c3aed,#8b5cf6_55%,#a78bfa)] px-5 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(124,58,237,0.28)] transition-transform hover:-translate-y-0.5"
              >
                Plan een demo
                <ArrowRight size={16} />
              </a>
              <a
                href="#resources"
                className="inline-flex h-12 items-center rounded-2xl border border-white/12 bg-white/4 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/9"
              >
                Bekijk pilotaanpak
              </a>
            </div>
          </div>
        </section>

        <section className="border-t border-white/8 py-16">
          <SectionHeading eyebrow="FAQ" title="Veelgestelde vragen." />

          <div className="mt-8 space-y-3">
            {faqItems.map((item) => (
              <details key={item.question} className="group landing-hover-card rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
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
      </main>

      <footer id="over-ons" className="border-t border-white/8 bg-[#040611] scroll-mt-24">
        <div className="mx-auto grid max-w-[1440px] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8">
          <div className="space-y-4">
            <a href="/" className="inline-flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-400/30 bg-[linear-gradient(180deg,rgba(124,58,237,0.9),rgba(56,189,248,0.45))]">
                <Sparkles size={18} className="text-white" />
              </div>
              <div>
                <div className="text-base font-semibold text-white">CareOn</div>
                <div className="text-sm text-slate-400">Regieplatform voor gemeenten en zorgaanbieders</div>
              </div>
            </a>
            <p className="max-w-2xl text-sm leading-7 text-slate-400">
              CareOn helpt gemeenten en zorgaanbieders van casus tot intake met meer grip, minder vertraging en
              beter verklaarbare beslissingen.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Waarom CareOn", "#waarom"],
              ["Oplossing", "#oplossing"],
              ["Voor gemeenten", "#gemeenten"],
              ["Voor aanbieders", "#aanbieders"],
              ["Privacy", "#over-ons"],
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
