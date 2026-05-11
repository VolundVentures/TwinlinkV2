// apply_director_note — Aleph 5s in-place edit driven by a review note.
//
// Used in the review phase. The director (live, on Characters API) gives a
// technical note ("the eyeline in shot 3 is half a degree off, the magenta
// wants 6% less in the climax"). The agent translates this into a surgical
// Aleph instruction targeting one shot. Output replaces the affected shot
// in the cut.

import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { getNextVariantNumber, formatDbError } from "./types";
import { alephEdit, toRunwayRatio } from "@/lib/runway";
import { db } from "@/lib/db";
import { persistAsset } from "@/lib/generation/persist-asset";

export const applyDirectorNoteDefinition: ToolDefinition = {
  name: "apply_director_note",
  description:
    "Apply a single director note as an Aleph correction to one shot (5s). Surgical — keep the prompt narrow.\n\n" +
    "Used after review. The note should describe ONE specific change ('eyeline shift', 'cool the highlights', 'add light rain to the window', 'remove the lamp glare') and explicitly preserve the rest.\n\n" +
    "Costs 12 credits.",
  input_schema: {
    type: "object",
    properties: {
      target_asset_id: { type: "string" },
      director_id: { type: "string" },
      note_text: {
        type: "string",
        description: "Original director's note in natural language (for the audit log / lesson_plan).",
      },
      edit_prompt: {
        type: "string",
        description: "Translated Aleph instruction. Surgical, with explicit 'preserve the rest'.",
      },
      reference_image_url: {
        type: "string",
        description: "Optional reference image for the edit.",
      },
    },
    required: ["target_asset_id", "director_id", "note_text", "edit_prompt"],
  },
};

export const applyDirectorNoteTool: ToolHandler = async (
  input,
  context,
  emitter
): Promise<ToolResult> => {
  const targetId = input.target_asset_id as string;
  const directorId = input.director_id as string;
  const noteText = input.note_text as string;
  const editPrompt = input.edit_prompt as string;
  const referenceImageUri = input.reference_image_url as string | undefined;

  const { data: target } = await db
    .from("generation_assets")
    .select("id, public_url, aspect_ratio, metadata")
    .eq("id", targetId)
    .single();

  if (!target?.public_url) {
    return { success: false, content: `Target asset ${targetId} not found.` };
  }

  emitter.send("tool_progress", {
    tool: "apply_director_note",
    generationId: context.generationId,
    status: "generating",
    message: `${directorId} note on ${targetId}: ${noteText.slice(0, 80)}`,
  });

  try {
    const taskResult = await alephEdit({
      videoUri: target.public_url,
      editPrompt,
      referenceImageUri,
      duration: 5,
      ratio: toRunwayRatio(target.aspect_ratio || "16:9"),
      generationId: context.generationId,
      description: `director note (${directorId}) on ${targetId}`,
    });

    const sourceUrl = Array.isArray(taskResult.output)
      ? taskResult.output[0]
      : (taskResult.output as unknown as string);
    if (!sourceUrl) throw new Error("director_note: no output URL");

    const persistentUrl = await persistAsset(sourceUrl, {
      generationId: context.generationId,
      kind: "video",
      basename: `note-${directorId}-${targetId.slice(0, 8)}`,
    });
    const variantNum = await getNextVariantNumber(context.generationId);

    const { data: asset, error: insertErr } = await db
      .from("generation_assets")
      .insert({
        generation_id: context.generationId,
        org_id: context.orgId,
        type: "video",
        aspect_ratio: target.aspect_ratio || "16:9",
        public_url: persistentUrl,
        storage_path: persistentUrl,
        duration_seconds: 5,
        prediction_id: taskResult.taskId,
        status: "ready",
        parent_asset_id: target.id,
        metadata: {
          ...((target.metadata as Record<string, unknown>) || {}),
          shot_role: "director_note",
          director_id: directorId,
          note_text: noteText,
          edit_prompt: editPrompt,
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
        content: `Director note applied but DB insert failed: ${formatDbError(insertErr)}.`,
      };
    }

    emitter.send("tool_progress", {
      tool: "apply_director_note",
      generationId: context.generationId,
      status: "complete",
      message: `Director note applied`,
    });

    return {
      success: true,
      content: `Director note (${directorId}) applied: ${noteText.slice(0, 100)}`,
      assets: [
        {
          assetId: asset.id,
          type: "video",
          url: sourceUrl,
          metadata: { shot_role: "director_note", director_id: directorId, note_text: noteText },
        },
      ],
    };
  } catch (error) {
    return {
      success: false,
      content: `Director note failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
