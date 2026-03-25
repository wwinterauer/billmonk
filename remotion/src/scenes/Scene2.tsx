import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";

const { fontFamily } = loadFont("normal", { weights: ["300", "400", "600", "700", "800"], subsets: ["latin"] });

const features = [
  { icon: "📸", title: "Beleg fotografieren", desc: "Einfach abfotografieren oder hochladen" },
  { icon: "🤖", title: "KI erkennt alles", desc: "Betrag, Datum, Händler — automatisch" },
  { icon: "📂", title: "Sofort organisiert", desc: "Kategorisiert und durchsuchbar" },
];

export const Scene2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headlineSpring = spring({ frame: frame - 5, fps, config: { damping: 16, stiffness: 100 } });
  const headlineY = interpolate(headlineSpring, [0, 1], [60, 0]);
  const headlineOp = interpolate(headlineSpring, [0, 1], [0, 1]);

  return (
    <AbsoluteFill style={{ fontFamily }}>
      <AbsoluteFill style={{
        background: "linear-gradient(170deg, #f0fdfa 0%, #e0f7f2 40%, #f8fffe 100%)",
      }} />

      {/* Subtle accent shapes */}
      <div style={{
        position: "absolute", right: -80, top: -80,
        width: 400, height: 400, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(13,128,112,0.06) 0%, transparent 70%)",
      }} />
      <div style={{
        position: "absolute", left: -60, bottom: -60,
        width: 300, height: 300, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(13,128,112,0.04) 0%, transparent 70%)",
      }} />

      {/* Headline */}
      <div style={{
        position: "absolute",
        left: 120, top: 120,
        transform: `translateY(${headlineY}px)`,
        opacity: headlineOp,
      }}>
        <p style={{ fontSize: 22, fontWeight: 400, color: "#0d8070", letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 }}>
          So funktioniert's
        </p>
        <h2 style={{ fontSize: 64, fontWeight: 700, color: "#0a2e2e", lineHeight: 1.1, maxWidth: 700 }}>
          Drei Schritte.{"\n"}
          <span style={{ color: "#0d8070" }}>Null Aufwand.</span>
        </h2>
      </div>

      {/* Feature cards */}
      {features.map((f, i) => {
        const delay = 25 + i * 18;
        const cardSpring = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 120 } });
        const cardY = interpolate(cardSpring, [0, 1], [80, 0]);
        const cardOp = interpolate(cardSpring, [0, 1], [0, 1]);

        return (
          <div key={i} style={{
            position: "absolute",
            left: 120 + i * 560,
            bottom: 140,
            transform: `translateY(${cardY}px)`,
            opacity: cardOp,
            width: 480,
            padding: "48px 40px",
            background: "rgba(255,255,255,0.85)",
            borderRadius: 24,
            border: "1px solid rgba(13,128,112,0.1)",
            boxShadow: "0 20px 60px -15px rgba(10,46,46,0.08)",
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16,
              background: "linear-gradient(135deg, #0d8070, #2dd4a8)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 32, marginBottom: 24,
            }}>
              {f.icon}
            </div>
            <h3 style={{ fontSize: 28, fontWeight: 700, color: "#0a2e2e", marginBottom: 8 }}>{f.title}</h3>
            <p style={{ fontSize: 20, fontWeight: 300, color: "#5a7a7a" }}>{f.desc}</p>

            {/* Step number */}
            <div style={{
              position: "absolute", top: 24, right: 28,
              fontSize: 80, fontWeight: 800, color: "rgba(13,128,112,0.06)",
              lineHeight: 1,
            }}>
              {i + 1}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
