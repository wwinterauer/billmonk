import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";

const { fontFamily } = loadFont("normal", { weights: ["300", "400", "600", "700", "800"], subsets: ["latin"] });

const stats = [
  { value: "94%", label: "KI-Genauigkeit" },
  { value: "< 3s", label: "Pro Beleg" },
  { value: "∞", label: "Durchsuchbar" },
];

export const Scene3: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Horizontal scanning line
  const scanX = interpolate(frame, [0, 90], [-200, 2100], { extrapolateRight: "clamp" });
  const scanOp = interpolate(frame, [0, 10, 80, 90], [0, 0.6, 0.6, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ fontFamily }}>
      <AbsoluteFill style={{
        background: "linear-gradient(160deg, #0a2e2e 0%, #0d4a4a 50%, #0a2e2e 100%)",
      }} />

      {/* Animated grid */}
      <AbsoluteFill style={{
        opacity: 0.03,
        backgroundImage: `
          linear-gradient(rgba(45,212,168,1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(45,212,168,1) 1px, transparent 1px)
        `,
        backgroundSize: "80px 80px",
      }} />

      {/* Scanning line */}
      <div style={{
        position: "absolute",
        left: scanX,
        top: 0,
        width: 3,
        height: "100%",
        background: "linear-gradient(180deg, transparent, #2dd4a8, transparent)",
        opacity: scanOp,
        boxShadow: "0 0 40px 20px rgba(45,212,168,0.15)",
      }} />

      {/* Title */}
      {(() => {
        const s = spring({ frame: frame - 10, fps, config: { damping: 18 } });
        return (
          <div style={{
            position: "absolute", left: 120, top: 140,
            opacity: interpolate(s, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(s, [0, 1], [40, 0])}px)`,
          }}>
            <h2 style={{ fontSize: 72, fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>
              KI-Power.
            </h2>
            <h2 style={{ fontSize: 72, fontWeight: 300, color: "#2dd4a8", lineHeight: 1.1 }}>
              Für deine Belege.
            </h2>
          </div>
        );
      })()}

      {/* Stats row */}
      {stats.map((stat, i) => {
        const delay = 30 + i * 15;
        const s = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 100 } });
        const scale = interpolate(s, [0, 1], [0.6, 1]);
        const op = interpolate(s, [0, 1], [0, 1]);

        return (
          <div key={i} style={{
            position: "absolute",
            left: 120 + i * 580,
            bottom: 180,
            opacity: op,
            transform: `scale(${scale})`,
            textAlign: "center",
            width: 480,
          }}>
            <div style={{
              padding: "44px 40px",
              background: "rgba(45,212,168,0.06)",
              borderRadius: 24,
              border: "1px solid rgba(45,212,168,0.15)",
            }}>
              <p style={{
                fontSize: 80, fontWeight: 800, color: "#2dd4a8",
                marginBottom: 8, lineHeight: 1,
              }}>
                {stat.value}
              </p>
              <p style={{
                fontSize: 22, fontWeight: 300, color: "rgba(255,255,255,0.6)",
                letterSpacing: 2, textTransform: "uppercase",
              }}>
                {stat.label}
              </p>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
