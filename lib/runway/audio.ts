// ElevenLabs models surfaced via Runway.
//
// Used for the post-production audio stack:
//   - Voice locks + dialogue (eleven_multilingual_v2)
//   - Ambient beds (eleven_text_to_sound_v2 — per scene/location)
//   - Diegetic SFX (eleven_text_to_sound_v2 — per beat)
//
// The Suno score layer goes through the existing TwinLink integration in
// lib/generation/music.ts, NOT through Runway.

import { trackCost } from "../generation/cost-tracker";
import { getRunwayClient } from "./client";
import { withSlot } from "./rate-limit";
import { RUNWAY_MODELS } from "./models";
import type { RunwayTaskResult } from "./types";

// Runway's SDK only exposes a fixed enum of preset voice names for
// `textToSpeech`. ElevenLabs IDs and Runway custom-voice IDs (created via the
// raw `/v1/custom_voices` HTTP endpoint) are NOT accepted here. Surfaced from
// node_modules/@runwayml/sdk/resources/text-to-speech.d.ts.
export const RUNWAY_TTS_PRESETS = [
  "Maya", "Arjun", "Serene", "Bernard", "Billy", "Mark", "Clint", "Mabel",
  "Chad", "Leslie", "Eleanor", "Elias", "Elliot", "Grungle", "Brodie",
  "Sandra", "Kirk", "Kylie", "Lara", "Lisa", "Malachi", "Marlene", "Martin",
  "Miriam", "Monster", "Paula", "Pip", "Rusty", "Ragnar", "Xylar", "Maggie",
  "Jack", "Katie", "Noah", "James", "Rina", "Ella", "Mariah", "Frank",
  "Claudia", "Niki", "Vincent", "Kendrick", "Myrna", "Tom", "Wanda",
  "Benjamin", "Kiana", "Rachel",
] as const;
export type RunwayTtsPreset = (typeof RUNWAY_TTS_PRESETS)[number];

export type TextToSpeechInput = {
  text: string;
  /**
   * Runway preset voice name (e.g. "Vincent", "Rachel"). Case-insensitive
   * match against `RUNWAY_TTS_PRESETS`. The previous implementation accepted
   * an opaque `voiceId` string — Runway's SDK rejects that shape; only
   * preset names listed in the enum above are valid.
   */
  voiceId: string;
  generationId: string;
  description: string;
};

function resolvePresetVoice(voiceId: string): RunwayTtsPreset {
  // Exact match first (case-sensitive), then case-insensitive.
  if ((RUNWAY_TTS_PRESETS as readonly string[]).includes(voiceId)) {
    return voiceId as RunwayTtsPreset;
  }
  const lower = voiceId.toLowerCase();
  const ci = RUNWAY_TTS_PRESETS.find((p) => p.toLowerCase() === lower);
  if (ci) return ci;
  // Fall back to a warm neutral male default — Vincent. Better than failing.
  console.warn(
    `[runway/audio] textToSpeech voiceId "${voiceId}" not in Runway preset enum; falling back to Vincent. Valid presets: ${RUNWAY_TTS_PRESETS.join(", ")}`
  );
  return "Vincent";
}

export async function textToSpeech(
  input: TextToSpeechInput
): Promise<RunwayTaskResult<string[]>> {
  return withSlot(async () => {
    const client = getRunwayClient();
    const preset = resolvePresetVoice(input.voiceId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const task = await (client as any).textToSpeech
      .create({
        model: RUNWAY_MODELS.ELEVEN_TTS,
        promptText: input.text,
        voice: { presetId: preset, type: "runway-preset" },
      })
      .waitForTaskOutput();
    if (input.generationId) {
      trackCost(
        input.generationId,
        "runway/eleven_multilingual_v2",
        input.text.length,
        input.description
      );
    }
    return { taskId: task.id, output: task.output };
  });
}

export type TextToSoundInput = {
  /** Description of the sound. E.g. "rain on cobblestones, distant thunder, wind in stone alley". */
  text: string;
  /**
   * Optional duration in seconds. If unspecified the model picks; we usually
   * pin to scene length for ambients and beat length for diegetic SFX.
   */
  durationSeconds?: number;
  generationId: string;
  description: string;
};

export async function textToSound(
  input: TextToSoundInput
): Promise<RunwayTaskResult<string[]>> {
  return withSlot(async () => {
    const client = getRunwayClient();
    // Wrong SDK shape until 2026-05-12: was using `textToSpeech.create()` with
    // `text` and `durationSeconds`. Runway's SDK exposes text-to-sound on a
    // SEPARATE resource (`soundEffect`) with `promptText` and `duration` —
    // the speech-shaped call returned a server-side validation error and the
    // agent kept retrying. SDK type: SoundEffectCreateParams in
    // @runwayml/sdk/resources/sound-effect.
    const params: Record<string, unknown> = {
      model: RUNWAY_MODELS.ELEVEN_SOUND,
      promptText: input.text,
    };
    if (input.durationSeconds) params.duration = input.durationSeconds;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const task = await (client as any).soundEffect.create(params).waitForTaskOutput();
    if (input.generationId) {
      trackCost(
        input.generationId,
        "runway/eleven_text_to_sound_v2",
        input.durationSeconds ?? 5,
        input.description
      );
    }
    return { taskId: task.id, output: task.output };
  });
}
