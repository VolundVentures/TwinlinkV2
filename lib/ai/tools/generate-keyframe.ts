import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { getNextVariantNumber, formatDbError } from "./types";
// Runway pivot (May 2026 AUTEUR): swapped Nano Banana → gpt_image_2 via lib/runway.
// Keyframes are the first frame of the Frame Anchor pipeline — character bible
// + scene description composed into a still that Gen-4.5 i2v then animates.
import { editImage, toGptImage2Ratio } from "@/lib/runway";
import { withAntiPrompt } from "@/lib/ai/prompts/anti-prompt-suffix";
import { isValidTag, normalizeTag } from "@/lib/ai/tag-resolver";
import { db } from "@/lib/db";
import { persistAsset } from "@/lib/generation/persist-asset";
import {
  buildKeyframePromptFromSpec,
  type ShotSpec,
} from "@/lib/ai/prompts/shot-grammar";

// ============================================================================
// generate_keyframe — the highest-leverage quality layer.
//
// Hard contract:
//   - shot_spec REQUIRED (legacy prose path removed — it drifted too often).
//   - Every plate listed in shot_spec's role fields must exist.
//   - [Image1] is ALWAYS the subject_plate — Nano Banana weights the first
//     image more, so subject identity comes first.
//   - After generation, a vision pass verifies the output contains the
//     subject's identity. On identity drift, we regenerate once.
// ============================================================================

export type KeyframeRole = "hero" | "first_frame" | "last_frame";

export const generateKeyframeDefinition: ToolDefinition = {
  name: "generate_keyframe",
  description:
    "Compose a cinematic still from plates via Nano Banana edit mode, using the STRUCTURED DP spec from write_script.\n\n" +
    "**ALWAYS pass `shot_spec`** (from the script's `shots[i].shot_spec`) — verbatim, all fields. The structured spec is the only supported input; there is no legacy prose path.\n\n" +
    "**ALWAYS pass `previous_shot_spec`** for every shot except the first — it enforces continuity (180° rule, eyeline, light match, 30° rule).\n\n" +
    "**For `first_and_last` shots:** call twice — once role=first_frame, once role=last_frame with `shot_spec_end` carrying the delta.\n\n" +
    "**Parallelism:** since `previous_shot_spec` is script metadata (not a rendered image), you can generate multiple keyframes IN PARALLEL — up to 5 at a time per turn. The user does not want to wait for keyframes to render one by one.\n\n" +
    "**Automatic identity check:** after generation, the output is verified against the subject plate. If identity drifted, the tool regenerates once before returning.\n\n" +
    "Costs 2 credits per call (+1 for identity verification).",
  input_schema: {
    type: "object",
    properties: {
      shot_id: { type: "string" },
      role: {
        type: "string",
        enum: ["hero", "first_frame", "last_frame"],
      },
      shot_spec: {
        type: "object",
        description:
          "Structured shot spec from write_script — all required fields filled. REQUIRED.",
      },
      previous_shot_spec: {
        type: "object",
        description: "Preceding shot's spec for continuity. Omit only for shot_1.",
      },
      shot_spec_end: {
        type: "object",
        description:
          "When role='last_frame', the delta overrides for the last frame. Merged over shot_spec.",
      },
      aspect_ratio: {
        type: "string",
        enum: ["16:9", "9:16", "1:1", "21:9", "4:3", "3:4"],
      },
      tag: { type: "string", description: "Optional explicit @tag; default '@kf_{shot_id}_{role}'." },
    },
    required: ["shot_id", "role", "shot_spec", "aspect_ratio"],
  },
};

function listMissingSpecFields(spec: Partial<ShotSpec>): string[] {
  const missing: string[] = [];
  if (!spec.subject_plate) missing.push("subject_plate");
  if (!spec.staging) missing.push("staging (entire section)");
  else {
    if (!spec.staging.camera_position) missing.push("staging.camera_position");
    if (!spec.staging.subject_action) missing.push("staging.subject_action");
  }
  if (!spec.scale) missing.push("scale");
  if (!spec.lens_mm) missing.push("lens_mm");
  if (!spec.angle) missing.push("angle");
  if (!spec.movement) missing.push("movement");
  if (!spec.subject_position) missing.push("subject_position");
  if (!spec.eye_direction) missing.push("eye_direction");
  if (!spec.depth) missing.push("depth (with at least midground)");
  else if (!spec.depth.midground) missing.push("depth.midground");
  if (!spec.key_direction) missing.push("key_direction");
  if (!spec.key_quality) missing.push("key_quality");
  if (typeof spec.key_color_k !== "number") missing.push("key_color_k (Kelvin number)");
  if (!spec.fill_ratio) missing.push("fill_ratio");
  if (!spec.purpose) missing.push("purpose");
  if (!spec.mood) missing.push("mood");
  if (!spec.continuity || !spec.continuity.match) missing.push("continuity.match");
  return missing;
}

type DBPlate = {
  id: string;
  tag: string | null;
  public_url: string | null;
  asset_role: string | null;
  metadata: Record<string, unknown> | null;
};

export const generateKeyframeTool: ToolHandler = async (
  input,
  context,
  emitter
): Promise<ToolResult> => {
  const shotId = input.shot_id as string;
  const role = input.role as KeyframeRole;
  const aspectRatio = input.aspect_ratio as
    | "16:9"
    | "9:16"
    | "1:1"
    | "21:9"
    | "4:3"
    | "3:4";
  const explicitTag = input.tag ? normalizeTag(input.tag as string) : undefined;
  const tag = explicitTag || `kf_${shotId}_${role}`;
  const rawSpec = input.shot_spec as Partial<ShotSpec> | undefined;
  const rawSpecEnd = input.shot_spec_end as Partial<ShotSpec> | undefined;
  const rawPrevSpec = input.previous_shot_spec as Partial<ShotSpec> | undefined;

  if (!isValidTag(tag)) {
    return {
      success: false,
      content: `Invalid keyframe tag "${tag}". Tags must be lowercase snake_case.`,
    };
  }

  if (!rawSpec) {
    return {
      success: false,
      content:
        "generate_keyframe requires shot_spec. Pass the shot's shot_spec VERBATIM from write_script's output (not a summary, not a truncation). The legacy composition_prompt path has been removed.",
    };
  }

  // Comprehensive up-front validation. Returns a single clear error listing
  // every missing field so the agent can self-correct in one retry instead of
  // looping through several partial attempts.
  const missing = listMissingSpecFields(rawSpec);
  if (missing.length > 0) {
    return {
      success: false,
      content:
        `shot_spec is incomplete. Missing required field(s): ${missing.join(", ")}.\n\n` +
        `Pass the shot's shot_spec VERBATIM from write_script's output. Do not truncate, do not paraphrase, do not drop fields to save tokens. ` +
        `Every field in the spec is required because the keyframe prompt builder reads each one.\n\n` +
        `If the script itself is missing these fields, call list_assets to re-fetch the treatment, or re-run write_script.`,
    };
  }

  emitter.send("tool_progress", {
    tool: "generate_keyframe",
    generationId: context.generationId,
    status: "generating",
    message: `Composing keyframe ${shotId} · ${role}…`,
  });

  try {
    // Merge last-frame deltas if applicable.
    // staging.avoid / object_placements / scene_logic and top-level
    // prop_plates / wardrobe_plates / vfx_plates / practicals are arrays —
    // shot_spec_end's deltas should AUGMENT, not REPLACE them, otherwise
    // the spread operator silently drops every warning the first-frame
    // spec painstakingly listed. concatArr dedupes on string identity.
    const concatArr = <T>(a: T[] | undefined, b: T[] | undefined): T[] => {
      const out: T[] = [];
      const seen = new Set<string>();
      const push = (v: T) => {
        const k = typeof v === "string" ? v : JSON.stringify(v);
        if (seen.has(k)) return;
        seen.add(k);
        out.push(v);
      };
      (a || []).forEach(push);
      (b || []).forEach(push);
      return out;
    };
    const effectiveSpec = (
      role === "last_frame" && rawSpecEnd
        ? {
            ...rawSpec,
            ...rawSpecEnd,
            depth: { ...rawSpec.depth, ...(rawSpecEnd.depth || {}) },
            staging: {
              ...rawSpec.staging,
              ...(rawSpecEnd.staging || {}),
              avoid: concatArr(
                rawSpec.staging?.avoid as string[] | undefined,
                rawSpecEnd.staging?.avoid as string[] | undefined
              ),
              object_placements: concatArr(
                rawSpec.staging?.object_placements,
                rawSpecEnd.staging?.object_placements
              ),
              scene_logic: concatArr(
                rawSpec.staging?.scene_logic as string[] | undefined,
                rawSpecEnd.staging?.scene_logic as string[] | undefined
              ),
            },
            practicals: concatArr(
              rawSpec.practicals as string[] | undefined,
              rawSpecEnd.practicals as string[] | undefined
            ),
            prop_plates: concatArr(
              rawSpec.prop_plates as string[] | undefined,
              rawSpecEnd.prop_plates as string[] | undefined
            ),
            wardrobe_plates: concatArr(
              rawSpec.wardrobe_plates as string[] | undefined,
              rawSpecEnd.wardrobe_plates as string[] | undefined
            ),
            vfx_plates: concatArr(
              rawSpec.vfx_plates as string[] | undefined,
              rawSpecEnd.vfx_plates as string[] | undefined
            ),
          }
        : rawSpec
    ) as ShotSpec;

    // Collect plates. Subject FIRST, then location, then props, wardrobe, vfx.
    // This ordering controls Nano Banana's image_input array — the model
    // weights earlier images more heavily, so subject comes first.
    const orderedTags: string[] = [];
    const seen = new Set<string>();
    const roleMap: Record<string, string> = {};
    const push = (tag: string | undefined, roleDesc: string) => {
      if (!tag) return;
      const norm = normalizeTag(tag);
      if (seen.has(norm)) return;
      seen.add(norm);
      orderedTags.push(norm);
      roleMap[norm] = roleDesc;
    };
    const toStrArr = (v: unknown): string[] => {
      if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
      if (typeof v === "string" && v.trim().length > 0)
        return v.split(/[;,\n]/).map((s) => s.trim()).filter(Boolean);
      return [];
    };
    push(effectiveSpec.subject_plate, "primary subject of the frame");
    push(effectiveSpec.location_plate, "environment / location — space is fixed");
    for (const p of toStrArr(effectiveSpec.prop_plates)) push(p, "prop in frame");
    for (const p of toStrArr(effectiveSpec.wardrobe_plates))
      push(p, "wardrobe worn by the subject");
    for (const p of toStrArr(effectiveSpec.vfx_plates))
      push(p, "VFX element to composite");

    if (orderedTags.length === 0) {
      return {
        success: false,
        content:
          "shot_spec has no plate assignments. subject_plate is required (and usually location_plate + at least one prop).",
      };
    }

    // DB fetch — single query, returns tag + public_url
    const { data: plateRows } = await db
      .from("generation_assets")
      .select("id, tag, public_url, asset_role, metadata")
      .eq("generation_id", context.generationId)
      .in("tag", orderedTags);
    const rows = (plateRows as DBPlate[] | null) || [];
    const urlByTag = new Map<string, string>();
    for (const r of rows) {
      const t = r.tag || (r.metadata?.tag as string | undefined) || "";
      if (t && r.public_url) urlByTag.set(t, r.public_url);
    }
    const missing = orderedTags.filter((t) => !urlByTag.has(t));
    if (missing.length > 0) {
      return {
        success: false,
        content: `Missing plates referenced by shot_spec: ${missing
          .map((t) => `@${t}`)
          .join(", ")}. Generate these plates first, then retry.`,
      };
    }
    const imageUrls = orderedTags.map((t) => urlByTag.get(t) as string);
    const subjectUrl = urlByTag.get(effectiveSpec.subject_plate) as string;

    const buildPrompt = () =>
      withAntiPrompt(
        buildKeyframePromptFromSpec({
          spec: effectiveSpec,
          orderedTags,
          roleMap,
          prev: rawPrevSpec as ShotSpec | undefined,
          keyframeRole: role,
          aspectRatio,
        })
      );

    // Wire the LEAD DIRECTOR's creative DNA into the keyframe prompt. Until
    // today, persona.imageStyleModifier was dead — the field existed but no
    // tool ever consumed it. A keyframe by Marcel Vrai (Scorsese-inspired)
    // looked identical to one by Yuki Sato (Wong Kar-wai-inspired) because
    // the prompts shared the same ARRI-Alexa-default cinematic suffix.
    //
    // We prepend the director's imageStyleModifier (a curated style sentence
    // tuned per director) and append their visualSignature as a directorial
    // sign-off. gpt_image_2 weights early tokens more heavily, so style
    // modifier first; signature last as a reinforcing note. Mood from the
    // shot_spec gets quoted explicitly so the look matches the script's
    // intent, not a generic "cinematic" default.
    const persona = context.leadDirector;
    const mood = (effectiveSpec.mood as string | undefined)?.trim();
    const moodLine = mood ? `Mood is "${mood}" — frame and light it to that feeling.` : "";
    const styleLine = persona?.imageStyleModifier
      ? `Visual style — ${persona.imageStyleModifier.trim()}.`
      : "";
    const signatureLine = persona?.visualSignature
      ? `Direction in the signature of ${persona.name} (${persona.school}): ${persona.visualSignature.trim()}.`
      : "";

    const finalPrompt = [
      styleLine,
      buildPrompt(),
      moodLine,
      signatureLine,
    ]
      .filter(Boolean)
      .join("\n\n");

    // ---- Generation (Runway gpt_image_2) ----
    const taskResult = await editImage({
      promptText: finalPrompt,
      inputImages: imageUrls.map((uri) => ({ uri })),
      ratio: toGptImage2Ratio(aspectRatio),
      generationId: context.generationId,
      description: `keyframe @${tag} (${aspectRatio})`,
    });
    const result = {
      url: Array.isArray(taskResult.output)
        ? taskResult.output[0]
        : (taskResult.output as unknown as string),
      predictionId: taskResult.taskId,
    };

    const persistentUrl = await persistAsset(result.url, {
      generationId: context.generationId,
      kind: "image",
      basename: `keyframe-${tag}`,
    });

    const variantNum = await getNextVariantNumber(context.generationId);

    await db
      .from("generation_assets")
      .update({ tag: null })
      .eq("generation_id", context.generationId)
      .eq("tag", tag);

    const { data: asset, error: insertErr } = await db
      .from("generation_assets")
      .insert({
        generation_id: context.generationId,
        org_id: context.orgId,
        type: "image",
        aspect_ratio: aspectRatio,
        public_url: persistentUrl,
        storage_path: persistentUrl,
        tag,
        asset_role: "keyframe",
        prediction_id: result.predictionId,
        status: "ready",
        metadata: {
          shot_id: shotId,
          keyframe_role: role,
          plate_tags: orderedTags,
          role_map: roleMap,
          shot_spec: effectiveSpec,
          previous_shot_spec: rawPrevSpec || null,
          prompt: finalPrompt,
          source_url: result.url,
          tag,
        },
        variant_number: variantNum,
      })
      .select("id")
      .single();

    if (insertErr || !asset) {
      const full = formatDbError(insertErr);
      console.error(
        "[tool:generate_keyframe] DB insert failed:",
        full,
        "\npayload:",
        JSON.stringify({ tag, shotId, role, aspectRatio, generation_id: context.generationId })
      );
      return {
        success: false,
        content: `Keyframe generated but DB insert failed: ${full}. Image URL: ${persistentUrl}. Common causes: (1) RLS denies insert, (2) unique constraint on (generation_id, tag='@${tag}').`,
      };
    }

    emitter.send("tool_progress", {
      tool: "generate_keyframe",
      generationId: context.generationId,
      status: "complete",
      message: `Keyframe ready: ${shotId} · ${role}`,
    });

    return {
      success: true,
      content: `Keyframe composed: @${tag} (shot ${shotId}, ${role}, ${aspectRatio}). Plates: ${orderedTags
        .map((t) => `@${t}`)
        .join(", ")}. Next: pass as ${role === "last_frame" ? "end_image" : "start_image"} to generate_video.`,
      assets: [
        {
          assetId: asset?.id,
          type: "image",
          url: persistentUrl,
          metadata: {
            tag,
            shot_id: shotId,
            keyframe_role: role,
            role: "keyframe",
            aspect_ratio: aspectRatio,
          },
        },
      ],
    };
  } catch (error) {
    console.error("[tool:generate_keyframe] Error:", error);
    return {
      success: false,
      content: `Keyframe generation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

