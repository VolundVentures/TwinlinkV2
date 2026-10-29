// Seedance 2.5 wrappers — the ONLY scene generator.
//
// A TwinLink "scene" is one Seedance 2.5 call: 25 seconds by default (API
// range 4–30s), native audio (dialogue, foley, ambience) rendered in the
// same pass. Three entry points:
//   1. seedanceImageToVideo — the Frame Anchor path. The composed keyframe is
//      the FIRST frame; the prompt carries the beats of the scene.
//   2. seedanceTextToVideo — no keyframe (rare; end cards with motion).
//   3. seedanceVideoToVideo — `reference` renders a NEW scene conditioned on
//      an existing one (coverage: same moment, new angle), `edit` modifies it
//      in place (signature grade, director notes, surgical fixes), `extend`
//      continues it. This replaces Aleph entirely.
//
// Pricing (720p): 30 cr/s output + 15 cr/s of input/reference video.
// 1080p: 68 cr/s + 34 cr/s. 80-credit minimum per generation.

import { trackCost } from "../generation/cost-tracker";
import { getRunwayClient } from "./client";
import { withSlot } from "./rate-limit";
import { RUNWAY_MODELS } from "./models";
import type { ReferenceImage, RunwayRatio, RunwayTaskResult } from "./types";

export const SEEDANCE_MIN_DURATION = 4;
export const SEEDANCE_MAX_DURATION = 30;
/** Product default — every narrative scene is 25 seconds. */
export const SCENE_DURATION = 25;

export function clampSceneDuration(seconds: number | undefined): number {
  const n = Math.round(seconds ?? SCENE_DURATION);
  return Math.max(SEEDANCE_MIN_DURATION, Math.min(SEEDANCE_MAX_DURATION, n));
}

type SeedanceBase = {
  /** Scene direction: camera, beats, dialogue, sound. Up to 15,000 chars. */
  promptText: string;
  /** 4–30 seconds, integer. Defaults to SCENE_DURATION (25). */
  duration?: number;
  ratio?: RunwayRatio;
  /** Native audio (dialogue / foley / ambience). Default true. */
  audio?: boolean;
  /** Up to 30 image references for identity / world consistency. */
  references?: ReferenceImage[];
  /** Up to 10 video references (combined ≤30s) for motion / style. */
  videoReferences?: { uri: string }[];
  /** Up to 10 audio references (combined <30s) — a VO take, a music cue. */
  audioReferences?: { uri: string }[];
  seed?: number;
  generationId: string;
  description: string;
};

function isHd(ratio?: RunwayRatio): boolean {
  return /1920|1080|1440|1664|1248|2206/.test(ratio ?? "");
}

function baseParams(input: SeedanceBase): Record<string, unknown> {
  const params: Record<string, unknown> = {
    model: RUNWAY_MODELS.SEEDANCE_2_5,
    promptText: input.promptText,
    duration: clampSceneDuration(input.duration),
    ratio: input.ratio ?? "1280:720",
    audio: input.audio ?? true,
  };
  if (input.references?.length) {
    params.references = input.references.map((r) => ({ uri: r.uri }));
  }
  if (input.videoReferences?.length) {
    params.referenceVideos = input.videoReferences.map((v) => ({ type: "video", uri: v.uri }));
  }
  if (input.audioReferences?.length) {
    params.referenceAudio = input.audioReferences.map((a) => ({ type: "audio", uri: a.uri }));
  }
  if (input.seed !== undefined) params.seed = input.seed;
  return params;
}

function track(input: SeedanceBase, outputSeconds: number, inputSeconds = 0) {
  if (!input.generationId) return;
  const hd = isHd(input.ratio);
  trackCost(
    input.generationId,
    hd ? "runway/seedance2_5_1080p" : "runway/seedance2_5",
    outputSeconds,
    input.description
  );
  if (inputSeconds > 0) {
    trackCost(
      input.generationId,
      hd ? "runway/seedance2_5_1080p_input" : "runway/seedance2_5_input",
      inputSeconds,
      `${input.description} (reference video)`
    );
  }
}

export type SeedanceTextToVideoInput = SeedanceBase;

export async function seedanceTextToVideo(
  input: SeedanceTextToVideoInput
): Promise<RunwayTaskResult<string[]>> {
  return withSlot(async () => {
    const client = getRunwayClient();
    const params = baseParams(input);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const task = await (client as any).textToVideo.create(params).waitForTaskOutput();
    track(input, params.duration as number);
    return { taskId: task.id, output: task.output };
  });
}

export type SeedanceImageToVideoInput = Omit<SeedanceBase, "references"> & {
  /** The composed keyframe. Pinned as frame 0 unless `referenceImages` is set. */
  firstFrame: string;
  /** Optional closing frame for a nameable state transition (door closed → open). */
  lastFrame?: string;
  /**
   * Identity / world references (plates). Seedance's i2v endpoint cannot mix
   * pinned frames with loose references, so passing these switches the call
   * to REFERENCE mode: keyframe + plates all guide the scene, nothing pinned.
   */
  referenceImages?: string[];
};

/**
 * Keyframe mode (default): first (and optionally last) frame are pinned.
 * Reference mode (when `referenceImages` is set): keyframe + plates guide
 * identity and composition without pinning frame 0.
 */
export async function seedanceImageToVideo(
  input: SeedanceImageToVideoInput
): Promise<RunwayTaskResult<string[]>> {
  return withSlot(async () => {
    const client = getRunwayClient();
    const params = baseParams(input);
    if (input.referenceImages?.length) {
      params.promptImage = [input.firstFrame, ...input.referenceImages]
        .slice(0, 30)
        .map((uri) => ({ uri }));
    } else {
      const promptImage: Array<{ uri: string; position: "first" | "last" }> = [
        { uri: input.firstFrame, position: "first" },
      ];
      if (input.lastFrame) promptImage.push({ uri: input.lastFrame, position: "last" });
      params.promptImage = promptImage;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const task = await (client as any).imageToVideo.create(params).waitForTaskOutput();
    track(input, params.duration as number);
    return { taskId: task.id, output: task.output };
  });
}

export type SeedanceVideoToVideoInput = Omit<SeedanceBase, "duration" | "ratio"> & {
  promptVideo: string;
  /** Seconds of the source — billed as input. */
  sourceDurationSeconds: number;
  /**
   * `extend` continues the source (keeps its ratio). `edit` modifies it in
   * place (duration auto). `reference` renders a NEW scene conditioned on it.
   */
  mode: "extend" | "edit" | "reference";
  /** Only for `reference` / `extend`. */
  duration?: number;
  /** Only for `reference`. */
  ratio?: RunwayRatio;
};

export async function seedanceVideoToVideo(
  input: SeedanceVideoToVideoInput
): Promise<RunwayTaskResult<string[]>> {
  return withSlot(async () => {
    const client = getRunwayClient();
    const params = baseParams({ ...input, duration: input.duration, ratio: input.ratio });
    params.promptVideo = input.promptVideo;
    params.mode = input.mode;
    if (input.mode === "edit") {
      params.duration = "auto";
      delete params.ratio;
    } else if (input.mode === "extend") {
      delete params.ratio;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const task = await (client as any).videoToVideo.create(params).waitForTaskOutput();
    const outSeconds =
      input.mode === "edit" ? input.sourceDurationSeconds : (params.duration as number);
    track(input, outSeconds, input.sourceDurationSeconds);
    return { taskId: task.id, output: task.output };
  });
}
