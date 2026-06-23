import { Eye, FileText, Lock, ShieldCheck, UserCheck } from "lucide-react";

const pillars = [
  {
    icon: UserCheck,
    title: "Rolgebaseerde toegang",
    description: "Alleen de juiste mensen zien wat ze nodig hebben.",
    iconColor: "var(--cl-violet-bright)",
    iconBg: "rgba(139,92,246,0.15)",
    accentBorder: "rgba(139,92,246,0.30)",
  },
  {
    icon: Lock,
    title: "Workflow-integriteit",
    description: "Strikte fasen en validaties. Geen omzeilen.",
    iconColor: "var(--cl-teal)",
    iconBg: "rgba(20,184,166,0.15)",
    accentBorder: "rgba(20,184,166,0.28)",
  },
  {
    icon: FileText,
    title: "Audittrail beslissingen",
    description: "Elke actie gelogd en herleidbaar per rol.",
    iconColor: "var(--cl-blue)",
    iconBg: "rgba(59,130,246,0.15)",
    accentBorder: "rgba(59,130,246,0.28)",
  },
  {
    icon: ShieldCheck,
    title: "Gegevensbescherming",
    description: "AVG-compliant omgeving, veilige verwerking.",
    iconColor: "#22c55e",
    iconBg: "rgba(34,197,94,0.15)",
    accentBorder: "rgba(34,197,94,0.28)",
  },
  {
    icon: Eye,
    title: "Gecontroleerde zichtbaarheid",
    description: "Aanbieders zien alleen wat én wanneer relevant.",
    iconColor: "var(--cl-amber)",
    iconBg: "rgba(245,158,11,0.15)",
    accentBorder: "rgba(245,158,11,0.28)",
  },
];

export function TrustByDesignSection() {
  return (
    <section
      id="veiligheid"
      className="cl-section scroll-mt-20"
      style={{ background: "var(--cl-bg-deep)" }}
      aria-labelledby="trust-heading"
    >
      <div className="cl-container">
        <div className="grid gap-12 lg:grid-cols-[40%_60%] lg:items-center">

          {/* LEFT: heading + description */}
          <div>
            <p className="cl-eyebrow">TRUST BY DESIGN</p>
            <h2 id="trust-heading" className="cl-heading">
              Vertrouwen is geen feature.{" "}
              <span style={{ color: "var(--cl-violet-bright)" }}>Het is onze basis.</span>
            </h2>
            <p className="cl-lead">
              Toegang, processtappen en besluiten zijn gecontroleerd, traceerbaar en
              afgestemd op de rol van de gebruiker.
            </p>
            <p
              className="mt-5 text-xs leading-relaxed"
              style={{
                color: "var(--cl-text-muted)",
                borderLeft: "2px solid rgba(155,130,255,0.30)",
                paddingLeft: "0.75rem",
              }}
            >
              Carelane verwerkt persoonsgegevens conform de AVG. Toegang wordt
              per rol en context bepaald — niet op organisatieniveau.
            </p>
          </div>

          {/* RIGHT: compact pillar list */}
          <div className="space-y-3">
            {pillars.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.title}
                  className="flex items-start gap-3 rounded-xl p-3.5"
                  style={{
                    background: "var(--cl-surface-1)",
                    border: `1px solid ${pillar.accentBorder}`,
                  }}
                >
                  <div
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: pillar.iconBg }}
                    aria-hidden="true"
                  >
                    <Icon size={16} style={{ color: pillar.iconColor }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "var(--cl-text)" }}>
                      {pillar.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-snug" style={{ color: "var(--cl-text-secondary)" }}>
                      {pillar.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
