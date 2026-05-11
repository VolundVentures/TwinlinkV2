// generate_ambient — film-wide ambient sound bed via Runway → ElevenLabs
// (eleven_text_to_sound_v2).
//
// Sits between the score (Suno, melodic, foregrounded) and silence: a quiet
// textured layer of room tone, weather, distant traffic, breath of space.
// One call per film for the master ambient bed; the agent may fire a second
// targeted call for a beat-specific SFX (e.g. a single door close, a single
// thunderclap) when the script calls for it.
//
// The lead director's `soundDesignNote` is folded into every prompt so the
// ambient texture matches their school — Marcel Vrai gets "subway rumble,
// vinyl crackle, leather creaks"; Yuki Sato gets "rain on neon, distant
// late-night traffic, ceiling fan hum"; Sven Holmgren gets "wide architectural
// silence, low atmospheric drone, single distant footstep".

import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { getNextVariantNumber, TOOL_CREDIT_COSTS } from "./types";
import { textToSound } from "@/lib/runway";
import { persistAsset } from "@/lib/generation/persist-asset";
import { db } from "@/lib/db";

export const generateAmbientDefinition: ToolDefinition = {
  name: "generate_ambient",
  description:
    "Generate an ambient sound bed (or a single diegetic SFX beat) via Runway → ElevenLabs (eleven_text_to_sound_v2). Costs 4 credits per call.\n\n" +
    "**Two modes:**\n" +
    "1. BED — the room tone / location atmosphere that plays UNDER the whole film. Duration = full film. Use when the treatment specifies a location with audible texture (a cafe, a rainy street, a forest, a server room). Call ONCE per film.\n" +
    "2. SFX — a single specific sound event (door close, thunderclap, glass break, footstep, page turn). Duration short (1-5s). Call when the script calls out a specific beat that needs sonic punctuation.\n\n" +
    "**Director DNA is automatic.** The lead director's `soundDesignNote` is appended to every prompt server-side. You write the SCENE (what the audience hears) — the tool injects the SCHOOL (how that director hears it).\n\n" +
    "**Prompt rules:**\n" +
    "- Specific over abstract: 'rain on cobblestones with distant thunder' beats 'rainy ambience'.\n" +
    "- Multi-element compositions read better than single sources: 'subway rumble under conversation, espresso machine hisses, vinyl crackle from a corner speaker' beats 'cafe ambience'.\n" +
    "- Describe LOCATION + WEATHER + TIME OF DAY + NEAR/FAR sources.\n" +
    "- Never include music or speech — that's not what this tool does.\n\n" +
    "**Audio architecture: this layer plays at ~0.18 volume in the final mix, beneath voiceover (0.85) and music (0.15). It's a texture, not a melody — but it's the layer that makes a 30-second AI film feel like it was shot somewhere real.**",
  input_schema: {
    type: "object",
    properties: {
      mode: {
        type: "string",
        enum: ["bed", "sfx"],
        description:
          "BED for full-film room tone. SFX for a single sonic beat (door, breath, glass).",
      },
      description: {
        type: "string",
        description:
          "Detailed description of the sound. Specific. 'rain on cobblestones with distant thunder, wind in stone alley, single church bell three blocks away' beats 'rainy ambience'.",
      },
      duration_seconds: {
        type: "number",
        minimum: 1,
        maximum: 60,
        description:
          "For BED: match the film duration (will be looped/extended in compose if needed). For SFX: 1-5s typically. The model picks if omitted.",
      },
      label: {
        type: "string",
        description:
          "Short label for the asset. E.g. 'cafe_ambience_bed', 'thunderclap_sfx', 'forest_dawn_bed'.",
      },
    },
    required: ["mode", "description"],
  },
};

export const generateAmbientTool: ToolHandler = async (
  input,
  context,
  emitter
): Promise<ToolResult> => {
  const mode = (input.mode as string) === "sfx" ? "sfx" : "bed";
  const description = (input.description as string).trim();
  const requestedDuration = input.duration_seconds as number | undefined;
  const label =
    (input.label as string) || (mode === "bed" ? "ambient_bed" : "ambient_sfx");

  if (!description || description.length < 8) {
    return {
      success: false,
      content:
        "generate_ambient requires a `description` of at least 8 characters. Write a specific sound brief (location, weather, near/far sources). 'rainy cafe' is too vague — try 'late-night cafe interior, distant rain through window, espresso steam hiss, soft footsteps on tile, vinyl crackle from corner speaker'.",
    };
  }

  // Director DNA — append the lead director's soundDesignNote so the ambient
  // texture carries the school's audio signature (Scorsese-coded NY street vs
  // Wong Kar-wai late-night neon vs Villeneuve architectural silence).
  const persona = context.leadDirector;
  const soundNote = persona?.soundDesignNote?.trim();
  const directorTag =
    soundNote && mode === "bed"
      ? ` — sound design in the signature of ${persona?.name ?? "the lead director"}: ${soundNote}`
      : "";
  const finalPrompt = `${description}${directorTag}`.slice(0, 900);

  // Duration heuristic: BED defaults to the film duration so compose_video
  // can loop a single track under the whole cut. SFX defaults to 4s.
  const fallback = mode === "bed" ? context.durationSeconds || 30 : 4;
  const durationSeconds = Math.min(
    60,
    Math.max(1, Math.round(requestedDuration ?? fallback))
  );

  emitter.send("tool_progress", {
    tool: "generate_ambient",
    generationId: context.generationId,
    status: "generating",
    message: `Generating ${mode === "bed" ? "ambient bed" : "diegetic SFX"} (${durationSeconds}s) via Runway → ElevenLabs…`,
  });

  try {
    const task = await textToSound({
      text: finalPrompt,
      durationSeconds,
      generationId: context.generationId,
      description: `${mode} [${label}] ${description.slice(0, 60)}`,
    });

    const rawUrl = Array.isArray(task.output)
      ? task.output[0]
      : (task.output as unknown as string);
    if (!rawUrl) {
      return {
        success: false,
        content:
          "Runway ambient task returned no output URL. Retry, or rephrase the description if it triggered the safety filter (war / explicit content sometimes does).",
      };
    }

    emitter.send("tool_progress", {
      tool: "generate_ambient",
      generationId: context.generationId,
      status: "uploading",
      message: "Mirroring ambient track to Supabase Storage…",
    });

    const audioUrl = await persistAsset(rawUrl, {
      generationId: context.generationId,
      kind: "audio",
      basename: `${mode}-${label}`,
    });

    const variantNum = await getNextVariantNumber(context.generationId);
    const { data: asset, error: saveError } = await db
      .from("generation_assets")
      .insert({
        generation_id: context.generationId,
        org_id: context.orgId,
        type: "audio",
        public_url: audioUrl,
        storage_path: audioUrl,
        metadata: {
          asset_kind: mode === "bed" ? "ambient_bed" : "ambient_sfx",
          role: mode === "bed" ? "ambient_bed" : "ambient_sfx",
          mode,
          label,
          description,
          composed_prompt: finalPrompt,
          duration_seconds: durationSeconds,
          provider: "runway/elevenlabs",
          model: "eleven_text_to_sound_v2",
          director_id: persona?.id ?? null,
          runway_task_id: task.taskId,
          source_url: rawUrl,
        },
        variant_number: variantNum,
      })
      .select("id")
      .single();

    if (saveError) {
      console.warn(
        "[tool:generate_ambient] DB insert warning:",
        saveError.message
      );
    }

    emitter.send("tool_progress", {
      tool: "generate_ambient",
      generationId: context.generationId,
      status: "complete",
      message: `Ambient ${mode} ready (${durationSeconds}s).`,
    });

    const summary = [
      `Ambient ${mode === "bed" ? "bed" : "SFX"} ready (Runway → ElevenLabs).`,
      `Audio URL: ${audioUrl}`,
      `Duration: ${durationSeconds}s`,
      `Label: ${label}`,
      `Director DNA: ${soundNote ? `${persona?.name ?? "?"} sound design applied` : "none (no director persona or no soundDesignNote)"}`,
      `Credits used: ${TOOL_CREDIT_COSTS.generate_ambient ?? 4}`,
      mode === "bed"
        ? `Pass this URL to compose_video as \`ambient_sound_url\`.`
        : `Use this SFX in a future cut/edit pass — currently the compose pipeline supports ONE ambient_sound_url per film. For per-beat SFX, hand-edit in post.`,
    ].join("\n");

    return {
      success: true,
      content: summary,
      data: {
        mode,
        label,
        durationSeconds,
        provider: "runway/elevenlabs",
      },
      assets: [
        {
          assetId: asset?.id,
          type: "audio",
          url: audioUrl,
          metadata: {
            asset_kind: mode === "bed" ? "ambient_bed" : "ambient_sfx",
            mode,
            label,
            description,
            duration_seconds: durationSeconds,
          },
        },
      ],
    };
  } catch (err) {
    console.error("[tool:generate_ambient] Runway text_to_sound failed:", err);
    return {
      success: false,
      content: `Ambient generation failed: ${err instanceof Error ? err.message : String(err)}. Re-phrase if the safety filter rejected the description, or retry.`,
    };
  }
};
