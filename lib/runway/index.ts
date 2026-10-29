// Public API surface for the Runway client. Every generation call in the
// app goes through here.

export { getRunwayClient, RUNWAY_API_VERSION } from "./client";
export { RUNWAY_MODELS, type RunwayModelId } from "./models";
export type { ReferenceImage, RunwayRatio, RunwayTaskResult } from "./types";
export { toSeedanceRatio, toGptImageRatio } from "./ratio-map";

// Image generation + edit (GPT Image 2.5)
export { generateImage, editImage } from "./image";
export type { ImageGenerateInput, ImageEditInput, ImageQuality } from "./image";

// Scenes — Seedance 2.5 (25s, native audio)
export {
  seedanceTextToVideo,
  seedanceImageToVideo,
  seedanceVideoToVideo,
  clampSceneDuration,
  SCENE_DURATION,
  SEEDANCE_MIN_DURATION,
  SEEDANCE_MAX_DURATION,
} from "./video-seedance";
export type {
  SeedanceTextToVideoInput,
  SeedanceImageToVideoInput,
  SeedanceVideoToVideoInput,
} from "./video-seedance";

// Finish — 4K master
export { upscaleVideo } from "./video-upscale";

// Audio (ElevenLabs + seed_audio via Runway)
export { textToSpeech, textToSound, generateScore } from "./audio";

// Uploads
export { uploadEphemeral } from "./uploads";
export type { UploadResult } from "./uploads";
