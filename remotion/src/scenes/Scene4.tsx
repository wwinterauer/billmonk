import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";

const FONT_DISPLAY = "Space Grotesk, Inter, sans-serif";
const FONT_BODY = "Inter, sans-serif";

// Scene 4 — "Pipeline": horizontal flow Beleg → KI → Buchhaltung → Steuerberater
export const Scene4: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const stages = [
    { label: "Beleg", sub: "Foto · Mail · Bank", icon: "📄", color: "#0F172A" },
    { label: "KI-Engine", sub: "Extrahieren · Lernen", icon: "✨", color: "#0E7A6F" },
    { label: "Buchhaltung", sub: "Konten · USt · Skonto", icon: "📊", color: "#0E7A6F" },
    { label: "Steuerberater", sub: "DATEV · BMD · Export", icon: "🤝", color: "#0F172A" },
  ];

  const headerOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });

  // Token traveling across pipeline
  const tokenProgress = interpolate(frame, [25, 95], [0, 1], { extrapolateRight: "clamp" });
  const totalWidth = 1500;
  const tokenX = interpolate(tokenProgress, [0, 1], [-totalWidth / 2 + 100, totalWidth / 2 - 100]);

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", opacity: headerOpacity, marginBottom: 70 }}>
        <div style={{ fontFamily: FONT_BODY, color: "#0E7A6F", fontSize: 16, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase", marginBottom: 16 }}>
          End-to-End
        </div>
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 64, fontWeight: 700, color: "#0F172A", margin: 0, letterSpacing: -1.5 }}>
          Vom Foto bis zum <span style={{ color: "#0E7A6F" }}>Steuerberater-Export</span>.
        </h2>
      </div>

      <div style={{ position: "relative", width: totalWidth, height: 260 }}>
        {/* Connecting line */}
        <div
          style={{
            position: "absolute",
            top: 100,
            left: 120,
            right: 120,
            height: 4,
            background: "#E2E8F0",
            borderRadius: 999,
          }}
        />
        {/* Animated progress line */}
        <div
          style={{
            position: "absolute",
            top: 100,
            left: 120,
            width: `${tokenProgress * (totalWidth - 240)}px`,
            height: 4,
            background: "linear-gradient(90deg, #0E7A6F, #1AB8A6)",
            borderRadius: 999,
            boxShadow: "0 0 16px rgba(14,122,111,0.6)",
          }}
        />

        {/* Traveling token */}
        {tokenProgress > 0 && tokenProgress < 1 && (
          <div
            style={{
              position: "absolute",
              top: 80,
              left: "50%",
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #0E7A6F, #1AB8A6)",
              boxShadow: "0 0 30px rgba(14,122,111,0.8)",
              transform: `translateX(${tokenX}px)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
            }}
          >
            ✨
          </div>
        )}

        {/* Stage nodes */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", height: "100%" }}>
          {stages.map((s, i) => {
            const delay = 15 + i * 10;
            const sp = spring({ frame: frame - delay, fps, config: { damping: 14 } });
            const scale = interpolate(sp, [0, 1], [0.4, 1]);
            const opacity = interpolate(frame, [delay, delay + 18], [0, 1], { extrapolateRight: "clamp" });

            // Glow when token passes through
            const stageMidpoint = i / (stages.length - 1);
            const distance = Math.abs(tokenProgress - stageMidpoint);
            const glow = Math.max(0, 1 - distance * 4);

            return (
              <div key={s.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 240, opacity, transform: `scale(${scale})` }}>
                <div
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 28,
                    background: "#FFFFFF",
                    border: `3px solid ${glow > 0.2 ? "#0E7A6F" : "#E2E8F0"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 44,
                    boxShadow: glow > 0.2 ? `0 0 ${20 + glow * 40}px rgba(14,122,111,${glow * 0.6})` : "0 10px 30px -10px rgba(15,23,42,0.15)",
                    transition: "all 0.2s",
                    marginTop: 52,
                  }}
                >
                  {s.icon}
                </div>
                <div style={{ marginTop: 24, textAlign: "center" }}>
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 700, color: "#0F172A" }}>{s.label}</div>
                  <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: "#64748B", marginTop: 4 }}>{s.sub}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
