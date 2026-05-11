import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { getNextVariantNumber } from "./types";
import { db } from "@/lib/db";

// Extract a single frame from a video via a public ffmpeg-on-Replicate model.
// Primary use case: chain shot-to-shot continuity by extracting the last frame
// of shot N and using it as start_image for shot N+1.
// Secondary: in the Higgsfield methodology, keyframes usually carry continuity
// so this tool is rarely needed — prefer designing first_frame/last_frame
// keyframe pairs at script time.

import { runModel } from "@/lib/generation/replicate";

// Public video-frame extractor model on Replicate.
const FRAME_EXTRACTOR_MODEL = "nareshmuthuraj/ffmpeg-extract-frame";

export const extractFrameDefinition: ToolDefinition = {
  name: "extract_frame",
  description:
    "Extract a still frame from a generated video (first / middle / last) for cross-shot continuity chaining. Usually not needed — prefer designing first/last keyframe pairs at write_script time. Costs 1 credit.",
  input_schema: {
    type: "object",
    properties: {
      video_url: { type: "string" },
      frame_type: {
        type: "string",
        enum: ["first", "middle", "last"],
        description: "Default 'last' (for forward chaining).",
      },
      tag: {
        type: "string",
        description:
          "Optional @tag to store the frame under so you can reference it as start_keyframe_tag later.",
      },
    },
    required: ["video_url"],
  },
};

export const extractFrameTool: ToolHandler = async (
  input,
  context,
  emitter
): Promise<ToolResult> => {
  const videoUrl = input.video_url as string;
  const frameType = (input.frame_type as "first" | "middle" | "last") || "last";
  const tag = (input.tag as string | undefined)?.replace(/^@/, "").toLowerCase();

  emitter.send("tool_progress", {
    tool: "extract_frame",
    generationId: context.generationId,
    status: "generating",
    message: `Extracting ${frameType} frame…`,
  });

  try {
    const frameArg = frameType === "first" ? "0" : frameType === "last" ? "-1" : "mid";

    const { predictionId, output } = await runModel<string | string[]>(
      FRAME_EXTRACTOR_MODEL,
      { video: videoUrl, frame: frameArg },
      { maxWaitMs: 120_000 }
    );

    const url = Array.isArray(output) ? output[0] : output;
    if (!url) {
      return { success: false, content: "Frame extraction returned no URL." };
    }

    const variantNum = await getNextVariantNumber(context.generationId);
    const { data: asset } = await db
      .from("generation_assets")
      .insert({
        generation_id: context.generationId,
        org_id: context.orgId,
        type: "image",
        public_url: url,
        storage_path: url,
        tag: tag || null,
        asset_role: "keyframe",
        prediction_id: predictionId,
        status: "ready",
        metadata: {
          keyframe_role: frameType === "last" ? "first_frame" : frameType,
          source_video_url: videoUrl,
          extracted: true,
        },
        variant_number: variantNum,
      })
      .select("id")
      .single();

    return {
      success: true,
      content: `Extracted ${frameType} frame${tag ? ` as @${tag}` : ""}.`,
      assets: [
        {
          assetId: asset?.id,
          type: "image",
          url,
          metadata: { tag, role: "keyframe", frame_type: frameType },
        },
      ],
    };
  } catch (error) {
    console.error("[tool:extract_frame] Error:", error);
    return {
      success: false,
      content: `Frame extraction failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
