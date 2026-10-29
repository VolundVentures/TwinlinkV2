import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { getNextVariantNumber } from "./types";
import {
  seedanceImageToVideo,
  toSeedanceRatio,
  clampSceneDuration,
  SCENE_DURATION,
  SEEDANCE_MIN_DURATION,
  SEEDANCE_MAX_DURATION,
} from "@/lib/runway";
import { lintVideoPrompt } from "@/lib/ai/prompt-lint";
import { resolveTags, normalizeTag } from "@/lib/ai/tag-resolver";
import { db } from "@/lib/db";
import { persistAsset } from "@/lib/generation/persist-asset";

// ============================================================================
// generate_video — render one 25-second SCENE with Seedance 2.5.
//
// Frame Anchor pipeline:
//   1. plates (GPT Image 2.5)
//   2. generate_keyframe composes plates into the scene's first frame
//   3. generate_video renders the scene from that frame ← THIS TOOL
//
// Seedance 2.5 renders 4–30s with native audio (dialogue, foley, ambience).
// The default scene is 25s. The prompt is a short shooting script: camera
// rule, timed beats, dialogue in quotes, sound cues in brackets.
// ============================================================================

export const generateVideoDefinition: ToolDefinition = {
  name: "generate_video",
  description:
    "Render one SCENE (default 25s) from a composed keyframe via Seedance 2.5. The keyframe is pinned as frame 0 and carries composition, identity, lighting and framing. The prompt is the SCENE DIRECTION for the full 25 seconds — with native audio.\n\n" +
    "**Prompt — a shooting script, ≤220 words.**\n" +
    "- Open with the camera rule, then 2–4 timed beats, then dialogue (in quotes, with who speaks) and sound cues (in brackets).\n" +
    "- Good: `locked off. 0-6s: hana lifts her gaze from the glass, holds. 6-15s: she says \"you came back\" — barely audible. [ice shifts in the glass] 15-25s: neon flickers on outside; she turns to the window. [distant traffic, rain begins]`\n" +
    "- Bad: adjectives, vibes, restating the look. Forbidden: 'cinematic', 'epic', '8K', 'ultra-realistic'.\n\n" +
    `**Duration:** integer ${SEEDANCE_MIN_DURATION}–${SEEDANCE_MAX_DURATION}s. Default ${SCENE_DURATION}. Every narrative scene is ${SCENE_DURATION}s unless the script says otherwise; end cards are short.\n\n` +
    "**Identity:** pass `reference_tags` (character / location plates) when the scene must hold a face across 25 seconds. This switches Seedance to reference mode (keyframe + plates guide, nothing pinned) — use it for character scenes; leave it off for empty environments.\n\n" +
    "**When NOT to use this tool:**\n" +
    "- A different camera angle of an existing scene → `generate_coverage`.\n" +
    "- The lead director's grade on a rendered scene → `apply_signature_pass`.\n" +
    "- One change to a rendered scene (eyeline, weather, object) → `edit_video`.",
  input_schema: {
    type: "object",
    properties: {
      shot_id: { type: "string", description: "Stable shot ID from write_script." },
      keyframe_tag: {
        type: "string",
        description: "@tag of the composed keyframe used as the first frame. Required.",
      },
      prompt: {
        type: "string",
        description:
          "Scene direction, ≤220 words: '[camera rule]. 0-8s: … 8-18s: … 18-25s: …'. Dialogue in quotes, sound in brackets.",
      },
      duration_seconds: {
        type: "integer",
        minimum: SEEDANCE_MIN_DURATION,
        maximum: SEEDANCE_MAX_DURATION,
        description: `Scene duration. Default ${SCENE_DURATION}.`,
      },
      reference_tags: {
        type: "array",
        items: { type: "string" },
        description:
          "Optional @tags of plates (character sheets, location) passed as identity references. Recommended for any scene with a recurring face.",
      },
      resolution: {
        type: "string",
        enum: ["720p", "1080p"],
        description: "Default 720p. 1080p costs ~2.3× — use for the final re-render of approved scenes only.",
      },
      audio: {
        type: "boolean",
        description: "Native audio (dialogue / foley / ambience). Default true. Set false only for silent-by-design scenes.",
      },
      aspect_ratio: {
        type: "string",
        enum: ["16:9", "9:16", "1:1", "21:9", "4:3", "3:4"],
        description: "Output aspect ratio. Defaults to the film spec from context.",
      },
    },
    required: ["shot_id", "keyframe_tag", "prompt"],
  },
};

// Trim a longer string to a clean boundary for prompt suffix use.
function truncatePhrase(s: string, max: number): string {
  if (!s) return "";
  const cleaned = s.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  const cut = cleaned.slice(0, max);
  const lastPunct = Math.max(cut.lastIndexOf("."), cut.lastIndexOf(","));
  if (lastPunct > max * 0.6) return cleaned.slice(0, lastPunct);
  const lastSpace = cut.lastIndexOf(" ");
  return cleaned.slice(0, lastSpace > 0 ? lastSpace : max);
}

export const generateVideoTool: ToolHandler = async (
  input,
  context,
  emitter
): Promise<ToolResult> => {
  const shotId = input.shot_id as string;
  const prompt = input.prompt as string;
  const keyframeTag = input.keyframe_tag
    ? normalizeTag(input.keyframe_tag as string)
    : undefined;
  const durationSeconds = clampSceneDuration(input.duration_seconds as number | undefined);
  const aspectRatio = (input.aspect_ratio as string) || context.aspectRatio || "16:9";
  const hd = input.resolution === "1080p";
  const audio = input.audio !== false;
  const referenceTags = ((input.reference_tags as string[] | undefined) || []).map(normalizeTag);

  if (!keyframeTag) {
    return {
      success: false,
      content:
        "generate_video requires keyframe_tag. Compose the scene's keyframe first via generate_keyframe, then render it here.",
    };
  }

  const lint = lintVideoPrompt(prompt);
  if (!lint.ok) {
    return {
      success: false,
      content: `Scene direction failed lint (${lint.wordCount} words). Fix and retry:\n- ${lint.warnings.join("\n- ")}`,
    };
  }

  const kf = await resolveTags("", context.generationId, [keyframeTag]);
  if (kf.unresolved.length > 0) {
    return {
      success: false,
      content: `Unresolved keyframe tag @${keyframeTag}. Generate the keyframe first via generate_keyframe.`,
    };
  }
  const keyframeUrl = kf.imageUrls[0];

  let referenceImages: string[] = [];
  if (referenceTags.length > 0) {
    const refs = await resolveTags("", context.generationId, referenceTags);
    if (refs.unresolved.length > 0) {
      return {
        success: false,
        content: `Unresolved reference tags: ${refs.unresolved.map((t) => `@${t}`).join(", ")}. Generate those plates first or drop them.`,
      };
    }
    referenceImages = refs.imageUrls;
  }

  // Append the lead director's motion signature so the school shapes HOW
  // camera and subject move, not just what the keyframe looks like.
  const persona = context.leadDirector;
  const motionSignature = persona?.visualSignature
    ? `Movement in the signature of ${persona.name}: ${truncatePhrase(persona.visualSignature, 110)}.`
    : "";
  const promptText = [prompt.trim(), motionSignature].filter(Boolean).join(" ");

  emitter.send("tool_progress", {
    tool: "generate_video",
    generationId: context.generationId,
    status: "generating",
    message: `Rendering scene ${shotId} (Seedance 2.5, ${aspectRatio}, ${durationSeconds}s${hd ? ", 1080p" : ""})…`,
  });

  try {
    const taskResult = await seedanceImageToVideo({
      promptText,
      firstFrame: keyframeUrl,
      referenceImages: referenceImages.length ? referenceImages : undefined,
      duration: durationSeconds,
      ratio: toSeedanceRatio(aspectRatio, hd),
      audio,
      generationId: context.generationId,
      description: `scene ${shotId} (Seedance 2.5, ${durationSeconds}s)`,
    });

    const sourceUrl = Array.isArray(taskResult.output)
      ? taskResult.output[0]
      : (taskResult.output as unknown as string);
    if (!sourceUrl) {
      return { success: false, content: "Seedance returned no output URL." };
    }

    const persistentUrl = await persistAsset(sourceUrl, {
      generationId: context.generationId,
      kind: "video",
      basename: `shot-${shotId}`,
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
        duration_seconds: durationSeconds,
        prediction_id: taskResult.taskId,
        status: "ready",
        metadata: {
          shot_id: shotId,
          shot_role: "master",
          model: "seedance2_5",
          mode: referenceImages.length ? "seedance_reference" : "seedance_first_frame",
          prompt,
          composed_prompt: promptText,
          director_id: persona?.id ?? null,
          keyframe_tag: keyframeTag,
          reference_tags: referenceTags,
          duration: durationSeconds,
          has_native_audio: audio,
          resolution: hd ? "1080p" : "720p",
          source_url: sourceUrl,
        },
        variant_number: variantNum,
      })
      .select("id")
      .single();

    emitter.send("tool_progress", {
      tool: "generate_video",
      generationId: context.generationId,
      status: "complete",
      message: `Scene ${shotId} ready.`,
    });

    return {
      success: true,
      content: `Scene ${shotId} rendered (Seedance 2.5, ${aspectRatio}, ${durationSeconds}s, native audio ${audio ? "on" : "off"}). URL: ${persistentUrl}`,
      assets: [
        {
          assetId: asset?.id,
          type: "video",
          url: persistentUrl,
          metadata: {
            shot_id: shotId,
            role: "shot",
            shot_role: "master",
            mode: "seedance2_5",
            aspect_ratio: aspectRatio,
            duration: durationSeconds,
            has_native_audio: audio,
            image_urls: [keyframeUrl],
          },
        },
      ],
    };
  } catch (error) {
    console.error("[tool:generate_video] Error:", error);
    return {
      success: false,
      content: `Scene render failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
