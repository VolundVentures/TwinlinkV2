// gpt_image_2 + gen4_image wrappers.
//
// Two responsibilities:
//   1. Text-to-image generation with optional reference images (character bibles,
//      storyboards, location plates, lookbook tiles).
//   2. Edit-with-input-images — pass an existing image as `input_images` plus
//      an instruction to alter it (port of TwinLink's edit_plate). gpt_image_2
//      supports an optional alpha mask: transparent regions = edit zone.
//
// Resolutions: WIDTHxHEIGHT, both divisible by 16, ratio 1:3 to 3:1.

import { trackCost } from "../generation/cost-tracker";
import { getRunwayClient } from "./client";
import { withSlot } from "./rate-limit";
import { RUNWAY_MODELS, type RunwayModelId } from "./models";
import type { ReferenceImage, RunwayTaskResult } from "./types";

// THROTTLED retry — Runway's account-level queue can THROTTLE a task before
// it ever starts. The SDK's `waitForTaskOutput()` surfaces this as a
// TaskTimedOutError with `taskDetails.status === 'THROTTLED'`. The right
// response is to wait and re-create the task — the failure is upstream
// rate-limit, not a content problem. We back off exponentially up to 3 tries.
function isThrottled(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as {
    name?: string;
    taskDetails?: { status?: string };
    message?: string;
  };
  if (e.taskDetails?.status === "THROTTLED") return true;
  if (e.name === "TaskTimedOutError" && /throttle/i.test(e.message || "")) {
    return true;
  }
  return false;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function withThrottleRetry<T = any>(
  fn: () => Promise<T>,
  label: string,
  maxAttempts = 3
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isThrottled(err) || attempt === maxAttempts) throw err;
      const backoffMs = 4_000 * Math.pow(2, attempt - 1) + Math.random() * 2_000;
      console.warn(
        `[runway/image] ${label} THROTTLED — attempt ${attempt}/${maxAttempts}, backing off ${Math.round(backoffMs / 1000)}s`
      );
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  throw lastErr;
}

export type ImageGenerateInput = {
  /** Free-text prompt. Reference images can be addressed by `@tag`. */
  promptText: string;
  /** Optional reference images. gpt_image_2: up to 10. gen4_image: up to 3. */
  references?: ReferenceImage[];
  /**
   * Aspect ratio as a Runway pixel-pair string. Note: gpt_image_2 has a
   * different valid ratio enum than video models (minimum 1920px on short
   * side). Use `toGptImage2Ratio()` from `lib/runway/ratio-map.ts` to map
   * a TwinLink aspect ratio (16:9, 1:1, etc.) to a gpt_image_2-legal pair.
   */
  ratio?: string;
  /** Override the default model (gpt_image_2). */
  model?: RunwayModelId;
  /** Generation ID for cost tracking. Pass "" to skip (e.g. spike scripts). */
  generationId: string;
  /** Human-readable description for the cost log. */
  description: string;
};

function costKeyForImage(model: RunwayModelId, ratio: string): string {
  // 1080p costs more for gpt_image_2 / gen4_image; otherwise same key.
  const isHd = /1080|1920/.test(ratio);
  if (model === RUNWAY_MODELS.GPT_IMAGE_2)
    return isHd ? "runway/gpt_image_2_hd" : "runway/gpt_image_2";
  if (model === RUNWAY_MODELS.GEN4_IMAGE)
    return isHd ? "runway/gen4_image_hd" : "runway/gen4_image";
  return `runway/${model}`;
}

export async function generateImage(
  input: ImageGenerateInput
): Promise<RunwayTaskResult<string[]>> {
  return withSlot(async () => {
    const client = getRunwayClient();
    const model = input.model ?? RUNWAY_MODELS.GPT_IMAGE_2;
    const ratio = input.ratio ?? "1280:720";

    const params: Record<string, unknown> = {
      model,
      promptText: input.promptText,
      ratio,
    };

    if (input.references && input.references.length > 0) {
      params.referenceImages = input.references.map((r) => ({
        uri: r.uri,
        ...(r.tag ? { tag: r.tag } : {}),
      }));
    }

    const task = await withThrottleRetry(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => (client as any).textToImage.create(params).waitForTaskOutput(),
      `generateImage(${model}) ${input.description.slice(0, 40)}`
    );

    if (input.generationId) {
      const outputs = Array.isArray(task.output) ? task.output.length : 1;
      trackCost(input.generationId, costKeyForImage(model, ratio), outputs, input.description);
    }
    return { taskId: task.id, output: task.output };
  });
}

export type ImageEditInput = {
  /** Edit instruction. */
  promptText: string;
  /** Source images to edit / compose from. The first is treated as the primary canvas. */
  inputImages: ReferenceImage[];
  /** Output ratio — usually matches the source. Use toGptImage2Ratio() for gpt_image_2. */
  ratio?: string;
  /**
   * Optional alpha-mask URI applied to inputImages[0]. Transparent regions
   * mark where edits may happen; opaque regions are preserved bit-identical.
   * Used for surgical changes (e.g. character identity swap with locked
   * background).
   */
  maskUri?: string;
  model?: RunwayModelId;
  generationId: string;
  description: string;
};

/**
 * Edit-with-input-images via gpt_image_2. Used for the Frame Anchor pipeline's
 * step 3 (swap character identity into a Seedance first frame) and for the
 * ported `edit_plate` flow (apply edits to existing plates / bibles).
 */
export async function editImage(
  input: ImageEditInput
): Promise<RunwayTaskResult<string[]>> {
  return withSlot(async () => {
    const client = getRunwayClient();
    const model = input.model ?? RUNWAY_MODELS.GPT_IMAGE_2;
    const ratio = input.ratio ?? "1280:720";

    // Runway gpt_image_2 uses `referenceImages` for BOTH generate-with-refs
    // and edit-with-input-images — same wire key, same API endpoint
    // (textToImage). Sending `inputImages` returns 400 "unrecognized key".
    // The internal type stays `inputImages` because semantically these are
    // edit sources, not just refs; we map at the boundary.
    const params: Record<string, unknown> = {
      model,
      promptText: input.promptText,
      ratio,
      referenceImages: input.inputImages.map((r) => ({
        uri: r.uri,
        ...(r.tag ? { tag: r.tag } : {}),
      })),
    };
    if (input.maskUri) params.mask = input.maskUri;

    const task = await withThrottleRetry(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => (client as any).textToImage.create(params).waitForTaskOutput(),
      `editImage(${model}) ${input.description.slice(0, 40)}`
    );

    if (input.generationId) {
      const outputs = Array.isArray(task.output) ? task.output.length : 1;
      trackCost(input.generationId, costKeyForImage(model, ratio), outputs, input.description);
    }
    return { taskId: task.id, output: task.output };
  });
}
