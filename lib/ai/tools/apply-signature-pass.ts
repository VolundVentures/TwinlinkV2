// apply_signature_pass — apply a director's visual signature via Aleph.
//
// Each director persona has 3-5 signature Aleph prompts in their JSON
// (alephSignaturePrompts) — color/grade/lighting fingerprint phrases.
// This tool runs one of those prompts on a target video as a 5s pass to
// imprint authorial style.
//
// Used per-shot in the production phase (after master + coverage), and
// optionally on a final assembled cut as a film-wide grade.

import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { getNextVariantNumber, formatDbError } from "./types";
import { alephSignaturePass, toRunwayRatio } from "@/lib/runway";
import { db } from "@/lib/db";
import { persistAsset } from "@/lib/generation/persist-asset";

export const applySignaturePassDefinition: ToolDefinition = {
  name: "apply_signature_pass",
  description:
    "Apply a director's signature pass via Aleph (5s). Imprints the director's visual fingerprint — color/grade/lighting/atmosphere — on a target video.\n\n" +
    "Use one of the director persona's `alephSignaturePrompts` strings as the prompt. The persona system loads these per-director; this tool only runs one prompt per call.\n\n" +
    "Costs 12 credits.",
  input_schema: {
    type: "object",
    properties: {
      target_asset_id: { type: "string", description: "DB asset ID of the video to pass." },
      director_id: { type: "string", description: "Director persona ID (e.g. 'marcel-vrai')." },
      signature_prompt: {
        type: "string",
        description: "The Aleph instruction. Pulled from the director persona's signature prompts.",
      },
      aspect_ratio: { type: "string" },
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
  const aspectRatio = (input.aspect_ratio as string) || context.aspectRatio || "16:9";

  if (!targetId || !directorId || !signaturePrompt) {
    return { success: false, content: "target_asset_id, director_id, signature_prompt required." };
  }

  const { data: target } = await db
    .from("generation_assets")
    .select("id, public_url, aspect_ratio, metadata")
    .eq("id", targetId)
    .single();

  if (!target?.public_url) {
    return { success: false, content: `Target asset ${targetId} not found.` };
  }

  emitter.send("tool_progress", {
    tool: "apply_signature_pass",
    generationId: context.generationId,
    status: "generating",
    message: `${directorId} signature pass on ${targetId}`,
  });

  try {
    const taskResult = await alephSignaturePass({
      videoUri: target.public_url,
      signaturePrompt,
      ratio: toRunwayRatio(target.aspect_ratio || aspectRatio),
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
        aspect_ratio: target.aspect_ratio || aspectRatio,
        public_url: persistentUrl,
        storage_path: persistentUrl,
        duration_seconds: 5,
        prediction_id: taskResult.taskId,
        status: "ready",
        parent_asset_id: target.id,
        metadata: {
          ...((target.metadata as Record<string, unknown>) || {}),
          shot_role: "signature_pass",
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
