import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { getNextVariantNumber } from "./types";
import { generateScore } from "@/lib/runway";
import { persistAsset } from "@/lib/generation/persist-asset";
import { db } from "@/lib/db";

export const generateMusicDefinition: ToolDefinition = {
  name: "generate_music",
  description:
    "Generate the instrumental score via Runway seed_audio. ALWAYS instrumental, no vocals. Costs 2 credits.\n\n" +
    "**STRUCTURED INPUT REQUIRED.** A vague prompt like 'cinematic music' produces stock-library output. This tool builds a professional music brief by forcing you to fill concrete fields, then composes the final music brief for you. Do NOT write `prompt` — write the structured fields.\n\n" +
    "**Fields you must fill:**\n" +
    "- `genre_refs` (array of 1–3 reference tracks/artists): e.g. ['Hans Zimmer Interstellar soundtrack', 'Bon Iver 22, A Million', 'Nils Frahm piano']. Real songs/artists ground the model dramatically. Pick from real catalog, not generic descriptors.\n" +
    "- `bpm` (60–160): beats per minute. 60–80 intimate/luxury, 90–110 warm storytelling, 110–125 confident brand, 125–140 energetic, 140+ aggressive.\n" +
    "- `key` ('minor' | 'major'): emotional tilt. Minor for tension, longing, drama. Major for triumph, warmth, joy.\n" +
    "- `instruments` (array, 3–6 primary instruments): be specific. 'felt piano + cello + sub-bass + hi-hat' beats 'orchestral'.\n" +
    "- `arc`: how the track should build across the film — e.g. 'Sparse piano for 0-8s, add strings at 8s on the emotional turn, full percussion at 15s on the product reveal, sustain + tail to 30s.'\n" +
    "- `energy` ('low' | 'medium' | 'high' | 'building'): overall intensity. 'building' = starts sparse, grows.\n" +
    "- `mood_tags` (3–5 one-word tags): 'nostalgic', 'hopeful', 'tense', 'triumphant', 'melancholic', 'gritty', etc. Specific beats generic.\n" +
    "- `negative_traits` (optional, array): things to EXCLUDE — 'no vocals', 'no cheesy synth leads', 'no EDM drop', 'no generic stock-music feel'.\n\n" +
    "The tool composes a reference-grade music brief from these fields and injects 'starts immediately, no intro silence' automatically.",
  input_schema: {
    type: "object",
    properties: {
      genre_refs: {
        type: "array",
        items: { type: "string" },
        description:
          "1–3 reference tracks or artists. Real catalog names. E.g. ['Hans Zimmer Dunkirk', 'Jóhann Jóhannsson Arrival', 'Max Richter On The Nature Of Daylight'].",
      },
      bpm: {
        type: "number",
        minimum: 60,
        maximum: 160,
        description:
          "Beats per minute. 60–80 intimate, 90–110 warm, 110–125 confident, 125–140 energetic, 140+ aggressive.",
      },
      key: {
        type: "string",
        enum: ["minor", "major"],
        description: "Emotional tilt. Minor = tension/longing/drama. Major = triumph/warmth/joy.",
      },
      instruments: {
        type: "array",
        items: { type: "string" },
        description:
          "3–6 primary instruments, specific. E.g. ['felt piano', 'legato cello', 'sub-bass', 'brushed hi-hat', 'ambient pad'].",
      },
      arc: {
        type: "string",
        description:
          "How the track evolves across the film's duration. E.g. 'Sparse piano for 0-8s, add strings at 8s on emotional turn, full percussion at 15s on product reveal, sustain + tail to 30s.'",
      },
      energy: {
        type: "string",
        enum: ["low", "medium", "high", "building"],
        description:
          "Overall intensity. 'building' = starts sparse and grows.",
      },
      mood_tags: {
        type: "array",
        items: { type: "string" },
        description:
          "3–5 one-word emotional tags. Specific beats generic. E.g. ['nostalgic', 'hopeful', 'triumphant'].",
      },
      negative_traits: {
        type: "array",
        items: { type: "string" },
        description:
          "Optional. What to exclude. E.g. ['no vocals', 'no EDM drop', 'no generic stock-music'].",
      },
      title: {
        type: "string",
        description: "Short title for the track.",
      },
      duration_seconds: {
        type: "number",
        minimum: 10,
        maximum: 90,
        description:
          "Target duration. Default 30. Should match the film's duration_seconds.",
      },
    },
    required: ["genre_refs", "bpm", "key", "instruments", "arc", "energy", "mood_tags"],
  },
};

/**
 * Compose a professional music brief from the structured fields. The model responds
 * dramatically better to a dense brief naming real artists/tracks, exact BPM,
 * instrument stack, and arc than to a vague "cinematic uplifting mood" prompt.
 */
function buildMusicBrief(input: {
  genre_refs: string[];
  bpm: number;
  key: "minor" | "major";
  instruments: string[];
  arc: string;
  energy: "low" | "medium" | "high" | "building";
  mood_tags: string[];
  negative_traits?: string[];
}): { prompt: string; style: string } {
  const refs = input.genre_refs.join(", ");
  const instruments = input.instruments.join(", ");
  const moods = input.mood_tags.join(", ");
  const negatives = input.negative_traits?.length
    ? ` AVOID: ${input.negative_traits.join("; ")}.`
    : "";

  const prompt = [
    `Instrumental cinema score in the sonic world of ${refs}.`,
    `${input.bpm} BPM, ${input.key} key, ${input.energy} energy.`,
    `Core instrumentation: ${instruments}.`,
    `Mood: ${moods}.`,
    `Arc: ${input.arc}`,
    `Starts IMMEDIATELY from beat one — no intro silence, no fade-in, no count-in.`,
    `Real instruments feel, not stock loops. Mastering: cinema-level dynamic range, not radio-crushed.${negatives}`,
  ].join(" ");

  // Flat list of style descriptors appended to the brief.
  const style = [
    `${input.bpm}bpm`,
    input.key,
    input.energy,
    ...input.mood_tags,
    ...input.instruments.slice(0, 3),
    "instrumental",
    "cinematic",
    "film score",
  ].join(", ");

  return { prompt, style };
}

export const generateMusicTool: ToolHandler = async (
  input,
  context,
  emitter
): Promise<ToolResult> => {
  // Accept structured fields (the production path). Legacy free-form `prompt`
  // + `style` are still accepted for backward compat but strongly discouraged —
  // they produced stock-library quality.
  const genreRefs = (input.genre_refs as string[]) || [];
  const bpm = input.bpm as number | undefined;
  const key = input.key as "minor" | "major" | undefined;
  const instruments = (input.instruments as string[]) || [];
  const arc = input.arc as string | undefined;
  const energy = input.energy as "low" | "medium" | "high" | "building" | undefined;
  const moodTags = (input.mood_tags as string[]) || [];
  const negativeTraits = input.negative_traits as string[] | undefined;
  const title = (input.title as string) || "Film Score";
  const targetDuration = (input.duration_seconds as number) || 30;

  let prompt: string;
  let style: string | undefined;
  if (genreRefs.length && bpm && key && instruments.length && arc && energy && moodTags.length) {
    const built = buildMusicBrief({
      genre_refs: genreRefs,
      bpm,
      key,
      instruments,
      arc,
      energy,
      mood_tags: moodTags,
      negative_traits: negativeTraits,
    });
    prompt = built.prompt;
    style = built.style;
  } else if (input.prompt) {
    // Legacy path — warn the agent to migrate.
    prompt = input.prompt as string;
    style = (input.style as string) || undefined;
    console.warn(
      "[tool:generate_music] Legacy free-form prompt path — use structured fields (genre_refs/bpm/key/instruments/arc/energy/mood_tags) for better results."
    );
  } else {
    return {
      success: false,
      content:
        "generate_music requires structured fields: genre_refs (≥1), bpm, key, instruments (≥3), arc, energy, mood_tags (≥3). See tool description for the professional brief format. Do not pass a free-form prompt — it produces basic output.",
    };
  }

  console.log(
    "[tool:generate_music]",
    "refs:", genreRefs.slice(0, 2).join("/"),
    "bpm:", bpm,
    "key:", key,
    "energy:", energy,
    "prompt:", prompt.slice(0, 80)
  );

  emitter.send("tool_progress", {
    tool: "generate_music",
    generationId: context.generationId,
    status: "generating",
    message: "Scoring the film (Runway seed_audio)...",
  });

  try {
    const taskResult = await generateScore({
      promptText: `${prompt}${style ? ` Style: ${style}.` : ""}`,
      durationSeconds: targetDuration,
      generationId: context.generationId,
      description: `score "${title}" (${targetDuration}s)`,
    });
    const sourceUrl = Array.isArray(taskResult.output)
      ? taskResult.output[0]
      : (taskResult.output as unknown as string);
    if (!sourceUrl) throw new Error("seed_audio returned no output URL");

    emitter.send("tool_progress", {
      tool: "generate_music",
      generationId: context.generationId,
      status: "saving",
      message: "Uploading score to permanent storage...",
    });
    const permanentUrl = await persistAsset(sourceUrl, {
      generationId: context.generationId,
      kind: "audio",
      basename: `score-${Date.now()}`,
    });

    const variantNum = await getNextVariantNumber(context.generationId);
    const { data: asset, error: saveError } = await db
      .from("generation_assets")
      .insert({
        generation_id: context.generationId,
        org_id: context.orgId,
        type: "audio",
        storage_path: permanentUrl,
        public_url: permanentUrl,
        prediction_id: taskResult.taskId,
        metadata: {
          asset_category: "background_music",
          prompt,
          style,
          title,
          duration_seconds: targetDuration,
          provider: "runway/seed_audio",
          instrumental: true,
          brief: {
            genre_refs: genreRefs,
            bpm,
            key,
            instruments,
            arc,
            energy,
            mood_tags: moodTags,
            negative_traits: negativeTraits,
          },
        },
        variant_number: variantNum,
      })
      .select("id")
      .single();
    if (saveError) {
      console.warn("[tool:generate_music] Failed to save:", saveError.message);
    }

    emitter.send("tool_progress", {
      tool: "generate_music",
      generationId: context.generationId,
      status: "complete",
      message: "Score generated",
    });

    return {
      success: true,
      content: [
        `Score generated: "${title}" (~${targetDuration}s)`,
        `Audio URL: ${permanentUrl}`,
        "",
        "IMPORTANT: Pass this EXACT URL as background_music_url when calling compose_video:",
        permanentUrl,
      ].join("\n"),
      data: { audioUrl: permanentUrl, title, duration: targetDuration },
      assets: [
        {
          assetId: asset?.id,
          type: "audio",
          url: permanentUrl,
          metadata: { asset_category: "background_music", title, duration_seconds: targetDuration },
        },
      ],
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[tool:generate_music] failed:", msg);
    return {
      success: false,
      content: `Score generation failed: ${msg}\n\nProceed to compose_video WITHOUT background_music_url rather than retrying — the scenes carry native audio, and the user can add a score later.`,
    };
  }
};
