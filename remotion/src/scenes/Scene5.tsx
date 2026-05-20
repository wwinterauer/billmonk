import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";

const FONT_DISPLAY = "Space Grotesk, Inter, sans-serif";
const FONT_BODY = "Inter, sans-serif";

// Scene 5 — "Outro": logo + tagline + subtle teal glow
export const Scene5: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSpring = spring({ frame, fps, config: { damping: 16 } });
  const logoScale = interpolate(logoSpring, [0, 1], [0.7, 1]);
  const logoOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });

  const taglineOpacity = interpolate(frame, [25, 45], [0, 1], { extrapolateRight: "clamp" });
  const taglineY = interpolate(frame, [25, 45], [20, 0], { extrapolateRight: "clamp" });

  const subOpacity = interpolate(frame, [45, 65], [0, 1], { extrapolateRight: "clamp" });

  const pullback = interpolate(frame, [0, 94], [1.04, 1]);

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", transform: `scale(${pullback})` }}>
      {/* Soft radial glow */}
      <div
        style={{
          position: "absolute",
          width: 1200,
          height: 1200,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(14,122,111,0.22) 0%, rgba(14,122,111,0) 60%)",
          opacity: logoOpacity,
        }}
      />

      <div style={{ textAlign: "center", position: "relative" }}>
        {/* Logo mark */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 18,
            opacity: logoOpacity,
            transform: `scale(${logoScale})`,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: 20,
              background: "linear-gradient(135deg, #0E7A6F, #1AB8A6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 44,
              boxShadow: "0 20px 50px -10px rgba(14,122,111,0.5)",
            }}
          >
            🧾
          </div>
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 84, fontWeight: 700, color: "#0F172A", letterSpacing: -2 }}>
            BillMonk
          </span>
        </div>

        <div
          style={{
            opacity: taglineOpacity,
            transform: `translateY(${taglineY}px)`,
            marginTop: 12,
          }}
        >
          <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 56, fontWeight: 700, color: "#0F172A", margin: 0, letterSpacing: -1.5 }}>
            KI-Buchhaltung. <span style={{ color: "#0E7A6F" }}>Made in Austria.</span>
          </h2>
        </div>

        <div
          style={{
            opacity: subOpacity,
            marginTop: 36,
            display: "flex",
            justifyContent: "center",
            gap: 36,
            fontFamily: FONT_BODY,
            color: "#64748B",
            fontSize: 18,
          }}
        >
          <span>🇦🇹 Bad Goisern</span>
          <span>·</span>
          <span>🔒 DSGVO-konform</span>
          <span>·</span>
          <span>⏱ 30 Tage testen</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
