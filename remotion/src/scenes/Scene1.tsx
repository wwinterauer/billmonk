import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";

const { fontFamily } = loadFont("normal", { weights: ["300", "400", "600", "700", "800"], subsets: ["latin"] });

export const Scene1: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Background pulse
  const bgScale = interpolate(frame, [0, 120], [1.05, 1], { extrapolateRight: "clamp" });

  // Logo entrance — spring up from below
  const logoSpring = spring({ frame: frame - 10, fps, config: { damping: 14, stiffness: 120 } });
  const logoY = interpolate(logoSpring, [0, 1], [80, 0]);
  const logoOpacity = interpolate(logoSpring, [0, 1], [0, 1]);
  const logoScale = interpolate(logoSpring, [0, 1], [0.7, 1]);

  // Tagline reveal
  const tagSpring = spring({ frame: frame - 40, fps, config: { damping: 18, stiffness: 100 } });
  const tagY = interpolate(tagSpring, [0, 1], [40, 0]);
  const tagOpacity = interpolate(tagSpring, [0, 1], [0, 1]);

  // Subtle floating particles
  const particles = Array.from({ length: 12 }, (_, i) => {
    const x = 15 + (i * 7) % 85;
    const baseY = 10 + (i * 11) % 80;
    const drift = Math.sin((frame + i * 30) / 40) * 15;
    const opacity = interpolate(frame, [0, 30], [0, 0.15 + (i % 3) * 0.05], { extrapolateRight: "clamp" });
    const size = 3 + (i % 4) * 2;
    return { x, y: baseY + drift, opacity, size };
  });

  // Accent line reveal
  const lineWidth = interpolate(
    spring({ frame: frame - 55, fps, config: { damping: 20 } }),
    [0, 1], [0, 200]
  );

  return (
    <AbsoluteFill style={{ fontFamily }}>
      {/* Deep teal gradient background */}
      <AbsoluteFill style={{
        background: "linear-gradient(155deg, #0a2e2e 0%, #0d3d3d 30%, #115454 60%, #0a2e2e 100%)",
        transform: `scale(${bgScale})`,
      }} />

      {/* Grid pattern overlay */}
      <AbsoluteFill style={{
        opacity: 0.04,
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)
        `,
        backgroundSize: "60px 60px",
      }} />

      {/* Floating particles */}
      {particles.map((p, i) => (
        <div key={i} style={{
          position: "absolute",
          left: `${p.x}%`,
          top: `${p.y}%`,
          width: p.size,
          height: p.size,
          borderRadius: "50%",
          background: "#2dd4a8",
          opacity: p.opacity,
          filter: "blur(1px)",
        }} />
      ))}

      {/* Radial glow behind logo */}
      <div style={{
        position: "absolute",
        left: "50%",
        top: "42%",
        transform: "translate(-50%, -50%)",
        width: 600,
        height: 600,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(45,212,168,0.12) 0%, transparent 70%)",
        opacity: logoOpacity,
      }} />

      {/* Logo */}
      <div style={{
        position: "absolute",
        left: "50%",
        top: "38%",
        transform: `translate(-50%, -50%) translateY(${logoY}px) scale(${logoScale})`,
        opacity: logoOpacity,
      }}>
        <Img src={staticFile("images/logo-white.png")} style={{ height: 100 }} />
      </div>

      {/* Accent line */}
      <div style={{
        position: "absolute",
        left: "50%",
        top: "52%",
        transform: "translateX(-50%)",
        width: lineWidth,
        height: 2,
        background: "linear-gradient(90deg, transparent, #2dd4a8, transparent)",
      }} />

      {/* Tagline */}
      <div style={{
        position: "absolute",
        left: "50%",
        top: "58%",
        transform: `translate(-50%, -50%) translateY(${tagY}px)`,
        opacity: tagOpacity,
        textAlign: "center",
      }}>
        <p style={{
          fontSize: 28,
          fontWeight: 300,
          color: "rgba(255,255,255,0.7)",
          letterSpacing: 6,
          textTransform: "uppercase",
        }}>
          Belege. Intelligent. Organisiert.
        </p>
      </div>
    </AbsoluteFill>
  );
};
