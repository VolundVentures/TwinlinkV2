import { trackCost } from "./cost-tracker";
import { falSubmitAndPoll } from "./fal-video";

type FalImage = {
  url: string;
  width: number;
  height: number;
  content_type: string;
};

type FalResponse = {
  images: FalImage[];
  description?: string;
};

export async function generateImage(
  prompt: string,
  options: {
    aspectRatio?: string;
    resolution?: "0.5K" | "1K" | "2K" | "4K";
    numImages?: number;
    outputFormat?: "png" | "jpeg" | "webp";
    thinking_level?: "minimal" | "high";
    enableWebSearch?: boolean;
    generationId?: string;
  } = {}
): Promise<string> {
  const {
    aspectRatio = "1:1",
    resolution = "2K",
    numImages = 1,
    outputFormat = "png",
    thinking_level = "high",
    enableWebSearch = false,
    generationId,
  } = options;

  console.log("[fal] Generating image with Nano Banana 2, aspect:", aspectRatio, "resolution:", resolution, "thinking:", thinking_level, "webSearch:", enableWebSearch);

  const input: Record<string, unknown> = {
    prompt,
    aspect_ratio: aspectRatio,
    resolution,
    num_images: numImages,
    output_format: outputFormat,
    thinking_level,
  };
  if (enableWebSearch) {
    input.enable_web_search = true;
  }

  // Use queue API to avoid Node.js undici 120s headersTimeout
  const data = await falSubmitAndPoll<FalResponse>(
    "fal-ai/nano-banana-2",
    input,
    undefined,
    300_000 // 5 min max
  );

  if (!data.images || data.images.length === 0) {
    throw new Error("Fal returned no images");
  }

  const modelKey = resolution === "2K" ? "fal-ai/nano-banana-2-2K" : "fal-ai/nano-banana-2";
  if (generationId) {
    trackCost(generationId, modelKey, numImages, `Image ${aspectRatio} ${resolution}`);
  }

  console.log("[fal] Image generated:", data.images[0].url.slice(0, 80));
  return data.images[0].url;
}

/**
 * Edit/generate images using Nano Banana 2's edit endpoint.
 * Accepts up to 14 reference images for character consistency,
 * product placement, style transfer, and scene editing.
 *
 * Uses fal.ai queue API to handle long processing times (2K + thinking:high can take 2-3 min).
 */
export async function editImage(
  prompt: string,
  options: {
    imageUrls: string[];
    aspectRatio?: string;
    resolution?: "0.5K" | "1K" | "2K" | "4K";
    numImages?: number;
    outputFormat?: "png" | "jpeg" | "webp";
    thinkingLevel?: "minimal" | "high";
    enableWebSearch?: boolean;
    generationId?: string;
  }
): Promise<string[]> {
  const {
    imageUrls,
    aspectRatio = "1:1",
    resolution = "2K",
    numImages = 1,
    outputFormat = "png",
    thinkingLevel = "high",
    enableWebSearch = false,
    generationId,
  } = options;

  if (!imageUrls || imageUrls.length === 0) {
    throw new Error("editImage requires at least one reference image URL");
  }

  console.log(
    "[fal] Editing image with Nano Banana 2 edit endpoint,",
    "refs:", imageUrls.length,
    "aspect:", aspectRatio,
    "resolution:", resolution,
    "thinking:", thinkingLevel
  );

  // Use queue API to avoid Node.js undici 120s headersTimeout
  const data = await falSubmitAndPoll<FalResponse>(
    "fal-ai/nano-banana-2/edit",
    {
      prompt,
      image_urls: imageUrls,
      aspect_ratio: aspectRatio,
      resolution,
      num_images: numImages,
      output_format: outputFormat,
      thinking_level: thinkingLevel,
      enable_web_search: enableWebSearch,
    },
    undefined,
    300_000 // 5 min max
  );

  if (!data.images || data.images.length === 0) {
    throw new Error("Fal edit returned no images");
  }

  const modelKey = resolution === "2K" ? "fal-ai/nano-banana-2/edit-2K" : "fal-ai/nano-banana-2/edit";
  if (generationId) {
    trackCost(generationId, modelKey, numImages, `Edit image ${aspectRatio} ${resolution} (${imageUrls.length} refs)`);
  }

  const urls = data.images.map((img) => img.url);
  console.log("[fal] Edit image generated:", urls.length, "images, first:", urls[0].slice(0, 80));
  return urls;
}
