import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { getNextVariantNumber } from "./types";
import { seedanceVideoToVideo } from "@/lib/runway";
import { resolveTags, normalizeTag } from "@/lib/ai/tag-resolver";
import { db } from "@/lib/db";
import { persistAsset } from "@/lib/generation/persist-asset";
import { validateImageUrls } from "@/lib/generation/validate-image-url";

/**
 * edit_video — in-place edit of a rendered scene via Seedance 2.5 (`edit`
 * mode). Same length, same action, native audio kept; ONE thing changes.
 * Used for both user-flagged fixes and director review notes.
 *
 * For a different camera angle → generate_coverage. For the director's
 * grade → apply_signature_pass.
 */

export const editVideoDefinition: ToolDefinition = {
  name: "edit_video",
  description:
    "Apply ONE surgical change to a rendered scene via Seedance 2.5 in-place edit — swap a subject, change wardrobe colour, add/remove an object, shift weather / light, fix an eyeline — without re-rolling the scene. The scene keeps its length, action and native audio.\n\n" +
    "Always include a 'preserve the rest' anchor in the instruction. Reference plates by @tag and they are passed as image references.\n\n" +
    "**Inputs:**\n" +
    "- `source_shot_tag`: shot id (e.g. 'shot_2') or @tag of the existing scene, OR `source_video_url`.\n" +
    "- `edit_instruction`: ONE specific change + 'preserve the rest'.\n" +
    "- `reference_image_url`: optional image reference for the change.\n" +
    "- `note_text`: optional — the director's original note, kept for the audit log.\n\n" +
    "**When NOT to use this tool:**\n" +
    "- A different camera angle of the same moment → `generate_coverage`.\n" +
    "- The director's signature colour/grade → `apply_signature_pass`.\n" +
    "- A fundamental re-shoot (changing the action itself) → re-run `generate_keyframe` + `generate_video`.\n\n" +
    "After editing, call `request_approval(stage=\"shots\")` with the updated items list. Costs ≈ scene length × 45 cr/s.",
  input_schema: {
    type: "object",
    properties: {
      shot_id: {
        type: "string",
        description: "Shot id from write_script this edited scene will replace (e.g. 'shot_3').",
      },
      source_shot_tag: {
        type: "string",
        description:
          "Shot id or @tag of an existing scene asset to edit. Either this OR source_video_url must be provided.",
      },
      source_video_url: {
        type: "string",
        description: "Direct URL to the video to edit. Use when the source isn't a tagged asset.",
      },
      edit_instruction: {
        type: "string",
        description:
          "ONE specific change + 'preserve the rest'. Example: 'Change the jacket to charcoal wool. Preserve pose, motion, lighting and dialogue exactly.'",
      },
      reference_image_url: {
        type: "string",
        description: "Optional image reference for the change. Validate before passing.",
      },
      note_text: {
        type: "string",
        description: "Optional — the director's original review note, in their words.",
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
  const noteText = input.note_text as string | undefined;

  if (!editInstruction) {
    return { success: false, content: "edit_video requires edit_instruction." };
  }
  if (!sourceShotTag && !sourceVideoUrl) {
    return {
      success: false,
      content: "edit_video requires either source_shot_tag (preferred) or source_video_url.",
    };
  }

  emitter.send("tool_progress", {
    tool: "edit_video",
    generationId: context.generationId,
    status: "generating",
    message: `Editing ${sourceShotTag ? `@${sourceShotTag}` : "scene"}…`,
  });

  // Resolve source video.
  let videoUrl = sourceVideoUrl;
  let parentAssetId: string | null = null;
  let parentAspect: string | null = null;
  let duration = 25;
  if (sourceShotTag) {
    type Row = {
      id: string;
      public_url: string | null;
      aspect_ratio: string | null;
      duration_seconds: number | null;
      metadata: Record<string, unknown> | null;
    };
    let parent: Row | null = null;
    const { data: byTag } = await db
      .from("generation_assets")
      .select("id, public_url, aspect_ratio, duration_seconds, metadata")
      .eq("generation_id", context.generationId)
      .eq("tag", sourceShotTag)
      .maybeSingle();
    parent = (byTag as Row | null) ?? null;

    if (!parent && sourceShotTag.startsWith("shot_")) {
      const { data: byShotId } = await db
        .from("generation_assets")
        .select("id, public_url, aspect_ratio, duration_seconds, metadata")
        .eq("generation_id", context.generationId)
        .eq("type", "video")
        .contains("metadata", { shot_id: sourceShotTag })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      parent = (byShotId as Row | null) ?? null;
    }

    if (!parent || !parent.public_url) {
      return {
        success: false,
        content: `Could not resolve @${sourceShotTag}. Confirm the scene exists via list_assets or pass source_video_url directly.`,
      };
    }
    videoUrl = parent.public_url;
    parentAssetId = parent.id;
    parentAspect = parent.aspect_ratio;
    duration =
      parent.duration_seconds || ((parent.metadata?.duration as number | undefined) ?? 25);
  }

  if (!videoUrl) {
    return { success: false, content: "Could not resolve source video URL." };
  }

  if (rawReferenceUrl) {
    const { ok, bad } = await validateImageUrls([rawReferenceUrl], { timeoutMs: 6_000 });
    if (!ok) {
      const details = bad
        .map((b) => `  - ${b.url.slice(0, 80)}: ${b.reason}${b.status ? ` (HTTP ${b.status})` : ""}`)
        .join("\n");
      return {
        success: false,
        content: `Reference URL isn't a usable image. Do NOT retry with this URL.\n\n${details}`,
      };
    }
  }

  // @tags inside the instruction → image references (Seedance takes up to 30).
  const tagMatches = Array.from(editInstruction.matchAll(/@([a-z][a-z0-9_]*)/g))
    .map((m) => m[1])
    .filter((t, i, a) => a.indexOf(t) === i);
  const referenceUris: string[] = rawReferenceUrl ? [rawReferenceUrl] : [];
  if (tagMatches.length > 0) {
    const { imageUrls } = await resolveTags("", context.generationId, tagMatches.map(normalizeTag));
    referenceUris.push(...imageUrls);
  }

  const aspectRatio = parentAspect || context.aspectRatio || "16:9";

  try {
    const taskResult = await seedanceVideoToVideo({
      promptVideo: videoUrl,
      sourceDurationSeconds: duration,
      mode: "edit",
      promptText: editInstruction,
      references: referenceUris.length ? referenceUris.map((uri) => ({ uri })) : undefined,
      generationId: context.generationId,
      description: `edit ${shotId} (Seedance 2.5 edit)`,
    });

    const sourceUrl = Array.isArray(taskResult.output)
      ? taskResult.output[0]
      : (taskResult.output as unknown as string);
    if (!sourceUrl) {
      return { success: false, content: "Seedance returned no output. Check the source clip and try again." };
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
        duration_seconds: duration,
        parent_asset_id: parentAssetId,
        prediction_id: taskResult.taskId,
        status: "ready",
        metadata: {
          shot_id: shotId,
          shot_role: "edit",
          model: "seedance2_5",
          mode: "seedance_edit",
          edit_instruction: editInstruction,
          note_text: noteText ?? null,
          source_shot_tag: sourceShotTag,
          source_video_url: videoUrl,
          source_url: sourceUrl,
          duration,
          has_native_audio: true,
        },
        variant_number: variantNum,
      })
      .select("id")
      .single();

    emitter.send("tool_progress", {
      tool: "edit_video",
      generationId: context.generationId,
      status: "complete",
      message: `Scene ${shotId} edited.`,
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
      content: `Edited scene ${shotId} (${duration}s). Next: call request_approval(stage="shots").`,
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
    return { success: false, content: `Scene edit failed: ${msg}` };
  }
};
