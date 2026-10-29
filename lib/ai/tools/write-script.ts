import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { getNextVariantNumber } from "./types";
import { videoScriptPrompt } from "@/lib/ai/prompts/script-writer";
import { generateStructuredJSON, DEFAULT_SCRIPT_MODEL } from "@/lib/ai/llm";
import { db } from "@/lib/db";
import type { Brand } from "@/lib/database.types";
import type { ShotSpec } from "@/lib/ai/prompts/shot-grammar";

// Trim a long persona field to a clean sentence boundary so it fits as a
// preamble line. Used for visualSignature / imageStyleModifier where the
// raw text might be 400 chars and the prompt budget is tight.
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

// ============================================================================
// Slim script schema — 25s Seedance scenes / 6-kind-plate / @tag
// methodology. Individual keyframes are NOT pre-planned here — the agent
// composes them at production time via generate_keyframe.
// ============================================================================

type Plate = {
  tag: string;
  kind:
    | "character_sheet"
    | "location_master"
    | "location_variant"
    | "prop"
    | "wardrobe"
    | "vfx_element";
  description: string;
  parent_tag?: string;
};

/**
 * An optional explicit build chain for a shot — the ordered list of
 * plate-generate and plate-edit operations that produce the keyframe(s).
 * When present on a shot, the agent follows it deterministically. When
 * absent, the agent improvises from shot_spec's role fields.
 *
 * This mirrors the Higgsfield-style compositional workflow: generate clean
 * location → edit character in → add prop → re-light → compose keyframe →
 * animate. Each shot_build step maps 1:1 to an existing tool call
 * (generate_plate / edit_plate / generate_keyframe). No new endpoints.
 */
export type ShotBuildStep =
  | {
      kind: "generate_plate";
      plate_kind:
        | "character_sheet"
        | "location_master"
        | "location_variant"
        | "prop"
        | "wardrobe"
        | "vfx_element";
      tag: string;
      description: string;
      parent_tag?: string;
    }
  | {
      kind: "edit_plate";
      target_tag: string;
      edit_instruction: string;
      new_tag?: string;
      reference_tags?: string[];
    }
  | {
      kind: "compose_keyframe";
      role: "hero" | "first_frame" | "last_frame";
    };

type Shot = {
  id: string;
  label: string;
  /** Final on-screen duration. The agent picks the tool to deliver it. */
  duration_seconds: number;
  /** seedance_scene for every narrative scene; image_clip for the end card. */
  model: "seedance_scene" | "image_clip";
  plate_refs: string[];
  keyframe_plan: "hero" | "image_only";
  motion: string;
  /**
   * Structured shot spec — DP-level framing/blocking/lighting. generate_keyframe
   * uses this to build its GPT Image 2.5 prompt. Every plate_ref MUST be assigned
   * a role here (subject_plate / location_plate / prop_plates / wardrobe_plates
   * / vfx_plates) or the keyframe tool will reject the shot.
   *
   * For first_and_last plans, you emit one `shot_spec` (describing the FIRST
   * frame) and one optional `shot_spec_end` (describing how the LAST frame
   * differs — pose change, state change, subject position). If omitted, the
   * last-frame keyframe re-uses the same spec with a note appended at runtime.
   */
  shot_spec: ShotSpec;
  shot_spec_end?: Partial<ShotSpec>;
  shot_build?: ShotBuildStep[];
  notes?: string;
};

type VideoScript = {
  title: string;
  logline: string;
  end_card: string;
  duration_seconds: number;
  aspect_ratio: string;
  tone: string;
  color_script: { shadow: string; highlight: string; notes?: string };
  camera_rule: string;
  reference_films: string[];
  plates: Plate[];
  shots: Shot[];
  music?: { description?: string; mood?: string; has_music?: boolean };
  voiceover?: { full_script?: string | null; direction?: string | null };
};

// JSON Schema fragment for the structured shot_spec — DP-level framing,
// blocking, lighting, continuity. Shared by shot_spec and shot_spec_end.
const SHOT_SPEC_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    staging: {
      type: "object",
      description:
        "Scene staging — the single most important section. Describes what is physically in the frame. GPT Image 2.5 follows explicit physics precisely, but invents nonsense when underspecified.",
      properties: {
        camera_position: {
          type: "string",
          description:
            "Where the CAMERA sits in 3D space (distance, orientation, interior/exterior). NOT the camera angle. Example: 'exterior, opposite sidewalk, 8m from subject, pointing slightly camera-left'. Example: 'interior passenger seat, 60cm from the driver, looking at driver past the steering wheel toward the windshield'.",
        },
        subject_action: {
          type: "string",
          description:
            "Verb phrase with pose and direction of attention. Never 'looking' without saying at what. Example: 'walks three paces toward camera on wet pavement, weight settling on left foot, gaze forward focused past the camera'. Example: 'turned toward the glass, face 30cm from the pane, eyes fixed on his own reflection'.",
        },
        subject_contact: {
          type: "string",
          description: "What the subject is touching/holding, with hand and surface named.",
        },
        object_placements: {
          type: "array",
          description:
            "Every named object's placement — distance, orientation, state. Prevents 'car floating in middle of street' class failures.",
          items: {
            type: "object",
            properties: {
              object: { type: "string" },
              where: {
                type: "string",
                description:
                  "Distance + position + orientation + state. 'Parked parallel to the curb, 4m behind subject, facing camera-right, headlights on'.",
              },
              facing: { type: "string" },
            },
            required: ["object", "where"],
          },
        },
        scene_logic: {
          type: "array",
          items: { type: "string" },
          description:
            "Spatial/physical invariants the model is likely to break if left implicit. 'The mirror reflects the man standing in front of it.' 'The camera is outside the car, not inside.' 'The glass between subject and lion is a single transparent pane.'",
        },
        avoid: {
          type: "array",
          items: { type: "string" },
          description:
            "Explicit NEGATIVE instructions — specific mis-interpretations to forbid. 'Do NOT park the car diagonally in the middle of the road.' 'Do NOT show the dashboard behind the driver.' 'Do NOT replace the reflection with anything other than the man's face.'",
        },
      },
      required: ["camera_position", "subject_action"],
    },
    scale: {
      type: "string",
      enum: ["ECU", "CU", "MCU", "MS", "MWS", "WS", "EWS"],
      description:
        "Shot scale. ECU=eye/texture detail, CU=head+shoulders, MCU=chest up, MS=waist up, MWS=full body with breathing room, WS=full body + env, EWS=small in landscape.",
    },
    lens_mm: {
      type: "number",
      enum: [18, 24, 35, 50, 85, 100, 135],
      description:
        "Focal length. 18-24 wide/environmental. 35 naturalistic (Deakins default). 50 eye-normal. 85 portrait compression. 100-135 telephoto isolation.",
    },
    angle: {
      type: "string",
      enum: ["low", "eye", "high", "top_down", "dutch"],
    },
    movement: {
      type: "string",
      enum: [
        "locked",
        "micro_drift",
        "handheld",
        "slow_dolly_in",
        "slow_dolly_out",
        "push_in",
        "pull_back",
        "pan_left",
        "pan_right",
        "tilt_up",
        "tilt_down",
        "tracking",
        "crane_up",
        "crane_down",
        "rack_focus",
        "whip_pan",
        "pov",
      ],
    },
    subject_position: {
      type: "string",
      enum: [
        "left_third",
        "right_third",
        "center",
        "golden_upper_left",
        "golden_upper_right",
        "golden_lower_left",
        "golden_lower_right",
        "full_bleed",
        "small_in_landscape",
      ],
    },
    eye_direction: {
      type: "string",
      enum: [
        "camera_left",
        "camera_right",
        "into_lens",
        "off_screen_up",
        "off_screen_down",
        "inward",
        "obscured",
      ],
    },
    depth: {
      type: "object",
      properties: {
        foreground: { type: "string" },
        midground: {
          type: "string",
          description: "What's on the subject plane — required.",
        },
        background: { type: "string" },
      },
      required: ["midground"],
    },
    negative_space: {
      type: "string",
      enum: ["left", "right", "top", "bottom", "none"],
    },
    key_direction: {
      type: "string",
      enum: [
        "from_left",
        "from_right",
        "three_quarter_left",
        "three_quarter_right",
        "frontal",
        "backlit",
        "top",
        "bottom",
        "rembrandt",
        "chiaroscuro",
      ],
    },
    key_quality: {
      type: "string",
      enum: ["hard", "soft", "diffused", "specular"],
    },
    key_color_k: {
      type: "number",
      description:
        "Key light color in Kelvin. 1800–2200 candle/firelight. 2800–3200 tungsten. 5000–5600 daylight. 6500+ cold blue.",
    },
    fill_ratio: {
      type: "string",
      enum: ["1:1", "1:2", "1:4", "1:8", "1:16", "none"],
    },
    practicals: {
      type: "array",
      items: { type: "string" },
      description: "Visible in-frame light sources (sconce camera-right, window behind, neon sign BG).",
    },
    purpose: {
      type: "string",
      enum: [
        "establish",
        "introduce",
        "intimate",
        "reveal",
        "confront",
        "transition",
        "punctuation",
        "product_hero",
        "end_card",
      ],
    },
    mood: { type: "string", description: "ONE word — suspended, tender, clinical, electric." },
    continuity: {
      type: "object",
      properties: {
        match: {
          type: "string",
          enum: ["eyeline", "axis", "graphic", "action", "light", "break", "first"],
          description:
            "first = this is shot_1. break = intentional disruption (must explain in note). Otherwise the match type to the previous shot.",
        },
        note: { type: "string" },
      },
      required: ["match"],
    },
    subject_plate: {
      type: "string",
      description: "@tag (without @) of the primary subject in the frame. Required.",
    },
    location_plate: { type: "string" },
    prop_plates: { type: "array", items: { type: "string" } },
    wardrobe_plates: { type: "array", items: { type: "string" } },
    vfx_plates: { type: "array", items: { type: "string" } },
  },
  required: [
    "staging",
    "scale",
    "lens_mm",
    "angle",
    "movement",
    "subject_position",
    "eye_direction",
    "depth",
    "key_direction",
    "key_quality",
    "key_color_k",
    "fill_ratio",
    "purpose",
    "mood",
    "continuity",
    "subject_plate",
  ],
};

// Partial version for shot_spec_end — the last-frame delta, all fields optional.
const SHOT_SPEC_PARTIAL_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: SHOT_SPEC_SCHEMA.properties,
};

// shot_build — optional explicit chain of plate/edit/compose operations.
// Backward-compatible: shots without this field fall through to today's
// path (agent improvises from shot_spec's role fields).
const SHOT_BUILD_STEP_SCHEMA: Record<string, unknown> = {
  oneOf: [
    {
      type: "object",
      description:
        "Create a new plate. Use when a plate required by this shot is not already in the top-level plates list (e.g., a one-off prop, a location_variant needed only for this shot).",
      properties: {
        kind: { type: "string", enum: ["generate_plate"] },
        plate_kind: {
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
        tag: { type: "string" },
        description: { type: "string" },
        parent_tag: { type: "string" },
      },
      required: ["kind", "plate_kind", "tag", "description"],
    },
    {
      type: "object",
      description:
        "Edit an existing plate or intermediate keyframe. The primary compositional tool: integrate a character into a location, add/remove a prop, shift camera angle, re-light, compose two characters. Always include a 'preserve X' anchor in edit_instruction.",
      properties: {
        kind: { type: "string", enum: ["edit_plate"] },
        target_tag: {
          type: "string",
          description:
            "The tag of the plate/keyframe to edit. Must already exist (either from plates, or from a prior step in this shot_build).",
        },
        edit_instruction: {
          type: "string",
          description:
            "Specific surgical instruction. Example: 'Add a matte black pistol in her right hand. Preserve pose, fabric, and lighting.' ALWAYS include what to preserve.",
        },
        new_tag: {
          type: "string",
          description:
            "Optional — when set, the edit creates a branched plate under this new tag instead of overwriting target_tag. Use when a prior step's output should remain available (e.g., intermediate compose stages).",
        },
        reference_tags: {
          type: "array",
          items: { type: "string" },
          description:
            "Additional plates to supply to the edit model as reference images (e.g., the character plate when integrating a character into a location).",
        },
      },
      required: ["kind", "target_tag", "edit_instruction"],
    },
    {
      type: "object",
      description:
        "Terminal step — calls generate_keyframe with the shot's shot_spec to produce the final keyframe. Exactly ONE compose_keyframe with role='hero' for hero shots. TWO compose_keyframe steps (role='first_frame' then role='last_frame') for first_and_last shots.",
      properties: {
        kind: { type: "string", enum: ["compose_keyframe"] },
        role: { type: "string", enum: ["hero", "first_frame", "last_frame"] },
      },
      required: ["kind", "role"],
    },
  ],
};

// JSON Schema for generateStructuredJSON tool_use. Permissive on optional
// fields so Opus doesn't stall trying to satisfy rigid structure.
const SCRIPT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    title: { type: "string" },
    logline: { type: "string" },
    end_card: { type: "string" },
    duration_seconds: { type: "number" },
    aspect_ratio: { type: "string" },
    tone: { type: "string" },
    color_script: {
      type: "object",
      properties: {
        shadow: { type: "string" },
        highlight: { type: "string" },
        notes: { type: "string" },
      },
      required: ["shadow", "highlight"],
    },
    camera_rule: { type: "string" },
    reference_films: { type: "array", items: { type: "string" } },
    plates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tag: { type: "string" },
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
          description: { type: "string" },
          parent_tag: { type: "string" },
        },
        required: ["tag", "kind", "description"],
      },
    },
    shots: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          duration_seconds: {
            type: "integer",
            minimum: 3,
            maximum: 30,
            description:
              "On-screen duration in seconds. Every narrative scene is 25 (Seedance 2.5 range 4–30). The end card is 3–5.",
          },
          model: {
            type: "string",
            enum: ["seedance_scene", "image_clip"],
            description:
              "seedance_scene = a 25s scene rendered by Seedance 2.5 from the composed keyframe, with native audio. image_clip = a still held in Remotion — end card only.",
          },
          plate_refs: { type: "array", items: { type: "string" } },
          keyframe_plan: {
            type: "string",
            enum: ["hero", "image_only"],
            description:
              "hero = every narrative scene (one keyframe = frame 0 + scene direction). image_only = end card (Remotion holds the image for duration_seconds).",
          },
          motion: { type: "string" },
          shot_spec: SHOT_SPEC_SCHEMA,
          shot_spec_end: SHOT_SPEC_PARTIAL_SCHEMA,
          shot_build: {
            type: "array",
            items: SHOT_BUILD_STEP_SCHEMA,
            description:
              "Optional ordered chain of generate_plate / edit_plate / compose_keyframe steps that build this shot's keyframe. Write a chain when the shot composes two+ characters, integrates a new prop, re-uses a prior keyframe with edits, or inherits scene mood via edits. Omit for simple direct compositions from plate_refs. Backward-compatible: when absent, the agent improvises.",
          },
          notes: { type: "string" },
        },
        required: ["id", "label", "duration_seconds", "model", "plate_refs", "keyframe_plan", "motion", "shot_spec"],
      },
    },
    music: {
      type: "object",
      properties: {
        description: { type: "string" },
        mood: { type: "string" },
        has_music: { type: "boolean" },
      },
    },
    voiceover: {
      type: "object",
      properties: {
        full_script: { type: ["string", "null"] },
        direction: { type: ["string", "null"] },
      },
    },
  },
  required: [
    "title",
    "logline",
    "end_card",
    "duration_seconds",
    "aspect_ratio",
    "tone",
    "color_script",
    "camera_rule",
    "reference_films",
    "plates",
    "shots",
  ],
};

export const writeScriptDefinition: ToolDefinition = {
  name: "write_script",
  description:
    "Direct the film's treatment + scene list. Output: title, logline, end card, color script, camera rule, plate list (6 kinds), scene list (id / 25s duration / model / plate_refs / keyframe_plan / scene direction). Pre-plans the STRUCTURE only — keyframes are composed per scene later via generate_keyframe.\n\n" +
    "Call this ONCE per film, right after user approves the brief. Costs 1 credit.\n\n" +
    "Structured output from the script model — typically returns in 20–60s.",
  input_schema: {
    type: "object",
    properties: {
      duration_seconds: {
        type: "number",
        description: "Target duration. Defaults to the user-chosen film spec.",
      },
      aspect_ratio: {
        type: "string",
        enum: ["16:9", "9:16", "1:1", "21:9", "4:3", "3:4"],
        description: "Target aspect. Defaults to the user-chosen film spec.",
      },
      creative_direction: {
        type: "string",
        description:
          "Your creative interpretation of the user's brief — concept, tone, references, emotional beats. The more specific, the better the shot list. This is where the director's voice lives.",
      },
      key_points: {
        type: "array",
        items: { type: "string" },
        description: "Specific elements that must appear (e.g. 'lion emblem must match real Peugeot silver grille').",
      },
    },
  },
};

export const writeScript: ToolHandler = async (
  input,
  context,
  emitter
): Promise<ToolResult> => {
  const durationSeconds =
    (input.duration_seconds as number) || context.durationSeconds || 30;
  const aspectRatio =
    (input.aspect_ratio as string) || context.aspectRatio || "16:9";
  const creativeDirection = (input.creative_direction as string) || "";
  const keyPoints = (input.key_points as string[]) || [];

  console.log("[tool:write_script]", {
    durationSeconds,
    aspectRatio,
    directionLen: creativeDirection.length,
  });

  // ── Idempotence guard ───────────────────────────────────────────────────
  // write_script must run ONCE per project. The agent system prompt
  // forbids re-running it, but Haiku occasionally tries to anyway after
  // approval directives confuse it. Refusing here keeps the existing
  // treatment + plates intact and bounces the agent back to whatever
  // stage it actually belongs in.
  try {
    const { data: existing } = await db
      .from("generation_assets")
      .select("id")
      .eq("generation_id", context.generationId)
      .eq("type", "script")
      .limit(1)
      .maybeSingle();
    if (existing) {
      return {
        success: false,
        content:
          "A treatment already exists for this project. write_script must run ONCE per project. To revise the treatment, use the user's Request Changes flow — it dispatches an edit directive that you handle directly, not by re-calling write_script. To proceed: check your room and call the next-stage tool (generate_plate, generate_keyframe, etc.) per the pipeline order.",
      };
    }
  } catch (err) {
    console.warn("[tool:write_script] idempotence check failed (non-fatal):", err);
  }

  const brand: Brand | null = context.brand;

  emitter.send("tool_progress", {
    tool: "write_script",
    generationId: context.generationId,
    status: "generating",
    message: `Directing a ${durationSeconds}s ${aspectRatio} film — writing treatment + shot specs…`,
  });

  // Heartbeat so the user sees progress during the 30-90s JSON generation.
  // Without this the UI sits silent and the tool feels frozen.
  const heartbeatMessages = [
    "Choosing palette and camera rule…",
    "Locking plate taxonomy (characters, locations, props)…",
    "Blocking shot by shot (staging, light, continuity)…",
    "Filling DP specs — lens, scale, fill ratio, key direction…",
    "Double-checking every plate_ref has a role…",
    "Finalizing end card + music cues…",
  ];
  let heartbeatIdx = 0;
  const heartbeat = setInterval(() => {
    if (context.signal?.aborted) return;
    emitter.send("tool_progress", {
      tool: "write_script",
      generationId: context.generationId,
      status: "generating",
      message: heartbeatMessages[heartbeatIdx % heartbeatMessages.length],
    });
    heartbeatIdx++;
  }, 15_000);

  const parts: string[] = [];
  if (creativeDirection) parts.push(creativeDirection);
  if (keyPoints.length > 0) parts.push(`Must include: ${keyPoints.join("; ")}`);
  const userPrompt = parts.length > 0
    ? parts.join("\n\n")
    : "Direct a cinematic commercial.";

  const prompt = videoScriptPrompt(
    brand,
    userPrompt,
    context.language,
    durationSeconds,
    aspectRatio
  );

  // Director-authored system prompt. The treatment is the foundation of
  // every downstream asset — until today, write_script ignored the lead
  // director entirely, so a film by Marcel Vrai (Scorsese-inspired)
  // produced the same generic shots as one by Yuki Sato (Wong Kar-wai-
  // inspired). We now thread the persona's school, visual signature,
  // image style modifier, and a small selection of their cited films
  // straight into the writer's instructions. Mood, color script, camera
  // rule, end card — all of it should now sound like the director who's
  // making the film.
  const persona = context.leadDirector;
  const directorPreamble = persona
    ? `\n\nYou are writing this treatment for ${persona.name} (school: ${persona.school}). Their visual signature: "${truncatePhrase(persona.visualSignature || "", 220)}". Their image style: ${truncatePhrase(persona.imageStyleModifier || "", 200)}.\n\nTheir authored vocabulary — palette, camera grammar, mood language, end-card style — should be unmistakable in the treatment. Lean into the techniques their cited films are known for: ${(persona.filmsCited || [])
        .slice(0, 4)
        .map(
          (f) =>
            `${f.title} (${f.techniques?.slice(0, 2).join(", ") || "—"})`
        )
        .join("; ")}. Scenes are 25 seconds with native sound — dialogue may be written into the scene direction when it serves the film, under-written and sparse; blocking, light and motion still carry the story.\n`
    : "";

  const system =
    "You are a commercial director at the level of Jonathan Glazer, Park Chan-wook, Chloé Zhao, Wong Kar-wai. You output a LEAN JSON treatment + scene list (25-second scenes). You do not pre-plan individual keyframe compositions — those happen at production time. You think in plates, scenes, end cards. You are ruthlessly specific about lenses, palette, camera rule." +
    directorPreamble;

  const MAX_RETRIES = 2;
  let lastError = "";

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 1) {
        emitter.send("tool_progress", {
          tool: "write_script",
          generationId: context.generationId,
          status: "generating",
          message: `Retry ${attempt}/${MAX_RETRIES}...`,
        });
      }

      // gpt-6-sol for the treatment (structured function-call output).
      // Override with SCRIPT_MODEL. write_script runs ONCE per project.
      const script = await generateStructuredJSON<VideoScript>({
        model: process.env.SCRIPT_MODEL || DEFAULT_SCRIPT_MODEL,
        maxTokens: 16384,
        temperature: 0.8,
        system,
        messages: [{ role: "user", content: prompt }],
        schema: SCRIPT_SCHEMA,
        schemaName: "film_treatment",
        signal: context.signal,
      });

      if (!script.plates?.length) {
        lastError = "Script returned zero plates — the director must lock identity before shooting.";
        continue;
      }
      if (!script.shots?.length) {
        lastError = "Script returned zero shots.";
        continue;
      }

      // Persist — defensive on column errors (migration-gated fields).
      emitter.send("tool_progress", {
        tool: "write_script",
        generationId: context.generationId,
        status: "saving",
        message: "Saving treatment…",
      });

      const variantNum = await getNextVariantNumber(context.generationId);
      const { data: asset, error: saveError } = await db
        .from("generation_assets")
        .insert({
          generation_id: context.generationId,
          org_id: context.orgId,
          type: "script",
          asset_role: "script",
          status: "ready",
          storage_path: `script://${context.generationId}`,
          public_url: `script://${context.generationId}`,
          metadata: {
            title: script.title,
            logline: script.logline,
            end_card: script.end_card,
            duration_seconds: script.duration_seconds,
            aspect_ratio: script.aspect_ratio,
            tone: script.tone,
            color_script: script.color_script,
            camera_rule: script.camera_rule,
            reference_films: script.reference_films,
            plates: script.plates,
            shots: script.shots,
            music: script.music,
            voiceover: script.voiceover,
          },
          variant_number: variantNum,
        })
        .select("id")
        .single();

      if (saveError) {
        console.warn("[tool:write_script] DB save error (continuing):", saveError.message);
      }

      emitter.send("tool_progress", {
        tool: "write_script",
        generationId: context.generationId,
        status: "complete",
        message: `Treatment: "${script.title}" — ${script.shots.length} shots, ${script.plates.length} plates.`,
      });

      // Fire a dedicated event for the treatment so the director UI can render
      // the full treatment markdown in the workspace — request_approval.summary
      // is deliberately terse now, so this is the primary path.
      emitter.send("treatment_ready", {
        generationId: context.generationId,
        title: script.title,
        logline: script.logline,
        end_card: script.end_card,
        duration_seconds: script.duration_seconds,
        aspect_ratio: script.aspect_ratio,
        tone: script.tone,
        color_script: script.color_script,
        camera_rule: script.camera_rule,
        reference_films: script.reference_films,
        plates: script.plates,
        shots: script.shots,
        music: script.music,
        voiceover: script.voiceover,
      });

      const plateSummary = script.plates
        .map((p) => `  @${p.tag} · ${p.kind}${p.parent_tag ? ` (from @${p.parent_tag})` : ""} — ${p.description}`)
        .join("\n");

      const shotSummary = script.shots
        .map((s) => {
          const header =
            `  [${s.id}] "${s.label}" · ${s.duration_seconds}s · ${s.model} · plan=${s.keyframe_plan} · plates=[${s.plate_refs.map((r) => `@${r}`).join(", ")}]`;
          const lines: string[] = [header, `       motion: ${s.motion}`];
          if (s.shot_build && s.shot_build.length > 0) {
            const chain = s.shot_build
              .map((step) => {
                if (step.kind === "generate_plate") return `gen@${step.tag}`;
                if (step.kind === "edit_plate")
                  return `edit@${step.target_tag}${step.new_tag ? `→@${step.new_tag}` : ""}`;
                return `compose:${step.role}`;
              })
              .join(" → ");
            lines.push(`       build: ${chain}`);
          }
          if (s.notes) lines.push(`       notes: ${s.notes}`);
          return lines.join("\n");
        })
        .join("\n");

      const summary = [
        `# TREATMENT — ${script.title}`,
        ``,
        `**Logline** — ${script.logline}`,
        `**End card** — "${script.end_card}"`,
        `**Duration** — ${script.duration_seconds}s, ${script.aspect_ratio}`,
        `**Tone** — ${script.tone}`,
        `**Color script** — shadow: ${script.color_script.shadow} · highlight: ${script.color_script.highlight}${script.color_script.notes ? ` (${script.color_script.notes})` : ""}`,
        `**Camera rule** — ${script.camera_rule}`,
        `**References** — ${script.reference_films.join(" · ")}`,
        ``,
        `## PLATES (${script.plates.length})`,
        plateSummary,
        ``,
        `## SHOTS (${script.shots.length})`,
        shotSummary,
        ``,
        script.music?.has_music
          ? `## MUSIC\n${script.music.description || ""}${script.music.mood ? ` · mood: ${script.music.mood}` : ""}`
          : `## AUDIO\nNo music bed. Silence + sparse SFX.`,
        script.voiceover?.full_script
          ? `\n## VOICEOVER\n"${script.voiceover.full_script}"\n(${script.voiceover.direction || "no direction"})`
          : `\n## NO VOICEOVER`,
      ].join("\n");

      clearInterval(heartbeat);
      return {
        success: true,
        content: summary,
        data: script,
        assets: [
          {
            assetId: asset?.id,
            type: "script",
            metadata: {
              title: script.title,
              duration_seconds: script.duration_seconds,
              aspect_ratio: script.aspect_ratio,
              end_card: script.end_card,
            },
          },
        ],
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.error(`[tool:write_script] attempt ${attempt} failed:`, lastError);
      // Abort signal → surface immediately, don't retry
      if (context.signal?.aborted) break;
    }
  }

  clearInterval(heartbeat);
  return {
    success: false,
    content: `Script writing failed: ${lastError}. Try again with a more specific creative_direction, or break the brief into shorter chunks.`,
  };
};
