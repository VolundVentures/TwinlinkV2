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

export type TextToSpeechInput = {
  text: string;
  /** Voice ID — runway custom voice id, or built-in preset. */
  voiceId: string;
  generationId: string;
  description: string;
};

export async function textToSpeech(
  input: TextToSpeechInput
): Promise<RunwayTaskResult<string[]>> {
  return withSlot(async () => {
    const client = getRunwayClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const task = await (client as any).textToSpeech
      .create({
        model: RUNWAY_MODELS.ELEVEN_TTS,
        text: input.text,
        voiceId: input.voiceId,
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
    const params: Record<string, unknown> = {
      model: RUNWAY_MODELS.ELEVEN_SOUND,
      text: input.text,
    };
    if (input.durationSeconds) params.durationSeconds = input.durationSeconds;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const task = await (client as any).textToSpeech.create(params).waitForTaskOutput();
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
