import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { getNextVariantNumber, formatDbError } from "./types";
// Runway pivot (May 2026 AUTEUR): swapped Nano Banana → gpt_image_2 via lib/runway.
import { generateImage as runwayGenerateImage, editImage, toGptImage2Ratio } from "@/lib/runway";
import { withAntiPrompt } from "@/lib/ai/prompts/anti-prompt-suffix";
import { resolveTags, normalizeTag } from "@/lib/ai/tag-resolver";
import { db } from "@/lib/db";
import { persistAsset } from "@/lib/generation/persist-asset";
import { validateImageUrls } from "@/lib/generation/validate-image-url";
import { filmFrameDeclaration } from "@/lib/ai/prompts/nano-banana-patterns";

// General-purpose image generation (Nano Banana via Replicate).
// Use this for free-form stills that aren't plates or keyframes — thumbnails,
// ad stills, end cards, mood boards. For identity-locked assets use generate_plate;
// for composited shot-keyframes use generate_keyframe.

export const generateImageDefinition: ToolDefinition = {
  name: "generate_image",
  description:
    "Generate a single still image via Nano Banana. The anti-prompt suffix (photorealistic, no beauty filter, film frame) is appended automatically.\n\n" +
    "**When to use:**\n" +
    "- End-card stills (black frame with tagline)\n" +
    "- Thumbnail / poster art\n" +
    "- Free-form mood stills that aren't plates or keyframes\n\n" +
    "**When NOT to use:** for characters/locations/props/wardrobe/FX → use `generate_plate`. For composited shot stills → use `generate_keyframe`.\n\n" +
    "**@tag references:** you can reference existing plates in the prompt as @tag — they're resolved into reference images automatically (edit mode). Or pass `reference_tags` explicitly.\n\n" +
    "Costs 3 credits.",
  input_schema: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description:
          "Image prompt. Can reference plates inline as @tag — e.g. 'End card: black background, white serif, the word SECRET centered. Below, small: @le_secret_logo.' Prompt should be ≤120 words.",
      },
      reference_tags: {
        type: "array",
        items: { type: "string" },
        description: "Optional @tags of existing plates to use as references.",
      },
      reference_image_urls: {
        type: "array",
        items: { type: "string" },
        description: "Optional raw image URLs as references.",
      },
      aspect_ratio: {
        type: "string",
        enum: ["1:1", "4:5", "9:16", "16:9", "3:4", "4:3", "21:9"],
        description: "Defaults to the generation's target aspect ratio.",
      },
      tag: {
        type: "string",
        description: "Optional @tag to assign to this image so you can reference it later.",
      },
    },
    required: ["prompt"],
  },
};

export const generateImageTool: ToolHandler = async (
  input,
  context,
  emitter
): Promise<ToolResult> => {
  const rawPrompt = input.prompt as string;
  const referenceTags = ((input.reference_tags as string[]) || []).map(normalizeTag);
  const rawRefUrls = (input.reference_image_urls as string[]) || [];
  const aspectRatio =
    (input.aspect_ratio as
      | "1:1"
      | "4:5"
      | "9:16"
      | "16:9"
      | "3:4"
      | "4:3"
      | "21:9") ||
    (context.aspectRatio as
      | "1:1"
      | "4:5"
      | "9:16"
      | "16:9"
      | "3:4"
      | "4:3"
      | "21:9") ||
    "16:9";
  const tag = input.tag ? normalizeTag(input.tag as string) : undefined;

  emitter.send("tool_progress", {
    tool: "generate_image",
    generationId: context.generationId,
    status: "generating",
    message: "Generating image...",
  });

  try {
    const { resolved, imageUrls, unresolved } = await resolveTags(
      rawPrompt,
      context.generationId,
      referenceTags
    );
    if (unresolved.length > 0) {
      return {
        success: false,
        content: `Unresolved tags in prompt: ${unresolved.map((t) => `@${t}`).join(", ")}.`,
      };
    }

    if (rawRefUrls.length > 0) {
      const { ok, bad } = await validateImageUrls(rawRefUrls, { timeoutMs: 6_000 });
      if (!ok) {
        const details = bad
          .map((b) => `  - ${b.url.slice(0, 80)}: ${b.reason}${b.status ? ` (HTTP ${b.status})` : ""}`)
          .join("\n");
        return {
          success: false,
          content: `Reference URL(s) aren't usable images. Do NOT retry with these URLs.\n\n${details}\n\nFix: upload the file via the attach button, use a direct image link (.jpg/.png/.webp), or drop the reference.`,
        };
      }
    }

    const refUrls = [...imageUrls, ...rawRefUrls];
    // Append a film-frame declaration so free-form stills (end cards, mood
    // stills, posters) stay in cinema register instead of drifting to the
    // "stock AI ad" default. The anti-prompt suffix adds the broader no-HDR /
    // no-beauty-filter language on top.
    const finalPrompt = withAntiPrompt(`${resolved}\n\n${filmFrameDeclaration(aspectRatio)}`);

    const runwayRatio = toGptImage2Ratio(aspectRatio);
    const taskResult =
      refUrls.length > 0
        ? await editImage({
            promptText: finalPrompt,
            inputImages: refUrls.map((uri) => ({ uri })),
            ratio: runwayRatio,
            generationId: context.generationId,
            description: tag ? `image @${tag} (${aspectRatio})` : `image (${aspectRatio})`,
          })
        : await runwayGenerateImage({
            promptText: finalPrompt,
            ratio: runwayRatio,
            generationId: context.generationId,
            description: tag ? `image @${tag} (${aspectRatio})` : `image (${aspectRatio})`,
          });
    const result = {
      url: Array.isArray(taskResult.output)
        ? taskResult.output[0]
        : (taskResult.output as unknown as string),
      predictionId: taskResult.taskId,
    };

    const variantNum = await getNextVariantNumber(context.generationId);

    if (tag) {
      await db
        .from("generation_assets")
        .update({ tag: null })
        .eq("generation_id", context.generationId)
        .eq("tag", tag);
    }

    const persistentUrl = await persistAsset(result.url, {
      generationId: context.generationId,
      kind: "image",
      basename: tag ? `image-${tag}` : "image",
    });

    const { data: asset, error: insertErr } = await db
      .from("generation_assets")
      .insert({
        generation_id: context.generationId,
        org_id: context.orgId,
        type: "image",
        aspect_ratio: aspectRatio,
        public_url: persistentUrl,
        storage_path: persistentUrl,
        tag: tag || null,
        asset_role: tag ? "plate" : null,
        prediction_id: result.predictionId,
        status: "ready",
        metadata: {
          prompt: finalPrompt,
          reference_tags: referenceTags,
          source_url: result.url,
          tag,
        },
        variant_number: variantNum,
      })
      .select("id")
      .single();

    if (insertErr || !asset) {
      const full = formatDbError(insertErr);
      console.error(
        "[tool:generate_image] DB insert failed:",
        full,
        "\npayload:",
        JSON.stringify({ tag, aspectRatio, generation_id: context.generationId })
      );
      return {
        success: false,
        content: `Image generated but DB insert failed: ${full}. Image URL: ${result.url}.`,
      };
    }

    emitter.send("tool_progress", {
      tool: "generate_image",
      generationId: context.generationId,
      status: "complete",
      message: tag ? `Image ready: @${tag}` : "Image ready",
    });

    return {
      success: true,
      content: `Image generated${tag ? ` (@${tag})` : ""}. URL: ${result.url}`,
      assets: [
        {
          assetId: asset?.id,
          type: "image",
          url: result.url,
          metadata: { tag, aspect_ratio: aspectRatio },
        },
      ],
    };
  } catch (error) {
    console.error("[tool:generate_image] Error:", error);
    return {
      success: false,
      content: `Image generation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
