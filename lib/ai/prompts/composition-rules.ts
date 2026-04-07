/**
 * CINEMATIC COMPOSITION RULES FOR AI-DRIVEN VIDEO AD PRODUCTION
 *
 * These rules are distilled from professional film editing standards,
 * broadcast specifications, and advertising best practices.
 * They provide concrete, numeric parameters an AI agent can follow
 * when composing short-form video ads (15-60s) via Remotion.
 *
 * Sources: EBU R128, ITU-R BS.1770, SMPTE RP 200, CALM Act,
 * Walter Murch's editing priorities, ASL research, platform specs.
 */

// ============================================================
// 1. AUDIO MIXING RULES
// ============================================================

export const AUDIO_RULES = {
  /**
   * LOUDNESS TARGETS BY PLATFORM (Integrated LUFS)
   *
   * YouTube: -14 LUFS (published standard)
   * TikTok:  -14 LUFS (internal normalization, no official spec — aim -14 to be safe)
   * Instagram Reels: -14 LUFS (Meta uses xHE-AAC with adaptive loudness)
   * Facebook: -16 LUFS
   * Broadcast TV (US): -24 LKFS (CALM Act / ATSC A/85)
   * Broadcast TV (EU): -23 LUFS (EBU R128)
   *
   * TRUE PEAK: Always keep below -1.0 dBTP (-1.5 dBTP preferred)
   * to prevent distortion after platform transcoding.
   *
   * PRACTICAL NOTE: Many creators push to -10 to -12 LUFS on TikTok/Reels
   * for perceived loudness on mobile speakers. For AI-generated ads,
   * target -14 LUFS as the safe standard.
   */
  platformTargets: {
    youtube: { integratedLUFS: -14, truePeakDBTP: -1.0 },
    tiktok: { integratedLUFS: -14, truePeakDBTP: -1.0 },
    instagram_reels: { integratedLUFS: -14, truePeakDBTP: -1.0 },
    facebook: { integratedLUFS: -16, truePeakDBTP: -1.0 },
    broadcast_us: { integratedLUFS: -24, truePeakDBTP: -2.0 },
    broadcast_eu: { integratedLUFS: -23, truePeakDBTP: -1.0 },
  },

  /**
   * VOICEOVER / DIALOGUE LEVELS
   *
   * Voiceover is the PRIMARY audio element in a video ad.
   * All other audio is mixed relative to it.
   *
   * Target: -12 to -10 LUFS (momentary) — the loudest element
   * Remotion linear volume: 0.85 (≈ -1.4 dB from full scale)
   * Apply light compression (3:1 ratio) to keep VO consistent.
   */
  voiceover: {
    remotionVolume: 0.85,
    targetLUFS: -12,
    description: "Primary audio. Loudest element. Always intelligible.",
  },

  /**
   * BACKGROUND MUSIC LEVELS
   *
   * Professional standard: music sits 8-12 LU below voiceover.
   * In a dialogue-driven ad, music should be FELT, not HEARD.
   *
   * When VO is active:  -20 to -24 LUFS (ducked) → Remotion 0.10-0.15
   * When VO is silent:  -16 to -18 LUFS (lifted) → Remotion 0.25-0.35
   * Music-only sections: -14 LUFS (full) → Remotion 0.50-0.60
   *
   * FADE IN:  0.5s linear fade from 0 at video start
   * FADE OUT: 2.0s linear fade to 0 at video end
   */
  backgroundMusic: {
    withVoiceover: {
      remotionVolume: 0.12,
      luGapFromVO: -10, // 10 LU below voiceover
      description: "Barely perceptible bed. VO must dominate.",
    },
    withoutVoiceover: {
      remotionVolume: 0.30,
      description: "Music lifts when no speech. Still not dominant.",
    },
    musicOnly: {
      remotionVolume: 0.55,
      description: "Full music for intros/outros with no speech.",
    },
    fadeInSeconds: 0.5,
    fadeOutSeconds: 2.0,
  },

  /**
   * AMBIENT / CLIP AUDIO
   *
   * B-roll clips with ambient sound (street noise, nature, etc.):
   * - MUTE completely when voiceover is active (avoid mud)
   * - If used, keep at -30 LUFS / Remotion 0.05-0.08
   *
   * Avatar/talking-head clips with baked-in speech:
   * - These ARE the primary audio for their duration
   * - Mute the separate voiceover track during these clips
   * - Keep avatar audio at full volume (1.0)
   */
  ambientAudio: {
    remotionVolume: 0.06,
    description: "Barely audible texture. Mute during VO.",
    muteWhenVoiceoverActive: true,
  },

  /**
   * AUDIO-TO-VISUAL SYNC RULES
   *
   * 1. Music beats should align with visual cuts (beat-synced editing)
   * 2. Voiceover emphasis words should land on visual reveals
   * 3. Allow 2-3 frames (66-100ms at 30fps) of audio lead before a visual cut
   *    (the ear processes faster than the eye — known as "J-cut" principle)
   * 4. Never cut audio and video at the exact same frame — offset by 2-3 frames
   * 5. Music should swell slightly (+2-3 LU) during the CTA section
   */
  syncRules: {
    audioLeadFrames: 2, // Audio change precedes visual cut by 2 frames
    musicSwellOnCTA: true,
    ctaMusicLift: 0.20, // Lift music to 0.20 during CTA if no VO
  },
} as const;

// ============================================================
// 2. CUT TIMING & PACING RULES
// ============================================================

export const PACING_RULES = {
  /**
   * AVERAGE SHOT LENGTH (ASL) BY AD STYLE
   *
   * These are the target durations for individual clips.
   * Modern commercial ASL has decreased dramatically:
   * - 1960s Hollywood: 10s ASL
   * - 2000s Hollywood: 3-4s ASL
   * - 2020s short-form ads: 2-3s ASL
   *
   * Different ad styles demand different pacing:
   */
  averageShotLength: {
    /** Fast-paced UGC / TikTok native: 1.5-2.5s per shot */
    ugc_fast: { minSeconds: 1.5, maxSeconds: 2.5, targetSeconds: 2.0 },
    /** Standard commercial: 2.5-4.0s per shot */
    standard: { minSeconds: 2.5, maxSeconds: 4.0, targetSeconds: 3.0 },
    /** Luxury / cinematic: 4.0-6.0s per shot */
    luxury: { minSeconds: 4.0, maxSeconds: 6.0, targetSeconds: 5.0 },
    /** Emotional / story-driven: 3.0-5.0s per shot */
    emotional: { minSeconds: 3.0, maxSeconds: 5.0, targetSeconds: 4.0 },
    /** Product demo: 3.0-5.0s per shot (needs time to show details) */
    product_demo: { minSeconds: 3.0, maxSeconds: 5.0, targetSeconds: 4.0 },
  },

  /**
   * SHOT COUNT BY AD DURATION
   *
   * These are target ranges for total number of cuts:
   */
  shotCount: {
    "15s": { min: 5, max: 8, typical: 6 },
    "30s": { min: 8, max: 15, typical: 10 },
    "60s": { min: 15, max: 25, typical: 18 },
  },

  /**
   * THE "HEARTBEAT" STRUCTURE OF A 30-SECOND COMMERCIAL
   *
   * Professional 30s spots follow a beat pattern:
   *
   * Beat 1 (0-3s):   HOOK — Grab attention. Short, punchy. 1 shot.
   * Beat 2 (3-8s):   TENSION — Present problem/context. 2 shots.
   * Beat 3 (8-15s):  TURN — Product reveal / solution. 2-3 shots.
   * Beat 4 (15-22s): PROOF — Show it working / social proof. 2-3 shots.
   * Beat 5 (22-27s): PAYOFF — Emotional resolution. 1-2 shots.
   * Beat 6 (27-30s): CTA — Call to action. 1 shot.
   *
   * Pacing should ACCELERATE through beats 2-4, then SLOW for beat 5.
   * The rhythm is: slow → fast → faster → SLOW → punch.
   */
  heartbeat30s: [
    { beat: "hook", startSec: 0, endSec: 3, shots: 1, paceNote: "Single impactful shot. Can be avatar or bold visual." },
    { beat: "tension", startSec: 3, endSec: 8, shots: 2, paceNote: "Build the problem. Slightly faster cuts." },
    { beat: "turn", startSec: 8, endSec: 15, shots: 3, paceNote: "Product reveal. Peak cut frequency." },
    { beat: "proof", startSec: 15, endSec: 22, shots: 3, paceNote: "Show results. Maintain energy." },
    { beat: "payoff", startSec: 22, endSec: 27, shots: 1, paceNote: "Let it breathe. Longer shot. Emotional landing." },
    { beat: "cta", startSec: 27, endSec: 30, shots: 1, paceNote: "Clear action. Logo + CTA text." },
  ],

  /**
   * STRUCTURE FOR 15-SECOND AD
   */
  heartbeat15s: [
    { beat: "hook", startSec: 0, endSec: 2, shots: 1, paceNote: "Immediate grab. No warm-up." },
    { beat: "core_message", startSec: 2, endSec: 8, shots: 3, paceNote: "One key benefit. Fast cuts." },
    { beat: "proof", startSec: 8, endSec: 12, shots: 2, paceNote: "Quick proof point." },
    { beat: "cta", startSec: 12, endSec: 15, shots: 1, paceNote: "CTA with logo." },
  ],

  /**
   * PACING ACCELERATION PATTERN
   *
   * Within a single ad, shot duration should follow a curve:
   * Opening:  longest shots (establish context)
   * Middle:   shortest shots (build energy)
   * Closing:  medium-long shots (resolve + CTA)
   *
   * Concrete multipliers relative to target ASL:
   */
  pacingCurve: {
    opening: 1.3, // 30% longer than target ASL
    buildUp: 0.8, // 20% shorter — faster cuts
    climax: 0.6,  // 40% shorter — fastest cuts
    resolution: 1.4, // 40% longer — let it breathe
    cta: 1.0,     // Standard length
  },

  /**
   * MINIMUM SHOT DURATION
   *
   * Never show a shot for less than 0.75 seconds (22 frames at 30fps).
   * Human perception needs ~500ms to register a new image.
   * Exception: flash-cut montages (0.5s) for energy, but max 3 in a row.
   */
  minimumShotFrames: 22, // 0.73 seconds at 30fps
  minimumShotSeconds: 0.75,
  flashCutMinFrames: 15, // 0.5s — only for intentional flash cuts
  maxConsecutiveFlashCuts: 3,
} as const;

// ============================================================
// 3. TRANSITION RULES
// ============================================================

export const TRANSITION_RULES = {
  /**
   * WHEN TO USE EACH TRANSITION TYPE
   *
   * HARD CUT (the default — 80% of transitions):
   * - Same scene, different angle
   * - Continuous action or dialogue
   * - Building energy / fast pacing
   * - Matching movement direction between shots
   * - When rhythm must stay sharp
   * - UGC-style content (almost always hard cuts)
   *
   * CROSSFADE / DISSOLVE (15% of transitions):
   * - Scene-to-scene change (different location/time)
   * - Slowing pace intentionally (emotional beat)
   * - Montage sequences
   * - Masking mismatched motion/lighting between shots
   * - Transitioning from problem → solution
   *
   * FADE TO BLACK (5% of transitions):
   * - Final shot → end card
   * - Major time passage
   * - Dramatic pause
   * - Never use mid-ad unless intentional dramatic beat
   */
  usage: {
    cut: {
      percentage: 80,
      useWhen: [
        "same_scene_different_angle",
        "continuous_action",
        "building_energy",
        "matched_movement",
        "ugc_style",
        "dialogue_scenes",
      ],
    },
    crossfade: {
      percentage: 15,
      useWhen: [
        "scene_change",
        "emotional_beat",
        "montage",
        "mismatched_lighting",
        "problem_to_solution",
        "time_passage",
      ],
    },
    fade_to_black: {
      percentage: 5,
      useWhen: [
        "final_to_endcard",
        "major_time_skip",
        "dramatic_pause",
      ],
    },
  },

  /**
   * CROSSFADE DURATION BY CONTEXT
   *
   * Duration in frames at 30fps:
   */
  crossfadeDuration: {
    /** Quick softening (jump cut smoothing): 6-10 frames (0.2-0.33s) */
    quick: { frames: 8, seconds: 0.27 },
    /** Standard scene transition: 15-20 frames (0.5-0.67s) */
    standard: { frames: 15, seconds: 0.5 },
    /** Emotional / luxury: 24-36 frames (0.8-1.2s) */
    emotional: { frames: 30, seconds: 1.0 },
    /** Dreamy / slow montage: 45-60 frames (1.5-2.0s) */
    slow: { frames: 45, seconds: 1.5 },
  },

  /**
   * FADE TO BLACK DURATION
   */
  fadeToBlackDuration: {
    standard: { frames: 20, seconds: 0.67 },
    dramatic: { frames: 45, seconds: 1.5 },
  },

  /**
   * TRANSITION MOMENTUM RULES
   *
   * Transitions that CREATE momentum (forward energy):
   * - Hard cut on action (match cut)
   * - Cut on beat (music-synced)
   * - Whip pan / swipe (motion-matched)
   *
   * Transitions that CREATE calm (deceleration):
   * - Long crossfade (1s+)
   * - Fade to black
   * - L-cut (audio leads, visual follows)
   *
   * RULE: Never use a calming transition when you need momentum.
   * In a 30s ad, the middle section (8-22s) should use ONLY hard cuts.
   * Reserve crossfades for the hook→tension bridge and payoff→CTA.
   */
  momentumMap: {
    hard_cut: "momentum",
    cut_on_beat: "strong_momentum",
    match_cut: "strong_momentum",
    quick_crossfade: "neutral",
    standard_crossfade: "calm",
    long_crossfade: "strong_calm",
    fade_to_black: "pause",
  },
} as const;

// ============================================================
// 4. VISUAL COMPOSITION & FRAMING
// ============================================================

export const VISUAL_RULES = {
  /**
   * SHOT FRAMING (Rule of Thirds + Golden Ratio)
   *
   * For AI-generated content, specify subject placement:
   * - Talking head: eyes on upper third line, centered or slight offset
   * - Product hero: center-dominant or golden ratio (0.382 from edge)
   * - Lifestyle: rule of thirds, subject at intersection point
   * - Text overlay zones: top or bottom third (never center for readability)
   * - CTA: center or lower third
   *
   * HEADROOM: Keep 10-15% of frame above subject's head
   * LOOK ROOM: If subject faces left, place them right of center (and vice versa)
   */
  framing: {
    talkingHead: { subjectX: 0.5, eyeLineY: 0.33, headroomPercent: 12 },
    productHero: { subjectX: 0.5, subjectY: 0.45 }, // Slightly above center
    lifestyle: { subjectX: 0.382, subjectY: 0.382 }, // Golden ratio intersection
    textSafeZone: { topMarginPercent: 8, bottomMarginPercent: 15, sideMarginPercent: 8 },
  },

  /**
   * MOVEMENT DIRECTION FLOW
   *
   * Consecutive shots should maintain visual flow:
   * 1. If a subject/camera moves LEFT in shot A, shot B should also move LEFT
   *    or be static. Reversing direction creates visual whiplash.
   * 2. Exception: intentional reversal for dramatic effect (problem → solution pivot)
   * 3. For product orbits: maintain consistent rotation direction throughout
   * 4. Push-in (zoom) = intimacy / reveal
   * 5. Pull-out (zoom out) = context / scale
   * 6. Static = authority / stability
   *
   * CAMERA MOTION PACING:
   * - Slow orbit (5-8 degrees/sec) for luxury
   * - Medium drift (10-15 degrees/sec) for standard
   * - Handheld shake for UGC authenticity
   */
  motionFlow: {
    rule: "Maintain consistent screen direction across consecutive shots",
    orbitSpeedLuxury: "5-8 degrees per second",
    orbitSpeedStandard: "10-15 degrees per second",
    pushInForReveal: true,
    pullOutForContext: true,
    staticForAuthority: true,
  },
} as const;

// ============================================================
// 5. COLOR & VISUAL CONTINUITY
// ============================================================

export const COLOR_RULES = {
  /**
   * COLOR TEMPERATURE MATCHING
   *
   * Consecutive shots MUST be within 500K of each other in color temperature.
   * Jarring temperature shifts break immersion.
   *
   * Guidelines:
   * - Warm (3200K-4500K): indoor, tungsten, golden hour, cozy
   * - Neutral (5000K-5500K): overcast, studio, clean
   * - Cool (6000K-7500K): shade, blue hour, tech, clinical
   *
   * RULE: Pick a color temperature RANGE for the entire ad and stay in it.
   * Allow max 500K variation between consecutive shots.
   * Exception: intentional contrast (e.g., cold problem → warm solution).
   */
  temperatureMatching: {
    maxConsecutiveDifferenceK: 500,
    ranges: {
      warm: { minK: 3200, maxK: 4500, mood: "cozy, intimate, lifestyle" },
      neutral: { minK: 5000, maxK: 5500, mood: "clean, professional, studio" },
      cool: { minK: 6000, maxK: 7500, mood: "tech, clinical, dramatic" },
    },
  },

  /**
   * BRIGHTNESS / EXPOSURE MATCHING
   *
   * Adjacent shots should be within 0.5 stops of each other.
   * A dark shot followed by a bright shot is jarring unless intentional.
   *
   * For AI image generation, specify consistent exposure in all prompts.
   */
  exposureMatching: {
    maxConsecutiveDifferenceStops: 0.5,
    rule: "Maintain consistent exposure across adjacent shots",
  },

  /**
   * COLOR PALETTE COHESION
   *
   * An ad should use a limited palette:
   * - 1 dominant color (60% of visual space) — usually brand primary or background
   * - 1 secondary color (30%) — complementary or brand secondary
   * - 1 accent color (10%) — CTAs, highlights, brand accent
   *
   * The 60/30/10 rule ensures visual cohesion across different shots.
   * Every generated image/video prompt should reference these colors.
   */
  paletteRule: "60/30/10 — dominant/secondary/accent",

  /**
   * VISUAL STYLE CONSISTENCY
   *
   * All shots in a single ad should share:
   * 1. Same film stock / color science reference (e.g., "Kodak Portra 400")
   * 2. Same grain level (ISO reference)
   * 3. Same contrast range (low contrast = editorial, high contrast = punchy)
   * 4. Same depth of field approach (shallow vs deep)
   * 5. Same aspect ratio (never mix aspect ratios within an ad)
   *
   * When generating image prompts for multiple shots in one ad,
   * include the SAME camera + film stock + lighting descriptors in every prompt.
   */
  consistencyChecklist: [
    "Same film stock reference across all shots",
    "Same grain/noise level",
    "Same contrast approach",
    "Same depth of field style",
    "Same color temperature range",
    "Same aspect ratio",
  ],
} as const;

// ============================================================
// 6. AD STRUCTURE TEMPLATES
// ============================================================

export const AD_STRUCTURES = {
  /**
   * 15-SECOND AD: "PUNCH"
   * 6 shots, all hard cuts, no time to waste
   *
   * Structure: HOOK (2s) → BENEFIT (3s) → PROOF (4s) → CTA (3s) → ENDCARD (3s)
   */
  "15s_punch": {
    totalSeconds: 15,
    transition: "cut" as const,
    shots: [
      { label: "hook", durationSec: 2.0, type: "attention_grab", transition: "cut" },
      { label: "benefit", durationSec: 3.0, type: "key_message", transition: "cut" },
      { label: "proof_1", durationSec: 2.5, type: "evidence", transition: "cut" },
      { label: "proof_2", durationSec: 2.5, type: "evidence", transition: "cut" },
      { label: "cta", durationSec: 2.5, type: "call_to_action", transition: "cut" },
      { label: "endcard", durationSec: 2.5, type: "brand_logo", transition: "fade_to_black" },
    ],
  },

  /**
   * 30-SECOND AD: "STORY ARC"
   * 10 shots, mix of cuts and crossfades
   */
  "30s_story": {
    totalSeconds: 30,
    transition: "mixed" as const,
    shots: [
      { label: "hook", durationSec: 3.0, type: "attention_grab", transition: "cut" },
      { label: "context", durationSec: 3.0, type: "scene_setting", transition: "cut" },
      { label: "problem", durationSec: 3.0, type: "pain_point", transition: "crossfade" },
      { label: "turn", durationSec: 2.5, type: "product_reveal", transition: "cut" },
      { label: "feature_1", durationSec: 2.5, type: "benefit", transition: "cut" },
      { label: "feature_2", durationSec: 2.5, type: "benefit", transition: "cut" },
      { label: "proof", durationSec: 3.0, type: "evidence", transition: "cut" },
      { label: "emotional_beat", durationSec: 4.0, type: "resolution", transition: "crossfade" },
      { label: "cta", durationSec: 3.5, type: "call_to_action", transition: "cut" },
      { label: "endcard", durationSec: 3.0, type: "brand_logo", transition: "fade_to_black" },
    ],
  },

  /**
   * 30-SECOND AD: "UGC ENERGY"
   * 12 shots, all hard cuts, fast pacing
   */
  "30s_ugc": {
    totalSeconds: 30,
    transition: "cut" as const,
    shots: [
      { label: "hook_avatar", durationSec: 2.5, type: "talking_head", transition: "cut" },
      { label: "reaction", durationSec: 1.5, type: "broll", transition: "cut" },
      { label: "story_1", durationSec: 2.5, type: "broll", transition: "cut" },
      { label: "story_2", durationSec: 2.0, type: "broll", transition: "cut" },
      { label: "product_reveal", durationSec: 3.0, type: "product_closeup", transition: "cut" },
      { label: "feature_1", durationSec: 2.5, type: "broll", transition: "cut" },
      { label: "feature_2", durationSec: 2.0, type: "broll", transition: "cut" },
      { label: "proof", durationSec: 2.5, type: "social_proof", transition: "cut" },
      { label: "result", durationSec: 3.0, type: "broll", transition: "cut" },
      { label: "avatar_close", durationSec: 2.5, type: "talking_head", transition: "cut" },
      { label: "cta", durationSec: 2.5, type: "call_to_action", transition: "cut" },
      { label: "endcard", durationSec: 1.5, type: "brand_logo", transition: "cut" },
    ],
  },

  /**
   * 30-SECOND AD: "LUXURY / CINEMATIC"
   * 7 shots, slow pacing, crossfades
   */
  "30s_luxury": {
    totalSeconds: 30,
    transition: "crossfade" as const,
    shots: [
      { label: "establishing", durationSec: 5.0, type: "mood_setting", transition: "crossfade" },
      { label: "detail_1", durationSec: 4.5, type: "product_macro", transition: "crossfade" },
      { label: "detail_2", durationSec: 4.5, type: "product_beauty", transition: "crossfade" },
      { label: "lifestyle", durationSec: 5.0, type: "aspirational", transition: "crossfade" },
      { label: "hero_shot", durationSec: 4.0, type: "product_hero", transition: "crossfade" },
      { label: "tagline", durationSec: 4.0, type: "brand_message", transition: "crossfade" },
      { label: "endcard", durationSec: 3.0, type: "brand_logo", transition: "fade_to_black" },
    ],
  },
} as const;

// ============================================================
// 7. REMOTION-SPECIFIC IMPLEMENTATION PARAMETERS
// ============================================================

export const REMOTION_PARAMS = {
  fps: 30,

  /**
   * Convert seconds to frames
   */
  secondsToFrames: (seconds: number, fps: number = 30): number =>
    Math.round(seconds * fps),

  /**
   * Convert frames to seconds
   */
  framesToSeconds: (frames: number, fps: number = 30): number =>
    frames / fps,

  /**
   * Calculate crossfade duration in frames based on ad style
   */
  getCrossfadeDuration: (
    style: "ugc" | "standard" | "luxury" | "emotional",
    fps: number = 30,
  ): number => {
    const map = {
      ugc: 0, // UGC = hard cuts only
      standard: 15, // 0.5s
      luxury: 30,   // 1.0s
      emotional: 24, // 0.8s
    };
    return map[style] || 15;
  },

  /**
   * Voiceover volume function for Remotion
   * Returns a frame-based volume function that:
   * - Mutes VO during avatar clips (hasOwnAudio=true)
   * - Plays VO at 0.85 during B-roll
   */
  getVoiceoverVolumeDescription:
    "Use Remotion interpolate() to mute VO (volume=0) during hasOwnAudio clips, " +
    "and set to 0.85 during B-roll. Use 3-frame crossfade at boundaries to avoid clicks.",

  /**
   * Background music volume function for Remotion
   * Returns a frame-based volume function that:
   * - Plays at 0.12 when VO is active
   * - Lifts to 0.25 during silent sections
   * - Fades out over last 2 seconds
   */
  getMusicVolumeDescription:
    "Use Remotion interpolate() with: base=0.12 during VO, lift to 0.25 during gaps, " +
    "fade from current to 0 over final 60 frames (2s at 30fps).",

  /**
   * Safe zones for text overlays (percentage of frame)
   * Accounts for platform UI overlays (TikTok comments, IG icons)
   */
  textSafeZones: {
    "9:16": {
      topSafe: 15,    // % — TikTok username area
      bottomSafe: 20, // % — TikTok caption/buttons area
      leftSafe: 5,
      rightSafe: 15,  // % — TikTok action buttons
    },
    "16:9": {
      topSafe: 8,
      bottomSafe: 10,
      leftSafe: 5,
      rightSafe: 5,
    },
    "1:1": {
      topSafe: 10,
      bottomSafe: 15,
      leftSafe: 5,
      rightSafe: 5,
    },
  },
} as const;

// ============================================================
// 8. DECISION FUNCTIONS
// ============================================================

/**
 * Given an ad style and duration, return the recommended structure.
 */
export function getAdStructure(
  durationSeconds: number,
  style: "ugc" | "standard" | "luxury" | "emotional" = "standard",
): typeof AD_STRUCTURES[keyof typeof AD_STRUCTURES] {
  if (durationSeconds <= 15) return AD_STRUCTURES["15s_punch"];
  if (style === "ugc") return AD_STRUCTURES["30s_ugc"];
  if (style === "luxury") return AD_STRUCTURES["30s_luxury"];
  return AD_STRUCTURES["30s_story"];
}

/**
 * Given two shot types, recommend the transition between them.
 */
export function recommendTransition(
  fromType: string,
  toType: string,
  adStyle: "ugc" | "standard" | "luxury" = "standard",
): { type: "cut" | "crossfade" | "fade_to_black"; durationFrames: number } {
  // UGC = always hard cut
  if (adStyle === "ugc") return { type: "cut", durationFrames: 0 };

  // To endcard = always fade to black
  if (toType === "brand_logo" || toType === "endcard") {
    return { type: "fade_to_black", durationFrames: 20 };
  }

  // Scene type changes that warrant a crossfade
  const crossfadeScenes = [
    ["pain_point", "product_reveal"],
    ["scene_setting", "pain_point"],
    ["resolution", "call_to_action"],
    ["mood_setting", "product_macro"],
    ["product_beauty", "aspirational"],
  ];

  for (const [from, to] of crossfadeScenes) {
    if (fromType === from && toType === to) {
      const duration = adStyle === "luxury" ? 30 : 15;
      return { type: "crossfade", durationFrames: duration };
    }
  }

  // Luxury style: crossfade most transitions
  if (adStyle === "luxury") {
    return { type: "crossfade", durationFrames: 24 };
  }

  // Default: hard cut
  return { type: "cut", durationFrames: 0 };
}

/**
 * Calculate ideal shot durations for a given total duration and shot count,
 * applying the pacing curve (longer opening/closing, shorter middle).
 */
export function calculateShotDurations(
  totalSeconds: number,
  shotCount: number,
  style: "ugc" | "standard" | "luxury" = "standard",
): number[] {
  const curve = PACING_RULES.pacingCurve;
  const baseDuration = totalSeconds / shotCount;

  return Array.from({ length: shotCount }, (_, i) => {
    const position = i / (shotCount - 1); // 0 to 1
    let multiplier: number;

    if (position < 0.15) {
      multiplier = curve.opening;
    } else if (position < 0.45) {
      multiplier = curve.buildUp;
    } else if (position < 0.65) {
      multiplier = curve.climax;
    } else if (position < 0.85) {
      multiplier = curve.resolution;
    } else {
      multiplier = curve.cta;
    }

    return Math.max(
      PACING_RULES.minimumShotSeconds,
      Number((baseDuration * multiplier).toFixed(1)),
    );
  });
}
