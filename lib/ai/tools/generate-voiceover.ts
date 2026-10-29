// generate_voiceover — Runway-routed ElevenLabs TTS.
//
// Architecture (May 2026 — switched from direct ElevenLabs to Runway):
//   1. Voice resolution priority:
//      a) lead director's custom voice (persona.voice.voiceId) when populated
//      b) explicit voice_id passed by the agent
//      c) style-keyword pick from the curated ElevenLabs voice catalog
//      d) safe fallback (a warm female voice)
//   2. Send to Runway `textToSpeech` (model: eleven_v3) — this
//      is ElevenLabs under the hood, so credit + cost telemetry rolls up to
//      the Runway account.
//   3. Mirror the output URL into Supabase Storage so the Remotion compose
//      step has a stable URL that never expires.

import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { getNextVariantNumber, TOOL_CREDIT_COSTS } from "./types";
import { textToSpeech as runwayTextToSpeech } from "@/lib/runway";
import { persistAsset } from "@/lib/generation/persist-asset";
import { db } from "@/lib/db";

// Curated ElevenLabs voice catalog — same IDs as the legacy TTS module so the
// behaviour transfers 1:1. Runway's `eleven_v3` model accepts
// ElevenLabs voice IDs directly because Runway delegates to ElevenLabs.
const VOICE_CATALOG = {
  hale:        { id: "wWWn96OtTHu1sn8SRGEr", style: "expressive, deep, emotive",       bestFor: "storytelling, emotional, brand films" },
  b_giffen:    { id: "Gpn64ViAPE8OHwnBHpEs", style: "professional, narration",         bestFor: "explainers, eLearning, corporate" },
  clemens:     { id: "eJHgBguIWw9PtA4GHbSP", style: "loud, energetic, attention-grabbing", bestFor: "hooks, hype, energetic" },
  christopher: { id: "SSfU0eLfP3qeuR4j2bwD", style: "smooth, deep, engaging",          bestFor: "premium, luxury" },
  koraly:      { id: "rbFGGoDXFHtVghjHuS3E", style: "promotional, polished",           bestFor: "promo, marketing, launches" },
  camille:     { id: "Da9VfudgKUvFOKayCiue", style: "content creator, casual",         bestFor: "UGC, social, conversational" },
  kat:         { id: "RiK8PTtVIeKKoFFTk9fg", style: "sharp, smart, educator",          bestFor: "tutorials, educational" },
  sophie:      { id: "BewlJwjEWiFLWoXrbGMf", style: "engaging, warm",                  bestFor: "advertising, social, friendly" },
} as const;
type VoiceName = keyof typeof VOICE_CATALOG;

function pickByStyle(style?: string): string {
  const s = (style || "").toLowerCase();
  if (s.includes("energetic") || s.includes("hype") || s.includes("loud")) return VOICE_CATALOG.clemens.id;
  if (s.includes("storytelling") || s.includes("emotive") || s.includes("emotional")) return VOICE_CATALOG.hale.id;
  if (s.includes("premium") || s.includes("luxury") || s.includes("smooth") || s.includes("deep")) return VOICE_CATALOG.christopher.id;
  if (s.includes("professional") || s.includes("corporate") || s.includes("narration")) return VOICE_CATALOG.b_giffen.id;
  if (s.includes("ugc") || s.includes("casual") || s.includes("creator") || s.includes("content")) return VOICE_CATALOG.camille.id;
  if (s.includes("promo") || s.includes("launch") || s.includes("polished")) return VOICE_CATALOG.koraly.id;
  if (s.includes("educator") || s.includes("tutorial") || s.includes("sharp")) return VOICE_CATALOG.kat.id;
  if (s.includes("warm") || s.includes("friendly") || s.includes("social")) return VOICE_CATALOG.sophie.id;
  if (s.includes("female")) return VOICE_CATALOG.sophie.id;
  if (s.includes("male")) return VOICE_CATALOG.christopher.id;
  return VOICE_CATALOG.hale.id;
}

// Accept catalog names ("Hale", "christopher"), ElevenLabs IDs, or Runway
// custom IDs — return whatever should go on the wire.
function resolveVoiceId(idOrName: string): string {
  const lower = idOrName.toLowerCase();
  if (lower in VOICE_CATALOG) return VOICE_CATALOG[lower as VoiceName].id;
  // Already an ID-shaped string — passed through unchanged.
  return idOrName;
}

export const generateVoiceoverDefinition: ToolDefinition = {
  name: "generate_voiceover",
  description:
    "Generate voiceover audio via Runway-routed ElevenLabs (eleven_v3). Returns a hosted audio URL. Costs 3 credits.\n\n" +
    "**Voice resolution priority:**\n" +
    "1. When the lead director has a custom voice configured (most films), THAT voice is used — pass nothing for voice_id and the tool auto-resolves.\n" +
    "2. Otherwise pass `voice_id` directly OR `voice_style` for catalog-based pick.\n\n" +
    "**Voice catalog (for style-based picks):**\n" +
    "- 'storytelling' / 'emotional' → Hale (M) — expressive, atmospheric\n" +
    "- 'premium' / 'luxury' → Christopher (M) — smooth deep, intimate\n" +
    "- 'professional' / 'corporate' → B.Giffen (M) — steady narration\n" +
    "- 'energetic' / 'hype' → Clemens (M) — punchy\n" +
    "- 'warm' / 'friendly' → Sophie (F) — social\n" +
    "- 'promo' / 'polished' → Koraly (F) — launch energy\n" +
    "- 'casual' / 'ugc' → Camille (F) — conversational\n" +
    "- 'educator' / 'sharp' → Kat (F) — instructional\n\n" +
    "**Guidance:** ONE continuous voiceover for the full script. Many Cannes-worthy films have no voiceover — if the treatment says 'no VO', skip this tool entirely.",
  input_schema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description:
          "The text to speak. Can be any length — longer scripts produce longer audio.",
      },
      voice_style: {
        type: "string",
        description:
          "Catalog pick by style keyword. Used only when the lead director has no custom voice AND no explicit voice_id is given.",
      },
      voice_id: {
        type: "string",
        description:
          "Direct override — ElevenLabs voice ID, catalog name (e.g. 'Hale'), or Runway custom voice ID. Overrides director voice + style.",
      },
      language: {
        type: "string",
        description: "Language code. Defaults to 'en'.",
      },
    },
    required: ["text"],
  },
};

export const generateVoiceoverTool: ToolHandler = async (
  input,
  context,
  emitter
): Promise<ToolResult> => {
  const text = (input.text as string).trim();
  const explicitVoiceId = (input.voice_id as string) || undefined;
  const voiceStyle = (input.voice_style as string) || undefined;
  const language = (input.language as string) || context.language || "en";

  const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
  if (wordCount < 25) {
    return {
      success: false,
      content: `Voiceover text is only ${wordCount} words. Too short for any ad voiceover — write at least 40-50 words for a 25-30s film. Pass the FULL voiceover script.`,
    };
  }
  if (wordCount > 200) {
    console.warn(
      `[tool:generate_voiceover] very long text: ${wordCount} words (~${Math.round(wordCount / 2.5)}s).`
    );
  }

  // Voice resolution. Director's custom voice wins unless the agent passed
  // an explicit override — those overrides are typically for stylistic
  // co-direction (e.g. "give me a female narrator for this one beat").
  let voiceId: string;
  let voiceSource: string;
  const personaVoice = context.leadDirector?.voice;
  if (explicitVoiceId) {
    voiceId = resolveVoiceId(explicitVoiceId);
    voiceSource = `explicit override (${explicitVoiceId})`;
  } else if (
    personaVoice &&
    personaVoice.type === "custom" &&
    personaVoice.voiceId
  ) {
    voiceId = personaVoice.voiceId;
    voiceSource = `lead director (${context.leadDirector?.name ?? "?"} custom voice)`;
  } else if (personaVoice && personaVoice.type === "preset") {
    voiceId = personaVoice.presetId;
    voiceSource = `lead director (preset ${personaVoice.presetId})`;
  } else {
    voiceId = pickByStyle(voiceStyle);
    voiceSource = `style catalog (${voiceStyle || "default"})`;
  }

  console.log(
    "[tool:generate_voiceover]",
    "words:", wordCount,
    "language:", language,
    "voice:", voiceSource,
    "voiceId:", voiceId
  );

  emitter.send("tool_progress", {
    tool: "generate_voiceover",
    generationId: context.generationId,
    status: "generating",
    message: `Generating voiceover via Runway → ElevenLabs (${voiceSource})…`,
  });

  try {
    const task = await runwayTextToSpeech({
      text,
      voiceId,
      generationId: context.generationId,
      description: `voiceover [${voiceSource}] ${text.slice(0, 60)}`,
    });

    const rawUrl = Array.isArray(task.output)
      ? task.output[0]
      : (task.output as unknown as string);
    if (!rawUrl) {
      return {
        success: false,
        content:
          "Runway voiceover task returned no output URL. Try again, or fall back to a different voice_style.",
      };
    }

    emitter.send("tool_progress", {
      tool: "generate_voiceover",
      generationId: context.generationId,
      status: "uploading",
      message: "Mirroring voiceover to Supabase Storage…",
    });

    // Mirror to Supabase so compose_video has a stable URL. Runway's CDN URLs
    // are believed stable but the mirror is cheap insurance against render-
    // time 404s — Remotion failures are the worst kind because they show up
    // 60+ seconds after the user clicked.
    const audioUrl = await persistAsset(rawUrl, {
      generationId: context.generationId,
      kind: "audio",
      basename: `voiceover-${context.generationId}`,
    });

    const durationEstimate = Math.round(wordCount / 2.5);

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
          asset_kind: "voiceover",
          role: "voiceover",
          text,
          voice_id: voiceId,
          voice_source: voiceSource,
          voice_style: voiceStyle || null,
          language,
          provider: "runway/elevenlabs",
          duration_seconds: durationEstimate,
          runway_task_id: task.taskId,
          source_url: rawUrl,
        },
        variant_number: variantNum,
      })
      .select("id")
      .single();

    if (saveError) {
      console.warn(
        "[tool:generate_voiceover] DB insert warning:",
        saveError.message
      );
    }

    emitter.send("tool_progress", {
      tool: "generate_voiceover",
      generationId: context.generationId,
      status: "complete",
      message: "Voiceover ready",
    });

    const summary = [
      `Voiceover ready (Runway → ElevenLabs).`,
      `Audio URL: ${audioUrl}`,
      `Voice: ${voiceSource} · ${voiceId}`,
      `Language: ${language}`,
      `Estimated duration: ~${durationEstimate}s (${wordCount} words)`,
      `Credits used: ${TOOL_CREDIT_COSTS.generate_voiceover}`,
    ].join("\n");

    return {
      success: true,
      content: summary,
      data: {
        language,
        voiceId,
        voiceSource,
        provider: "runway/elevenlabs",
        durationSeconds: durationEstimate,
      },
      assets: [
        {
          assetId: asset?.id,
          type: "audio",
          url: audioUrl,
          metadata: {
            asset_kind: "voiceover",
            text,
            voice_id: voiceId,
            voice_source: voiceSource,
            language,
            duration_seconds: durationEstimate,
          },
        },
      ],
    };
  } catch (err) {
    console.error("[tool:generate_voiceover] Runway TTS failed:", err);
    return {
      success: false,
      content: `Voiceover generation failed: ${err instanceof Error ? err.message : String(err)}. The Runway TTS endpoint may be rate-limited or the voice_id "${voiceId}" rejected — retry, or pass a different voice_id.`,
    };
  }
};
