import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";

const { fontFamily } = loadFont("normal", { weights: ["300", "400", "600", "700", "800"], subsets: ["latin"] });

const features = [
  "DSGVO-konform",
  "Bank-Import",
  "E-Mail Sync",
  "Rechnungen erstellen",
  "Cloud-Backup",
  "Steuer-Export",
];

export const Scene4: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ fontFamily }}>
      <AbsoluteFill style={{
        background: "linear-gradient(170deg, #f0fdfa 0%, #ffffff 100%)",
      }} />

      {/* Large decorative circle */}
      <div style={{
        position: "absolute",
        right: -100, top: -100,
        width: 700, height: 700,
        borderRadius: "50%",
        border: "1px solid rgba(13,128,112,0.08)",
      }} />

      {/* Headline */}
      {(() => {
        const s = spring({ frame: frame - 5, fps, config: { damping: 16 } });
        return (
          <div style={{
            position: "absolute", left: 120, top: 140,
            opacity: interpolate(s, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(s, [0, 1], [40, 0])}px)`,
          }}>
            <h2 style={{ fontSize: 64, fontWeight: 700, color: "#0a2e2e", lineHeight: 1.15 }}>
              Alles was du brauchst.
            </h2>
            <h2 style={{ fontSize: 64, fontWeight: 300, color: "#0d8070", lineHeight: 1.15 }}>
              In einer App.
            </h2>
          </div>
        );
      })()}

      {/* Feature pills */}
      <div style={{
        position: "absolute",
        left: 120, bottom: 160,
        display: "flex",
        flexWrap: "wrap",
        gap: 20,
        maxWidth: 1680,
      }}>
        {features.map((feat, i) => {
          const delay = 20 + i * 10;
          const s = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 140 } });
          const scale = interpolate(s, [0, 1], [0.8, 1]);
          const op = interpolate(s, [0, 1], [0, 1]);

          return (
            <div key={i} style={{
              opacity: op,
              transform: `scale(${scale})`,
              padding: "24px 48px",
              background: i % 2 === 0
                ? "linear-gradient(135deg, #0d8070, #2dd4a8)"
                : "rgba(13,128,112,0.06)",
              borderRadius: 60,
              border: i % 2 === 0 ? "none" : "1px solid rgba(13,128,112,0.15)",
            }}>
              <span style={{
                fontSize: 26,
                fontWeight: i % 2 === 0 ? 600 : 400,
                color: i % 2 === 0 ? "#fff" : "#0a2e2e",
              }}>
                {feat}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
