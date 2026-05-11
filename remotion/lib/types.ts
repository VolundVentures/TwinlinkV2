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

export type LetterboxMode = "none" | "2.39:1";

export type AspectRatioId = "16:9" | "9:16" | "1:1" | "21:9" | "4:3" | "3:4";

export type AdCompositionProps = {
  clips: ClipInput[];
  audio?: {
    url: string;
    volume: number;
    startFrame?: number;
    durationFrames?: number;
  };
  backgroundMusic?: {
    url: string;
    volume: number;
  };
  /**
   * Ambient sound bed — the room-tone / location-texture layer that plays
   * under the whole film at ~0.18 volume (below music 0.15… wait, ambient is
   * QUIETER than music because it's texture, not melody). Generated via
   * Runway's eleven_text_to_sound_v2 with the director's soundDesignNote
   * folded in. Optional — many films are intentionally bone-dry.
   */
  ambientSound?: {
    url: string;
    volume: number;
  };
  captions?: CaptionWord[];
  textOverlays?: TextOverlayInput[];
  brandWatermark?: BrandWatermark;
  transition: TransitionType;
  filmGrain?: boolean;
  letterbox?: LetterboxMode;
  fps: number;
  /**
   * Output aspect ratio. Drives width/height via calculateMetadata so a
   * single deployed Remotion site can render every aspect without needing
   * per-aspect Composition IDs (which require re-deploying the S3 site
   * every time we add one — the silent-fallback-to-9:16 bug).
   */
  aspectRatio?: AspectRatioId;
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
