// Canonical Runway model identifiers.
//
// These map to Runway's API model parameter strings exactly. Centralised here
// so renames and additions happen in one place. Routing decisions live in the
// tool handlers, not here.

export const RUNWAY_MODELS = {
  // ---- Image ----
  GPT_IMAGE_2: "gpt_image_2", // text-to-image + edit-with-input_images. Resolutions WIDTHxHEIGHT divisible by 16, ratio 1:3 to 3:1.
  GEN4_IMAGE: "gen4_image", // up to 3 reference images. 5 cr (720p) / 8 cr (1080p).
  GEN4_IMAGE_TURBO: "gen4_image_turbo", // requires reference images. 2 cr.

  // ---- Video ----
  SEEDANCE_2: "seedance2", // t2v + i2v. up to 9 image refs, 3 video refs, 3 audio refs. 5-15s integer. 36 cr/s.
  GEN_4_5: "gen4.5", // t2v + i2v. 12 cr/s. Default character workhorse.
  GEN_4_TURBO: "gen4_turbo", // i2v only. 5 cr/s.
  GEN_4_ALEPH: "gen4_aleph", // v2v. 5s MAX. 15 cr/s.
  ACT_TWO: "act_two", // performance capture v2v. 5 cr/s.

  // ---- Audio ----
  ELEVEN_TTS: "eleven_multilingual_v2",
  ELEVEN_SOUND: "eleven_text_to_sound_v2",
  ELEVEN_DUBBING: "eleven_voice_dubbing",
  ELEVEN_ISOLATION: "eleven_voice_isolation",
  ELEVEN_STS: "eleven_multilingual_sts_v2",
  ELEVEN_TTV_V3: "eleven_ttv_v3", // text-to-voice for custom voice design

  // ---- Real-time ----
  CHARACTERS: "gwm1_avatars",
} as const;

export type RunwayModelId = (typeof RUNWAY_MODELS)[keyof typeof RUNWAY_MODELS];
