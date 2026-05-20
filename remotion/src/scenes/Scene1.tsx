import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";

const FONT_DISPLAY = "Space Grotesk, Inter, sans-serif";
const FONT_BODY = "Inter, sans-serif";

// Scene 1 — "Der Schmerz": chaotic stack of paper receipts falling in
export const Scene1: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const receipts = [
    { x: -280, y: -120, rot: -18, delay: 0, w: 240, h: 320 },
    { x: -80, y: -160, rot: 8, delay: 4, w: 220, h: 290 },
    { x: 160, y: -140, rot: 22, delay: 8, w: 250, h: 310 },
    { x: -200, y: 60, rot: -28, delay: 12, w: 230, h: 300 },
    { x: 60, y: 80, rot: 14, delay: 16, w: 260, h: 330 },
    { x: 280, y: 40, rot: -10, delay: 20, w: 210, h: 280 },
    { x: -340, y: 180, rot: 32, delay: 24, w: 220, h: 290 },
    { x: 200, y: 220, rot: -22, delay: 28, w: 240, h: 310 },
  ];

  const headlineSpring = spring({ frame: frame - 36, fps, config: { damping: 18 } });
  const headlineY = interpolate(headlineSpring, [0, 1], [30, 0]);
  const headlineOpacity = interpolate(frame, [36, 60], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      {/* Receipt pile */}
      <div style={{ position: "relative", width: 0, height: 0 }}>
        {receipts.map((r, i) => {
          const s = spring({ frame: frame - r.delay, fps, config: { damping: 14, stiffness: 90 } });
          const y = interpolate(s, [0, 1], [-900, r.y]);
          const opacity = interpolate(frame, [r.delay, r.delay + 10], [0, 1], { extrapolateRight: "clamp" });
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: r.x - r.w / 2,
                top: y - r.h / 2,
                width: r.w,
                height: r.h,
                transform: `rotate(${r.rot}deg)`,
                background: "#FFFFFF",
                borderRadius: 6,
                boxShadow: "0 20px 40px -10px rgba(15,23,42,0.25), 0 8px 16px -8px rgba(15,23,42,0.15)",
                opacity,
                padding: 18,
                fontFamily: "monospace",
                fontSize: 10,
                color: "#94A3B8",
                lineHeight: 1.6,
              }}
            >
              <div style={{ borderBottom: "1px dashed #CBD5E1", paddingBottom: 6, marginBottom: 8, fontWeight: 700, color: "#475569" }}>
                RECHNUNG
              </div>
              {Array.from({ length: 8 }).map((_, k) => (
                <div key={k} style={{ height: 6, background: "#E2E8F0", marginBottom: 6, borderRadius: 2, width: `${60 + ((i * 7 + k * 11) % 35)}%` }} />
              ))}
              <div style={{ marginTop: 12, fontWeight: 700, color: "#0F172A", fontSize: 14 }}>
                € {(20 + ((i * 31) % 180)).toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Headline */}
      <div
        style={{
          position: "absolute",
          bottom: 120,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: headlineOpacity,
          transform: `translateY(${headlineY}px)`,
        }}
      >
        <div
          style={{
            display: "inline-block",
            padding: "10px 20px",
            background: "rgba(15,148,135,0.1)",
            color: "#0E7A6F",
            borderRadius: 999,
            fontFamily: FONT_BODY,
            fontSize: 18,
            fontWeight: 600,
            marginBottom: 24,
            letterSpacing: 0.5,
          }}
        >
          Kennst du das?
        </div>
        <h1
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 96,
            fontWeight: 700,
            color: "#0F172A",
            margin: 0,
            letterSpacing: -2,
            lineHeight: 1.02,
          }}
        >
          Schluss mit dem <span style={{ color: "#0E7A6F" }}>Schuhkarton</span>.
        </h1>
      </div>
    </AbsoluteFill>
  );
};
