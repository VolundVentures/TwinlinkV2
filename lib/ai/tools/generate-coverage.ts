// generate_coverage — alternate-angle coverage of an existing scene.
//
// Seedance 2.5 video-to-video in `reference` mode: the master scene is the
// conditioning video, the prompt asserts continuity and names the new camera
// position. Output is a new scene of the same length. Cost: output seconds
// + input seconds (25s master ≈ 1,125 credits at 720p) — generate coverage
// only where the cut needs it.

import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { getNextVariantNumber, formatDbError } from "./types";
import { seedanceVideoToVideo, toSeedanceRatio } from "@/lib/runway";
import { db } from "@/lib/db";
import { persistAsset } from "@/lib/generation/persist-asset";

export const generateCoverageDefinition: ToolDefinition = {
  name: "generate_coverage",
  description:
    "Generate alternate-angle coverage of an existing scene via Seedance 2.5 (video reference mode). The coverage shows the SAME fictional moment from a different camera position — close-up, OTS, low-angle, reverse — at the same length as the master.\n\n" +
    "**Prompt rule:** assert continuity explicitly. e.g. *'Same scene, same moment, same character, same lighting, same dialogue — but [new angle].'*\n\n" +
    "Expensive (≈ master length × 45 cr/s). Generate 1–2 variants per master, only where the edit needs a cut.",
  input_schema: {
    type: "object",
    properties: {
      master_shot_id: {
        type: "string",
        description: "Stable shot ID of the master this is coverage for.",
      },
      master_asset_id: {
        type: "string",
        description: "DB asset ID of the master video. Use this OR master_shot_id to locate the source.",
      },
      angle_label: {
        type: "string",
        description: "Short label for this variant. e.g. 'close-up-hands', 'OTS', 'low-angle', 'reverse'.",
      },
      angle_prompt: {
        type: "string",
        description:
          "Lead with the continuity assertion ('Same scene, same moment, same character, same lighting'), then describe the new angle and any framing beats.",
      },
      aspect_ratio: {
        type: "string",
        enum: ["16:9", "9:16", "1:1", "21:9", "4:3", "3:4"],
      },
    },
    required: ["angle_label", "angle_prompt"],
  },
};

export const generateCoverageTool: ToolHandler = async (
  input,
  context,
  emitter
): Promise<ToolResult> => {
  const masterShotId = input.master_shot_id as string | undefined;
  const masterAssetId = input.master_asset_id as string | undefined;
  const angleLabel = input.angle_label as string;
  const anglePrompt = input.angle_prompt as string;
  const aspectRatio = (input.aspect_ratio as string) || context.aspectRatio || "16:9";

  if (!angleLabel || !anglePrompt) {
    return { success: false, content: "angle_label and angle_prompt are required." };
  }
  if (!masterShotId && !masterAssetId) {
    return {
      success: false,
      content: "Provide either master_shot_id or master_asset_id to locate the source video.",
    };
  }

  let masterQuery = db
    .from("generation_assets")
    .select("id, public_url, metadata, aspect_ratio, duration_seconds")
    .eq("generation_id", context.generationId)
    .eq("type", "video");

  if (masterAssetId) {
    masterQuery = masterQuery.eq("id", masterAssetId);
  } else if (masterShotId) {
    masterQuery = masterQuery.contains("metadata", { shot_id: masterShotId, shot_role: "master" });
  }

  const { data: master } = await masterQuery
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!master?.public_url) {
    return {
      success: false,
      content: `No master scene found for ${masterAssetId ? `asset ${masterAssetId}` : `shot ${masterShotId}`}.`,
    };
  }
  const masterMeta = (master.metadata as Record<string, unknown> | null) || {};
  const duration =
    (master.duration_seconds as number | null) || (masterMeta.duration as number | undefined) || 25;

  emitter.send("tool_progress", {
    tool: "generate_coverage",
    generationId: context.generationId,
    status: "generating",
    message: `Generating coverage [${angleLabel}] from master (${duration}s)`,
  });

  try {
    const taskResult = await seedanceVideoToVideo({
      promptVideo: master.public_url,
      sourceDurationSeconds: duration,
      mode: "reference",
      promptText: anglePrompt,
      duration,
      ratio: toSeedanceRatio(master.aspect_ratio || aspectRatio),
      generationId: context.generationId,
      description: `coverage [${angleLabel}] from master ${masterShotId || master.id}`,
    });

    const sourceUrl = Array.isArray(taskResult.output)
      ? taskResult.output[0]
      : (taskResult.output as unknown as string);
    if (!sourceUrl) throw new Error("coverage: no output URL");

    const variantNum = await getNextVariantNumber(context.generationId);
    const persistentUrl = await persistAsset(sourceUrl, {
      generationId: context.generationId,
      kind: "video",
      basename: `coverage-${angleLabel}`,
    });

    const { data: asset, error: insertErr } = await db
      .from("generation_assets")
      .insert({
        generation_id: context.generationId,
        org_id: context.orgId,
        type: "video",
        aspect_ratio: master.aspect_ratio || aspectRatio,
        public_url: persistentUrl,
        storage_path: persistentUrl,
        duration_seconds: duration,
        prediction_id: taskResult.taskId,
        status: "ready",
        parent_asset_id: master.id,
        metadata: {
          shot_role: "coverage",
          model: "seedance2_5",
          mode: "seedance_reference",
          angle_label: angleLabel,
          angle_prompt: anglePrompt,
          master_shot_id: masterShotId || masterMeta.shot_id,
          master_asset_id: master.id,
          duration,
          has_native_audio: true,
          source_url: sourceUrl,
        },
        variant_number: variantNum,
      })
      .select("id")
      .single();

    if (insertErr || !asset) {
      return {
        success: false,
        content: `Coverage generated but DB insert failed: ${formatDbError(insertErr)}. URL: ${sourceUrl}`,
      };
    }

    emitter.send("tool_progress", {
      tool: "generate_coverage",
      generationId: context.generationId,
      status: "complete",
      message: `Coverage ready: ${angleLabel}`,
    });

    return {
      success: true,
      content: `Coverage [${angleLabel}] generated from master ${masterShotId || master.id} (${duration}s).`,
      assets: [
        {
          assetId: asset.id,
          type: "video",
          url: sourceUrl,
          metadata: {
            shot_role: "coverage",
            angle_label: angleLabel,
            duration_seconds: duration,
            aspect_ratio: master.aspect_ratio || aspectRatio,
          },
        },
      ],
    };
  } catch (error) {
    console.error("[tool:generate_coverage] Error:", error);
    return {
      success: false,
      content: `Coverage generation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
