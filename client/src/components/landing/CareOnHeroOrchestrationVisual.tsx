export function CareOnHeroOrchestrationVisual() {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-[5%] z-0 hidden w-[min(78vw,1120px)] max-w-none lg:top-[6%] lg:block"
        style={{
          /* Wider horizontal feather avoids 1px “seam” where mask layers intersect (often through center / star). */
          maskImage:
            "radial-gradient(circle at 68% 46%, black 0%, black 44%, rgba(0,0,0,0.78) 62%, rgba(0,0,0,0.28) 80%, transparent 97%), linear-gradient(90deg, transparent 0%, black 5%, black 50%, black 95%, transparent 100%), linear-gradient(180deg, transparent 0%, black 8%, black 90%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(circle at 68% 46%, black 0%, black 44%, rgba(0,0,0,0.78) 62%, rgba(0,0,0,0.28) 80%, transparent 97%), linear-gradient(90deg, transparent 0%, black 5%, black 50%, black 95%, transparent 100%), linear-gradient(180deg, transparent 0%, black 8%, black 90%, transparent 100%)",
          WebkitMaskComposite: "source-in",
          maskComposite: "intersect",
        }}
      >
        {/* Travelling bloom: anchored to SVG path start (star / regie hub), then follows the main line */}
        <div className="careon-hero-bloom-travel pointer-events-none absolute h-0 w-0" aria-hidden="true">
          <div className="careon-hero-hub-bloom absolute h-[min(20rem,32vw)] w-[min(20rem,32vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(196,181,253,0.48)_0%,rgba(124,58,237,0.16)_36%,transparent_70%)] blur-3xl" />
          <div className="careon-hero-hub-bloom-delayed absolute h-[min(14rem,24vw)] w-[min(14rem,24vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.14)_0%,rgba(167,139,250,0.22)_42%,transparent_68%)] blur-2xl mix-blend-screen" />
        </div>
        <div className="careon-hero-bloom-travel careon-hero-bloom-travel--echo pointer-events-none absolute h-0 w-0" aria-hidden="true">
          <div className="careon-hero-hub-bloom absolute h-[min(12rem,20vw)] w-[min(12rem,20vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(216,180,254,0.28)_0%,rgba(124,58,237,0.1)_45%,transparent_72%)] blur-2xl opacity-90" />
        </div>

        <div
          className="absolute inset-[-16%] bg-[radial-gradient(circle_at_72%_46%,rgba(139,92,246,0.14),transparent_34%),radial-gradient(circle_at_86%_34%,rgba(96,165,250,0.07),transparent_26%),radial-gradient(circle_at_76%_72%,rgba(16,185,129,0.04),transparent_20%)] blur-2xl"
          style={{ animation: "careonHeroAtmosphere 14s ease-in-out infinite alternate" }}
        />

        <div
          className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,8,22,0.98)_0%,rgba(5,8,22,0.92)_12%,rgba(5,8,22,0.58)_26%,rgba(5,8,22,0.18)_46%,transparent_68%),linear-gradient(180deg,rgba(5,8,22,0.64)_0%,transparent_12%,transparent_82%,rgba(5,8,22,0.90)_100%)]"
        />

        {/* Crop ~14% from image bottom (legend strip baked into PNG) — aspect 1536:880 ≈ 0.86 of original height */}
        <div className="relative w-full overflow-hidden" style={{ aspectRatio: "1536 / 880" }}>
          <img
            src="/images/careon-hero-exact.png"
            alt=""
            aria-hidden="true"
            width={1536}
            height={1024}
            className="careon-hero-exact absolute inset-0 h-full w-full max-w-none select-none object-cover object-top opacity-[0.97]"
            style={{
              maskImage: "linear-gradient(90deg, transparent 0%, black 10%, black 90%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(90deg, transparent 0%, black 10%, black 90%, transparent 100%)",
              animation: "careonHeroFloat 18s ease-in-out infinite alternate",
              filter: "saturate(1.02) contrast(1.07) brightness(1.03)",
            }}
            loading="eager"
            decoding="async"
            fetchpriority="high"
            draggable="false"
          />
        </div>

        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_72%_48%,transparent_0%,transparent_42%,rgba(5,8,22,0.02)_62%,rgba(5,8,22,0.14)_82%,rgba(5,8,22,0.55)_100%),linear-gradient(180deg,rgba(5,8,22,0.08)_0%,transparent_18%,transparent_80%,rgba(5,8,22,0.22)_100%)]"
          style={{ animation: "careonHeroVeil 16s ease-in-out infinite alternate" }}
        />

        <div
          className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,8,22,0.55)_0%,rgba(5,8,22,0.18)_18%,transparent_38%,transparent_62%,rgba(5,8,22,0.14)_82%,rgba(5,8,22,0.45)_100%),linear-gradient(118deg,transparent_0%,rgba(255,255,255,0.012)_48%,transparent_60%)] opacity-[0.2] mix-blend-screen"
          style={{ animation: "careonHeroShimmer 18s linear infinite" }}
        />

        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            {/* Invisible geometry only: hero PNG already contains the flow line; pulses follow this route. */}
            <filter id="careonHeroPulseGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="0.55" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="careonHeroPulseGlowSoft" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="0.75" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <path
            id="careon-hero-flow-route"
            d="M 46 50 C 53 47, 61 47, 68 48 C 75 49, 82 47, 89 43"
            fill="none"
            stroke="transparent"
            strokeWidth="1"
          />

          {/* Core hub breathing glow — coords aligned to regie/star in artwork (offset from prior 51,57) */}
          <circle cx="46" cy="50" r="1.35" fill="rgba(196,181,253,0.55)" filter="url(#careonHeroPulseGlowSoft)" opacity="0.5">
            <animate attributeName="r" values="1.1;1.55;1.1" dur="3.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.35;0.72;0.35" dur="3.4s" repeatCount="indefinite" />
          </circle>

          <circle r="0.82" fill="rgba(237,233,254,0.98)" filter="url(#careonHeroPulseGlow)">
            <animateMotion dur="6.8s" repeatCount="indefinite">
              <mpath href="#careon-hero-flow-route" />
            </animateMotion>
            <animate
              attributeName="opacity"
              values="0;0.98;0.98;0"
              keyTimes="0;0.12;0.86;1"
              dur="6.8s"
              repeatCount="indefinite"
            />
          </circle>

          <circle r="0.52" fill="rgba(125,211,252,0.88)" filter="url(#careonHeroPulseGlowSoft)">
            <animateMotion dur="6.8s" begin="2.27s" repeatCount="indefinite">
              <mpath href="#careon-hero-flow-route" />
            </animateMotion>
            <animate
              attributeName="opacity"
              values="0;0.72;0.72;0"
              keyTimes="0;0.14;0.84;1"
              dur="6.8s"
              begin="2.27s"
              repeatCount="indefinite"
            />
          </circle>

          <circle r="0.4" fill="rgba(216,180,254,0.75)" filter="url(#careonHeroPulseGlowSoft)">
            <animateMotion dur="6.8s" begin="4.55s" repeatCount="indefinite">
              <mpath href="#careon-hero-flow-route" />
            </animateMotion>
            <animate
              attributeName="opacity"
              values="0;0.55;0.55;0"
              keyTimes="0;0.16;0.82;1"
              dur="6.8s"
              begin="4.55s"
              repeatCount="indefinite"
            />
          </circle>
        </svg>

        {/* Full-area gradients only (no width-clipped panels) — prevents a vertical compositing line through the artwork. */}
        <div
          className="absolute inset-0 bg-[linear-gradient(270deg,transparent_0%,transparent_42%,rgba(5,8,22,0.08)_72%,rgba(5,8,22,0.32)_100%)]"
          aria-hidden="true"
        />

        <div
          className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,8,22,0.72)_0%,rgba(5,8,22,0.28)_32%,rgba(5,8,22,0.06)_48%,transparent_58%)]"
          aria-hidden="true"
        />

        <div
          className="absolute bottom-[-4%] left-0 right-0 h-[48%] bg-[linear-gradient(180deg,rgba(5,8,22,0)_0%,rgba(5,8,22,0.02)_36%,rgba(5,8,22,0.16)_70%,rgba(5,8,22,0.38)_100%)]"
          aria-hidden="true"
        />
      </div>

      <style>{`
        @keyframes careonHeroFloat {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          100% { transform: translate3d(0.28%, -0.18%, 0) scale(1.006); }
        }

        @keyframes careonHeroAtmosphere {
          0% { opacity: 0.34; transform: translate3d(0, 0, 0) scale(0.98); }
          100% { opacity: 0.62; transform: translate3d(0.6%, -0.4%, 0) scale(1.02); }
        }

        @keyframes careonHeroHubBloom {
          0%, 100% { opacity: 0.42; transform: translate(-50%, -50%) scale(0.94); }
          50% { opacity: 0.88; transform: translate(-50%, -50%) scale(1.06); }
        }

        @keyframes careonHeroHubBloomDelayed {
          0%, 100% { opacity: 0.28; transform: translate(-50%, -50%) scale(1.02); }
          50% { opacity: 0.62; transform: translate(-50%, -50%) scale(1.14); }
        }

        @keyframes careonHeroVeil {
          0% { opacity: 0.82; }
          100% { opacity: 0.94; }
        }

        @keyframes careonHeroShimmer {
          0% { transform: translate3d(-3%, 0, 0); opacity: 0.1; }
          50% { opacity: 0.22; }
          100% { transform: translate3d(4%, 0, 0); opacity: 0.1; }
        }

        /* Bloom pulses (scale/opacity) while parent .careon-hero-bloom-travel moves along the hero flow line */
        .careon-hero-hub-bloom {
          animation: careonHeroHubBloom 3.6s ease-in-out infinite;
        }

        .careon-hero-hub-bloom-delayed {
          animation: careonHeroHubBloomDelayed 4.4s ease-in-out infinite;
          animation-delay: -1.4s;
        }

        .careon-hero-bloom-travel {
          left: 46%;
          top: 50%;
          animation: careonHeroBloomTravel 6.8s ease-in-out infinite;
        }

        .careon-hero-bloom-travel--echo {
          animation: careonHeroBloomTravel 6.8s ease-in-out infinite;
          animation-delay: -2.27s;
        }

        @keyframes careonHeroBloomTravel {
          /* Same route as #careon-hero-flow-route (hub at star, then along main glow line) */
          0%,
          100% {
            left: 46%;
            top: 50%;
          }
          18% {
            left: 59%;
            top: 47%;
          }
          36% {
            left: 69%;
            top: 48%;
          }
          54% {
            left: 79%;
            top: 47%;
          }
          72% {
            left: 86%;
            top: 44%;
          }
          86% {
            left: 89%;
            top: 43%;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .careon-hero-exact {
            animation: none !important;
          }
          .careon-hero-bloom-travel,
          .careon-hero-bloom-travel--echo {
            animation: none !important;
            left: 46% !important;
            top: 50% !important;
          }
          .careon-hero-bloom-travel .careon-hero-hub-bloom,
          .careon-hero-bloom-travel .careon-hero-hub-bloom-delayed,
          .careon-hero-bloom-travel--echo .careon-hero-hub-bloom {
            animation: none !important;
            opacity: 0.55 !important;
            transform: translate(-50%, -50%) scale(1) !important;
          }
        }
      `}</style>
    </>
  );
}
