import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";

const FONT_DISPLAY = "Space Grotesk, Inter, sans-serif";
const FONT_BODY = "Inter, sans-serif";

// Scene 2 — "Capture": single receipt scanned by teal laser line
export const Scene2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const receiptSpring = spring({ frame, fps, config: { damping: 16 } });
  const receiptY = interpolate(receiptSpring, [0, 1], [60, 0]);
  const receiptOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });

  // Scan line travels top → bottom from frame 20 to 60
  const scanProgress = interpolate(frame, [20, 65], [0, 1], { extrapolateRight: "clamp" });
  const scanY = interpolate(scanProgress, [0, 1], [0, 540]);
  const scanOpacity = interpolate(frame, [20, 25, 60, 68], [0, 1, 1, 0]);

  // Card flies in after scan
  const cardSpring = spring({ frame: frame - 55, fps, config: { damping: 14 } });
  const cardX = interpolate(cardSpring, [0, 1], [120, 0]);
  const cardOpacity = interpolate(frame, [55, 75], [0, 1], { extrapolateRight: "clamp" });

  const labelOpacity = interpolate(frame, [10, 24], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: labelOpacity,
        }}
      >
        <div
          style={{
            fontFamily: FONT_BODY,
            color: "#0E7A6F",
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: 4,
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          Schritt 1 · Capture
        </div>
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 56, fontWeight: 700, color: "#0F172A", margin: 0, letterSpacing: -1 }}>
          Foto. Mail. Drop. <span style={{ color: "#0E7A6F" }}>Fertig.</span>
        </h2>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 80, marginTop: 60 }}>
        {/* Receipt with scan line */}
        <div
          style={{
            position: "relative",
            width: 380,
            height: 540,
            background: "#FFFFFF",
            borderRadius: 8,
            boxShadow: "0 30px 60px -15px rgba(15,23,42,0.3)",
            transform: `translateY(${receiptY}px) rotate(-4deg)`,
            opacity: receiptOpacity,
            overflow: "hidden",
            padding: 28,
            fontFamily: "monospace",
            fontSize: 11,
            color: "#475569",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 16, color: "#0F172A", marginBottom: 4 }}>BILLA</div>
          <div style={{ fontSize: 10, color: "#94A3B8", marginBottom: 16 }}>Hauptstraße 12 · 4822 Bad Goisern</div>
          <div style={{ borderTop: "1px dashed #CBD5E1", borderBottom: "1px dashed #CBD5E1", padding: "12px 0", marginBottom: 12 }}>
            {["Milch 1L", "Brot Vollkorn", "Eier 10er", "Käse Bergland", "Apfel 1kg", "Bananen", "Joghurt 4×"].map((p, i) => (
              <div key={p} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span>{p}</span>
                <span>€ {(1.5 + i * 0.7).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, color: "#0F172A" }}>
            <span>SUMME</span>
            <span>€ 47,32</span>
          </div>
          <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 8 }}>MwSt 10 %: € 3,12 · MwSt 20 %: € 4,89</div>
          <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 16 }}>14.05.2026 · 17:42 · DANKE FÜR IHREN EINKAUF</div>

          {/* scan line */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: scanY,
              height: 3,
              background: "linear-gradient(90deg, transparent, #0E7A6F, transparent)",
              boxShadow: "0 0 20px rgba(14,122,111,0.8), 0 0 40px rgba(14,122,111,0.5)",
              opacity: scanOpacity,
            }}
          />
          {/* scanned overlay */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              height: scanY,
              background: "rgba(14,122,111,0.08)",
              opacity: scanOpacity,
            }}
          />
        </div>

        {/* Result card */}
        <div
          style={{
            width: 340,
            background: "#FFFFFF",
            borderRadius: 16,
            padding: 28,
            boxShadow: "0 30px 60px -15px rgba(15,23,42,0.2)",
            transform: `translateX(${cardX}px)`,
            opacity: cardOpacity,
            border: "1px solid #E2E8F0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22C55E" }} />
            <span style={{ fontFamily: FONT_BODY, fontSize: 12, fontWeight: 600, color: "#22C55E", textTransform: "uppercase", letterSpacing: 1 }}>
              Erkannt
            </span>
          </div>
          {[
            ["Lieferant", "BILLA"],
            ["Datum", "14.05.2026"],
            ["Netto", "€ 39,31"],
            ["USt 10 %", "€ 3,12"],
            ["USt 20 %", "€ 4,89"],
            ["Brutto", "€ 47,32"],
            ["Kategorie", "Lebensmittel"],
          ].map(([k, v], i) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: i < 6 ? "1px solid #F1F5F9" : "none", fontFamily: FONT_BODY }}>
              <span style={{ color: "#64748B", fontSize: 14 }}>{k}</span>
              <span style={{ color: "#0F172A", fontSize: 14, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
