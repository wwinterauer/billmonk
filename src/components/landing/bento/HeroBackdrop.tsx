import { useReducedMotion } from 'framer-motion';

/** Slowly rotating conic-gradient mesh + dot grid + noise overlay behind the hero. */
export function HeroBackdrop() {
  const reduced = useReducedMotion();
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* Animated conic mesh */}
      <div
        className="absolute -inset-1/4"
        style={{
          background:
            'conic-gradient(from 0deg at 50% 50%, hsl(var(--primary)/0.18), hsl(var(--accent)/0.14), hsl(var(--primary)/0.10), hsl(var(--warning)/0.08), hsl(var(--primary)/0.18))',
          filter: 'blur(80px)',
          animation: reduced ? undefined : 'mesh-spin 40s linear infinite',
        }}
      />
      {/* Soft hero gradient layer */}
      <div className="absolute inset-0 gradient-hero opacity-90" />
      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />
      {/* SVG noise */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.04] mix-blend-overlay">
        <filter id="hero-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#hero-noise)" />
      </svg>
      <style>{`
        @keyframes mesh-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
