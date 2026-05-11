// Gen-4 Aleph wrappers.
//
// Aleph is video-to-video, hard 5-second max duration. Three roles:
//   1. Coverage: novel-view generation from a master shot — same fictional
//      moment from a different camera angle.
//   2. Signature pass: apply a director's color/grade/lighting fingerprint.
//   3. In-place edit: add/remove/transform objects, weather, lighting, style.
//
// All proven reliable in May 2026 testing.

import { trackCost } from "../generation/cost-tracker";
import { getRunwayClient } from "./client";
import { withSlot } from "./rate-limit";
import { RUNWAY_MODELS } from "./models";
import type { RunwayRatio, RunwayTaskResult } from "./types";

const ALEPH_MAX_DURATION = 5;

export type AlephInput = {
  /** Source video URI (HTTPS or runway://). */
  videoUri: string;
  /** Edit instruction. */
  promptText: string;
  /** Optional reference image — documented but unverified. Day 1 spike will confirm. */
  referenceImageUri?: string;
  /** Defaults to 5. Larger values are clipped to the API max regardless. */
  duration?: number;
  ratio?: RunwayRatio;
  generationId: string;
  description: string;
};

async function runAleph(input: AlephInput): Promise<RunwayTaskResult<string[]>> {
  return withSlot(async () => {
    const client = getRunwayClient();
    const duration = Math.min(input.duration ?? ALEPH_MAX_DURATION, ALEPH_MAX_DURATION);
    const params: Record<string, unknown> = {
      model: RUNWAY_MODELS.GEN_4_ALEPH,
      videoUri: input.videoUri,
      promptText: input.promptText,
      duration,
      ratio: input.ratio ?? "1280:720",
    };
    if (input.referenceImageUri) {
      params.references = [{ type: "image", uri: input.referenceImageUri }];
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const task = await (client as any).videoToVideo.create(params).waitForTaskOutput();
    if (input.generationId) {
      trackCost(input.generationId, "runway/gen4_aleph", duration, input.description);
    }
    return { taskId: task.id, output: task.output };
  });
}

/**
 * Generate alternate-angle coverage from a master shot. The prompt should
 * describe the new angle clearly and assert continuity with the master
 * ("same scene, same moment, same character, same lighting — but [new angle]").
 */
export function alephCoverage(input: {
  masterVideoUri: string;
  anglePrompt: string;
  duration?: number;
  ratio?: RunwayRatio;
  generationId: string;
  description: string;
}): Promise<RunwayTaskResult<string[]>> {
  return runAleph({
    videoUri: input.masterVideoUri,
    promptText: input.anglePrompt,
    duration: input.duration,
    ratio: input.ratio,
    generationId: input.generationId,
    description: input.description,
  });
}

/**
 * Apply a director's signature pass — color, grade, lighting fingerprint.
 * Driven from the persona JSON's alephSignaturePrompts array.
 */
export function alephSignaturePass(input: {
  videoUri: string;
  signaturePrompt: string;
  ratio?: RunwayRatio;
  generationId: string;
  description: string;
}): Promise<RunwayTaskResult<string[]>> {
  return runAleph({
    videoUri: input.videoUri,
    promptText: input.signaturePrompt,
    duration: 5,
    ratio: input.ratio,
    generationId: input.generationId,
    description: input.description,
  });
}

/**
 * Apply a review-time correction (eyeline tweak, color shift, weather change).
 * Surgical — keep prompts narrow.
 */
export function alephEdit(input: {
  videoUri: string;
  editPrompt: string;
  referenceImageUri?: string;
  duration?: number;
  ratio?: RunwayRatio;
  generationId: string;
  description: string;
}): Promise<RunwayTaskResult<string[]>> {
  return runAleph({
    videoUri: input.videoUri,
    promptText: input.editPrompt,
    referenceImageUri: input.referenceImageUri,
    duration: input.duration,
    ratio: input.ratio,
    generationId: input.generationId,
    description: input.description,
  });
}
