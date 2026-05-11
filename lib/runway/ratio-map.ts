// Map TwinLink's aspect-ratio enum (e.g. "16:9") to Runway's pixel-pair format.
//
// Runway models have DIFFERENT valid ratio enums per model:
//
// - **gpt_image_2** uses minimum 1920px on the short side. Smallest 1:1 = `1920:1920`.
//   Confirmed empirically May 2026 — the SDK validates this enum strictly.
// - **Gen-4.5 / Aleph / Veo** use `1280:720`, `720:1280`, `960:960`, etc.
// - **Seedance 2** has its own enum (1280:720, 720:1280, 992:432, 864:496, ...).
//
// `toRunwayRatio` (the default) returns video-model ratios (1280:720 etc).
// `toGptImage2Ratio` returns ratios valid for gpt_image_2.

import type { RunwayRatio } from "./types";

// Video-model ratios (Gen-4.5, Aleph, Seedance, Veo) — pixel pairs.
const ASPECT_TO_VIDEO: Record<string, RunwayRatio> = {
  "16:9": "1280:720",
  "9:16": "720:1280",
  "1:1": "960:960",
  "4:3": "1408:1408",
  "3:4": "1408:1408",
  "21:9": "1470:630",
  "4:5": "896:1408",
};

const ASPECT_TO_VIDEO_HD: Record<string, RunwayRatio> = {
  "16:9": "1920:1080",
  "9:16": "1080:1920",
  "1:1": "960:960",
  "4:3": "1408:1408",
  "3:4": "1408:1408",
  "21:9": "1470:630",
  "4:5": "896:1408",
};

/**
 * Convert a TwinLink aspect ratio to a Runway VIDEO-model pixel-pair.
 * Use for Gen-4.5 i2v/t2v, Aleph, Veo. NOT for gpt_image_2 — see toGptImage2Ratio.
 */
export function toRunwayRatio(aspectRatio: string, hd = false): RunwayRatio {
  const map = hd ? ASPECT_TO_VIDEO_HD : ASPECT_TO_VIDEO;
  return map[aspectRatio] ?? "1280:720";
}

// gpt_image_2 valid ratios — minimum 1920px on the short side, exact strings
// pulled from the SDK error response when an invalid ratio is sent.
//
// For each TwinLink aspect ratio we pick the closest gpt_image_2-legal pair.
// `auto` is also accepted (model picks).
const ASPECT_TO_GPT_IMAGE_2: Record<string, string> = {
  "16:9": "1920:1088",   // ≈ 1.76:1 (true 16:9 = 1.78)
  "9:16": "1088:1920",
  "1:1": "1920:1920",
  "4:3": "1920:1440",    // exact 4:3
  "3:4": "1440:1920",    // exact 3:4
  "21:9": "2912:1248",   // ≈ 2.33:1 (true 21:9 = 2.33)
  "4:5": "1536:1920",    // ≈ 4:5 (exact)
};

const ASPECT_TO_GPT_IMAGE_2_HD: Record<string, string> = {
  "16:9": "3840:2160",   // exact 16:9 4K
  "9:16": "2160:3840",
  "1:1": "2880:2880",
  "4:3": "3264:2448",    // exact 4:3
  "3:4": "2448:3264",
  "21:9": "3840:1648",   // ≈ 2.33:1
  "4:5": "2560:3200",    // exact 4:5
};

/**
 * Convert a TwinLink aspect ratio to a gpt_image_2-legal ratio string.
 * Pass `hd=true` for 4K-class output (~4× the pixels — slower, more credits).
 */
export function toGptImage2Ratio(aspectRatio: string, hd = false): string {
  const map = hd ? ASPECT_TO_GPT_IMAGE_2_HD : ASPECT_TO_GPT_IMAGE_2;
  return map[aspectRatio] ?? "1920:1088";
}
