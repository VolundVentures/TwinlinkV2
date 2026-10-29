// apply_signature_pass — imprint a director's grade on a rendered scene.
//
// Seedance 2.5 video-to-video in `edit` mode: the scene is modified in place
// (same length, same action, native audio kept) per one of the persona's
// signature prompts — color / grade / lighting / atmosphere fingerprint.

import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { getNextVariantNumber, formatDbError } from "./types";
import { seedanceVideoToVideo } from "@/lib/runway";
import { db } from "@/lib/db";
import { persistAsset } from "@/lib/generation/persist-asset";

export const applySignaturePassDefinition: ToolDefinition = {
  name: "apply_signature_pass",
  description:
    "Apply the director's signature grade to a rendered scene via Seedance 2.5 (in-place edit). Imprints the director's visual fingerprint — color / grade / lighting / atmosphere — while preserving action, framing and native audio.\n\n" +
    "Use one of the director persona's signature prompt strings verbatim (they're listed in the DIRECTORS section). One prompt per call. Run on the master and each coverage variant for a coherent film-wide grade.\n\n" +
    "Costs ≈ scene length × 45 cr/s.",
  input_schema: {
    type: "object",
    properties: {
      target_asset_id: { type: "string", description: "DB asset ID of the scene to grade." },
      director_id: { type: "string", description: "Director persona ID (e.g. 'marcel-vrai')." },
      signature_prompt: {
        type: "string",
        description: "The grade instruction — pulled verbatim from the director persona's signature prompts.",
      },
    },
    required: ["target_asset_id", "director_id", "signature_prompt"],
  },
};

export const applySignaturePassTool: ToolHandler = async (
  input,
  context,
  emitter
): Promise<ToolResult> => {
  const targetId = input.target_asset_id as string;
  const directorId = input.director_id as string;
  const signaturePrompt = input.signature_prompt as string;

  if (!targetId || !directorId || !signaturePrompt) {
    return { success: false, content: "target_asset_id, director_id, signature_prompt required." };
  }

  const { data: target } = await db
    .from("generation_assets")
    .select("id, public_url, aspect_ratio, metadata, duration_seconds")
    .eq("id", targetId)
    .single();

  if (!target?.public_url) {
    return { success: false, content: `Target asset ${targetId} not found.` };
  }
  const targetMeta = (target.metadata as Record<string, unknown> | null) || {};
  const duration =
    (target.duration_seconds as number | null) || (targetMeta.duration as number | undefined) || 25;

  emitter.send("tool_progress", {
    tool: "apply_signature_pass",
    generationId: context.generationId,
    status: "generating",
    message: `${directorId} signature pass on ${targetId}`,
  });

  try {
    const taskResult = await seedanceVideoToVideo({
      promptVideo: target.public_url,
      sourceDurationSeconds: duration,
      mode: "edit",
      promptText: `${signaturePrompt} Preserve the action, framing, performances and sound exactly — change only the look.`,
      generationId: context.generationId,
      description: `${directorId} signature pass on ${targetId}`,
    });

    const sourceUrl = Array.isArray(taskResult.output)
      ? taskResult.output[0]
      : (taskResult.output as unknown as string);
    if (!sourceUrl) throw new Error("signature_pass: no output URL");

    const persistentUrl = await persistAsset(sourceUrl, {
      generationId: context.generationId,
      kind: "video",
      basename: `signature-${directorId}-${targetId.slice(0, 8)}`,
    });
    const variantNum = await getNextVariantNumber(context.generationId);

    const { data: asset, error: insertErr } = await db
      .from("generation_assets")
      .insert({
        generation_id: context.generationId,
        org_id: context.orgId,
        type: "video",
        aspect_ratio: target.aspect_ratio || context.aspectRatio || "16:9",
        public_url: persistentUrl,
        storage_path: persistentUrl,
        duration_seconds: duration,
        prediction_id: taskResult.taskId,
        status: "ready",
        parent_asset_id: target.id,
        metadata: {
          ...targetMeta,
          shot_role: "signature_pass",
          model: "seedance2_5",
          mode: "seedance_edit",
          director_id: directorId,
          signature_prompt: signaturePrompt,
          parent_asset_id: target.id,
          source_url: sourceUrl,
        },
        variant_number: variantNum,
      })
      .select("id")
      .single();

    if (insertErr || !asset) {
      return {
        success: false,
        content: `Signature pass generated but DB insert failed: ${formatDbError(insertErr)}. URL: ${sourceUrl}`,
      };
    }

    emitter.send("tool_progress", {
      tool: "apply_signature_pass",
      generationId: context.generationId,
      status: "complete",
      message: `Signature applied: ${directorId}`,
    });

    return {
      success: true,
      content: `Signature pass applied (${directorId}) on asset ${targetId}.`,
      assets: [
        {
          assetId: asset.id,
          type: "video",
          url: sourceUrl,
          metadata: { shot_role: "signature_pass", director_id: directorId },
        },
      ],
    };
  } catch (error) {
    return {
      success: false,
      content: `Signature pass failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
