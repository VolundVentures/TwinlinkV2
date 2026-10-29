// Director persona — fictional auteur trained on a real director's body of work.
//
// Names, portraits, and personalities are fictional, but the curriculum
// (films cited, techniques referenced) is drawn from a real-world inspiration.
// The system prompt explicitly tells the user the persona is fictional —
// no impersonation pretense.

export type FilmReference = {
  /** Real film title from the inspiration's actual filmography. */
  title: string;
  year: number;
  /** Specific techniques the persona will reference when teaching. */
  techniques: string[];
};

export type DirectorVoiceConfig =
  | { type: "preset"; presetId: "clara" | "victoria" | "vincent" }
  | {
      type: "custom";
      designPrompt: string;
      /** Populated at first-run after POST /custom_voices completes. */
      voiceId?: string;
    };

export type DirectorPersona = {
  /** Slug — also the file name (without extension). */
  id: string;
  name: string;
  /** Real director the persona's curriculum is drawn from. PRIVATE — used to seed the persona but not shown in the UI. */
  inspiration: string;
  /** One-line school descriptor shown in the lobby. */
  school: string;
  /** Path under public/directors/ (e.g. /directors/marcel-vrai.png). The gallery / lobby image. Editorial aesthetic, may be off-axis. */
  portraitUrl: string;
  /**
   * Optional path to a Characters-API-optimised reference image (frontal,
   * centred, neutral expression, soft lighting). If absent, the avatar
   * session route falls back to convention-checking
   * `public/directors/avatars/<id>.png`, then to `portraitUrl`.
   *
   * Purpose: the gallery portrait is dramatic / chiaroscuro / off-axis —
   * great for UI, wrong format for Runway's Characters API which needs a
   * frontal head-and-shoulders to animate. The two are decoupled.
   */
  avatarReferenceUrl?: string;
  voice: DirectorVoiceConfig;
  /** Populated at first-run after Runway documents API uploads the knowledge file. */
  knowledgeBaseDocId?: string;
  /** ≤10K character system prompt. Drives the avatar's speech patterns, opinions, and teaching style. */
  personality: string;
  /** ≤2K character opening line. */
  startScript: string;
  /** Prose description of the visual signature for prompt augmentation. */
  visualSignature: string;
  /** 3-5 signature grade prompts (Seedance edit mode) — color/grade/lighting fingerprint. */
  alephSignaturePrompts: string[];
  /** String prepended to gpt_image_2 prompts to imprint the director's image style. */
  imageStyleModifier: string;
  /** Score prompt augmentation (Runway seed_audio). */
  scoreModifier: string;
  /** ElevenLabs `text_to_sound_v2` prompt seed — shapes ambient + diegetic SFX. */
  soundDesignNote: string;
  /** 0.0-1.0. Drives turn-taking when paired with another live director. Lower = more assertive, higher = more deferential. */
  deferenceRate: number;
  /** Real films from the inspiration's filmography that the persona references when teaching. */
  filmsCited: FilmReference[];
};
