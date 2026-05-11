import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { getNextVariantNumber } from "./types";
import { generateMusic } from "@/lib/generation/music";
import { db } from "@/lib/db";

export const generateMusicDefinition: ToolDefinition = {
  name: "generate_music",
  description:
    "Generate instrumental background music using Suno. ALWAYS instrumental, no vocals. Costs 5 credits.\n\n" +
    "**STRUCTURED INPUT REQUIRED.** A vague prompt like 'cinematic music' produces basic Suno output. This tool builds a professional music brief by forcing you to fill concrete fields, then composes the final Suno prompt for you. Do NOT write `prompt` — write the structured fields.\n\n" +
    "**Fields you must fill:**\n" +
    "- `genre_refs` (array of 1–3 reference tracks/artists): e.g. ['Hans Zimmer Interstellar soundtrack', 'Bon Iver 22, A Million', 'Nils Frahm piano']. Real songs/artists ground Suno dramatically. Pick from real catalog, not generic descriptors.\n" +
    "- `bpm` (60–160): beats per minute. 60–80 intimate/luxury, 90–110 warm storytelling, 110–125 confident brand, 125–140 energetic, 140+ aggressive.\n" +
    "- `key` ('minor' | 'major'): emotional tilt. Minor for tension, longing, drama. Major for triumph, warmth, joy.\n" +
    "- `instruments` (array, 3–6 primary instruments): be specific. 'felt piano + cello + sub-bass + hi-hat' beats 'orchestral'.\n" +
    "- `arc`: how the track should build across the film — e.g. 'Sparse piano for 0-8s, add strings at 8s on the emotional turn, full percussion at 15s on the product reveal, sustain + tail to 30s.'\n" +
    "- `energy` ('low' | 'medium' | 'high' | 'building'): overall intensity. 'building' = starts sparse, grows.\n" +
    "- `mood_tags` (3–5 one-word tags): 'nostalgic', 'hopeful', 'tense', 'triumphant', 'melancholic', 'gritty', etc. Specific beats generic.\n" +
    "- `negative_traits` (optional, array): things to EXCLUDE — 'no vocals', 'no cheesy synth leads', 'no EDM drop', 'no generic stock-music feel'.\n\n" +
    "The tool composes a reference-grade Suno prompt from these fields and injects 'starts immediately, no intro silence' automatically.",
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
 * Compose a professional Suno prompt from the structured fields. Suno responds
 * dramatically better to a dense brief naming real artists/tracks, exact BPM,
 * instrument stack, and arc than to a vague "cinematic uplifting mood" prompt.
 */
function buildSunoPrompt(input: {
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

  // Suno's `style` tag takes a flat list of descriptors.
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
  // they produced the "basic Suno" quality the user flagged.
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
    const built = buildSunoPrompt({
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
    message: "Generating background music with Suno AI...",
  });

  // Retry up to 2 times — Suno can be flaky
  const MAX_RETRIES = 2;
  let lastError = "";

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`[tool:generate_music] Retry attempt ${attempt}/${MAX_RETRIES}...`);
        emitter.send("tool_progress", {
          tool: "generate_music",
          generationId: context.generationId,
          status: "generating",
          message: `Music generation retry ${attempt}/${MAX_RETRIES}...`,
        });
      }

      const result = await generateMusic({
        prompt,
        style,
        title,
        instrumental: true,
        generationId: context.generationId,
        targetDuration,
      });

      emitter.send("tool_progress", {
        tool: "generate_music",
        generationId: context.generationId,
        status: "saving",
        message: "Uploading music to permanent storage...",
      });

      // Upload to Supabase Storage for a PERMANENT URL
      // Suno returns URLs from tempfile.aiquickdraw.com which expire
      let permanentUrl = result.audioUrl;
      try {
        const audioRes = await fetch(result.audioUrl);
        if (audioRes.ok) {
          const audioBuffer = await audioRes.arrayBuffer();
          const fileName = `music-${context.generationId}-${Date.now()}.mp3`;

          const { error: bucketError } = await db.storage.createBucket("music", {
            public: true,
            allowedMimeTypes: ["audio/mpeg", "audio/wav", "audio/mp3"],
          });
          if (bucketError && !bucketError.message.includes("already exists")) {
            console.warn("[tool:generate_music] Bucket creation warning:", bucketError.message);
          }

          const { error: uploadError } = await db.storage
            .from("music")
            .upload(fileName, audioBuffer, { contentType: "audio/mpeg", upsert: true });

          if (!uploadError) {
            const { data: publicUrlData } = db.storage.from("music").getPublicUrl(fileName);
            permanentUrl = publicUrlData.publicUrl;
            console.log("[tool:generate_music] Uploaded to Supabase Storage:", permanentUrl.slice(0, 80));
          } else {
            console.warn("[tool:generate_music] Supabase upload failed, using Suno URL:", uploadError.message);
          }
        }
      } catch (uploadErr) {
        console.warn("[tool:generate_music] Failed to re-upload music, using Suno URL:", uploadErr);
      }

      // Save to generation_assets
      const variantNum = await getNextVariantNumber(context.generationId);
      const { data: asset, error: saveError } = await db
        .from("generation_assets")
        .insert({
          generation_id: context.generationId,
          org_id: context.orgId,
          type: "audio",
          storage_path: permanentUrl,
          public_url: permanentUrl,
          metadata: {
            asset_category: "background_music",
            prompt,
            style,
            title: result.title,
            duration_seconds: result.duration,
            provider: "suno",
            instrumental: true,
            // Persist the structured brief so we can inspect what actually
            // drove the track (and regenerate variants from the same spec).
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
        message: "Background music generated",
      });

      const summary = [
        `Background music generated successfully`,
        `Title: "${result.title}"`,
        `Duration: ${result.duration}s`,
        `Audio URL: ${permanentUrl}`,
        "",
        "IMPORTANT: Pass this EXACT URL as background_music_url when calling compose_video:",
        permanentUrl,
      ].join("\n");

      return {
        success: true,
        content: summary,
        data: { ...result, audioUrl: permanentUrl },
        assets: [
          {
            assetId: asset?.id,
            type: "audio",
            url: permanentUrl,
            metadata: {
              asset_category: "background_music",
              title: result.title,
              duration_seconds: result.duration,
            },
          },
        ],
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.error(`[tool:generate_music] Attempt ${attempt}/${MAX_RETRIES} failed:`, lastError);

      // Don't retry on config errors
      if (lastError.includes("SUNO_API_KEY")) break;
    }
  }

  // All retries exhausted
  let hint = "";
  if (lastError.includes("SUNO_API_KEY")) {
    hint = " Set SUNO_API_KEY in your .env file.";
  } else if (lastError.includes("timeout")) {
    hint = " Suno timed out after retries. The service may be overloaded.";
  }

  return {
    success: false,
    content: `Music generation failed after ${MAX_RETRIES} attempts: ${lastError}${hint}\n\nMusic generation is unreliable. Proceed to compose_video WITHOUT background_music_url — it's better to deliver a video without music than to keep retrying and waste time/credits. The user can add music later.`,
  };
};
