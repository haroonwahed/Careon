/**
 * Carelane public landing page.
 *
 * Route: /  (public, unauthenticated)
 *
 * Section order per design kit:
 * 1. Navigation
 * 2. Hero
 * 3. Care journey route
 * 4. Regiekamer intelligence
 * 5. One case, multiple organisations
 * 6. Explainable matching
 * 7. Trust by design
 * 8. Results in practice
 * 9. Built for each role
 * 10. Final CTA
 * 11. Footer
 */
import { useEffect } from "react";
import { LandingNav } from "../landing/LandingNav";
import { CareJourneySection } from "../landing/CareJourneySection";
import { RegiekamerSection } from "../landing/RegiekamerSection";
import { CareNetworkSection } from "../landing/CareNetworkSection";
import { ExplainableMatchingSection } from "../landing/ExplainableMatchingSection";
import { TrustByDesignSection } from "../landing/TrustByDesignSection";
import { ResultsSection } from "../landing/ResultsSection";
import { AudienceSection } from "../landing/AudienceSection";
import { FinalCtaSection } from "../landing/FinalCtaSection";
import { LandingFooter } from "../landing/LandingFooter";
import { CarelaneHeroOrchestrationVisual } from "../landing/CarelaneHeroOrchestrationVisual";
import { DarkPrimaryLogo } from "../logos/CarelaneLogos";
import { LOGIN_URL } from "../../lib/routes";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface PublicLandingPageProps {
  onThemeToggle: () => void;
}

const DEMO_EMAIL = "contact@carelane.nl";

export function PublicLandingPage({ onThemeToggle: _onThemeToggle }: PublicLandingPageProps) {
  // Force body/html to dark while landing page is mounted so the canvas
  // background shows correctly when content overflows the #root div.
  useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#060b17";
    document.documentElement.style.backgroundColor = "#060b17";
    return () => {
      document.body.style.backgroundColor = prev;
      document.documentElement.style.backgroundColor = "";
    };
  }, []);

  const handleDemoClick = () => {
    window.location.href = `mailto:${DEMO_EMAIL}?subject=Demo aanvragen – Carelane`;
  };

  return (
    <div
      className="carelane-landing min-h-screen"
      style={{
        color: "var(--cl-text)",
        background:
          "radial-gradient(ellipse at 65% 0%, rgba(91,62,230,.14), transparent 36rem), var(--cl-bg-canvas)",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* ── 1. Navigation ─────────────────────────────────────────── */}
      <LandingNav />

      <main>
        {/* ── 2. Hero ────────────────────────────────────────────────── */}
        <section
          className="relative overflow-x-clip pt-[72px]"
          aria-labelledby="hero-heading"
          style={{ minHeight: "min(90vh, 800px)" }}
        >
          {/* Background elements */}
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "radial-gradient(ellipse at 72% 28%, rgba(124,92,255,.14), transparent 40%), radial-gradient(ellipse at 20% 80%, rgba(62,168,255,.06), transparent 30%)",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: "8rem",
                background: "linear-gradient(to top, var(--cl-bg-canvas), transparent)",
              }}
            />
          </div>

          <div
            className="cl-container relative z-10 flex flex-col justify-center"
            style={{ paddingTop: "clamp(1.5rem, 3vw, 2.5rem)", paddingBottom: "clamp(2rem, 4vw, 4rem)" }}
          >
            {/* Brand logo above hero */}
            <div className="mb-8 flex justify-start lg:mb-10">
              <DarkPrimaryLogo width={280} />
            </div>

            <div className="grid gap-10 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] lg:items-center">
              {/* Left: copy */}
              <div className="max-w-[560px] space-y-6">
                {/* Eyebrow */}
                <p
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-widest"
                  style={{
                    borderColor: "var(--cl-border)",
                    background: "rgba(155,130,255,.08)",
                    color: "var(--cl-violet-bright)",
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: "var(--cl-violet-bright)" }}
                    aria-hidden="true"
                  />
                  Operationele regie voor zorgcoördinatie
                </p>

                <h1
                  id="hero-heading"
                  className="text-balance font-semibold tracking-[-0.04em] text-[var(--cl-text)]"
                  style={{ fontSize: "clamp(2.4rem, 4.5vw, 3.75rem)", lineHeight: 1.05 }}
                >
                  Betere beslissingen in{" "}
                  <span style={{ color: "var(--cl-violet-bright)" }}>schaarse zorg.</span>
                </h1>

                <p
                  className="leading-relaxed"
                  style={{
                    fontSize: "clamp(1rem, 1.2vw, 1.125rem)",
                    color: "var(--cl-text-secondary)",
                    maxWidth: "46ch",
                  }}
                >
                  Carelane verbindt gemeenten, zorgaanbieders en coördinatoren in één helder proces.
                  Zo wordt zichtbaar wat vastloopt, wie aan zet is en welke stap een casus verder
                  brengt.
                </p>

                {/* CTAs */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleDemoClick}
                    className="inline-flex min-h-[48px] items-center gap-2 rounded-xl px-6 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cl-violet-bright)]"
                    style={{
                      background: "linear-gradient(135deg, var(--cl-violet), var(--cl-violet-deep))",
                      boxShadow: "0 10px 30px rgba(91,62,230,.30)",
                    }}
                  >
                    Plan een demo
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <a
                    href="#werkwijze"
                    className="inline-flex min-h-[48px] items-center rounded-xl border px-6 text-sm font-medium transition-all duration-200 hover:border-[var(--cl-border-focus)] hover:text-[var(--cl-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cl-violet-bright)]"
                    style={{
                      borderColor: "var(--cl-border)",
                      color: "var(--cl-text-secondary)",
                    }}
                  >
                    Bekijk hoe het werkt
                  </a>
                </div>

                {/* Trust strip */}
                <div className="flex flex-wrap items-center gap-4 pt-1">
                  {["Veilig", "AVG-bewust", "Gebouwd voor de zorg"].map((label) => (
                    <span
                      key={label}
                      className="flex items-center gap-1.5 text-xs"
                      style={{ color: "var(--cl-text-muted)" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path d="M6 1L1.5 3v3c0 2.8 1.95 5.4 4.5 6 2.55-.6 4.5-3.2 4.5-6V3L6 1Z" fill="rgba(155,130,255,.25)" stroke="rgba(155,130,255,.5)" strokeWidth="1"/>
                        <path d="M3.5 6l1.5 1.5 3-3" stroke="#9b82ff" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Right: Regiekamer preview */}
              <CarelaneHeroOrchestrationVisual />
            </div>
          </div>
        </section>

        {/* ── 3. Care journey route ────────────────────────────────── */}
        <CareJourneySection />

        {/* ── 4. Regiekamer intelligence ────────────────────────────── */}
        <RegiekamerSection />

        {/* ── 5. One case, multiple organisations ─────────────────── */}
        <CareNetworkSection />

        {/* ── 6. Explainable matching ───────────────────────────────── */}
        <ExplainableMatchingSection />

        {/* ── 7. Trust by design ────────────────────────────────────── */}
        <TrustByDesignSection />

        {/* ── 8. Results in practice ────────────────────────────────── */}
        <ResultsSection />

        {/* ── 9. Built for each role ────────────────────────────────── */}
        <AudienceSection />

        {/* ── 10. Final CTA ─────────────────────────────────────────── */}
        <FinalCtaSection />
      </main>

      {/* ── 11. Footer ────────────────────────────────────────────── */}
      <LandingFooter />
    </div>
  );
}
