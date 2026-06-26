import { useState, useEffect, useRef } from "react";
import { Menu, X } from "lucide-react";
import { LOGIN_URL } from "../../lib/routes";
import { CarelaneLogo } from "../logos/CarelaneLogo";

const DEMO_EMAIL = "contact@carelane.nl";

const navLinks = [
  { label: "Platform", href: "#platform" },
  { label: "Voor wie", href: "#voor-wie" },
  { label: "Werkwijze", href: "#werkwijze" },
  { label: "Veiligheid", href: "#veiligheid" },
  { label: "Over Carelane", href: "#over-carelane" },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close drawer on escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && menuOpen) {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // Lock scroll when menu open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const handleDemoClick = () => {
    window.location.href = `mailto:${DEMO_EMAIL}?subject=Demo aanvragen – Carelane`;
  };

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 ${
          scrolled
            ? "border-b border-[var(--cl-border-subtle)] bg-[rgba(6,11,23,.92)] backdrop-blur-xl"
            : "bg-transparent"
        }`}
        style={{ height: 72 }}
      >
        <div
          className="mx-auto flex h-full max-w-[var(--cl-container)] items-center justify-between gap-4 px-5 sm:px-8"
        >
          {/* Logo */}
          <a
            href="/"
            className="flex items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--cl-violet-bright)] rounded-xl"
            aria-label="Carelane home"
          >
            <CarelaneLogo compact decorative className="w-[230px]" />
          </a>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-6 lg:flex" aria-label="Hoofdnavigatie">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-[var(--cl-text-secondary)] transition-colors duration-150 hover:text-[var(--cl-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cl-violet-bright)] rounded"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <a
              href={LOGIN_URL}
              className="hidden h-9 items-center rounded-xl border border-[var(--cl-border)] bg-transparent px-4 text-sm font-medium text-[var(--cl-text-secondary)] transition-colors hover:border-[var(--cl-border-focus)] hover:text-[var(--cl-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cl-violet-bright)] sm:inline-flex"
            >
              Inloggen
            </a>
            <button
              type="button"
              onClick={handleDemoClick}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--cl-violet)] px-4 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(91,62,230,.30)] transition-all hover:-translate-y-px hover:bg-[var(--cl-violet-bright)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cl-violet-bright)]"
            >
              Demo aanvragen
            </button>

            {/* Mobile menu toggle */}
            <button
              ref={menuButtonRef}
              type="button"
              aria-expanded={menuOpen}
              aria-controls="landing-mobile-menu"
              aria-label={menuOpen ? "Menu sluiten" : "Menu openen"}
              onClick={() => setMenuOpen((o) => !o)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--cl-border)] text-[var(--cl-text-secondary)] transition-colors hover:border-[var(--cl-border-focus)] hover:text-[var(--cl-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cl-violet-bright)] lg:hidden"
            >
              {menuOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          aria-hidden="true"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        id="landing-mobile-menu"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigatiemenu"
        className={`fixed inset-x-0 top-0 z-50 bg-[var(--cl-bg-deep)] border-b border-[var(--cl-border)] pt-20 pb-8 px-5 transition-transform duration-300 lg:hidden ${
          menuOpen ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <nav aria-label="Mobiele navigatie">
          <ul className="space-y-1">
            {navLinks.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center rounded-xl px-4 py-3 text-base font-medium text-[var(--cl-text-secondary)] transition-colors hover:bg-[var(--cl-surface-1)] hover:text-[var(--cl-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cl-violet-bright)]"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="mt-6 space-y-2 border-t border-[var(--cl-border-subtle)] pt-6">
            <a
              href={LOGIN_URL}
              onClick={() => setMenuOpen(false)}
              className="flex h-11 items-center justify-center rounded-xl border border-[var(--cl-border)] text-sm font-medium text-[var(--cl-text-secondary)] transition-colors hover:border-[var(--cl-border-focus)] hover:text-[var(--cl-text)]"
            >
              Inloggen
            </a>
            <button
              type="button"
              onClick={() => { setMenuOpen(false); handleDemoClick(); }}
              className="flex h-11 w-full items-center justify-center rounded-xl bg-[var(--cl-violet)] text-sm font-semibold text-white shadow-[0_8px_24px_rgba(91,62,230,.30)] transition-all hover:bg-[var(--cl-violet-bright)]"
            >
              Demo aanvragen
            </button>
          </div>
        </nav>
      </div>
    </>
  );
}
