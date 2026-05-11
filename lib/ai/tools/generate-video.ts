import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { getNextVariantNumber } from "./types";
import { gen4ImageToVideo, toRunwayRatio } from "@/lib/runway";
import { lintVideoPrompt } from "@/lib/ai/prompt-lint";
import { resolveTags, normalizeTag } from "@/lib/ai/tag-resolver";
import { db } from "@/lib/db";
import { persistAsset } from "@/lib/generation/persist-asset";

// ============================================================================
// generate_video — animate one keyframe with Gen-4.5 i2v.
//
// AUTEUR Frame Anchor pipeline (May 2026):
//   1. plates (gpt_image_2)
//   2. generate_keyframe composes plates into a first frame (gpt_image_2 edit)
//   3. generate_video animates that frame with Gen-4.5 i2v ← THIS TOOL
//
// Hero keyframes only. No FFLF — Gen-4.5 takes one promptImage. State
// transitions are achieved via two cut shots, not one shot with two frames.
// For different camera angles of the same fictional moment use generate_coverage
// (Aleph). For style/grade tweaks use apply_signature_pass. For surgical edits
// use apply_director_note.
//
// Duration: any integer 2-10 seconds (Gen-4.5 API range). Aspect locked to
// user's film spec.
// ============================================================================

export const generateVideoDefinition: ToolDefinition = {
  name: "generate_video",
  description:
    "Animate one composed keyframe into a video shot via Gen-4.5 image-to-video. ALWAYS pass a hero keyframe by @tag — the keyframe carries composition, identity, lighting, framing. The motion prompt only describes movement.\n\n" +
    "**Prompt — ≤25 words, MECHANICAL.**\n" +
    "- Format: `[camera rule]. [motion verb].`\n" +
    "- Good: `static camera. orlando turns head toward the mirror, gaze lingers one beat.`\n" +
    "- Good: `slow dolly in. maria raises pistol; focus pulls from her face to the barrel.`\n" +
    "- Bad: narrative paragraphs, adjectives, vibes. Forbidden: 'cinematic', 'epic', '8K', 'ultra-realistic'.\n\n" +
    "**Duration:** any integer from 2 to 10 seconds (Gen-4.5's API range). Default 5. Pick the duration that serves the moment — a glance is 2-3s, a held silence is 6-8s, a Steadicam pass is 10s. Cost scales linearly at 3 credits per second.\n\n" +
    "**When NOT to use this tool:**\n" +
    "- For a different camera angle of the same fictional moment from an existing shot → call `generate_coverage` (Aleph).\n" +
    "- To imprint the lead director's color/grade fingerprint on a rendered shot → call `apply_signature_pass` (Aleph).\n" +
    "- For a surgical change to a rendered shot (eyeline, weather, swap object) → call `apply_director_note` (Aleph).",
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
          "≤25 words, mechanical. Format: '[camera rule]. [motion verb].' No adjectives.",
      },
      duration_seconds: {
        type: "integer",
        minimum: 2,
        maximum: 10,
        description:
          "Shot duration in seconds. Any integer 2 to 10. Default 5. Pick what serves the moment.",
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

// Trim a longer string to the first sentence (or N chars) for prompt suffix
// use. Keeps the motion prompt under the model's effective length without
// chopping mid-word.
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
  const rawDuration = (input.duration_seconds as number) ?? 5;
  // Gen-4.5 i2v accepts any integer 2–10 seconds. Clamp to the API range and
  // round to integer (the model rejects floats).
  const durationSeconds = Math.max(2, Math.min(10, Math.round(rawDuration)));
  const aspectRatio =
    (input.aspect_ratio as string) || context.aspectRatio || "16:9";

  if (!keyframeTag) {
    return {
      success: false,
      content:
        "generate_video requires keyframe_tag. Compose the shot's keyframe first via generate_keyframe, then animate it here.",
    };
  }

  // Lint the motion prompt (≤25 words, no banned adjectives).
  const lint = lintVideoPrompt(prompt);
  if (!lint.ok) {
    return {
      success: false,
      content: `Motion prompt failed lint (${lint.wordCount} words). Fix and retry:\n- ${lint.warnings.join("\n- ")}`,
    };
  }

  // Resolve keyframe tag → URL.
  const kf = await resolveTags("", context.generationId, [keyframeTag]);
  if (kf.unresolved.length > 0) {
    return {
      success: false,
      content: `Unresolved keyframe tag @${keyframeTag}. Generate the keyframe first via generate_keyframe.`,
    };
  }
  const keyframeUrl = kf.imageUrls[0];

  // ── Compose the final motion prompt ──────────────────────────────────────
  // The LLM-authored prompt is a motion description (≤25 words, mechanical).
  // We append TWO authored suffixes:
  //
  // 1. ANTI-LIP-SYNC. The single most visible failure of the current
  //    pipeline: characters appear to be speaking mid-shot but there's no
  //    audio (audio is composed in post via VO, not synced). Without an
  //    explicit instruction Gen-4.5 frequently animates mouth movement
  //    from neutral face poses. This suffix is added to EVERY motion
  //    prompt — it's never wrong to ask for it.
  //
  // 2. DIRECTOR MOTION SIGNATURE. The lead director's school informs HOW
  //    the camera + subject move (Scorsese = kinetic tracking; Wong Kar-wai
  //    = slow shutter + smoke; Villeneuve = stately push-ins). We append
  //    a 10-15 word fingerprint pulled from the persona's visualSignature.
  //    Until today the director persona was a chat character with zero
  //    influence on what actually got generated; this is the first thread.
  const persona = context.leadDirector;
  const motionSignature = persona?.visualSignature
    ? `Motion in the visual signature of ${persona.name}: ${truncatePhrase(persona.visualSignature, 110)}.`
    : "";
  const antiLipSync =
    "No dialogue, no lip movement — subjects do not speak; mouths closed or natural breathing only.";
  const promptText = [prompt.trim(), antiLipSync, motionSignature]
    .filter(Boolean)
    .join(" ");

  emitter.send("tool_progress", {
    tool: "generate_video",
    generationId: context.generationId,
    status: "generating",
    message: `Animating ${shotId} (Gen-4.5 i2v, ${aspectRatio}, ${durationSeconds}s)…`,
  });

  try {
    const taskResult = await gen4ImageToVideo({
      promptText,
      promptImage: keyframeUrl,
      duration: durationSeconds,
      ratio: toRunwayRatio(aspectRatio),
      generationId: context.generationId,
      description: `shot ${shotId} (Gen-4.5 i2v, ${durationSeconds}s)`,
    });

    const sourceUrl = Array.isArray(taskResult.output)
      ? taskResult.output[0]
      : (taskResult.output as unknown as string);

    if (!sourceUrl) {
      return { success: false, content: "Gen-4.5 returned no output URL." };
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
        prediction_id: taskResult.taskId,
        status: "ready",
        metadata: {
          shot_id: shotId,
          shot_role: "master",
          model: "gen4.5",
          mode: "gen4_5_i2v",
          prompt,
          composed_prompt: promptText,
          director_id: persona?.id ?? null,
          keyframe_tag: keyframeTag,
          duration: durationSeconds,
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
      message: `Shot ${shotId} ready.`,
    });

    return {
      success: true,
      content: `Shot ${shotId} animated (Gen-4.5 i2v, ${aspectRatio}, ${durationSeconds}s). URL: ${persistentUrl}`,
      assets: [
        {
          assetId: asset?.id,
          type: "video",
          url: persistentUrl,
          metadata: {
            shot_id: shotId,
            role: "shot",
            shot_role: "master",
            mode: "gen4_5_i2v",
            aspect_ratio: aspectRatio,
            duration: durationSeconds,
            image_urls: [keyframeUrl],
          },
        },
      ],
    };
  } catch (error) {
    console.error("[tool:generate_video] Error:", error);
    return {
      success: false,
      content: `Video generation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
