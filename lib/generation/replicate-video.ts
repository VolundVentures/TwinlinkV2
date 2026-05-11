import { runModel, MODELS } from "./replicate";
import { trackCost } from "./cost-tracker";

/**
 * Replicate video model wrappers.
 *
 * PRIMARY model: kwaivgi/kling-v3-omni-video (Kling Omni).
 *   - 1080p in 'pro' mode
 *   - Handles human faces (Seedance refuses too often)
 *   - Supports: start_image + end_image (keyframe), reference_images (up to 7),
 *     reference_video (style or editing), multi_prompt (up to 6 shots), negative_prompt
 *   - Aspect ratios: 16:9, 9:16, 1:1 ONLY
 *
 * SECONDARY model: bytedance/seedance-2.0 (face-free b-roll only)
 *   - Only reason to use: user wants 21:9, 4:3, or 3:4 aspect
 *   - Max 720p
 *   - Schema quirk: `image` (first-frame) and `reference_images` are mutually exclusive
 */

export type KlingAspectRatio = "16:9" | "9:16" | "1:1";
export type KlingMode = "standard" | "pro";
export type SeedanceAspectRatio =
  | "16:9"
  | "4:3"
  | "1:1"
  | "3:4"
  | "9:16"
  | "21:9"
  | "adaptive";

export class AspectRatioNotSupported extends Error {
  constructor(aspect: string, model: string) {
    super(`Aspect ratio "${aspect}" is not supported by ${model}. Kling: 16:9 / 9:16 / 1:1. Seedance: 16:9 / 4:3 / 1:1 / 3:4 / 9:16 / 21:9.`);
    this.name = "AspectRatioNotSupported";
  }
}

export class SchemaConflict extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaConflict";
  }
}

// ============================================================================
// Kling Omni — PRIMARY
// ============================================================================

type KlingOmniOutput = string | string[];

export type KlingOmniInput = {
  prompt: string; // up to 2500 chars — BUT write mechanical ≤25-word prompts
  negativePrompt?: string;
  startImageUrl?: string;
  endImageUrl?: string; // requires startImageUrl
  referenceImageUrls?: string[]; // up to 7 (or 4 when combined with reference_video)
  referenceVideoUrl?: string;
  videoReferenceType?: "feature" | "base"; // feature = style transfer, base = editing
  keepOriginalSound?: boolean; // only with reference_video
  multiPrompt?: Array<{ prompt: string; duration?: number }>; // up to 6 shots
  mode?: KlingMode; // default 'pro' (1080p)
  aspectRatio?: KlingAspectRatio; // default 16:9
  durationSeconds?: number; // 3..15, default 5
  generateAudio?: boolean; // default false (mutex with reference_video)
  generationId: string; // for telemetry
  useWebhook?: boolean;
};

export async function klingOmni(
  opts: KlingOmniInput
): Promise<{ predictionId: string; videoUrl: string | null }> {
  // Schema validation
  if (opts.endImageUrl && !opts.startImageUrl) {
    throw new SchemaConflict("end_image requires start_image");
  }
  if (opts.aspectRatio && !["16:9", "9:16", "1:1"].includes(opts.aspectRatio)) {
    throw new AspectRatioNotSupported(opts.aspectRatio, "kling-v3-omni-video");
  }
  if (opts.referenceImageUrls && opts.referenceImageUrls.length > 7) {
    throw new SchemaConflict("Kling Omni allows at most 7 reference_images");
  }
  if (
    opts.referenceVideoUrl &&
    opts.referenceImageUrls &&
    opts.referenceImageUrls.length > 4
  ) {
    throw new SchemaConflict("When reference_video is set, reference_images is capped at 4");
  }
  if (opts.generateAudio && opts.referenceVideoUrl) {
    throw new SchemaConflict("Audio generation cannot be combined with reference_video");
  }

  const input: Record<string, unknown> = {
    prompt: opts.prompt,
    mode: opts.mode || "pro",
    duration: opts.durationSeconds ?? 5,
    aspect_ratio: opts.aspectRatio || "16:9",
  };
  if (opts.negativePrompt) input.negative_prompt = opts.negativePrompt;
  if (opts.startImageUrl) input.start_image = opts.startImageUrl;
  if (opts.endImageUrl) input.end_image = opts.endImageUrl;
  if (opts.referenceImageUrls?.length) input.reference_images = opts.referenceImageUrls;
  if (opts.referenceVideoUrl) {
    input.reference_video = opts.referenceVideoUrl;
    if (opts.videoReferenceType) input.video_reference_type = opts.videoReferenceType;
    if (opts.keepOriginalSound !== undefined)
      input.keep_original_sound = opts.keepOriginalSound;
  }
  if (opts.multiPrompt?.length) input.multi_prompt = JSON.stringify(opts.multiPrompt);
  if (opts.generateAudio) input.generate_audio = true;

  const webhookUrl = opts.useWebhook
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/replicate`
    : undefined;

  const { predictionId, output } = await runModel<KlingOmniOutput>(
    MODELS.KLING_OMNI,
    input,
    { webhookUrl, maxWaitMs: 600_000 }
  );

  const videoUrl = Array.isArray(output) ? output[0] : output;
  // Track only when the prediction completed synchronously. Webhook-mode
  // predictions settle later — the webhook handler records the cost.
  if (videoUrl) {
    const mode = opts.mode || "pro";
    trackCost(
      opts.generationId,
      `${MODELS.KLING_OMNI}-${mode}`,
      opts.durationSeconds ?? 5,
      `Kling Omni ${mode} (${opts.aspectRatio || "16:9"}, ${opts.durationSeconds ?? 5}s)`
    );
  }
  return { predictionId, videoUrl: videoUrl || null };
}

// ============================================================================
// Seedance — SECONDARY (face-free b-roll only, for 21:9 / 4:3 / 3:4)
// ============================================================================

export type SeedanceKeyframeInput = {
  firstFrameUrl: string;
  lastFrameUrl?: string;
  prompt: string;
  aspectRatio?: SeedanceAspectRatio;
  resolution?: "480p" | "720p";
  durationSeconds?: number; // -1..15, default 5 (-1 = intelligent)
  generateAudio?: boolean;
  generationId: string;
  useWebhook?: boolean;
};

export type SeedanceRefInput = {
  referenceImageUrls: string[]; // up to 9 — CANNOT combine with firstFrame
  prompt: string;
  aspectRatio?: SeedanceAspectRatio;
  resolution?: "480p" | "720p";
  durationSeconds?: number;
  generateAudio?: boolean;
  generationId: string;
  useWebhook?: boolean;
};

export async function seedanceKeyframe(
  opts: SeedanceKeyframeInput
): Promise<{ predictionId: string; videoUrl: string | null }> {
  if (opts.lastFrameUrl && !opts.firstFrameUrl) {
    throw new SchemaConflict("last_frame_image requires image (first frame)");
  }

  const input: Record<string, unknown> = {
    prompt: opts.prompt,
    image: opts.firstFrameUrl,
    aspect_ratio: opts.aspectRatio || "16:9",
    resolution: opts.resolution || "720p",
    duration: opts.durationSeconds ?? 5,
    generate_audio: opts.generateAudio !== false, // default true
  };
  if (opts.lastFrameUrl) input.last_frame_image = opts.lastFrameUrl;

  const webhookUrl = opts.useWebhook
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/replicate`
    : undefined;

  const { predictionId, output } = await runModel<string | string[]>(
    MODELS.SEEDANCE,
    input,
    { webhookUrl, maxWaitMs: 600_000 }
  );

  const videoUrl = Array.isArray(output) ? output[0] : output;
  if (videoUrl) {
    const res = opts.resolution || "720p";
    trackCost(
      opts.generationId,
      `${MODELS.SEEDANCE}-${res}`,
      opts.durationSeconds ?? 5,
      `Seedance keyframe I2V (${opts.aspectRatio || "16:9"}, ${res}, ${opts.durationSeconds ?? 5}s)`
    );
  }
  return { predictionId, videoUrl: videoUrl || null };
}

export async function seedanceRef(
  opts: SeedanceRefInput
): Promise<{ predictionId: string; videoUrl: string | null }> {
  if (!opts.referenceImageUrls?.length) {
    throw new SchemaConflict("seedanceRef requires at least one reference image");
  }
  if (opts.referenceImageUrls.length > 9) {
    throw new SchemaConflict("Seedance reference_images is capped at 9");
  }

  const input: Record<string, unknown> = {
    prompt: opts.prompt,
    reference_images: opts.referenceImageUrls,
    aspect_ratio: opts.aspectRatio || "16:9",
    resolution: opts.resolution || "720p",
    duration: opts.durationSeconds ?? 5,
    generate_audio: opts.generateAudio !== false,
  };

  const webhookUrl = opts.useWebhook
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/replicate`
    : undefined;

  const { predictionId, output } = await runModel<string | string[]>(
    MODELS.SEEDANCE,
    input,
    { webhookUrl, maxWaitMs: 600_000 }
  );

  const videoUrl = Array.isArray(output) ? output[0] : output;
  if (videoUrl) {
    const res = opts.resolution || "720p";
    trackCost(
      opts.generationId,
      `${MODELS.SEEDANCE}-${res}`,
      opts.durationSeconds ?? 5,
      `Seedance reference-pack (${opts.referenceImageUrls.length} refs, ${opts.aspectRatio || "16:9"}, ${res}, ${opts.durationSeconds ?? 5}s)`
    );
  }
  return { predictionId, videoUrl: videoUrl || null };
}

// ============================================================================
// Kling O1 — video editing (natural-language edits on an existing clip)
// ============================================================================
//
// Use this to modify a shot that was already rendered — swap subjects,
// environment, wardrobe, restyle — without regenerating from scratch.
// Source clip must be 3–10 seconds, max 200MB, .mp4/.mov/.webm/.m4v/.gif.
// Output length matches input. Pricing: ~$0.168/sec of source.

export type KlingO1Input = {
  videoUrl: string; // source clip (Supabase URL or any public URL)
  prompt: string; // natural-language edit instruction, may reference @tags
  frontalImageUrl?: string; // primary character/element reference
  referenceImageUrls?: string[]; // extra angle references (combined cap ≈ 4)
  keepAudio?: boolean; // default false
  generationId: string;
  useWebhook?: boolean;
};

export async function klingO1Edit(
  opts: KlingO1Input
): Promise<{ predictionId: string; videoUrl: string | null }> {
  if (!opts.videoUrl) {
    throw new SchemaConflict("klingO1Edit requires a source videoUrl");
  }
  if (
    opts.referenceImageUrls &&
    (opts.frontalImageUrl ? opts.referenceImageUrls.length : opts.referenceImageUrls.length) > 4
  ) {
    throw new SchemaConflict("Kling O1 accepts at most 4 reference images total (frontal + extras)");
  }

  const input: Record<string, unknown> = {
    video: opts.videoUrl,
    prompt: opts.prompt,
  };
  if (opts.frontalImageUrl) input.frontal_image_url = opts.frontalImageUrl;
  if (opts.referenceImageUrls?.length) input.reference_image_urls = opts.referenceImageUrls;
  if (opts.keepAudio !== undefined) input.keep_audio = opts.keepAudio;

  const webhookUrl = opts.useWebhook
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/replicate`
    : undefined;

  const { predictionId, output } = await runModel<string | string[]>(
    MODELS.KLING_O1,
    input,
    { webhookUrl, maxWaitMs: 900_000 }
  );

  const videoUrl = Array.isArray(output) ? output[0] : output;
  if (videoUrl) {
    // Kling O1 is billed per source-second. We don't know the source duration
    // here; charge a conservative default of 5s unless the caller passes one.
    // When the webhook handler lands the real duration, it will re-track.
    trackCost(
      opts.generationId,
      MODELS.KLING_O1,
      5,
      `Kling O1 edit (5s source, ${opts.referenceImageUrls?.length || 0} refs)`
    );
  }
  return { predictionId, videoUrl: videoUrl || null };
}

// ============================================================================
// Routing helper
// ============================================================================

/** Decide which model to use based on aspect ratio. Kling is always preferred when it supports the aspect. */
export function pickVideoModel(aspectRatio: string): "kling_omni" | "seedance" {
  if (["16:9", "9:16", "1:1"].includes(aspectRatio)) return "kling_omni";
  return "seedance";
}
