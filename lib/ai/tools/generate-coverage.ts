// generate_coverage — Aleph 5s novel-view coverage from a master shot.
//
// Takes a master shot (video) and generates an alternate-angle variant of the
// same fictional moment. Same character, same wardrobe, same lighting, same
// time of day — different camera position. Editor cuts between master and
// coverage in post for dynamic editorial pacing.
//
// Aleph max duration is 5 seconds. For master shots longer than 5s, the
// coverage will animate the equivalent first 5s window of the master.

import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { getNextVariantNumber, formatDbError } from "./types";
import { alephCoverage, toRunwayRatio } from "@/lib/runway";
import { db } from "@/lib/db";
import { persistAsset } from "@/lib/generation/persist-asset";

export const generateCoverageDefinition: ToolDefinition = {
  name: "generate_coverage",
  description:
    "Generate alternate-angle coverage from a master shot via Aleph (5s max). The coverage shows the SAME fictional moment from a different camera position — close-up, OTS, low-angle, reverse, etc.\n\n" +
    "**Prompt rule:** assert continuity explicitly. e.g. *'Same scene, same moment, same character, same lighting — but [new angle].'* Aleph's strength is preserving the world while changing the camera.\n\n" +
    "Useful angles: close-up, over-the-shoulder, low-angle, high-angle, reverse, profile, hand close-up. Generate 2-4 variants per master to give the editor cutting options.\n\n" +
    "Costs 12 credits.",
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
          "Aleph instruction. Lead with continuity assertion ('Same scene, same moment, same character, same lighting'), then describe the new angle.",
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

  // Locate master.
  let masterQuery = db
    .from("generation_assets")
    .select("id, public_url, metadata, aspect_ratio")
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
      content: `No master shot found for ${masterAssetId ? `asset ${masterAssetId}` : `shot ${masterShotId}`}.`,
    };
  }

  emitter.send("tool_progress", {
    tool: "generate_coverage",
    generationId: context.generationId,
    status: "generating",
    message: `Generating coverage [${angleLabel}] from master`,
  });

  try {
    const taskResult = await alephCoverage({
      masterVideoUri: master.public_url,
      anglePrompt,
      duration: 5,
      ratio: toRunwayRatio(aspectRatio),
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
        aspect_ratio: aspectRatio,
        public_url: persistentUrl,
        storage_path: persistentUrl,
        duration_seconds: 5,
        prediction_id: taskResult.taskId,
        status: "ready",
        parent_asset_id: master.id,
        metadata: {
          shot_role: "coverage",
          angle_label: angleLabel,
          angle_prompt: anglePrompt,
          master_shot_id: masterShotId || (master.metadata as Record<string, unknown> | null)?.shot_id,
          master_asset_id: master.id,
          source_url: sourceUrl,
        },
        variant_number: variantNum,
      })
      .select("id")
      .single();

    if (insertErr || !asset) {
      const full = formatDbError(insertErr);
      return {
        success: false,
        content: `Coverage generated but DB insert failed: ${full}. URL: ${sourceUrl}`,
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
      content: `Coverage [${angleLabel}] generated from master ${masterShotId || master.id} (5s).`,
      assets: [
        {
          assetId: asset.id,
          type: "video",
          url: sourceUrl,
          metadata: {
            shot_role: "coverage",
            angle_label: angleLabel,
            duration_seconds: 5,
            aspect_ratio: aspectRatio,
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
