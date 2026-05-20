import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";

const FONT_DISPLAY = "Space Grotesk, Inter, sans-serif";
const FONT_BODY = "Inter, sans-serif";

// Scene 3 — "KI extrahiert": fields appear staggered with confidence bars
export const Scene3: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fields = [
    { label: "Lieferant", value: "Hofer KG", conf: 98 },
    { label: "Datum", value: "14.05.2026", conf: 100 },
    { label: "Netto", value: "€ 152,40", conf: 96 },
    { label: "USt 20 %", value: "€ 30,48", conf: 96 },
    { label: "Brutto", value: "€ 182,88", conf: 99 },
    { label: "Kategorie", value: "Büromaterial", conf: 91 },
    { label: "Steuertyp", value: "Vorsteuer-abzug", conf: 94 },
  ];

  const headerOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const headerY = interpolate(frame, [0, 18], [20, 0], { extrapolateRight: "clamp" });

  // Brain pulse
  const pulse = interpolate(frame % 60, [0, 30, 60], [1, 1.08, 1]);

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 100 }}>
      <div style={{ textAlign: "center", opacity: headerOpacity, transform: `translateY(${headerY}px)`, marginBottom: 50 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 22px",
            background: "rgba(15,148,135,0.1)",
            borderRadius: 999,
            marginBottom: 20,
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#0E7A6F",
              transform: `scale(${pulse})`,
              boxShadow: "0 0 16px rgba(14,122,111,0.6)",
            }}
          />
          <span style={{ fontFamily: FONT_BODY, fontWeight: 700, color: "#0E7A6F", letterSpacing: 2, fontSize: 14, textTransform: "uppercase" }}>
            KI analysiert · 3 Sekunden
          </span>
        </div>
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 64, fontWeight: 700, color: "#0F172A", margin: 0, letterSpacing: -1.5 }}>
          Felder erkannt. <span style={{ color: "#0E7A6F" }}>94 % Genauigkeit.</span>
        </h2>
      </div>

      <div
        style={{
          width: 880,
          background: "#FFFFFF",
          borderRadius: 24,
          padding: 36,
          boxShadow: "0 40px 80px -20px rgba(15,23,42,0.18)",
          border: "1px solid #E2E8F0",
        }}
      >
        {fields.map((f, i) => {
          const delay = 20 + i * 8;
          const s = spring({ frame: frame - delay, fps, config: { damping: 18 } });
          const x = interpolate(s, [0, 1], [-30, 0]);
          const opacity = interpolate(frame, [delay, delay + 12], [0, 1], { extrapolateRight: "clamp" });
          const barProgress = interpolate(frame, [delay + 6, delay + 24], [0, f.conf / 100], { extrapolateRight: "clamp" });
          return (
            <div
              key={f.label}
              style={{
                display: "grid",
                gridTemplateColumns: "200px 1fr 220px 60px",
                alignItems: "center",
                gap: 24,
                padding: "16px 0",
                borderBottom: i < fields.length - 1 ? "1px solid #F1F5F9" : "none",
                opacity,
                transform: `translateX(${x}px)`,
              }}
            >
              <span style={{ fontFamily: FONT_BODY, color: "#64748B", fontSize: 18 }}>{f.label}</span>
              <span style={{ fontFamily: FONT_BODY, color: "#0F172A", fontSize: 20, fontWeight: 600 }}>{f.value}</span>
              <div style={{ height: 8, background: "#F1F5F9", borderRadius: 999, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${barProgress * 100}%`,
                    background: "linear-gradient(90deg, #0E7A6F, #1AB8A6)",
                    borderRadius: 999,
                  }}
                />
              </div>
              <span style={{ fontFamily: FONT_BODY, color: "#0E7A6F", fontSize: 16, fontWeight: 700, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {Math.round(barProgress * 100)}%
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
