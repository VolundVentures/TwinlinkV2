// finish_film — 4K master of the composed film via Runway's Magnific upscaler.
//
// The last step before PREMIERE. Takes the final cut (720p Seedance scenes
// composed in Remotion) and returns a 4K deliverable. Billed per frame
// (~$0.012 at 4K), so a 30s film at 30fps ≈ $11.

import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { getNextVariantNumber, formatDbError } from "./types";
import { upscaleVideo } from "@/lib/runway";
import { db } from "@/lib/db";
import { persistAsset } from "@/lib/generation/persist-asset";

export const finishFilmDefinition: ToolDefinition = {
  name: "finish_film",
  description:
    "Produce the 4K master of the composed film (Runway Magnific video upscaler). Call ONCE, after the final cut is approved, on the final film asset. Keeps the grade (`natural` flavour, low creativity). Optional frame-rate boost for smoother motion.\n\n" +
    "Billed per frame (~$0.012/frame at 4K). Do not run on individual scenes.",
  input_schema: {
    type: "object",
    properties: {
      final_asset_id: {
        type: "string",
        description: "DB asset id of the composed final film. If omitted, the latest final-film asset is used.",
      },
      resolution: { type: "string", enum: ["2k", "4k"], description: "Default 4k." },
      fps_boost: { type: "boolean", description: "Increase output frame rate. Default false." },
    },
  },
};

export const finishFilmTool: ToolHandler = async (input, context, emitter): Promise<ToolResult> => {
  const finalAssetId = input.final_asset_id as string | undefined;
  const resolution = (input.resolution as "2k" | "4k" | undefined) ?? "4k";
  const fpsBoost = input.fps_boost === true;

  let query = db
    .from("generation_assets")
    .select("id, public_url, aspect_ratio, metadata, duration_seconds")
    .eq("generation_id", context.generationId)
    .eq("type", "video");
  query = finalAssetId ? query.eq("id", finalAssetId) : query.eq("asset_role", "final");
  const { data: final } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();

  if (!final?.public_url) {
    return { success: false, content: "No final film found. Run compose_video first." };
  }
  const meta = (final.metadata as Record<string, unknown> | null) || {};
  const duration =
    (final.duration_seconds as number | null) || (meta.duration_seconds as number | undefined) || 30;
  const fps = (meta.fps as number | undefined) || 30;

  emitter.send("tool_progress", {
    tool: "finish_film",
    generationId: context.generationId,
    status: "generating",
    message: `Mastering the film at ${resolution}${fpsBoost ? " with frame-rate boost" : ""}…`,
  });

  try {
    const taskResult = await upscaleVideo({
      videoUri: final.public_url,
      resolution,
      fpsBoost,
      sourceFrames: Math.round(duration * fps),
      generationId: context.generationId,
      description: `${resolution} master of final film`,
    });
    const sourceUrl = Array.isArray(taskResult.output)
      ? taskResult.output[0]
      : (taskResult.output as unknown as string);
    if (!sourceUrl) throw new Error("upscaler returned no output URL");

    const persistentUrl = await persistAsset(sourceUrl, {
      generationId: context.generationId,
      kind: "video",
      basename: `master-${resolution}`,
    });
    const variantNum = await getNextVariantNumber(context.generationId);
    const { data: asset, error: insertErr } = await db
      .from("generation_assets")
      .insert({
        generation_id: context.generationId,
        org_id: context.orgId,
        type: "video",
        aspect_ratio: final.aspect_ratio,
        public_url: persistentUrl,
        storage_path: persistentUrl,
        asset_role: "final_master",
        duration_seconds: duration,
        parent_asset_id: final.id,
        prediction_id: taskResult.taskId,
        status: "ready",
        metadata: { ...meta, resolution, fps_boost: fpsBoost, source_url: sourceUrl },
        variant_number: variantNum,
      })
      .select("id")
      .single();
    if (insertErr || !asset) {
      return { success: false, content: `Master rendered but DB insert failed: ${formatDbError(insertErr)}. URL: ${persistentUrl}` };
    }

    emitter.send("tool_progress", {
      tool: "finish_film",
      generationId: context.generationId,
      status: "complete",
      message: `${resolution.toUpperCase()} master ready.`,
    });
    return {
      success: true,
      content: `${resolution.toUpperCase()} master ready: ${persistentUrl}`,
      assets: [{ assetId: asset.id, type: "video", url: persistentUrl, metadata: { role: "final_master", resolution } }],
    };
  } catch (error) {
    return { success: false, content: `Mastering failed: ${error instanceof Error ? error.message : String(error)}` };
  }
};
