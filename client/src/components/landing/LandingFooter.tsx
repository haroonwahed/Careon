/**
 * Landing footer.
 * Real navigation groups. No invented social accounts or inactive links.
 * Copyright and legal links.
 */
import { CarelaneLogo } from "../logos/CarelaneLogo";
import { LOGIN_URL } from "../../lib/routes";

const DEMO_EMAIL = "contact@carelane.nl";

const footerGroups = [
  {
    label: "Platform",
    links: [
      { label: "Werkwijze", href: "#werkwijze" },
      { label: "Regiekamer", href: "#platform" },
      { label: "Verklaarbare matching", href: "#matching" },
      { label: "Trust by design", href: "#veiligheid" },
    ],
  },
  {
    label: "Voor wie",
    links: [
      { label: "Gemeenten", href: "#voor-wie" },
      { label: "Zorgaanbieders", href: "#voor-wie" },
      { label: "Coordinatoren", href: "#voor-wie" },
      { label: "Cliënten & gezinnen", href: "#voor-wie" },
    ],
  },
  {
    label: "Over Carelane",
    links: [
      { label: "Onze aanpak", href: "#over-carelane" },
      { label: "Pilot starten", href: "#over-carelane" },
      { label: "Contact", href: `mailto:${DEMO_EMAIL}` },
    ],
  },
  {
    label: "Veiligheid & Privacy",
    links: [
      { label: "Veiligheid", href: "#veiligheid" },
      { label: "Privacybeleid", href: "#" },
      { label: "Gebruiksvoorwaarden", href: "#" },
      { label: "AVG & gegevens", href: "#veiligheid" },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer
      className="border-t"
      style={{ borderColor: "var(--cl-border-subtle)", background: "var(--cl-bg-deep)" }}
      aria-label="Sitefooter"
    >
      {/* Main footer content */}
      <div
        className="cl-container grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]"
      >
        {/* Brand column */}
        <div className="sm:col-span-2 lg:col-span-1 space-y-4">
          <a
            href="/"
            className="inline-flex items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--cl-violet-bright)] rounded-xl"
            aria-label="Carelane home"
          >
            <CarelaneLogo variant="horizontal" theme="dark" size="md" ariaLabel="" />
          </a>
          <p className="max-w-xs text-sm leading-relaxed text-[var(--cl-text-muted)]">
            Operationele regie voor zorgcoördinatie. Carelane verbindt gemeenten, zorgaanbieders en
            coördinatoren in één helder, auditbaar proces.
          </p>
          <div className="flex flex-col gap-2 pt-1">
            <a
              href={LOGIN_URL}
              className="inline-flex h-9 w-fit items-center rounded-xl border px-4 text-sm font-medium text-[var(--cl-text-secondary)] transition-colors hover:border-[var(--cl-border-focus)] hover:text-[var(--cl-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cl-violet-bright)]"
              style={{ borderColor: "var(--cl-border)" }}
            >
              Inloggen
            </a>
          </div>
        </div>

        {/* Link groups */}
        {footerGroups.map((group) => (
          <div key={group.label}>
            <p className="mb-4 text-[11px] font-bold uppercase tracking-widest text-[var(--cl-text-muted)]">
              {group.label}
            </p>
            <ul className="space-y-2.5">
              {group.links.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-[var(--cl-text-secondary)] transition-colors hover:text-[var(--cl-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cl-violet-bright)] rounded"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div
        className="border-t"
        style={{ borderColor: "var(--cl-border-subtle)" }}
      >
        <div className="cl-container flex flex-wrap items-center justify-between gap-4 py-5">
          <p className="text-xs text-[var(--cl-text-muted)]">
            © {new Date().getFullYear()} Carelane. Alle rechten voorbehouden.
          </p>
          <div className="flex items-center gap-4">
            {[
              { label: "Privacy", href: "#" },
              { label: "Gebruiksvoorwaarden", href: "#" },
              { label: "Contact", href: `mailto:${DEMO_EMAIL}` },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-xs text-[var(--cl-text-muted)] transition-colors hover:text-[var(--cl-text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cl-violet-bright)] rounded"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
