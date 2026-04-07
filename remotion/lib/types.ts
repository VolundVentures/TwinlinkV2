/**
 * Shared types between Next.js application and Remotion compositions.
 */

export type ClipInput = {
  url: string;
  type: "video" | "image";
  durationFrames: number;
  label: string;
  hasOwnAudio: boolean; // true for clips with native audio (ambient SFX, lipsync)
  isLipsync?: boolean; // true ONLY for lipsync/avatar clips — plays at full volume and mutes voiceover
};

export type TextOverlayInput = {
  text: string;
  position: "top" | "center" | "bottom";
  startFrame: number;
  endFrame: number;
  style: {
    fontSize: number;
    color: string;
    fontFamily: string;
    fontWeight: string;
    backgroundColor?: string;
    padding?: number;
    borderRadius?: number;
  };
};

export type CaptionWord = {
  word: string;
  startMs: number;
  endMs: number;
};

export type BrandWatermark = {
  text: string;
  logoUrl?: string;
  color: string;
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
};

export type TransitionType = "cut" | "crossfade" | "fade_to_black";

export type AdCompositionProps = {
  clips: ClipInput[];
  audio?: {
    url: string;
    volume: number;
    startFrame?: number;
    durationFrames?: number; // Actual VO duration — used to prevent black screen at end
  };
  backgroundMusic?: {
    url: string;
    volume: number;
  };
  captions?: CaptionWord[];
  textOverlays?: TextOverlayInput[];
  brandWatermark?: BrandWatermark;
  transition: TransitionType;
  filmGrain?: boolean;
  fps: number;
};

// Motion graphic types
export type StatItem = {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  color?: string;
};

export type FeatureItem = {
  title: string;
  description: string;
  icon?: string;
};

export type MotionGraphicProps = {
  type:
    | "stat_counter"
    | "feature_highlight"
    | "kinetic_type"
    | "product_launch"
    | "pitch_deck";
  title: string;
  subtitle?: string;
  stats?: StatItem[];
  features?: FeatureItem[];
  textLines?: string[];
  brandColor: string;
  accentColor: string;
  backgroundColor: string;
  fontFamily: string;
  fps: number;
};
