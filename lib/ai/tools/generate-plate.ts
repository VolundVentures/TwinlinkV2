import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { getNextVariantNumber, formatDbError } from "./types";
// Runway pivot (May 2026 AUTEUR): swapped Nano Banana → gpt_image_2 via lib/runway.
// The old replicate-image imports are kept exported there for any callers that
// haven't been migrated, but new flows use the Runway client.
import { generateImage, editImage, toGptImage2Ratio } from "@/lib/runway";
import { withAntiPrompt } from "@/lib/ai/prompts/anti-prompt-suffix";
import { resolveTags, isValidTag, normalizeTag } from "@/lib/ai/tag-resolver";
import { db } from "@/lib/db";
import { persistAsset } from "@/lib/generation/persist-asset";
import { validateImageUrls } from "@/lib/generation/validate-image-url";
import {
  sixPoseTurnaround,
  NEUTRAL_GREY_BACKDROP,
  PURE_BLACK_BACKDROP,
  SKIN_MATERIALITY,
  FABRIC_MATERIALITY,
  gradeLine,
  filmFrameDeclaration,
  spaceLock,
} from "@/lib/ai/prompts/nano-banana-patterns";

// ============================================================================
// PLATE TAXONOMY (6 kinds) — the reference bible for a film.
//
// A "plate" is a locked reference image used across every shot to enforce
// continuity of people / places / props / looks.
//
// Kinds:
// - character_sheet   : one person, multi-angle on neutral grey (front + 3/4 + profile)
// - location_master   : empty wide establishing of a place
// - location_variant  : same place in a different state (with lasers, at night, etc.)
//                       uses parent_tag + nano-banana edit mode
// - prop              : macro product-style shot of one object on neutral ground
// - wardrobe          : garment on invisible mannequin or flat-lay
// - vfx_element       : isolated FX element on black (smoke, spark, hologram, shard)
// ============================================================================

export type PlateKind =
  | "character_sheet"
  | "location_master"
  | "location_variant"
  | "prop"
  | "wardrobe"
  | "vfx_element";

function buildPlatePrompt(
  kind: PlateKind,
  description: string,
  aspectRatio: string,
  hasParentReference: boolean
): string {
  switch (kind) {
    case "character_sheet":
      // Six-pose turnaround (front / 3Q-left / profile-left / back / profile-right / 3Q-right).
      // This is the most-failed plate kind — back view is consistently missed
      // when not explicitly called out by name.
      return [
        sixPoseTurnaround(description),
        SKIN_MATERIALITY + ".",
        "Wardrobe is identical across all six panels — same garment, same fit, same accessories; the only change between panels is the rotation of the body.",
        gradeLine("portra_400") + ".",
        "Do NOT produce a single-panel portrait. Do NOT omit the back view — the bottom-left panel MUST show the back of the person. Do NOT add text, angle labels, numbers, or arrows. Do NOT add environment details or props outside the subject.",
        filmFrameDeclaration(aspectRatio),
      ].join(" ");

    case "location_master":
      // Empty cinematic establishing still, narrative opener per the Google
      // guide ("Subject → Setting → Lighting → Mood → Details").
      return [
        `A cinematic empty-location reference still — no people, no vehicles, no animals, no product placement, no visible crew or lights.`,
        `The space: ${description}.`,
        `Framing: a wide establishing angle that shows the architecture and its relationship to the light, shot on an ARRI Alexa 35 with a 35mm anamorphic prime; deep depth of field; slight anamorphic flare only if a practical source hits the lens directly.`,
        `Light: the space's own motivated sources — sun angle stated, practicals named (sconces, desk lamps, window light, streetlights), ambient tone specified. Shadows fall truthfully from real sources.`,
        `Materials: every surface rendered as itself — wood grain direction visible, concrete aggregate legible, fabric weave, glass micro-scratches, metal brush direction, leather crease. Lived-in imperfection, not showroom polish.`,
        `Palette: the color script is two-tone — name the shadow color and the highlight color explicitly as if writing a shot list.`,
        gradeLine("print_2383") + ".",
        `Do NOT stage the room as a real-estate listing, do NOT add people or mannequins, do NOT render the space in generic HDR "CGI-clean" style, do NOT add text, captions, floor plans, or arrows.`,
        filmFrameDeclaration(aspectRatio),
      ].join(" ");

    case "location_variant":
      // Variants are generated via edit mode with the parent master as [Image1].
      return [
        `A variant of the reference location from [Image1].`,
        hasParentReference ? spaceLock(1) : "",
        `Target state change: ${description}.`,
        `Apply ONLY the state change described above. Preserve the camera position, the framing, the lens character, the color grade, the grain level, the atmospheric haze, and every architectural element from [Image1] — it must feel like the same camera returned to the same spot at a different moment.`,
        `Do NOT redesign the room, do NOT change the camera angle or distance, do NOT introduce new architecture or furniture not implied by the state change, do NOT shift the color grade.`,
        filmFrameDeclaration(aspectRatio),
      ]
        .filter(Boolean)
        .join(" ");

    case "prop":
      return [
        `A hero prop reference plate — a single object photographed for use as a locked reference across a film.`,
        `The object: ${description}.`,
        `Framing: hero 3/4 angle on a Phase One IQ4 150MP medium-format back with a 120mm macro lens; shallow depth of field, pulled back just enough that the full object is sharp edge-to-edge; clean composition with generous negative space around the object.`,
        `Light: a soft diffused key from camera-right, a cool hair/rim light from camera-left-and-behind, a gentle warm kicker from below. Specular highlights truthful to the material — glass refracts and catches micro-scratches, brushed metal shows its grain direction, matte finishes eat the light cleanly, leather shows a natural crease.`,
        `Backdrop: a seamless neutral surface — warm grey, matte charcoal, oak, linen, or polished concrete (choose the one that flatters the material). Never pure white, never catalog cyclorama.`,
        FABRIC_MATERIALITY + " (where applicable).",
        gradeLine("vision3_250d") + ".",
        `Do NOT stage as an e-commerce pack-shot, do NOT apply glowing CGI rim, do NOT over-saturate, do NOT add price tags, badges, or brand text unless explicitly requested in the description.`,
        filmFrameDeclaration(aspectRatio),
      ].join(" ");

    case "wardrobe":
      return [
        `A wardrobe reference plate for use across a film. ${NEUTRAL_GREY_BACKDROP}.`,
        `The garment: ${description}.`,
        `Arrangement: TWO panels side-by-side in a single image — the left panel shows the garment on an invisible mannequin in FRONT view, the right panel shows the SAME garment on the same invisible mannequin in BACK view. Both panels have identical camera distance, identical framing, identical lighting.`,
        `Lighting: even soft north-window light with gentle fill, shadows soft enough to show fabric drape and seam structure without becoming dramatic.`,
        FABRIC_MATERIALITY + ".",
        gradeLine("portra_400") + ".",
        `Do NOT show the mannequin itself (it is invisible), do NOT add a model or body, do NOT use glossy fashion-ecom lighting, do NOT add price tags or labels, do NOT omit the back view.`,
        filmFrameDeclaration(aspectRatio),
      ].join(" ");

    case "vfx_element":
      return [
        `An isolated VFX element plate ready for compositing. ${PURE_BLACK_BACKDROP}.`,
        `The element: ${description}.`,
        `High dynamic range between the element and the surrounding pure black. Soft blooming highlights where bright areas meet dark. The element is physically believable — smoke billows with real turbulence, sparks arc under gravity, liquids refract light correctly, holograms flicker with scan lines and chromatic aberration, glass shards show genuine fracture geometry.`,
        `Single element only — no ground plane, no characters, no environment, no additional props. The black negative space around the element is uniform and untextured.`,
        gradeLine("vision3_500t") + ".",
        `Do NOT composite with other elements, do NOT add a ground shadow, do NOT render with CGI-clean symmetry, do NOT reference a stock-effects library look.`,
        filmFrameDeclaration(aspectRatio),
      ].join(" ");
  }
}

export const generatePlateDefinition: ToolDefinition = {
  name: "generate_plate",
  description:
    "Generate a locked reference image (a 'plate') that anchors identity, place, prop, wardrobe, or FX across every shot of the film. Plates are generated ONCE and referenced everywhere by @tag.\n\n" +
    "**Kinds:**\n" +
    "- `character_sheet` — multi-angle on neutral grey (medium + front full + 3/4). One per distinct person. Tag example: `@orlando`.\n" +
    "- `location_master` — empty wide establishing shot. No people, no state cues. Tag example: `@mansion_lobby`.\n" +
    "- `location_variant` — derived from a master, in a different state (with lasers, at night, with/without props). Requires `parent_tag`. Tag example: `@mansion_lobby_lasers_on`.\n" +
    "- `prop` — a single object (watch, pistol, perfume bottle, key card). Tag example: `@blowgun`.\n" +
    "- `wardrobe` — a garment / costume spec (tactical suit, tuxedo, yellow puffer). Tag example: `@orlando_spy_suit`.\n" +
    "- `vfx_element` — isolated effect on black (hologram, smoke, sparks). Tag example: `@vent_hologram`.\n\n" +
    "**@tag rules:** lowercase snake_case, no spaces. Unique per generation. Reference in all future prompts as `@tag`. Never paste plate URLs into prompts — use @tag.\n\n" +
    "**Anti-prompt suffix** is applied automatically — you don't need to add 'photorealistic, film frame, no beauty filter' etc.\n\n" +
    "**Discipline:** lean beats dense. A 60-second film typically needs 6–12 plates (1–2 characters, 1–3 locations plus variants, 2–4 props, 0–2 VFX).\n\n" +
    "Costs 3 credits.",
  input_schema: {
    type: "object",
    properties: {
      kind: {
        type: "string",
        enum: [
          "character_sheet",
          "location_master",
          "location_variant",
          "prop",
          "wardrobe",
          "vfx_element",
        ],
      },
      tag: {
        type: "string",
        description:
          "The @tag to reference this plate by. Lowercase snake_case (e.g. 'orlando', 'mansion_lobby', 'blowgun'). With or without leading @.",
      },
      description: {
        type: "string",
        description:
          "What this plate locks in. For character_sheet: identity + physique + hair + wardrobe + one signature feature. For location_master: architecture + materials + time-of-day + practical light sources. For prop: object + material + key features. For wardrobe: the garment with silhouette + fabric + fit. For vfx_element: the effect. For location_variant: ONLY the state change relative to the parent (e.g. 'same room but with red security lasers crossing the air at chest height').",
      },
      parent_tag: {
        type: "string",
        description:
          "Required for kind='location_variant'. The @tag of the parent location_master. The variant will be generated via edit mode to preserve geometry and materials.",
      },
      reference_tags: {
        type: "array",
        items: { type: "string" },
        description:
          "Optional. Extra @tags of existing plates to use as references (e.g. attaching a wardrobe plate to a character_sheet regeneration, or layering a vfx_element on a location).",
      },
      reference_image_urls: {
        type: "array",
        items: { type: "string" },
        description:
          "Optional. Raw reference URLs (brand's real product photo, uploaded actor photo, etc.). Use when starting from source imagery.",
      },
      aspect_ratio: {
        type: "string",
        enum: ["1:1", "4:5", "9:16", "16:9", "3:4", "4:3", "21:9"],
        description:
          "Aspect ratio. Default: 16:9 for locations, 1:1 for characters/props/wardrobe/vfx.",
      },
      force_regenerate: {
        type: "boolean",
        description:
          "Set true ONLY when the user has explicitly asked to redo a plate. By default, if a `ready` plate with this @tag already exists, the tool returns the existing plate (no API call, no credit charge). This guard prevents wasted regeneration on resumed sessions and accidental re-calls.",
      },
    },
    required: ["kind", "tag", "description"],
  },
};

export const generatePlateTool: ToolHandler = async (
  input,
  context,
  emitter
): Promise<ToolResult> => {
  const kind = input.kind as PlateKind;
  const rawTag = (input.tag as string) || "";
  const tag = normalizeTag(rawTag);
  const description = input.description as string;
  const parentTag = input.parent_tag
    ? normalizeTag(input.parent_tag as string)
    : undefined;
  const referenceTags = ((input.reference_tags as string[]) || []).map(normalizeTag);
  const rawReferenceUrls = (input.reference_image_urls as string[]) || [];
  const aspectRatio =
    (input.aspect_ratio as
      | "1:1"
      | "4:5"
      | "9:16"
      | "16:9"
      | "3:4"
      | "4:3"
      | "21:9") ||
    (kind === "location_master" || kind === "location_variant"
      ? "16:9"
      : "1:1");

  if (!isValidTag(tag)) {
    return {
      success: false,
      content: `Invalid tag "${rawTag}". Tags must be lowercase snake_case starting with a letter (e.g. 'orlando', 'mansion_lobby').`,
    };
  }

  if (kind === "location_variant" && !parentTag) {
    return {
      success: false,
      content:
        "location_variant requires parent_tag — the @tag of the parent location_master plate.",
    };
  }

  const forceRegenerate = input.force_regenerate === true;

  console.log("[tool:generate_plate]", { kind, tag, aspectRatio, parentTag, forceRegenerate });

  // ---- Short-circuit: plate already exists and is ready ----
  // Generating the same plate twice is expensive (3 credits + ~$0.04) and
  // produces a second row that's usually strictly worse (the first pass
  // often has references the agent has since forgotten about). Unless the
  // user has explicitly asked for a regeneration via edit_plate, return the
  // existing plate. Saves credits, saves time, keeps the DB clean.
  if (!forceRegenerate) {
    const { data: existing } = await db
      .from("generation_assets")
      .select("id, public_url, aspect_ratio, status, metadata")
      .eq("generation_id", context.generationId)
      .eq("tag", tag)
      .eq("asset_role", "plate")
      .eq("status", "ready")
      .maybeSingle();
    if (existing?.public_url) {
      emitter.send("tool_progress", {
        tool: "generate_plate",
        generationId: context.generationId,
        status: "complete",
        message: `Plate already exists: @${tag} (skipped)`,
      });
      return {
        success: true,
        content: `Plate @${tag} already exists and is ready — returning the existing plate without regenerating. If you need to change it, call edit_plate with target_tag="@${tag}" and a surgical instruction. To force a full regeneration, call generate_plate again with force_regenerate=true.`,
        assets: [
          {
            assetId: existing.id,
            type: "image",
            url: existing.public_url,
            metadata: {
              tag,
              plate_kind: kind,
              role: "plate",
              aspect_ratio: existing.aspect_ratio || aspectRatio,
              skipped: true,
            },
          },
        ],
      };
    }
  }

  emitter.send("tool_progress", {
    tool: "generate_plate",
    generationId: context.generationId,
    status: "generating",
    message: `Generating ${kind} plate: @${tag}`,
  });

  try {
    // Resolve tags → URLs
    const tagsToResolve = [
      ...(parentTag ? [parentTag] : []),
      ...referenceTags,
    ];
    const resolution = tagsToResolve.length
      ? await resolveTags("", context.generationId, tagsToResolve)
      : { imageUrls: [] as string[], unresolved: [] as string[] };

    if (resolution.unresolved?.length) {
      return {
        success: false,
        content: `Unresolved tags: ${resolution.unresolved.map((t) => `@${t}`).join(", ")}. Generate those plates first.`,
      };
    }

    // Pre-validate every user-supplied URL. The resolver's URLs come from
    // our own DB (Supabase public URLs) so they skip validation via the
    // trusted-host shortcut. Raw URLs pasted by user or agent are the real
    // risk — webpage links, CDN-protected redirects, and 403s waste minutes.
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
          content: `Reference URL(s) are not usable as images — Replicate will reject them. Do NOT retry with these URLs.\n\n${details}\n\nFix: either (a) upload the file via the attach button so it's hosted on Supabase, (b) find a direct image link (ending in .jpg/.png/.webp), or (c) drop the reference and generate without it. If this was a website URL, it's a webpage not an image.`,
        };
      }
    }

    const refUrls = [...resolution.imageUrls, ...rawReferenceUrls];

    // For location_variant, the parent master is always [Image1]; other kinds
    // may or may not have references. The prompt builder references [Image1]
    // only when a parent is present so the clause doesn't lie to the model.
    const hasParentReference = kind === "location_variant" && refUrls.length > 0;
    const basePrompt = buildPlatePrompt(kind, description, aspectRatio, hasParentReference);

    // Prepend the lead director's imageStyleModifier so the plate inherits
    // their visual school from the FIRST asset onwards — characters,
    // locations, props, wardrobe all carry the same fingerprint. Without
    // this every project came out generic "ARRI Alexa cinematic".
    // Character_sheet plates skip the style prefix to keep the multi-angle
    // turnaround neutral (identity reference, not in-scene styling).
    const persona = context.leadDirector;
    const stylePrefix =
      persona?.imageStyleModifier && kind !== "character_sheet"
        ? `Visual style — ${persona.imageStyleModifier.trim()}.\n\n`
        : "";
    const finalPrompt = withAntiPrompt(stylePrefix + basePrompt);

    // Fetch parent asset (for parent_asset_id linkage)
    let parentAssetId: string | undefined;
    if (parentTag) {
      const { data: parent } = await db
        .from("generation_assets")
        .select("id")
        .eq("generation_id", context.generationId)
        .eq("tag", parentTag)
        .single();
      parentAssetId = parent?.id;
    }

    // Edit if we have refs, else pure text-to-image. Runway gpt_image_2.
    const runwayRatio = toGptImage2Ratio(aspectRatio);
    const desc = `plate @${tag} (${kind}, ${aspectRatio})`;
    const taskResult =
      refUrls.length > 0
        ? await editImage({
            promptText: finalPrompt,
            inputImages: refUrls.map((uri) => ({ uri })),
            ratio: runwayRatio,
            generationId: context.generationId,
            description: desc,
          })
        : await generateImage({
            promptText: finalPrompt,
            ratio: runwayRatio,
            generationId: context.generationId,
            description: desc,
          });
    const result = {
      url: Array.isArray(taskResult.output) ? taskResult.output[0] : (taskResult.output as unknown as string),
      predictionId: taskResult.taskId,
    };

    const variantNum = await getNextVariantNumber(context.generationId);

    // If a plate with this @tag already exists in this generation, null its
    // tag first so the unique-index allows our insert to claim the @tag.
    // The old row stays in history; the new version wins lookups.
    await db
      .from("generation_assets")
      .update({ tag: null })
      .eq("generation_id", context.generationId)
      .eq("tag", tag);

    const persistentUrl = await persistAsset(result.url, {
      generationId: context.generationId,
      kind: "image",
      basename: `plate-${tag}`,
    });

    const insertPayload = {
      generation_id: context.generationId,
      org_id: context.orgId,
      type: "image",
      aspect_ratio: aspectRatio,
      public_url: persistentUrl,
      storage_path: persistentUrl,
      tag,
      asset_role: "plate",
      parent_asset_id: parentAssetId || null,
      prediction_id: result.predictionId,
      status: "ready",
      metadata: {
        plate_kind: kind,
        description,
        prompt: finalPrompt,
        parent_tag: parentTag,
        reference_tags: referenceTags,
        reference_image_urls: rawReferenceUrls,
        source_url: result.url,
        tag, // redundant copy in metadata so tag-resolver fallback works
      },
      variant_number: variantNum,
    };

    const { data: asset, error: insertErr } = await db
      .from("generation_assets")
      .insert(insertPayload)
      .select("id")
      .single();

    if (insertErr || !asset) {
      const full = formatDbError(insertErr);
      console.error(
        "[tool:generate_plate] DB insert failed:",
        full,
        "\npayload:",
        JSON.stringify({ tag, kind, aspectRatio, generation_id: context.generationId })
      );
      return {
        success: false,
        content: `Plate image generated but DB insert failed: ${full}. Image URL (ephemeral, won't persist without the row): ${result.url}. Common causes: (1) migration 00005_director_overhaul.sql not applied, (2) RLS policy denies insert for this org_id/user, (3) unique constraint on (generation_id, tag) — another row already has tag '@${tag}'.`,
      };
    }

    emitter.send("tool_progress", {
      tool: "generate_plate",
      generationId: context.generationId,
      status: "complete",
      message: `Plate ready: @${tag}`,
    });

    return {
      success: true,
      content: `Plate generated: @${tag} (${kind}, ${aspectRatio}). Reference in future prompts as @${tag}.`,
      assets: [
        {
          assetId: asset?.id,
          type: "image",
          url: result.url,
          metadata: {
            tag,
            plate_kind: kind,
            role: "plate",
            aspect_ratio: aspectRatio,
          },
        },
      ],
    };
  } catch (error) {
    console.error("[tool:generate_plate] Error:", error);
    return {
      success: false,
      content: `Plate generation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
