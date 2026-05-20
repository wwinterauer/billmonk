import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import {
  TransitionSeries,
  linearTiming,
} from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadSpaceGrotesk } from "@remotion/google-fonts/SpaceGrotesk";
import { Scene1 } from "./scenes/Scene1";
import { Scene2 } from "./scenes/Scene2";
import { Scene3 } from "./scenes/Scene3";
import { Scene4 } from "./scenes/Scene4";
import { Scene5 } from "./scenes/Scene5";

loadInter("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] });
loadSpaceGrotesk("normal", { weights: ["500", "600", "700"], subsets: ["latin"] });

const PersistentBackdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const rotate = interpolate(frame, [0, 450], [0, 30]);
  const drift = interpolate(frame, [0, 450], [0, 1]);
  return (
    <AbsoluteFill style={{ background: "#F8FAFC" }}>
      {/* slow drifting teal blob */}
      <div
        style={{
          position: "absolute",
          width: 1400,
          height: 1400,
          left: -300 + drift * 80,
          top: -400 + drift * 40,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(15,148,135,0.18) 0%, rgba(15,148,135,0) 60%)",
          transform: `rotate(${rotate}deg)`,
          filter: "blur(20px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 1200,
          height: 1200,
          right: -200 - drift * 60,
          bottom: -300,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(26,184,166,0.14) 0%, rgba(26,184,166,0) 60%)",
          filter: "blur(20px)",
        }}
      />
      {/* dot grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(15,23,42,0.045) 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />
    </AbsoluteFill>
  );
};

export const MainVideo: React.FC = () => {
  return (
    <AbsoluteFill>
      <PersistentBackdrop />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={90}>
          <Scene1 />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 12 })}
        />
        <TransitionSeries.Sequence durationInFrames={90}>
          <Scene2 />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 12 })}
        />
        <TransitionSeries.Sequence durationInFrames={100}>
          <Scene3 />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 12 })}
        />
        <TransitionSeries.Sequence durationInFrames={100}>
          <Scene4 />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 12 })}
        />
        <TransitionSeries.Sequence durationInFrames={94}>
          <Scene5 />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
