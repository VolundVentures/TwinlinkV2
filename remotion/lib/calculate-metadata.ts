import type { CalculateMetadataFunction } from "remotion";
import type { AdCompositionProps, AspectRatioId, MotionGraphicProps } from "./types";

// Canonical dimensions per aspect ratio. All render at the same vertical
// 1080-line budget so Remotion Lambda's per-frame cost stays comparable.
// 16:9 and 21:9 get 1920/2520 width respectively (common cinema deliverables).
const ASPECT_DIMENSIONS: Record<AspectRatioId, { width: number; height: number }> = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "21:9": { width: 2520, height: 1080 },
  "4:3": { width: 1440, height: 1080 },
  "3:4": { width: 1080, height: 1440 },
};

/**
 * Dynamically calculate duration AND dimensions based on inputProps.aspectRatio.
 *
 * This is the fix for the "final cut renders in 9:16 even when user picked
 * 16:9" bug. Previously we had six separate <Composition> registrations
 * (AdComposition-Landscape, -Square, -Cinema, -Classic, -Portrait, +
 * default AdComposition at 1080×1920). The S3-deployed Remotion site
 * can fall out of sync with these, and any lookup miss silently falls
 * back to the default 9:16 composition.
 *
 * Returning width/height from calculateMetadata overrides the declared
 * Composition dimensions, so ONE deployed composition (AdComposition)
 * handles every aspect ratio. No more per-aspect compositions. No more
 * silent 9:16 fallback.
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
  const totalFrames = clipFrames;

  if (voDurationFrames > 0 && voDurationFrames > clipFrames) {
    console.warn(
      `[calculate-metadata] VO (${voDurationFrames} frames) is longer than clips (${clipFrames} frames). ` +
      `Video will end at clip boundary — VO will be trimmed. Consider adding more clips or shortening VO.`
    );
  }

  const aspect = props.aspectRatio;
  const dims = aspect && ASPECT_DIMENSIONS[aspect];
  if (!dims) {
    // No aspect passed — fall back to whatever the Composition declared.
    return {
      durationInFrames: Math.max(totalFrames, 30),
      fps,
    };
  }
  return {
    durationInFrames: Math.max(totalFrames, 30),
    fps,
    width: dims.width,
    height: dims.height,
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
  };
};
