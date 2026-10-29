// GPT Image 2.5 wrappers (gpt_image_2_5_sunburst / gpt_image_2_5_flare).
//
// Two responsibilities:
//   1. Text-to-image generation with optional reference images (character
//      sheets, location plates, lookbook tiles). Up to 16 tagged refs.
//   2. Edit-with-input-images — pass existing images as references plus an
//      instruction to alter them (edit_plate / generate_keyframe).
//
// Sunburst = quality (default for plates + keyframes). Flare = fast, GPT
// Image 2 quality — use for lookbook tiles and drafts.
// Ratios: 30 width:height pairs across 1K / 2K / 4K — see ratio-map.ts.

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
  /** Optional reference images. Up to 16, optionally tagged. */
  references?: ReferenceImage[];
  /**
   * Aspect ratio as a Runway pixel-pair string. Use `toGptImageRatio()` from
   * `lib/runway/ratio-map.ts` to map a TwinLink aspect (16:9, 1:1, …).
   */
  ratio?: string;
  /** Override the default model (gpt_image_2_5_sunburst). */
  model?: RunwayModelId;
  /** Rendering quality. Defaults to `high`. `xhigh` / `max` cost more. */
  quality?: ImageQuality;
  /** Generation ID for cost tracking. Pass "" to skip (e.g. spike scripts). */
  generationId: string;
  /** Human-readable description for the cost log. */
  description: string;
};

export type ImageQuality = "low" | "medium" | "high" | "xhigh" | "max";

function costKeyForImage(model: RunwayModelId, ratio: string): string {
  // 4K tier (≥2560 on the long side) bills at the HD rate.
  const isHd = /2560|2880|3264|3840/.test(ratio);
  return isHd ? `runway/${model}_hd` : `runway/${model}`;
}

export async function generateImage(
  input: ImageGenerateInput
): Promise<RunwayTaskResult<string[]>> {
  return withSlot(async () => {
    const client = getRunwayClient();
    const model = input.model ?? RUNWAY_MODELS.GPT_IMAGE_2_5;
    const ratio = input.ratio ?? "1920:1088";

    const params: Record<string, unknown> = {
      model,
      promptText: input.promptText,
      ratio,
      quality: input.quality ?? "high",
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
  /** Output ratio — usually matches the source. Use toGptImageRatio(). */
  ratio?: string;
  /**
   * Optional alpha-mask URI applied to inputImages[0]. Transparent regions
   * mark where edits may happen; opaque regions are preserved bit-identical.
   * Used for surgical changes (e.g. character identity swap with locked
   * background).
   */
  maskUri?: string;
  model?: RunwayModelId;
  quality?: ImageQuality;
  generationId: string;
  description: string;
};

/**
 * Edit-with-input-images via GPT Image 2.5. Used by edit_plate (apply edits
 * to existing plates) and generate_keyframe (compose plates into a first
 * frame for Seedance).
 */
export async function editImage(
  input: ImageEditInput
): Promise<RunwayTaskResult<string[]>> {
  return withSlot(async () => {
    const client = getRunwayClient();
    const model = input.model ?? RUNWAY_MODELS.GPT_IMAGE_2_5;
    const ratio = input.ratio ?? "1920:1088";

    // Runway uses `referenceImages` for BOTH generate-with-refs and
    // edit-with-input-images — same wire key, same endpoint (textToImage).
    // The internal type stays `inputImages` because semantically these are
    // edit sources, not just refs; we map at the boundary.
    const params: Record<string, unknown> = {
      model,
      promptText: input.promptText,
      ratio,
      quality: input.quality ?? "high",
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
