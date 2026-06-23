/**
 * Care Network section — one case at centre with surrounding organisations.
 * Desktop: SVG network diagram with curved paths and connection labels.
 * Mobile: role cards grid.
 */
import type { CSSProperties } from "react";
import { Activity, BookOpen, Building2, Share2, ShieldCheck, User, Users } from "lucide-react";

const bullets = [
  {
    Icon: Share2,
    label: "Informatie delen",
    desc: "Elke partij ziet precies wat nodig is voor de eigen rol — niet meer, niet minder.",
  },
  {
    Icon: BookOpen,
    label: "Beslissingen vastleggen",
    desc: "Elk besluit is herleidbaar tot een actor, rol en moment.",
  },
  {
    Icon: Activity,
    label: "Voortgang bewaken",
    desc: "Carelane bewaakt de informatiestroom en houdt eigenaarschap expliciet.",
  },
];

interface NodeDef {
  id: string;
  label: string;
  sub: string;
  Icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  // absolute position within the 480x480 container
  pos: CSSProperties;
  // SVG anchor point for path drawing (0-480 scale)
  cx: number;
  cy: number;
  // connection label
  connLabel: string;
}

const nodes: NodeDef[] = [
  {
    id: "gemeente",
    label: "Gemeente",
    sub: "Regie & beoordeling",
    Icon: Building2,
    color: "var(--cl-blue)",
    bg: "rgba(62,168,255,.12)",
    border: "rgba(62,168,255,.28)",
    pos: { top: "4%", left: "4%", width: 116 },
    cx: 100, cy: 90,
    connLabel: "aanmelding",
  },
  {
    id: "aanbieder",
    label: "Aanbieder",
    sub: "Zorg & behandeling",
    Icon: ShieldCheck,
    color: "var(--cl-violet-bright)",
    bg: "rgba(155,130,255,.12)",
    border: "rgba(155,130,255,.28)",
    pos: { top: "4%", right: "4%", width: 116 },
    cx: 378, cy: 90,
    connLabel: "reactie",
  },
  {
    id: "coordinator",
    label: "Coördinator",
    sub: "Casemanagement & voortgang",
    Icon: User,
    color: "var(--cl-amber)",
    bg: "rgba(245,165,36,.12)",
    border: "rgba(245,165,36,.28)",
    pos: { bottom: "4%", left: "4%", width: 116 },
    cx: 100, cy: 390,
    connLabel: "informatie",
  },
  {
    id: "client",
    label: "Cliënt & gezin",
    sub: "Betrokken & geïnformeerd",
    Icon: Users,
    color: "var(--cl-teal)",
    bg: "rgba(46,200,166,.12)",
    border: "rgba(46,200,166,.28)",
    pos: { bottom: "4%", right: "4%", width: 116 },
    cx: 378, cy: 390,
    connLabel: "terugkoppeling",
  },
];

const CENTER = { x: 240, y: 240 };

function buildCurvedPath(nx: number, ny: number): string {
  const mx = (CENTER.x + nx) / 2;
  const my = (CENTER.y + ny) / 2;
  // slight curve via control point offset
  const cpx = mx + (ny < CENTER.y ? -20 : 20);
  const cpy = my + (nx < CENTER.x ? 20 : -20);
  return `M ${CENTER.x} ${CENTER.y} Q ${cpx} ${cpy} ${nx} ${ny}`;
}

// midpoint on the curved path at t≈0.5
function labelPoint(nx: number, ny: number) {
  const mx = (CENTER.x + nx) / 2;
  const my = (CENTER.y + ny) / 2;
  const cpx = mx + (ny < CENTER.y ? -20 : 20);
  const cpy = my + (nx < CENTER.x ? 20 : -20);
  const t = 0.5;
  return {
    x: (1 - t) * (1 - t) * CENTER.x + 2 * (1 - t) * t * cpx + t * t * nx,
    y: (1 - t) * (1 - t) * CENTER.y + 2 * (1 - t) * t * cpy + t * t * ny,
  };
}

export function CareNetworkSection() {
  return (
    <section
      className="cl-section"
      aria-labelledby="network-heading"
      style={{ background: "var(--cl-bg-deep)" }}
    >
      <div className="cl-container">
        <div className="grid gap-10 lg:grid-cols-[38%_62%] lg:items-center">

          {/* LEFT text */}
          <div>
            <p className="cl-eyebrow">ÉÉN CASUS, MEERDERE ORGANISATIES</p>
            <h2 id="network-heading" className="cl-heading">
              Samenwerken rondom de jongere.
            </h2>
            <p className="cl-lead">
              Gemeenten, aanbieders, coördinatoren en gezin werken in een gedeelde
              omgeving — elk met eigen rol en eigen zichtbaarheid.
            </p>

            <ul className="mt-7 space-y-5">
              {bullets.map(({ Icon, label, desc }) => (
                <li key={label} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      background: "rgba(155,130,255,.10)",
                      color: "var(--cl-violet-bright)",
                      border: "1px solid rgba(155,130,255,.20)",
                    }}
                    aria-hidden="true"
                  >
                    <Icon size={15} strokeWidth={1.75} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--cl-text)" }}>{label}</p>
                    <p className="mt-0.5 text-xs leading-relaxed" style={{ color: "var(--cl-text-muted)" }}>{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* RIGHT network diagram — desktop */}
          <div
            className="hidden lg:block"
            role="img"
            aria-label="Diagram: centrale casus omringd door gemeente, aanbieder, coördinator en cliënt & gezin"
          >
            <div
              style={{
                position: "relative",
                width: "100%",
                maxWidth: 480,
                aspectRatio: "1 / 1",
                margin: "0 auto",
              }}
            >
              {/* SVG: curved connection paths + labels + orbit rings */}
              <svg
                viewBox="0 0 480 480"
                aria-hidden="true"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
              >
                {/* Orbit ring glow effect — subtle radial gradient */}
                <defs>
                  <radialGradient id="orbitGlow" cx="50%" cy="50%" r="60%">
                    <stop offset="0%" stopColor="rgba(155,130,255,0)" />
                    <stop offset="70%" stopColor="rgba(155,130,255,0.06)" />
                    <stop offset="100%" stopColor="rgba(155,130,255,0)" />
                  </radialGradient>
                </defs>
                <circle
                  cx="240" cy="240" r="150"
                  fill="url(#orbitGlow)"
                  opacity="0.6"
                />

                {/* Premium orbit ring (outer) */}
                <circle
                  cx="240" cy="240" r="148"
                  fill="none"
                  stroke="rgba(155,130,255,.12)"
                  strokeWidth="1.2"
                  strokeDasharray="4 8"
                />

                {/* Second orbit ring (inner) */}
                <circle
                  cx="240" cy="240" r="105"
                  fill="none"
                  stroke="rgba(155,130,255,.08)"
                  strokeWidth="1"
                  strokeDasharray="3 6"
                />

                {/* Connection path gradients — richer and more saturated */}
                {nodes.map((n) => (
                  <linearGradient
                    key={`grad-${n.id}`}
                    id={`grad-${n.id}`}
                    x1={CENTER.x} y1={CENTER.y}
                    x2={n.cx} y2={n.cy}
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%" stopColor="rgba(155,130,255,0.70)" />
                    <stop offset="100%" stopColor={
                      n.id === "gemeente" ? "rgba(62,168,255,0.70)"
                      : n.id === "aanbieder" ? "rgba(155,130,255,0.70)"
                      : n.id === "coordinator" ? "rgba(245,165,36,0.70)"
                      : "rgba(46,200,166,0.70)"
                    } />
                  </linearGradient>
                ))}

                {nodes.map((n) => {
                  const midpt = labelPoint(n.cx, n.cy);
                  return (
                    <g key={n.id}>
                      {/* Outer glow line */}
                      <path
                        d={buildCurvedPath(n.cx, n.cy)}
                        fill="none"
                        stroke={`url(#grad-${n.id})`}
                        strokeWidth="7"
                        opacity="0.15"
                      />
                      {/* Main connection line */}
                      <path
                        d={buildCurvedPath(n.cx, n.cy)}
                        fill="none"
                        stroke={`url(#grad-${n.id})`}
                        strokeWidth="2.2"
                        strokeDasharray="6 5"
                        opacity="0.90"
                        strokeLinecap="round"
                      />
                      {/* Connection label — enhanced contrast */}
                      <text
                        x={midpt.x}
                        y={midpt.y - 5}
                        textAnchor="middle"
                        style={{ fontSize: 9, fill: "rgba(195,180,255,0.95)", fontFamily: "inherit", fontWeight: 500 }}
                      >
                        {n.connLabel}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Center node — premium glow treatment */}
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: 136,
                  height: 136,
                  borderRadius: "50%",
                  background: "radial-gradient(circle at 40% 35%, rgba(155,130,255,.35), rgba(91,62,230,.10))",
                  border: "2.5px solid rgba(155,130,255,.45)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  boxShadow: "0 0 0 1px rgba(155,130,255,.35), 0 0 32px rgba(155,130,255,.35), 0 0 64px rgba(155,130,255,.18), 0 0 120px rgba(155,130,255,.10), 0 20px 60px rgba(0,0,0,0.45)",
                }}
              >
                <svg width="52" height="52" viewBox="0 0 44 44" aria-hidden="true" fill="none">
                  <circle cx="22" cy="14" r="8" fill="rgba(171,155,255,.55)" />
                  <path d="M4 42c0-9.94 8.06-18 18-18s18 8.06 18 18" fill="rgba(171,155,255,.38)" />
                </svg>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--cl-text-muted)", textTransform: "uppercase" }}>
                  CASUS
                </span>
              </div>

              {/* 4 role node cards */}
              {nodes.map(({ id, label, sub, Icon, color, bg, border, pos }) => (
                <div
                  key={id}
                  style={{
                    position: "absolute",
                    ...pos,
                    borderRadius: 14,
                    background: bg,
                    border: `1.5px solid ${border}`,
                    padding: "10px 11px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 5,
                    textAlign: "center",
                    boxShadow: `0 4px 20px ${bg}`,
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      background: bg,
                      color,
                      border: `1px solid ${border}`,
                    }}
                    aria-hidden="true"
                  >
                    <Icon size={14} strokeWidth={1.75} />
                  </span>
                  <p style={{ fontSize: 11, fontWeight: 700, color, lineHeight: 1.2 }}>{label}</p>
                  <p style={{ fontSize: 9, color: "var(--cl-text-muted)", lineHeight: 1.3 }}>{sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile: cards grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
            {nodes.map(({ id, label, sub, Icon, color, bg, border }) => (
              <div
                key={id}
                className="rounded-[var(--cl-radius-md)] border p-4"
                style={{ background: "var(--cl-surface-1)", borderColor: border }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: bg, color }}
                    aria-hidden="true"
                  >
                    <Icon size={14} strokeWidth={1.75} />
                  </span>
                  <p className="text-sm font-semibold" style={{ color }}>{label}</p>
                </div>
                <p className="text-xs" style={{ color: "var(--cl-text-muted)" }}>{sub}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
