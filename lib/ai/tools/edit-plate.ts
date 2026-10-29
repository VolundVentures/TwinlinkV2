import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { getNextVariantNumber, formatDbError } from "./types";
// Runway pivot (May 2026 AUTEUR): swapped Nano Banana → gpt_image_2 via lib/runway.
import { editImage, toGptImageRatio } from "@/lib/runway";
import { withAntiPrompt } from "@/lib/ai/prompts/anti-prompt-suffix";
import { resolveTags, isValidTag, normalizeTag } from "@/lib/ai/tag-resolver";
import { db } from "@/lib/db";
import { persistAsset } from "@/lib/generation/persist-asset";
import { validateImageUrls } from "@/lib/generation/validate-image-url";
import { filmFrameDeclaration } from "@/lib/ai/prompts/nano-banana-patterns";

// ============================================================================
// edit_plate — iterative surgical edits that preserve identity.
//
// Higgsfield: "Replace the security guard in the first image with the security
// guard in the second image. Remove the earpiece from his ear and place only
// one single coiled transparent earpiece hanging from his right shoulder. Add
// white wired iPod earphones in both ears."
//
// Use this when the user flags one item for change ("change her wardrobe",
// "swap the pistol for a knife", "make the light warmer", "remove the lamp in
// the corner"). NEVER regenerate a plate from scratch for small edits —
// identity will drift. Edit mode with Nano Banana preserves identity.
// ============================================================================

export const editPlateDefinition: ToolDefinition = {
  name: "edit_plate",
  description:
    "Make a surgical edit to an existing plate or keyframe while preserving everything else. Prefer this over regenerating when the user flags a small change.\n\n" +
    "**Examples of good edit instructions:**\n" +
    "- 'Replace the earpiece with white wired iPod earphones in both ears. Preserve the rest.'\n" +
    "- 'Remove the lamp in the upper-right corner. Keep the rest identical.'\n" +
    "- 'Change the wardrobe color from black to navy. Preserve cut and fabric.'\n" +
    "- 'Add a pistol in the subject's right hand, finger off trigger. Preserve pose.'\n" +
    "- 'Warm the light 500K. Preserve every other element.'\n\n" +
    "**Anti-pattern:** 'Make the whole image more cinematic.' Too vague. Edit one thing at a time.\n\n" +
    "**@tag handling:** the new plate is stored as a variant (parent_asset_id points to the original). By default it keeps the same @tag (so downstream references get the latest version). Pass `new_tag` if you want to preserve both versions side-by-side.\n\n" +
    "Costs 2 credits.",
  input_schema: {
    type: "object",
    properties: {
      target_tag: {
        type: "string",
        description:
          "@tag of the plate/keyframe to edit (e.g. '@orlando', '@mansion_lobby', '@kf_shot1_hero').",
      },
      edit_instruction: {
        type: "string",
        description:
          "One surgical change + explicit 'preserve the rest' or 'preserve pose, light, grade' anchor. Be specific about WHAT changes and WHERE.",
      },
      reference_tags: {
        type: "array",
        items: { type: "string" },
        description:
          "Optional additional @tags to pull into the edit (e.g. attaching a wardrobe plate when changing a character's outfit).",
      },
      reference_image_urls: {
        type: "array",
        items: { type: "string" },
        description:
          "Optional direct image URLs to pass as additional references. Use this when the user has attached a file via the paperclip (the chat message will contain `[Attached reference: label — url]` — extract the url and pass it here). URLs are validated before being sent to Runway.",
      },
      new_tag: {
        type: "string",
        description:
          "Optional. If set, the edited version gets a new @tag (preserves both versions). If omitted, the same @tag is updated (old version stays in DB but new version wins tag lookups).",
      },
    },
    required: ["target_tag", "edit_instruction"],
  },
};

export const editPlateTool: ToolHandler = async (
  input,
  context,
  emitter
): Promise<ToolResult> => {
  const rawTarget = input.target_tag as string;
  const targetTag = normalizeTag(rawTarget);
  const editInstruction = input.edit_instruction as string;
  const referenceTags = ((input.reference_tags as string[]) || []).map(normalizeTag);
  const rawReferenceUrls = (input.reference_image_urls as string[]) || [];
  const rawNewTag = input.new_tag ? normalizeTag(input.new_tag as string) : undefined;

  if (!isValidTag(targetTag)) {
    return {
      success: false,
      content: `Invalid target_tag "${rawTarget}". Expected lowercase snake_case with optional @ prefix.`,
    };
  }
  if (rawNewTag && !isValidTag(rawNewTag)) {
    return {
      success: false,
      content: `Invalid new_tag "${rawNewTag}".`,
    };
  }

  // Fetch the parent asset
  const { data: parent, error: fetchErr } = await db
    .from("generation_assets")
    .select("id, tag, aspect_ratio, public_url, asset_role, metadata")
    .eq("generation_id", context.generationId)
    .eq("tag", targetTag)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (fetchErr || !parent?.public_url) {
    return {
      success: false,
      content: `No plate found for @${targetTag}. Generate it first with generate_plate.`,
    };
  }

  emitter.send("tool_progress", {
    tool: "edit_plate",
    generationId: context.generationId,
    status: "generating",
    message: `Editing @${targetTag}...`,
  });

  try {
    const extraRefs = await resolveTags("", context.generationId, referenceTags);
    if (extraRefs.unresolved?.length) {
      return {
        success: false,
        content: `Unresolved reference tags: ${extraRefs.unresolved.map((t) => `@${t}`).join(", ")}.`,
      };
    }

    // Validate raw URLs the agent passed (user-attached via paperclip).
    // Bad URLs are rejected fast with a clear error instead of wasting a
    // Runway task.
    if (rawReferenceUrls.length > 0) {
      const { ok, bad } = await validateImageUrls(rawReferenceUrls, { timeoutMs: 6_000 });
      if (!ok) {
        const details = bad
          .map(
            (b) =>
              `  - ${b.url.slice(0, 80)}: ${b.reason}${b.status ? ` (HTTP ${b.status})` : ""}`
          )
          .join("\n");
        return {
          success: false,
          content: `Reference URL(s) aren't usable images. Do NOT retry with these URLs.\n\n${details}\n\nFix: ask the user to upload a valid image, or drop the reference.`,
        };
      }
    }

    // Subject plate (parent) stays [Image1], extra plate refs next, user-
    // attached URLs last — preserves Nano Banana's attention ordering.
    const imageUrls = [parent.public_url, ...extraRefs.imageUrls, ...rawReferenceUrls];

    const aspectRatio = (parent.aspect_ratio || "16:9") as
      | "16:9"
      | "9:16"
      | "1:1"
      | "21:9"
      | "4:3"
      | "3:4"
      | "4:5";

    // Edit prompts follow the Google guide's "edit, don't re-roll" pattern:
    // reference [Image1] explicitly as the canvas, state the surgical change,
    // preserve everything else, close with a film-frame declaration so the
    // model stays in cinema mode instead of drifting to "AI-clean" output.
    const editBody = [
      `Starting canvas: [Image1]. Preserve everything in [Image1] — identity, pose, framing, lighting, grade, grain, background — except for the surgical change stated below.`,
      `Surgical change: ${editInstruction.trim()}`,
      extraRefs.imageUrls.length + rawReferenceUrls.length > 0
        ? `Additional references ([Image2] onward) supply the new elements referenced in the change; match their color, shape, and material exactly.`
        : "",
      `Do NOT re-render, re-pose, or re-frame the subject. Do NOT restyle the grade. Do NOT alter anything the change did not ask for.`,
      filmFrameDeclaration(aspectRatio),
    ]
      .filter(Boolean)
      .join(" ");
    const finalPrompt = withAntiPrompt(editBody);

    const runwayRatio = toGptImageRatio(aspectRatio);
    const taskResult = await editImage({
      promptText: finalPrompt,
      inputImages: imageUrls.map((uri) => ({ uri })),
      ratio: runwayRatio,
      generationId: context.generationId,
      description: `edit @${targetTag} → ${rawNewTag ? `@${rawNewTag}` : "(in place)"}`,
    });
    const result = {
      url: Array.isArray(taskResult.output) ? taskResult.output[0] : (taskResult.output as unknown as string),
      predictionId: taskResult.taskId,
    };

    const variantNum = await getNextVariantNumber(context.generationId);

    // If using same @tag, null out the old row's tag first to avoid unique index conflict.
    const storeTag = rawNewTag || targetTag;
    if (!rawNewTag) {
      await db
        .from("generation_assets")
        .update({ tag: null })
        .eq("id", parent.id);
    }

    const persistentUrl = await persistAsset(result.url, {
      generationId: context.generationId,
      kind: "image",
      basename: `edit-${storeTag}`,
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
        tag: storeTag,
        asset_role: parent.asset_role || "plate",
        parent_asset_id: parent.id,
        prediction_id: result.predictionId,
        status: "ready",
        metadata: {
          ...(parent.metadata || {}),
          edit_instruction: editInstruction,
          reference_tags: referenceTags,
          edited_from: targetTag,
          source_url: result.url,
          tag: storeTag,
        },
        variant_number: variantNum,
      })
      .select("id")
      .single();

    if (insertErr || !asset) {
      const full = formatDbError(insertErr);
      console.error(
        "[tool:edit_plate] DB insert failed:",
        full,
        "\npayload:",
        JSON.stringify({ storeTag, targetTag, parentId: parent.id, generation_id: context.generationId })
      );
      return {
        success: false,
        content: `Edit generated but DB insert failed: ${full}. Common causes: (1) RLS denies insert, (2) unique constraint on (generation_id, tag='@${storeTag}') — the parent's tag may not have been nulled out.`,
      };
    }

    emitter.send("tool_progress", {
      tool: "edit_plate",
      generationId: context.generationId,
      status: "complete",
      message: `Edit applied: @${storeTag}`,
    });

    // Preserve plate classification so the workspace doesn't reclassify the
    // edited character as a "prop" (fallback on the client when plate_kind
    // is missing). We carry kind + description forward from the parent.
    const parentMeta = (parent.metadata || {}) as Record<string, unknown>;
    const parentKind = parentMeta.plate_kind as string | undefined;
    const parentDesc = parentMeta.description as string | undefined;

    return {
      success: true,
      content: `Edited @${targetTag} → @${storeTag}. Future @${storeTag} references will use this version.`,
      assets: [
        {
          assetId: asset?.id,
          type: "image",
          url: result.url,
          metadata: {
            tag: storeTag,
            role: parent.asset_role || "plate",
            aspect_ratio: aspectRatio,
            edited_from: targetTag,
            plate_kind: parentKind,
            description: parentDesc,
          },
        },
      ],
    };
  } catch (error) {
    console.error("[tool:edit_plate] Error:", error);
    return {
      success: false,
      content: `Edit failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
