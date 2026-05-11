import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { getNextVariantNumber } from "./types";
import { alephEdit, toRunwayRatio } from "@/lib/runway";
import { resolveTags, normalizeTag } from "@/lib/ai/tag-resolver";
import { db } from "@/lib/db";
import { persistAsset } from "@/lib/generation/persist-asset";
import { validateImageUrls } from "@/lib/generation/validate-image-url";

/**
 * edit_video — surgical edit on an existing rendered shot via Aleph (5s max).
 *
 * AUTEUR Frame Anchor pipeline (May 2026): Aleph is the only video-to-video
 * tool. It plays three roles:
 *   1. Coverage (alternate camera angle of the same fictional moment) → use
 *      `generate_coverage` instead.
 *   2. Signature pass (director's color/grade fingerprint) → use
 *      `apply_signature_pass`.
 *   3. Surgical edit (eyeline tweak, weather change, swap object) → THIS TOOL.
 *
 * Aleph operates on the FIRST 5 SECONDS of the source video. Longer source
 * shots will only have their opening 5s edited. The shot's identity is
 * preserved by the original keyframe — Aleph cannot drift the world.
 */

export const editVideoDefinition: ToolDefinition = {
  name: "edit_video",
  description:
    "Apply a surgical edit to an existing rendered shot via Aleph (5s max). Use for: swapping a subject, changing wardrobe color, adding/removing an object, weather/light/style change — without regenerating from a keyframe.\n\n" +
    "**Aleph's strength:** preserves the world while changing one thing. Always include a 'preserve the rest' anchor in the edit instruction.\n\n" +
    "**Inputs:**\n" +
    "- `source_shot_tag`: @tag of the existing shot OR `source_video_url`.\n" +
    "- `edit_instruction`: ONE specific change + 'preserve the rest'. Reference plates by @tag — they'll be passed as references.\n" +
    "- `reference_image_url`: optional single image reference for the edit.\n\n" +
    "**Aleph is 5s max.** If the source is 10s, only the first 5s is processed — split first or pick a smaller window.\n\n" +
    "**When NOT to use this tool:**\n" +
    "- For a different camera angle of the same moment → `generate_coverage`.\n" +
    "- For the director's signature color/grade → `apply_signature_pass`.\n" +
    "- For a fundamental re-shoot (changing the action, not just an element) → re-run `generate_keyframe` + `generate_video`.\n\n" +
    "After editing, call `request_approval(stage=\"shots\")` with the updated items list. Costs 12 credits (Aleph 5s).",
  input_schema: {
    type: "object",
    properties: {
      shot_id: {
        type: "string",
        description: "Shot id from write_script this edited clip will replace (e.g. 'shot_3').",
      },
      source_shot_tag: {
        type: "string",
        description:
          "@tag of an existing shot asset to edit. Either this OR source_video_url must be provided.",
      },
      source_video_url: {
        type: "string",
        description:
          "Direct URL to the video to edit. Use when the source isn't a tagged asset.",
      },
      edit_instruction: {
        type: "string",
        description:
          "ONE specific change + 'preserve the rest'. Example: 'Change the jacket to charcoal wool. Preserve pose, motion, and lighting exactly.'",
      },
      reference_image_url: {
        type: "string",
        description:
          "Optional single image reference (Aleph supports one). Validate before passing.",
      },
    },
    required: ["shot_id", "edit_instruction"],
  },
};

export const editVideoTool: ToolHandler = async (
  input,
  context,
  emitter
): Promise<ToolResult> => {
  const shotId = input.shot_id as string;
  const sourceShotTag = input.source_shot_tag
    ? normalizeTag(input.source_shot_tag as string)
    : undefined;
  const sourceVideoUrl = input.source_video_url as string | undefined;
  const editInstruction = input.edit_instruction as string;
  const rawReferenceUrl = input.reference_image_url as string | undefined;

  if (!editInstruction) {
    return { success: false, content: "edit_video requires edit_instruction." };
  }
  if (!sourceShotTag && !sourceVideoUrl) {
    return {
      success: false,
      content:
        "edit_video requires either source_shot_tag (preferred) or source_video_url.",
    };
  }

  emitter.send("tool_progress", {
    tool: "edit_video",
    generationId: context.generationId,
    status: "generating",
    message: `Aleph editing ${sourceShotTag ? `@${sourceShotTag}` : "video"}…`,
  });

  // Resolve source video.
  let videoUrl = sourceVideoUrl;
  let parentAssetId: string | null = null;
  let parentAspect: string | null = null;
  if (sourceShotTag) {
    // Try @tag lookup first; fall back to scanning shot_id metadata.
    let parent: { id: string; public_url: string | null; aspect_ratio: string | null } | null = null;
    const { data: byTag } = await db
      .from("generation_assets")
      .select("id, public_url, aspect_ratio")
      .eq("generation_id", context.generationId)
      .eq("tag", sourceShotTag)
      .maybeSingle();
    parent = byTag ?? null;

    // If the tag wasn't found and the input looks like a shot_id, search by shot_id metadata.
    if (!parent && sourceShotTag.startsWith("shot_")) {
      const { data: byShotId } = await db
        .from("generation_assets")
        .select("id, public_url, aspect_ratio")
        .eq("generation_id", context.generationId)
        .eq("type", "video")
        .contains("metadata", { shot_id: sourceShotTag })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      parent = byShotId ?? null;
    }

    if (!parent || !parent.public_url) {
      return {
        success: false,
        content: `Could not resolve @${sourceShotTag}. Confirm the shot exists via list_assets or pass source_video_url directly.`,
      };
    }
    videoUrl = parent.public_url;
    parentAssetId = parent.id;
    parentAspect = parent.aspect_ratio;
  }

  if (!videoUrl) {
    return { success: false, content: "Could not resolve source video URL." };
  }

  // Validate reference URL if user-attached.
  if (rawReferenceUrl) {
    const { ok, bad } = await validateImageUrls([rawReferenceUrl], { timeoutMs: 6_000 });
    if (!ok) {
      const details = bad
        .map(
          (b) =>
            `  - ${b.url.slice(0, 80)}: ${b.reason}${b.status ? ` (HTTP ${b.status})` : ""}`
        )
        .join("\n");
      return {
        success: false,
        content: `Reference URL isn't a usable image. Do NOT retry with this URL.\n\n${details}`,
      };
    }
  }

  // Resolve any @tags inside the edit_instruction to a single image reference.
  // Aleph supports one reference image; if the instruction references multiple
  // plates, prefer the first user-attached URL, otherwise the first @tag's URL.
  let referenceImageUri = rawReferenceUrl;
  const tagMatches = Array.from(editInstruction.matchAll(/@([a-z][a-z0-9_]*)/g))
    .map((m) => m[1])
    .filter((t, i, a) => a.indexOf(t) === i);
  if (!referenceImageUri && tagMatches.length > 0) {
    const { imageUrls } = await resolveTags(
      "",
      context.generationId,
      tagMatches.slice(0, 1).map(normalizeTag)
    );
    referenceImageUri = imageUrls[0];
  }

  const aspectRatio = parentAspect || context.aspectRatio || "16:9";

  try {
    const taskResult = await alephEdit({
      videoUri: videoUrl,
      editPrompt: editInstruction,
      referenceImageUri,
      duration: 5,
      ratio: toRunwayRatio(aspectRatio),
      generationId: context.generationId,
      description: `edit ${shotId} via Aleph`,
    });

    const sourceUrl = Array.isArray(taskResult.output)
      ? taskResult.output[0]
      : (taskResult.output as unknown as string);

    if (!sourceUrl) {
      return {
        success: false,
        content: "Aleph returned no output. Check the source clip and try again.",
      };
    }

    const persistentUrl = await persistAsset(sourceUrl, {
      generationId: context.generationId,
      kind: "video",
      basename: `edit-${shotId}`,
    });

    const variantNum = await getNextVariantNumber(context.generationId);
    const { data: asset } = await db
      .from("generation_assets")
      .insert({
        generation_id: context.generationId,
        org_id: context.orgId,
        type: "video",
        aspect_ratio: aspectRatio,
        public_url: persistentUrl,
        storage_path: persistentUrl,
        asset_role: "shot",
        parent_asset_id: parentAssetId,
        prediction_id: taskResult.taskId,
        status: "ready",
        metadata: {
          shot_id: shotId,
          shot_role: "edit",
          model: "gen4_aleph",
          edit_instruction: editInstruction,
          source_shot_tag: sourceShotTag,
          source_video_url: videoUrl,
          source_url: sourceUrl,
          duration: 5,
          provider: "runway-aleph",
        },
        variant_number: variantNum,
      })
      .select("id")
      .single();

    emitter.send("tool_progress", {
      tool: "edit_video",
      generationId: context.generationId,
      status: "complete",
      message: `Shot ${shotId} edited via Aleph.`,
    });

    if (asset?.id) {
      emitter.send("asset_ready", {
        assetId: asset.id,
        type: "video",
        url: persistentUrl,
        metadata: {
          shot_id: shotId,
          role: "shot",
          shot_role: "edit",
          edited_from: sourceShotTag,
          aspect_ratio: aspectRatio,
        },
      });
    }

    return {
      success: true,
      content: `Edited shot ${shotId} via Aleph (5s). Next: call request_approval(stage="shots").`,
      assets: [
        {
          assetId: asset?.id,
          type: "video",
          url: persistentUrl,
          metadata: {
            shot_id: shotId,
            role: "shot",
            shot_role: "edit",
            edited_from: sourceShotTag,
          },
        },
      ],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[tool:edit_video] error:", msg);
    return { success: false, content: `Aleph edit failed: ${msg}` };
  }
};
