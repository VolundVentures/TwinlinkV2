// Map TwinLink's aspect-ratio enum (e.g. "16:9") to Runway's pixel-pair format.
//
// Runway models have DIFFERENT valid ratio enums per model:
// - gpt_image_2_5_* : 1K / 2K / 4K tiers, ≥1088px short side at 1K.
// - seedance2_5     : 720p tier (1280:720 …) and 1080p tier (1920:1080 …).
//                     v2v `edit` / `extend` take no ratio — output matches input.

import type { RunwayRatio } from "./types";

const ASPECT_TO_SEEDANCE_720: Record<string, RunwayRatio> = {
  "16:9": "1280:720",
  "9:16": "720:1280",
  "1:1": "960:960",
  "4:3": "1112:834",
  "3:4": "834:1112",
  "21:9": "1470:630",
  "4:5": "834:1112",
};

const ASPECT_TO_SEEDANCE_1080: Record<string, RunwayRatio> = {
  "16:9": "1920:1080",
  "9:16": "1080:1920",
  "1:1": "1440:1440",
  "4:3": "1664:1248",
  "3:4": "1248:1664",
  "21:9": "2206:946",
  "4:5": "1248:1664",
};

/** TwinLink aspect → Seedance 2.5 pixel pair. `hd=true` → 1080p tier (≈2.3× credits). */
export function toSeedanceRatio(aspectRatio: string, hd = false): RunwayRatio {
  const map = hd ? ASPECT_TO_SEEDANCE_1080 : ASPECT_TO_SEEDANCE_720;
  return map[aspectRatio] ?? "1280:720";
}

// gpt_image_2_5 ratios — same 30-entry enum as gpt_image_2 (1K / 2K / 4K tiers).
const ASPECT_TO_GPT_IMAGE: Record<string, string> = {
  "16:9": "1920:1088",
  "9:16": "1088:1920",
  "1:1": "1920:1920",
  "4:3": "1920:1440",
  "3:4": "1440:1920",
  "21:9": "2912:1248",
  "4:5": "1536:1920",
};

const ASPECT_TO_GPT_IMAGE_HD: Record<string, string> = {
  "16:9": "3840:2160",
  "9:16": "2160:3840",
  "1:1": "2880:2880",
  "4:3": "3264:2448",
  "3:4": "2448:3264",
  "21:9": "3840:1648",
  "4:5": "2560:3200",
};

/** TwinLink aspect → gpt_image_2_5-legal ratio. `hd=true` → 4K tier. */
export function toGptImageRatio(aspectRatio: string, hd = false): string {
  const map = hd ? ASPECT_TO_GPT_IMAGE_HD : ASPECT_TO_GPT_IMAGE;
  return map[aspectRatio] ?? "1920:1088";
}
