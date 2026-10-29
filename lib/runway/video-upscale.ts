// Magnific video upscaler via Runway — the "finish" step.
//
// Takes the composed film (or a single scene) and returns a 4K master with an
// optional frame-rate boost. Billed per frame ($0.007 at 720p → $0.012 at 4K).

import { trackCost } from "../generation/cost-tracker";
import { getRunwayClient } from "./client";
import { withSlot } from "./rate-limit";
import { RUNWAY_MODELS } from "./models";
import type { RunwayTaskResult } from "./types";

export type UpscaleVideoInput = {
  videoUri: string;
  resolution?: "720p" | "1k" | "2k" | "4k";
  /** Increase output frame rate (smoother motion). */
  fpsBoost?: boolean;
  /** 0 (faithful) … 100 (invented detail). Film work stays low. */
  creativity?: number;
  /** `natural` keeps the grade; `vivid` pushes color. */
  flavor?: "vivid" | "natural";
  /** Source seconds × fps — for cost tracking only. */
  sourceFrames: number;
  generationId: string;
  description: string;
};

export async function upscaleVideo(input: UpscaleVideoInput): Promise<RunwayTaskResult<string[]>> {
  return withSlot(async () => {
    const client = getRunwayClient();
    const params: Record<string, unknown> = {
      model: RUNWAY_MODELS.VIDEO_UPSCALE,
      videoUri: input.videoUri,
      resolution: input.resolution ?? "4k",
      fpsBoost: input.fpsBoost ?? false,
      creativity: input.creativity ?? 10,
      flavor: input.flavor ?? "natural",
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const task = await (client as any).videoUpscale.create(params).waitForTaskOutput();
    if (input.generationId) {
      trackCost(input.generationId, "runway/magnific_video_upscaler_4k", input.sourceFrames, input.description);
    }
    return { taskId: task.id, output: task.output };
  });
}
