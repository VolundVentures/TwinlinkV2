import {
  runModel,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_RESOLUTION,
} from "./replicate";
import { trackCost } from "./cost-tracker";

/**
 * Replicate image generation and editing.
 *
 * Default model: `google/nano-banana-pro` (Nano Banana Pro, up to 4K, edit mode
 * with reference images). Override via `REPLICATE_IMAGE_MODEL` env var to
 * fall back to `google/nano-banana` (faster / cheaper / 1K only).
 *
 * Edit mode (when `imageUrls` is supplied) is the engine behind:
 *   - Composited keyframes (plate URLs → one still per shot)
 *   - edit_plate (iterative surgical edits that preserve identity)
 *   - location_variant (same location, different state)
 */

export type NanoBananaAspectRatio =
  | "1:1"
  | "4:5"
  | "9:16"
  | "16:9"
  | "3:4"
  | "4:3"
  | "21:9";

export type NanoBananaGenerateInput = {
  prompt: string;
  aspectRatio?: NanoBananaAspectRatio;
  resolution?: string; // "1K" | "2K" | "4K"
  generationId: string;
};

export type NanoBananaEditInput = {
  prompt: string;
  imageUrls: string[];
  aspectRatio?: NanoBananaAspectRatio;
  resolution?: string;
  generationId: string;
  signal?: AbortSignal;
};

function buildBaseInput(aspectRatio: string, resolution: string): Record<string, unknown> {
  // Nano Banana Pro and Nano Banana both accept `prompt`, `aspect_ratio`,
  // `output_format`, `image_input`. Pro additionally honors `output_resolution`.
  // Unknown fields are ignored server-side, so safe to always send.
  return {
    aspect_ratio: aspectRatio,
    output_format: "png",
    output_resolution: resolution,
    resolution, // alternate key name some Replicate models use
  };
}

/**
 * Turn a raw Replicate error message into something the agent can act on.
 *
 * Replicate surfaces input-validation failures as error codes like E005/E006,
 * plus a prose sentence. These codes come back through runModel as:
 *   "Prediction failed: The input was invalid. Please try again with different
 *    inputs. (E006) (uIJ6l3ruRD)"
 * or sometimes mid-sentence via createPrediction's Replicate API error body.
 *
 * Converts those to an actionable message the agent can recover from: which
 * knob to turn (drop references, shorten prompt, change aspect), not a model-
 * opaque alphabet-soup code.
 */
export function parseNanoBananaError(err: unknown, hadReferences: boolean): Error {
  const raw = err instanceof Error ? err.message : String(err);

  // E006 — generic input validation. Most common cause in this pipeline is a
  // bad reference URL (webpage instead of image, 403-protected CDN, broken
  // link). Second most common: prompt tripped a safety filter.
  if (/E006|input (?:was|is) invalid|input_validation/i.test(raw)) {
    const hint = hadReferences
      ? "MOST LIKELY CAUSE: one of the reference images can't be loaded by Replicate (webpage URL instead of an image file, expired signed URL, 403/CDN-blocked, or the file isn't a real image). RECOVERY: retry ONCE without reference_image_urls (and without any @tag whose plate URL might be stale) so text-only generation can complete, or drop the suspect reference and retry. Do NOT retry with the same references."
      : "MOST LIKELY CAUSE: the prompt tripped a content filter or contained an unsupported phrase. RECOVERY: retry with a terser, more descriptive prompt (drop brand names, proper nouns, any adjectives that imply violence / nudity / real persons). Do NOT retry with the same prompt.";
    return new Error(`Nano Banana rejected the input (Replicate E006). ${hint} Raw: ${raw}`);
  }

  // E005 — safety / moderation.
  if (/E005|moderation|safety|nsfw|content[_ ]policy/i.test(raw)) {
    return new Error(
      `Nano Banana flagged this prompt or reference as unsafe (Replicate E005). RECOVERY: rewrite the prompt without any language that could read as violence, weapons in frame, real named persons, or anything sexual. If a reference image is the issue, drop it. Raw: ${raw}`
    );
  }

  // Rate limit.
  if (/429|rate[_ ]limit|too many requests/i.test(raw)) {
    return new Error(
      `Replicate rate-limited this request. RECOVERY: wait 30–60s, then retry with the same input. Do NOT spawn parallel retries. Raw: ${raw}`
    );
  }

  // Timeout — from runModel / waitForPrediction.
  if (/timed out|timeout/i.test(raw)) {
    return new Error(
      `Replicate prediction timed out. RECOVERY: retry once with the same input (compute slots sometimes hang). If it times out again, reduce prompt length or drop one reference. Raw: ${raw}`
    );
  }

  // Unknown — pass through verbatim so the agent still sees something.
  return new Error(raw);
}

export async function nanoBananaGenerate(
  opts: NanoBananaGenerateInput
): Promise<{ url: string; predictionId: string }> {
  const resolution = opts.resolution || DEFAULT_IMAGE_RESOLUTION;
  const input: Record<string, unknown> = {
    ...buildBaseInput(opts.aspectRatio || "16:9", resolution),
    prompt: opts.prompt,
  };

  const { predictionId, output } = await runModel<string | string[]>(
    DEFAULT_IMAGE_MODEL,
    input,
    { maxWaitMs: 360_000 }
  );

  const url = Array.isArray(output) ? output[0] : output;
  if (!url) throw new Error("nanoBananaGenerate: no output URL");
  trackCost(
    opts.generationId,
    DEFAULT_IMAGE_MODEL,
    1,
    `Nano Banana generate (${opts.aspectRatio || "16:9"}, ${resolution})`
  );
  return { url, predictionId };
}

export async function nanoBananaEdit(
  opts: NanoBananaEditInput
): Promise<{ url: string; predictionId: string }> {
  if (!opts.imageUrls.length) {
    throw new Error("nanoBananaEdit requires at least one reference image");
  }
  if (opts.imageUrls.length > 14) {
    throw new Error("Nano Banana supports up to 14 reference images");
  }

  const resolution = opts.resolution || DEFAULT_IMAGE_RESOLUTION;
  const input: Record<string, unknown> = {
    ...buildBaseInput(opts.aspectRatio || "16:9", resolution),
    prompt: opts.prompt,
    image_input: opts.imageUrls,
  };

  const { predictionId, output } = await runModel<string | string[]>(
    DEFAULT_IMAGE_MODEL,
    input,
    { maxWaitMs: 360_000, signal: opts.signal }
  );

  const url = Array.isArray(output) ? output[0] : output;
  if (!url) throw new Error("nanoBananaEdit: no output URL");
  trackCost(
    opts.generationId,
    DEFAULT_IMAGE_MODEL,
    1,
    `Nano Banana edit (${opts.imageUrls.length} refs, ${opts.aspectRatio || "16:9"}, ${resolution})`
  );
  return { url, predictionId };
}
