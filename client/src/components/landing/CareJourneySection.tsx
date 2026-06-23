/**
 * Care Journey Route — five connected phases in the canonical order:
 * Aanmelding → Matching → Aanbiederreactie → Plaatsing → Intake
 */

const phases = [
  {
    name: "Aanmelding",
    role: "Gemeente",
    text: "De zorgvraag wordt aangemaakt, gecontroleerd en compleet gemaakt.",
    friction: "Onvolledige gegevens vertragen de start",
    color: "var(--cl-blue)",
    bg: "rgba(62,168,255,.10)",
    border: "rgba(62,168,255,.22)",
    step: "01",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="8" r="4" fill="currentColor" opacity="0.9"/>
        <path d="M4 20c0-3.31 3.58-6 8-6s8 2.69 8 6v2H4v-2Z" fill="currentColor" opacity="0.85"/>
      </svg>
    ),
  },
  {
    name: "Matching",
    role: "Carelane",
    text: "Carelane vergelijkt passende aanbieders en maakt afwegingen zichtbaar.",
    friction: "Adviserend — de professional beslist",
    color: "var(--cl-violet-bright)",
    bg: "rgba(155,130,255,.10)",
    border: "rgba(155,130,255,.26)",
    step: "02",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="8" cy="12" r="3.5" fill="currentColor" opacity="0.85"/>
        <circle cx="16" cy="12" r="3.5" fill="currentColor" opacity="0.85"/>
        <path d="M11 12h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
      </svg>
    ),
  },
  {
    name: "Aanbiederreactie",
    role: "Zorgaanbieder",
    text: "De aanbieder accepteert, wijst af of vraagt aanvullende informatie.",
    friction: "Wachttijd op reactie zichtbaar",
    color: "var(--cl-amber)",
    bg: "rgba(245,165,36,.10)",
    border: "rgba(245,165,36,.22)",
    step: "03",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="2" y="4" width="20" height="14" rx="1" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M2 6l10 7 10-7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" opacity="0.9"/>
      </svg>
    ),
  },
  {
    name: "Plaatsing",
    role: "Gemeente + Aanbieder",
    text: "De plaatsing wordt bevestigd en zorgvuldig voorbereid.",
    friction: "Overdracht met volledige context",
    color: "var(--cl-teal)",
    bg: "rgba(46,200,166,.10)",
    border: "rgba(46,200,166,.22)",
    step: "04",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.15"/>
        <path d="M7 12.5l3 3 7-8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.95"/>
      </svg>
    ),
  },
  {
    name: "Intake",
    role: "Zorgaanbieder",
    text: "De intake wordt gepland en de overdracht wordt afgerond.",
    friction: "Zorgstart bevestigd",
    color: "var(--cl-teal)",
    bg: "rgba(46,200,166,.10)",
    border: "rgba(46,200,166,.22)",
    step: "05",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" opacity="0.9"/>
        <path d="M8 2v5M16 2v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.85"/>
        <path d="M3 10h18" stroke="currentColor" strokeWidth="1.6" opacity="0.7"/>
        <circle cx="12" cy="16" r="2.5" fill="currentColor" opacity="0.8"/>
      </svg>
    ),
  },
];

export function CareJourneySection() {
  return (
    <section
      id="werkwijze"
      className="cl-section scroll-mt-20"
      aria-labelledby="journey-heading"
    >
      <div className="cl-container">
        <div className="mb-12 max-w-2xl">
          <p className="cl-eyebrow">Eén zorgketen, één route</p>
          <h2 id="journey-heading" className="cl-heading">
            Van aanmelding tot intake.
          </h2>
          <p className="cl-lead">
            Iedere casus volgt dezelfde herkenbare route, met ruimte voor professionele
            afwegingen en heldere verantwoordelijkheid.
          </p>
        </div>

        {/* Desktop: horizontal phase route */}
        <div className="hidden lg:block">
          <ol className="relative grid grid-cols-5 gap-4" aria-label="Zorgketen fasen">
            {phases.map((phase, i) => (
              <li key={phase.name} className="group relative flex flex-col">
                {/* Step marker */}
                <div className="mb-4 flex justify-center">
                  <div
                    className="relative flex h-[68px] w-[68px] items-center justify-center rounded-2xl border transition-all duration-300 group-hover:scale-105"
                    style={{
                      background: phase.bg,
                      borderColor: phase.border,
                      color: phase.color,
                      boxShadow: `0 0 0 8px ${phase.bg}, 0 0 24px ${phase.bg}, 0 8px 24px rgba(0,0,0,0.35)`,
                    }}
                  >
                    {phase.icon}
                    {/* Step badge */}
                    <span
                      style={{
                        position: "absolute",
                        top: -6,
                        right: -6,
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        background: phase.color,
                        color: "#060b17",
                        fontSize: 9,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {phase.step}
                    </span>
                    {/* Connecting arrow, not on last */}
                    {i < phases.length - 1 && (
                      <div
                        className="pointer-events-none absolute -right-[calc(50%+.5rem)] top-1/2 -translate-y-1/2 hidden text-[var(--cl-text-muted)] lg:block"
                        aria-hidden="true"
                      >
                        <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
                          <path d="M0 5h14M10 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div
                  className="flex-1 rounded-[var(--cl-radius-lg)] border p-4 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[var(--cl-shadow-card)]"
                  style={{
                    background: "var(--cl-surface-1)",
                    borderColor: "var(--cl-border-subtle)",
                  }}
                >
                  <div
                    className="mb-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
                    style={{ background: phase.bg, color: phase.color }}
                  >
                    {phase.step}
                  </div>
                  <h3 className="text-sm font-semibold text-[var(--cl-text)]">{phase.name}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--cl-text-secondary)]">
                    {phase.text}
                  </p>
                  <div className="mt-3 border-t pt-2.5" style={{ borderColor: "var(--cl-border-subtle)" }}>
                    <p className="text-[10px] uppercase tracking-wide text-[var(--cl-text-muted)]">
                      {phase.role}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--cl-text-muted)]">{phase.friction}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Mobile: vertical timeline */}
        <div className="lg:hidden">
          <ol className="relative space-y-0" aria-label="Zorgketen fasen">
            {/* Vertical line */}
            <div
              className="pointer-events-none absolute left-[23px] top-6 bottom-6 w-px"
              style={{ background: "linear-gradient(to bottom, var(--cl-blue), var(--cl-violet), var(--cl-amber), var(--cl-teal))", opacity: .25 }}
              aria-hidden="true"
            />
            {phases.map((phase) => (
              <li key={phase.name} className="relative flex gap-4 pb-8 last:pb-0">
                {/* Icon */}
                <div
                  className="relative z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border"
                  style={{ background: phase.bg, borderColor: phase.border, color: phase.color }}
                >
                  {phase.icon}
                </div>

                {/* Content */}
                <div
                  className="min-w-0 flex-1 rounded-[var(--cl-radius-md)] border p-4"
                  style={{ background: "var(--cl-surface-1)", borderColor: "var(--cl-border-subtle)" }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[var(--cl-text)]">{phase.name}</h3>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
                      style={{ background: phase.bg, color: phase.color }}
                    >
                      {phase.step}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--cl-text-secondary)]">
                    {phase.text}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-[var(--cl-text-muted)]">{phase.role}</span>
                    <span className="text-[var(--cl-border)]">·</span>
                    <span className="text-xs text-[var(--cl-text-muted)]">{phase.friction}</span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
