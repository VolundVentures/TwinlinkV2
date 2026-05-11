// Seedance 2 wrappers.
//
// Used in two places in the AUTEUR pipeline:
//   1. Empty environment / b-roll / atmosphere / wide-no-face shots.
//   2. The first stage of the Frame Anchor pipeline — generate a generic-figure
//      shot, extract first frame, then swap identity in step 2 (gpt_image_2)
//      and animate in step 3 (gen4.5).
//
// CRITICAL: never pass face reference IMAGES to Seedance. Text descriptions of
// people are fine; image refs of faces trip moderation. See
// feedback_video_model_routing memory.
//
// Duration: 5-15s integer values. Ratios from Seedance's specific list (see types.ts).

import { trackCost } from "../generation/cost-tracker";
import { getRunwayClient } from "./client";
import { withSlot } from "./rate-limit";
import { RUNWAY_MODELS } from "./models";
import type { ReferenceImage, RunwayRatio, RunwayTaskResult } from "./types";

export type SeedanceTextToVideoInput = {
  promptText: string;
  /** 5-15 seconds, integer. */
  duration: number;
  ratio?: RunwayRatio;
  /**
   * Up to 9 image references. **Do not pass face refs** — Seedance moderation.
   * Safe uses: storyboard panels (face-free or stylized sketches),
   * location plates, lookbook tiles, costume detail crops.
   */
  references?: ReferenceImage[];
  /**
   * Up to 3 video references for style/motion transfer. Combined max 15s.
   */
  videoReferences?: { uri: string }[];
  /**
   * Up to 3 audio references (2-15s each, combined max 15s). Requires at least
   * one image or video reference per Seedance docs. Rarely used in our pipeline
   * — we compose audio in post.
   */
  audioReferences?: { uri: string }[];
  generationId: string;
  description: string;
};

export async function seedanceTextToVideo(
  input: SeedanceTextToVideoInput
): Promise<RunwayTaskResult<string[]>> {
  return withSlot(async () => {
    const client = getRunwayClient();
    const params: Record<string, unknown> = {
      model: RUNWAY_MODELS.SEEDANCE_2,
      promptText: input.promptText,
      duration: input.duration,
      ratio: input.ratio ?? "1280:720",
    };

    const refs: Array<Record<string, unknown>> = [];
    if (input.references) {
      for (const r of input.references) refs.push({ type: "image", uri: r.uri });
    }
    if (input.videoReferences) {
      for (const v of input.videoReferences) refs.push({ type: "video", uri: v.uri });
    }
    if (input.audioReferences) {
      for (const a of input.audioReferences) refs.push({ type: "audio", uri: a.uri });
    }
    if (refs.length > 0) params.references = refs;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const task = await (client as any).textToVideo.create(params).waitForTaskOutput();
    if (input.generationId) {
      trackCost(input.generationId, "runway/seedance2", input.duration, input.description);
    }
    return { taskId: task.id, output: task.output };
  });
}

export type SeedanceImageToVideoInput = {
  promptText: string;
  /** Single image URI (Mode 2 — image as content reference, not first/last frame). */
  promptImage: string;
  duration: number;
  ratio?: RunwayRatio;
  /** Up to 8 additional image references (image URIs). */
  references?: ReferenceImage[];
  generationId: string;
  description: string;
};

export async function seedanceImageToVideo(
  input: SeedanceImageToVideoInput
): Promise<RunwayTaskResult<string[]>> {
  return withSlot(async () => {
    const client = getRunwayClient();
    const params: Record<string, unknown> = {
      model: RUNWAY_MODELS.SEEDANCE_2,
      promptText: input.promptText,
      promptImage: input.promptImage,
      duration: input.duration,
      ratio: input.ratio ?? "1280:720",
    };
    if (input.references && input.references.length > 0) {
      params.references = input.references.map((r) => ({ type: "image", uri: r.uri }));
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const task = await (client as any).imageToVideo.create(params).waitForTaskOutput();
    if (input.generationId) {
      trackCost(input.generationId, "runway/seedance2", input.duration, input.description);
    }
    return { taskId: task.id, output: task.output };
  });
}
