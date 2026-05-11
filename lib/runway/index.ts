// Public API surface for the Runway client.

export { getRunwayClient, RUNWAY_API_VERSION } from "./client";
export { RUNWAY_MODELS, type RunwayModelId } from "./models";
export type { ReferenceImage, RunwayRatio, RunwayTaskResult } from "./types";
export { toRunwayRatio, toGptImage2Ratio } from "./ratio-map";

// Image generation + edit
export { generateImage, editImage } from "./image";
export type { ImageGenerateInput, ImageEditInput } from "./image";

// Video — Seedance
export { seedanceTextToVideo, seedanceImageToVideo } from "./video-seedance";
export type { SeedanceTextToVideoInput, SeedanceImageToVideoInput } from "./video-seedance";

// Video — Gen-4 family
export { gen4ImageToVideo, gen4TextToVideo } from "./video-gen4";
export type { Gen4ImageToVideoInput, Gen4TextToVideoInput } from "./video-gen4";

// Video — Aleph (5s max)
export { alephCoverage, alephSignaturePass, alephEdit } from "./video-aleph";

// Audio (ElevenLabs via Runway)
export { textToSpeech, textToSound } from "./audio";

// Uploads
export { uploadEphemeral } from "./uploads";
export type { UploadResult } from "./uploads";

// Characters (gwm1_avatars)
export {
  createAvatar,
  createReadySession,
  createCustomVoice,
  pollVoiceReady,
} from "./characters";
export type {
  AvatarVoice,
  CreateAvatarInput,
  CreateSessionInput,
  SessionCredentials,
  CreateCustomVoiceInput,
} from "./characters";
