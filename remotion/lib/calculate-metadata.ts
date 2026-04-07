import type { CalculateMetadataFunction } from "remotion";
import type { AdCompositionProps, MotionGraphicProps } from "./types";

/**
 * Dynamically calculate duration and dimensions based on inputProps.
 */
export const calculateAdMetadata: CalculateMetadataFunction<
  AdCompositionProps
> = ({ props }) => {
  const fps = props.fps || 30;
  const rawClipFrames = props.clips.reduce(
    (sum, clip) => sum + clip.durationFrames,
    0
  );

  // Account for transition overlap — crossfade transitions reduce total duration
  const transitionDuration = props.transition === "cut" ? 0 : Math.round(fps * 0.5);
  const overlapFrames = Math.max(0, props.clips.length - 1) * transitionDuration;
  const clipFrames = rawClipFrames - overlapFrames;

  const voDurationFrames = props.audio?.durationFrames ?? 0;
  // Composition should match clip duration exactly — never extend beyond clips
  const totalFrames = clipFrames;

  if (voDurationFrames > 0 && voDurationFrames > clipFrames) {
    console.warn(
      `[calculate-metadata] VO (${voDurationFrames} frames) is longer than clips (${clipFrames} frames). ` +
      `Video will end at clip boundary — VO will be trimmed. Consider adding more clips or shortening VO.`
    );
  }

  return {
    durationInFrames: Math.max(totalFrames, 30), // minimum 1 second at 30fps
    fps,
    width: 1080,
    height: 1920,
  };
};

export const calculateMotionMetadata: CalculateMetadataFunction<
  MotionGraphicProps
> = ({ props }) => {
  // Default durations per type
  const durationMap: Record<string, number> = {
    stat_counter: 5, // seconds
    feature_highlight: 8,
    kinetic_type: 6,
    product_launch: 10,
    pitch_deck: 15,
  };

  const fps = props.fps || 30;
  const durationSeconds = durationMap[props.type] || 8;

  return {
    durationInFrames: durationSeconds * fps,
    fps,
    width: 1080,
    height: 1080, // Default 1:1, override via render params
  };
};
