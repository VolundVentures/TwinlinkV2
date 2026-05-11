import React from "react";
import { registerRoot, Composition } from "remotion";
import { AdComposition } from "./compositions/AdComposition";
import { MotionGraphic } from "./compositions/MotionGraphic";
import { calculateAdMetadata, calculateMotionMetadata } from "./lib/calculate-metadata";
import type { AdCompositionProps, MotionGraphicProps } from "./lib/types";

const RemotionRoot: React.FC = () => {
  return (
    <>
      {/*
        Ad Composition — the ONE ad composition. Dimensions are resolved at
        render time from inputProps.aspectRatio via calculateAdMetadata, so
        we don't need per-aspect Composition registrations (which caused the
        silent 9:16 fallback bug when the deployed site was out of sync).

        Declared width/height below are just sane defaults for the Remotion
        Studio preview — calculateAdMetadata overrides at render time.
      */}
      <Composition
        id="AdComposition"
        component={AdComposition}
        calculateMetadata={calculateAdMetadata}
        defaultProps={{
          clips: [],
          transition: "crossfade" as const,
          fps: 30,
          aspectRatio: "16:9" as const,
        } satisfies AdCompositionProps}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={150}
      />

      {/* Motion Graphic — data-driven animations for tech/SaaS */}
      <Composition
        id="MotionGraphic"
        component={MotionGraphic}
        calculateMetadata={calculateMotionMetadata}
        defaultProps={{
          type: "stat_counter" as const,
          title: "Key Metrics",
          stats: [
            { label: "Users", value: 50000, suffix: "+" },
            { label: "Revenue", value: 1250000, prefix: "$" },
          ],
          brandColor: "#1a1a2e",
          accentColor: "#e94560",
          backgroundColor: "#ffffff",
          fontFamily: "Inter",
          fps: 30,
        } satisfies MotionGraphicProps}
        width={1080}
        height={1080}
        fps={30}
        durationInFrames={150}
      />

      {/* Motion Graphic — 9:16 vertical variant */}
      <Composition
        id="MotionGraphic-Vertical"
        component={MotionGraphic}
        calculateMetadata={calculateMotionMetadata}
        defaultProps={{
          type: "stat_counter" as const,
          title: "Key Metrics",
          stats: [],
          brandColor: "#1a1a2e",
          accentColor: "#e94560",
          backgroundColor: "#ffffff",
          fontFamily: "Inter",
          fps: 30,
        } satisfies MotionGraphicProps}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={150}
      />
    </>
  );
};

registerRoot(RemotionRoot);
