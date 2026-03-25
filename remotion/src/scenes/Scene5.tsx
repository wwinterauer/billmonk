import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";

const { fontFamily } = loadFont("normal", { weights: ["300", "400", "600", "700", "800"], subsets: ["latin"] });

export const Scene5: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo entrance
  const logoS = spring({ frame: frame - 10, fps, config: { damping: 12 } });
  const logoScale = interpolate(logoS, [0, 1], [0.5, 1]);
  const logoOp = interpolate(logoS, [0, 1], [0, 1]);

  // CTA text
  const ctaS = spring({ frame: frame - 35, fps, config: { damping: 16 } });
  const ctaY = interpolate(ctaS, [0, 1], [50, 0]);
  const ctaOp = interpolate(ctaS, [0, 1], [0, 1]);

  // Button
  const btnS = spring({ frame: frame - 55, fps, config: { damping: 14, stiffness: 80 } });
  const btnScale = interpolate(btnS, [0, 1], [0.8, 1]);
  const btnOp = interpolate(btnS, [0, 1], [0, 1]);

  // Pulsing ring around logo
  const ringScale = interpolate(frame, [0, 120], [0.9, 1.1], { extrapolateRight: "clamp" });
  const ringOp = 0.08 + Math.sin(frame / 20) * 0.04;

  // Floating particles
  const particles = Array.from({ length: 20 }, (_, i) => {
    const angle = (i / 20) * Math.PI * 2 + frame / 80;
    const radius = 280 + Math.sin(frame / 30 + i) * 40;
    const x = 960 + Math.cos(angle) * radius;
    const y = 440 + Math.sin(angle) * radius;
    const op = 0.1 + Math.sin(frame / 15 + i * 2) * 0.06;
    const size = 3 + (i % 3) * 2;
    return { x, y, op, size };
  });

  return (
    <AbsoluteFill style={{ fontFamily }}>
      <AbsoluteFill style={{
        background: "linear-gradient(155deg, #0a2e2e 0%, #0d4a4a 40%, #0a2e2e 100%)",
      }} />

      {/* Orbiting particles */}
      {particles.map((p, i) => (
        <div key={i} style={{
          position: "absolute",
          left: p.x, top: p.y,
          width: p.size, height: p.size,
          borderRadius: "50%",
          background: "#2dd4a8",
          opacity: p.op,
        }} />
      ))}

      {/* Ring */}
      <div style={{
        position: "absolute",
        left: "50%", top: "40%",
        transform: `translate(-50%, -50%) scale(${ringScale})`,
        width: 300, height: 300,
        borderRadius: "50%",
        border: "1px solid rgba(45,212,168,0.2)",
        opacity: ringOp,
      }} />

      {/* Logo */}
      <div style={{
        position: "absolute",
        left: "50%", top: "38%",
        transform: `translate(-50%, -50%) scale(${logoScale})`,
        opacity: logoOp,
      }}>
        <Img src={staticFile("images/logo-white.png")} style={{ height: 90 }} />
      </div>

      {/* CTA text */}
      <div style={{
        position: "absolute",
        left: "50%", top: "58%",
        transform: `translate(-50%, -50%) translateY(${ctaY}px)`,
        opacity: ctaOp,
        textAlign: "center",
      }}>
        <h2 style={{ fontSize: 56, fontWeight: 700, color: "#fff", marginBottom: 12 }}>
          Jetzt kostenlos starten.
        </h2>
        <p style={{ fontSize: 24, fontWeight: 300, color: "rgba(255,255,255,0.5)" }}>
          billmonk.lovable.app
        </p>
      </div>

      {/* Button */}
      <div style={{
        position: "absolute",
        left: "50%", top: "74%",
        transform: `translate(-50%, -50%) scale(${btnScale})`,
        opacity: btnOp,
      }}>
        <div style={{
          padding: "22px 64px",
          background: "linear-gradient(135deg, #0d8070, #2dd4a8)",
          borderRadius: 60,
          boxShadow: "0 15px 50px -10px rgba(45,212,168,0.35)",
        }}>
          <span style={{ fontSize: 26, fontWeight: 600, color: "#fff" }}>
            Kostenlos testen →
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
