// Gen-4.5 + Gen-4 Turbo wrappers.
//
// Gen-4.5 i2v is the character workhorse via the Frame Anchor pipeline. Takes
// a character-locked first frame as `promptImage` and animates per the prompt.
// Outputs silent video.

import { trackCost } from "../generation/cost-tracker";
import { getRunwayClient } from "./client";
import { withSlot } from "./rate-limit";
import { RUNWAY_MODELS } from "./models";
import type { RunwayRatio, RunwayTaskResult } from "./types";

export type Gen4ImageToVideoInput = {
  promptText: string;
  /** First frame — typically the character-locked output from gpt_image_2 swap. */
  promptImage: string;
  /** Seconds. Defaults to 5; check Runway docs for max per model. */
  duration?: number;
  ratio?: RunwayRatio;
  /** Override default model (gen4.5). Use gen4_turbo for cheap drafts. */
  model?: typeof RUNWAY_MODELS.GEN_4_5 | typeof RUNWAY_MODELS.GEN_4_TURBO;
  generationId: string;
  description: string;
};

export async function gen4ImageToVideo(
  input: Gen4ImageToVideoInput
): Promise<RunwayTaskResult<string[]>> {
  return withSlot(async () => {
    const client = getRunwayClient();
    const model = input.model ?? RUNWAY_MODELS.GEN_4_5;
    const duration = input.duration ?? 5;
    const params: Record<string, unknown> = {
      model,
      promptImage: input.promptImage,
      promptText: input.promptText,
      ratio: input.ratio ?? "1280:720",
      duration,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const task = await (client as any).imageToVideo.create(params).waitForTaskOutput();
    if (input.generationId) {
      const costKey = model === RUNWAY_MODELS.GEN_4_TURBO ? "runway/gen4_turbo" : "runway/gen4.5";
      trackCost(input.generationId, costKey, duration, input.description);
    }
    return { taskId: task.id, output: task.output };
  });
}

export type Gen4TextToVideoInput = {
  promptText: string;
  duration?: number;
  ratio?: RunwayRatio;
  generationId: string;
  description: string;
};

/**
 * Gen-4.5 text-to-video — used when there's no first frame yet (rare in our
 * pipeline; the Frame Anchor pattern always provides a first frame). Kept
 * for the script-writer's cases where it picks gen4.5 t2v explicitly.
 */
export async function gen4TextToVideo(
  input: Gen4TextToVideoInput
): Promise<RunwayTaskResult<string[]>> {
  return withSlot(async () => {
    const client = getRunwayClient();
    const duration = input.duration ?? 5;
    const params: Record<string, unknown> = {
      model: RUNWAY_MODELS.GEN_4_5,
      promptText: input.promptText,
      ratio: input.ratio ?? "1280:720",
      duration,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const task = await (client as any).textToVideo.create(params).waitForTaskOutput();
    if (input.generationId) {
      trackCost(input.generationId, "runway/gen4.5", duration, input.description);
    }
    return { taskId: task.id, output: task.output };
  });
}
