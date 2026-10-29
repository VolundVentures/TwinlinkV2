// Canonical Runway model identifiers (docs.dev.runwayml.com, Sept 2026).
//
// These map to Runway's API `model` strings exactly. Centralised here so
// renames happen in one place. Routing decisions live in the tool handlers.
// ALL generation goes through Runway — no other provider is wired in.

export const RUNWAY_MODELS = {
  // ---- Image ----
  GPT_IMAGE_2_5: "gpt_image_2_5_sunburst", // quality model. ≤16 refs (tagged), 30 ratios across 1K/2K/4K, transparent bg.
  GPT_IMAGE_2_5_FLARE: "gpt_image_2_5_flare", // fast model, GPT Image 2 quality. Same params minus transparent bg.

  // ---- Video ----
  // Seedance 2.5 is the ONLY video model: t2v + i2v + v2v (reference / extend /
  // edit). 4–30s, native audio, ≤30 image / 10 video / 10 audio refs, 480p–1080p.
  SEEDANCE_2_5: "seedance2_5",

  // ---- Finish ----
  VIDEO_UPSCALE: "magnific_video_upscaler_creative", // 720p→4K, optional fps boost.

  // ---- Audio ----
  ELEVEN_TTS: "eleven_v3", // expressive TTS — supports [whispers] / [laughs] tags, stability, speed.
  ELEVEN_SOUND: "eleven_text_to_sound_v2", // ambient beds + SFX, 0.5–30s, loopable.
  SEED_AUDIO: "seed_audio", // text-to-audio: music, scene audio. 0.25 cr/s.
} as const;

export type RunwayModelId = (typeof RUNWAY_MODELS)[keyof typeof RUNWAY_MODELS];
