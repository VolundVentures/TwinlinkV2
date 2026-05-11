/**
 * Shot grammar — the cinematic vocabulary TwinLink directors think in.
 *
 * Built from standard film-school grammar (Bordwell's FILM ART, Murch's IN
 * THE BLINK OF AN EYE, ASC Manual) cross-referenced with the visual language
 * of the reference bench: Fincher, Villeneuve, Deakins, Chazelle, Glazer,
 * Lubezki, Ozark-era Armando Salas, House-of-Cards-era Igor Martinovic,
 * Mindhunter-era Erik Messerschmidt, Park Chan-wook, Wong Kar-wai, Chloé Zhao.
 *
 * This module does two jobs:
 *   1. Exposes enums + types so the script-writer emits STRUCTURED shot specs
 *      (not freeform prose). Every shot carries scale, lens, light, blocking.
 *   2. Exposes a prompt-builder that translates a spec into a surgical
 *      Nano-Banana-Pro edit prompt — forcing every plate reference to appear,
 *      with an explicit role, in the right position in the frame.
 *
 * Why this matters: the keyframe IS the shot. Motion is applied on top.
 * If the keyframe is wrong (missing asset, wrong framing, bad light) every
 * downstream step fails. Getting this layer right is the single highest-
 * leverage quality decision in the pipeline.
 */

// ============================================================================
// Enums — every value has a photographic meaning the model understands
// ============================================================================

export type Scale =
  | "ECU" // extreme close-up: eyes / texture
  | "CU" // close-up: head and shoulders
  | "MCU" // medium close-up: chest up
  | "MS" // medium shot: waist up
  | "MWS" // medium wide: full body with headroom
  | "WS" // wide: full body + environment
  | "EWS"; // extreme wide: subject small in landscape

export type Lens =
  | 18 // ultra-wide — distorting, immersive
  | 24 // wide — environmental
  | 35 // naturalistic — Roger Deakins' default
  | 50 // "nifty fifty" — eye-normal
  | 85 // portrait — flattering compression
  | 100
  | 135; // telephoto — isolating, voyeuristic

export type Angle =
  | "low" // camera below eye, subject dominant
  | "eye" // equal, conversational
  | "high" // camera above, subject diminished
  | "top_down" // overhead / god-view
  | "dutch"; // tilted, unease

export type Movement =
  | "locked" // tripod, no movement
  | "micro_drift" // near-imperceptible 1cm dolly — Glazer / Villeneuve default
  | "handheld" // visible sway — immediacy
  | "slow_dolly_in"
  | "slow_dolly_out"
  | "push_in" // faster dolly toward subject
  | "pull_back"
  | "pan_left"
  | "pan_right"
  | "tilt_up"
  | "tilt_down"
  | "tracking" // camera moves with subject
  | "crane_up"
  | "crane_down"
  | "rack_focus" // focus shift between planes
  | "whip_pan"
  | "pov"; // first-person

export type SubjectPosition =
  | "left_third" // rule of thirds, subject on left vertical third
  | "right_third"
  | "center" // symmetry, formal (Kubrick, Mindhunter)
  | "golden_upper_left"
  | "golden_upper_right"
  | "golden_lower_left"
  | "golden_lower_right"
  | "full_bleed" // subject fills frame
  | "small_in_landscape"; // isolated, vulnerable

export type EyeDirection =
  | "camera_left" // looking off-frame left
  | "camera_right"
  | "into_lens" // direct address
  | "off_screen_up"
  | "off_screen_down"
  | "inward" // eyes closed / contemplative
  | "obscured"; // covered / hidden

export type KeyLightDirection =
  | "from_left" // 90° camera-left
  | "from_right"
  | "three_quarter_left" // 3/4 fill (Rembrandt if from camera-right on subject facing left)
  | "three_quarter_right"
  | "frontal" // on-axis, flat
  | "backlit" // rim / silhouette
  | "top" // overhead
  | "bottom" // horror, uplight
  | "rembrandt" // explicit Rembrandt triangle
  | "chiaroscuro"; // extreme contrast, single source (Wong Kar-wai)

export type KeyQuality = "hard" | "soft" | "diffused" | "specular";

export type FillRatio = "1:1" | "1:2" | "1:4" | "1:8" | "1:16" | "none";

export type Purpose =
  | "establish" // set the world
  | "introduce" // meet a subject
  | "intimate" // CU / emotional
  | "reveal" // withhold then show
  | "confront" // into-lens, pressure
  | "transition" // connective tissue
  | "punctuation" // a single visual beat
  | "product_hero" // the object is the subject
  | "end_card";

export type ContinuityMatch =
  | "eyeline" // A looks right → B must look left
  | "axis" // stay on same side of 180° line
  | "graphic" // shape/color/motion carries across cut
  | "action" // match mid-motion
  | "light" // maintain key direction + color
  | "break" // intentional disruption (explain why in note)
  | "first"; // opening shot, no prior

// ============================================================================
// Structured shot spec — emitted by write_script, consumed by generate_keyframe
// ============================================================================

/**
 * Staging = the physical/narrative setup of the frame. This is the single
 * highest-leverage field for Nano Banana Pro — the model follows explicit
 * physics precisely, but when underspecified it invents spatially nonsensical
 * compositions (dashboards behind drivers, cars floating in the middle of
 * empty streets, mirrors reflecting the wrong thing). Every field below
 * should be concrete and unambiguous.
 */
export type SceneStaging = {
  /**
   * Where the CAMERA physically sits in the scene — NOT the camera angle.
   * Include distance, orientation, and whether interior or exterior.
   * Good: "exterior, opposite sidewalk, 8m from the subject, pointing slightly camera-left"
   * Good: "interior passenger seat, 60cm from the driver, looking at the driver's face past the steering wheel toward the windshield"
   * Bad: "eye level" (that's angle, not position)
   */
  camera_position: string;

  /**
   * Exactly what the subject's body is doing — verb phrase with pose and
   * direction of attention. Don't say "looking" without saying at what.
   * Good: "walking three paces toward camera on wet pavement, weight on left foot, gaze forward focused past the camera"
   * Good: "turned toward the glass, face 30cm from the pane, eyes focused on his own reflection in the glass"
   * Bad: "standing and looking" (ambiguous — at what? how?)
   */
  subject_action: string;

  /** Optional: what the subject is touching or holding, with hand/object contact detail. */
  subject_contact?: string;

  /**
   * Named objects in frame with precise placement. Distance, orientation,
   * and state must be stated. This is what prevents "car floating in the
   * middle of the street" failures.
   */
  object_placements?: Array<{
    /** What the object is (usually matches a @tag but can be a scenic element). */
    object: string;
    /** Position in world space: "parked parallel to the curb 4m behind the subject, facing camera-right, headlights on" */
    where: string;
    /** Optional orientation clarifier. */
    facing?: string;
  }>;

  /**
   * Spatial or physical rules that MUST hold. Use for invariants the model
   * is likely to get wrong if left implicit.
   * Good: "the glass between the subject and the lion is a single transparent pane"
   * Good: "the mirror reflects the man standing in front of it"
   * Good: "the camera is outside the car, not inside"
   */
  scene_logic?: string[];

  /**
   * Explicit NEGATIVE instructions — "do not do X" — for the common
   * misreadings of this exact shot. Every avoid line should name a specific
   * wrong outcome observed or anticipated.
   * Good: "do not park the car diagonally in the middle of the road"
   * Good: "do not show the dashboard behind the driver — the dashboard is in front of the driver, visible through the windshield"
   * Good: "do not replace the man's reflection with anything else — the mirror shows HIS face"
   */
  avoid?: string[];
};

export type ShotSpec = {
  // Scene staging — MUST come first; this is where the shot actually lives
  staging: SceneStaging;

  // Camera
  scale: Scale;
  lens_mm: Lens;
  angle: Angle;
  movement: Movement;

  // Composition
  subject_position: SubjectPosition;
  eye_direction: EyeDirection;
  depth: {
    foreground?: string;
    midground: string;
    background?: string;
  };
  negative_space?: "left" | "right" | "top" | "bottom" | "none";

  // Light
  key_direction: KeyLightDirection;
  key_quality: KeyQuality;
  key_color_k: number; // Kelvin — 2000..8000
  fill_ratio: FillRatio;
  practicals?: string[]; // visible in-frame light sources

  // Intent
  purpose: Purpose;
  mood: string; // one word — "suspended", "tender", "clinical"

  // Continuity to the PREVIOUS shot
  continuity?: { match: ContinuityMatch; note?: string };

  // Plate roles — strictly required for reference enforcement
  subject_plate: string; // @tag of primary subject (may be a prop for hero shots)
  location_plate?: string; // @tag of location (if shot has an environment)
  prop_plates?: string[]; // @tags of props in frame
  wardrobe_plates?: string[]; // @tags of wardrobe (if distinct from character sheet)
  vfx_plates?: string[]; // @tags of FX elements (smoke, sparks, etc.)
};

// ============================================================================
// Human-readable descriptors — for Nano Banana Pro prompting
// ============================================================================

const SCALE_DESC: Record<Scale, string> = {
  ECU: "extreme close-up, a detail shot of texture or eyes, filling the frame",
  CU: "close-up, head-and-shoulders of the subject",
  MCU: "medium close-up, chest up",
  MS: "medium shot, waist up",
  MWS: "medium wide shot, full body with breathing room",
  WS: "wide shot, full body plus the environment around",
  EWS: "extreme wide shot, the subject small inside a large landscape",
};

const ANGLE_DESC: Record<Angle, string> = {
  low: "camera low, looking up at the subject",
  eye: "camera at eye level with the subject",
  high: "camera high, looking down at the subject",
  top_down: "overhead top-down angle, looking straight down",
  dutch: "camera tilted (Dutch angle) to unsettle",
};

const MOVEMENT_DESC: Record<Movement, string> = {
  locked: "locked-off tripod — no camera motion",
  micro_drift: "near-imperceptible 1cm push — camera appears still",
  handheld: "subtle handheld sway",
  slow_dolly_in: "slow dolly in toward subject",
  slow_dolly_out: "slow dolly back from subject",
  push_in: "deliberate push-in",
  pull_back: "pull-back revealing more space",
  pan_left: "slow pan left",
  pan_right: "slow pan right",
  tilt_up: "tilt up",
  tilt_down: "tilt down",
  tracking: "tracking move alongside subject",
  crane_up: "crane rising",
  crane_down: "crane descending",
  rack_focus: "rack focus between planes",
  whip_pan: "whip-pan to",
  pov: "point-of-view shot",
};

const POSITION_DESC: Record<SubjectPosition, string> = {
  left_third:
    "subject anchored on the LEFT vertical third of the frame, looking or leaning toward the open right side",
  right_third:
    "subject anchored on the RIGHT vertical third of the frame, looking or leaning toward the open left side",
  center:
    "subject dead-center, symmetrical composition (Kubrick / Fincher institutional framing)",
  golden_upper_left:
    "subject placed on the upper-left golden-ratio intersection",
  golden_upper_right: "subject placed on the upper-right golden-ratio intersection",
  golden_lower_left: "subject placed on the lower-left golden-ratio intersection",
  golden_lower_right: "subject placed on the lower-right golden-ratio intersection",
  full_bleed: "subject fills the frame edge to edge",
  small_in_landscape:
    "subject small inside a large empty landscape — the environment dominates",
};

const EYE_DESC: Record<EyeDirection, string> = {
  camera_left: "gaze directed toward camera-left, off-screen",
  camera_right: "gaze directed toward camera-right, off-screen",
  into_lens: "looking directly into the lens — direct address",
  off_screen_up: "looking off-screen, upward",
  off_screen_down: "looking off-screen, downward",
  inward: "eyes closed or downcast, introspective",
  obscured: "eyes obscured, hidden, or out of frame",
};

const KEY_DESC: Record<KeyLightDirection, string> = {
  from_left: "key light from camera-left, a hard side-light",
  from_right: "key light from camera-right, a hard side-light",
  three_quarter_left: "3/4 key from camera-left, classic portrait angle",
  three_quarter_right: "3/4 key from camera-right, classic portrait angle",
  frontal: "on-axis frontal key, flat even lighting",
  backlit: "strong backlight creating a rim / silhouette",
  top: "top-light from above, shadowed eye sockets",
  bottom: "uplight from below (horror register)",
  rembrandt:
    "Rembrandt lighting — triangle of light on the shadow-side cheek beneath the eye",
  chiaroscuro:
    "chiaroscuro — single hard source, 70%+ of frame in deep shadow, one illuminated sliver",
};

const FILL_DESC: Record<FillRatio, string> = {
  "1:1": "flat fill, almost no shadow",
  "1:2": "soft contrast, subtle shadow side",
  "1:4": "moderate contrast, clear shadow side",
  "1:8": "high contrast, deep shadow side",
  "1:16": "extreme contrast, near-black shadow",
  none: "no fill — single-source lighting, full shadow",
};

function kelvinDescription(k: number): string {
  if (k <= 2200) return `${k}K candle / firelight warm`;
  if (k <= 3200) return `${k}K tungsten warm amber`;
  if (k <= 4000) return `${k}K warm white`;
  if (k <= 4800) return `${k}K neutral`;
  if (k <= 5600) return `${k}K daylight`;
  if (k <= 6500) return `${k}K cool daylight`;
  return `${k}K cold blue`;
}

// ============================================================================
// Prompt builder — the critical function
// ============================================================================

/**
 * Build a Nano Banana Pro edit-mode prompt from a structured shot spec.
 * The output is mechanical, explicit, and forces every reference to appear.
 *
 * @param spec     the shot's structured spec
 * @param refMap   tag → image index (1-based) in the image_input array
 * @param prev     optional previous shot's spec for continuity reasoning
 * @param roleMap  tag → role string ("primary subject", "location", ...)
 */
/**
 * Normalize a field that should be an array but might arrive as a string,
 * null, or an object from a loose-typed agent call. Keeps the builder
 * crash-proof regardless of how the agent shapes the JSON.
 */
function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : String(x)));
  if (typeof v === "string" && v.trim().length > 0) {
    // Accept "a; b; c" or "a, b, c" strings as arrays of items
    return v
      .split(/[;,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function asPlacementArray(v: unknown): Array<{ object: string; where: string; facing?: string }> {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
    .map((x) => ({
      object: typeof x.object === "string" ? x.object : "",
      where: typeof x.where === "string" ? x.where : "",
      facing: typeof x.facing === "string" ? x.facing : undefined,
    }))
    .filter((p) => p.object && p.where);
}

/**
 * Short scale word for the imperative prompt ("close-up" rather than
 * "medium close-up, chest-up" paragraph).
 */
function scaleShort(s: Scale | undefined): string {
  switch (s) {
    case "ECU": return "extreme close-up";
    case "CU": return "close-up";
    case "MCU": return "medium close-up";
    case "MS": return "medium shot";
    case "MWS": return "medium-wide shot";
    case "WS": return "wide shot";
    case "EWS": return "extreme-wide shot";
    default: return "medium shot";
  }
}

function angleShort(a: Angle | undefined): string {
  switch (a) {
    case "low": return "low-angle";
    case "high": return "high-angle";
    case "top_down": return "top-down";
    case "dutch": return "dutch-tilted";
    default: return "eye-level";
  }
}

function lightShort(dir: KeyLightDirection | undefined, k: number | undefined, q: KeyQuality | undefined): string {
  const d =
    dir === "from_left" ? "key light from camera-left" :
    dir === "from_right" ? "key light from camera-right" :
    dir === "three_quarter_left" ? "3/4 key from camera-left" :
    dir === "three_quarter_right" ? "3/4 key from camera-right" :
    dir === "backlit" ? "backlit rim" :
    dir === "top" ? "top-down overhead light" :
    dir === "bottom" ? "uplight from below" :
    dir === "rembrandt" ? "Rembrandt triangle key" :
    dir === "chiaroscuro" ? "single-source chiaroscuro" :
    "soft frontal key";
  const kelvin = k || 5000;
  const warmth =
    kelvin <= 2500 ? "warm candle-firelight" :
    kelvin <= 3400 ? "warm tungsten" :
    kelvin <= 4400 ? "warm white" :
    kelvin <= 5600 ? "daylight" :
    "cool daylight";
  const quality = q ? `${q} ` : "";
  return `${quality}${d} at ${kelvin}K (${warmth})`;
}

/**
 * Build a Nano Banana Pro edit-mode prompt from a structured shot spec.
 *
 * Structure (following the Google + Higgsfield + DEV.to guides):
 *   1. Frame role declaration (hero / first / last)
 *   2. Unified scene sentence — Subject → Setting → Action → Props/Wardrobe
 *      with role-labeled references [Image1], [Image2]…
 *   3. Camera sentence — scale, lens, angle, physical camera position
 *   4. Lighting sentence — direction, quality, color temp, mood
 *   5. Spatial staging — explicit object placements in world coordinates
 *   6. Preservation clauses — per-reference identity / space / prop locks
 *      (the single most impactful block for avoiding drift)
 *   7. Scene invariants (scene_logic)
 *   8. Specific negatives (avoid)
 *   9. Cinematic directive (the Netflix-DP closing clause)
 *
 * Target length: ~180–250 words. Under 150 words leaves too much up to the
 * model; over 300 dilutes attention and the identity lock loses weight.
 */
export function buildKeyframePromptFromSpec(opts: {
  spec: ShotSpec;
  /** Ordered list of plate tags — subject first, location second, then props. */
  orderedTags: string[];
  roleMap: Record<string, string>;
  prev?: ShotSpec;
  keyframeRole: "hero" | "first_frame" | "last_frame";
  aspectRatio: string;
}): string {
  const { spec, orderedTags, prev, keyframeRole, aspectRatio } = opts;

  const staging = spec.staging || ({} as SceneStaging);
  const depth = spec.depth || { midground: "the primary subject" };

  const idxOf = (tag: string | undefined) =>
    tag ? orderedTags.indexOf(tag) + 1 : 0;
  const subjectIdx = idxOf(spec.subject_plate);
  const locationIdx = idxOf(spec.location_plate);
  const propIdxs = asStringArray(spec.prop_plates)
    .map((t) => ({ tag: t, idx: idxOf(t) }))
    .filter((p) => p.idx > 0);
  const wardrobeIdxs = asStringArray(spec.wardrobe_plates)
    .map((t) => ({ tag: t, idx: idxOf(t) }))
    .filter((p) => p.idx > 0);
  const vfxIdxs = asStringArray(spec.vfx_plates)
    .map((t) => ({ tag: t, idx: idxOf(t) }))
    .filter((p) => p.idx > 0);

  // ---- 1. Frame role ----
  const frameTag =
    keyframeRole === "first_frame"
      ? "First-frame keyframe — motion starts here."
      : keyframeRole === "last_frame"
        ? "Last-frame keyframe — motion resolves here."
        : "Hero keyframe — the single still that defines this shot.";

  // ---- 2. Unified scene sentence (narrative, per the Google guide) ----
  const subjectRef = subjectIdx ? `[Image${subjectIdx}]` : "the subject";
  const locationRef = locationIdx ? ` within [Image${locationIdx}]` : "";
  const propClause =
    propIdxs.length > 0
      ? ` holding ${propIdxs.map((p) => `[Image${p.idx}]`).join(" and ")}`
      : "";
  const wardrobeClause =
    wardrobeIdxs.length > 0
      ? ` wearing the outfit shown in ${wardrobeIdxs.map((p) => `[Image${p.idx}]`).join(" and ")}`
      : "";
  const action = (staging.subject_action || depth.midground || "standing naturally in frame").trim();
  const contact = staging.subject_contact ? ` ${staging.subject_contact}` : "";
  const sceneSentence = `Compose a single cinema frame with ${subjectRef}${locationRef}${wardrobeClause}${propClause}: ${action}${contact}.`;

  // ---- 3. Camera sentence ----
  const cam = staging.camera_position || "";
  const cameraSentence = [
    `The shot is a ${scaleShort(spec.scale)} at ${spec.lens_mm || 50}mm, ${angleShort(spec.angle)}.`,
    cam && `The camera is physically positioned ${cam}.`,
  ]
    .filter(Boolean)
    .join(" ");

  // ---- 4. Lighting sentence ----
  const practicalsArr = asStringArray(spec.practicals);
  const lightSentence = [
    `${lightShort(spec.key_direction, spec.key_color_k, spec.key_quality)}.`,
    practicalsArr.length > 0
      ? `Visible practical sources in frame: ${practicalsArr.join("; ")}.`
      : "",
    spec.mood ? `Mood: ${spec.mood}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  // ---- 5. Spatial staging ----
  const placements = asPlacementArray(staging.object_placements);
  const placementsBlock =
    placements.length > 0
      ? "World staging: " +
        placements
          .map((p) => `${p.object} is ${p.where}${p.facing ? `, facing ${p.facing}` : ""}`)
          .join("; ") +
        "."
      : "";

  // ---- 6. Preservation clauses (the critical identity block) ----
  const identityLine = subjectIdx
    ? `[Image${subjectIdx}] is the primary subject's identity anchor — preserve the exact face shape, skin tone, ethnicity, age, eye color, hair color and texture, facial hair, body type, and proportions exactly as shown; do NOT age, do NOT change gender, do NOT substitute ethnicity, do NOT alter facial structure.`
    : "";
  const locationLine = locationIdx
    ? `[Image${locationIdx}] is the exact location — preserve the walls, ceiling, floor, window/door placements, architectural proportions, and material palette; do NOT invent geometry not present in the reference, do NOT relocate to a different space.`
    : "";
  const propLocks =
    propIdxs.length > 0
      ? `${propIdxs.map((p) => `[Image${p.idx}]`).join(" and ")} must appear at the exact shape, color, finish, and proportions of the reference; do NOT substitute similar objects.`
      : "";
  const wardrobeLocks =
    wardrobeIdxs.length > 0
      ? `${wardrobeIdxs.map((p) => `[Image${p.idx}]`).join(" and ")} defines the wardrobe — preserve cut, fabric, color, and hardware.`
      : "";
  const vfxLine =
    vfxIdxs.length > 0
      ? `Composite ${vfxIdxs.map((p) => `[Image${p.idx}]`).join(", ")} into the frame with physically plausible light interaction (cast shadows, specular reflections, lens bloom where appropriate).`
      : "";

  // ---- 7. Scene invariants ----
  const sceneLogicArr = asStringArray(staging.scene_logic);
  const sceneLogicLine =
    sceneLogicArr.length > 0
      ? `Physical invariants that must hold: ${sceneLogicArr.join("; ")}.`
      : "";

  // ---- 7b. Auto-inject physics hardening for common failure surfaces ----
  // Nano Banana tends to *merge* subjects with reference spaces rather than
  // preserve separation — "man looking at reflection" becomes "man emerging
  // from mirror." We detect these surfaces from the spec text and inject
  // an explicit separation clause.
  const physicsHardeningLine = detectPhysicsHazards({
    subjectAction: staging.subject_action,
    sceneLogic: sceneLogicArr,
    objectPlacements: placements,
    subjectIdx,
  });

  // ---- 7c. Continuity clauses — enforced from the previous shot's spec ----
  // When prev is present and the current spec declares a continuity match type,
  // the continuity helper emits explicit 180°/eyeline/light/graphic/action
  // guidance so Nano Banana keeps cuts coherent inside a scene. This is dead
  // code unless prev is wired in (it now is).
  const continuityLine =
    prev && spec.continuity && spec.continuity.match !== "first"
      ? continuityDescription(spec.continuity, prev, spec)
      : "";

  // ---- 8. Specific negatives ----
  const avoidArr = asStringArray(staging.avoid);
  const avoidLine =
    avoidArr.length > 0 ? `Explicit do-nots: ${avoidArr.join("; ")}.` : "";

  // ---- Face policy ----
  const faceLine =
    spec.eye_direction === "obscured"
      ? ""
      : `The subject's face is fully visible and identifiable — do not crop the head out of frame, do not obscure the face, do not turn the subject entirely away from camera unless the spec's eye_direction demands it.`;

  // ---- 9. Cinematic directive ----
  const cinematic = [
    `Photorealistic cinema film frame, aspect ratio ${aspectRatio}, shot on an ARRI Alexa 35 with a true cinema prime; depth of field and bokeh behave like real glass; every reflection, cast shadow, and ground contact is physically correct.`,
    `Single cohesive composition inside ONE rectangular frame — never a collage, never a multi-panel grid, never a split-screen, never picture-in-picture. No text, no watermark, no captions, no logos, no borders, no matte bars. No AI sheen, no beauty filter, no HDR, no contrast push, no saturation boost.`,
  ].join(" ");

  return [
    frameTag,
    sceneSentence,
    cameraSentence,
    lightSentence,
    placementsBlock,
    vfxLine,
    faceLine,
    identityLine,
    locationLine,
    wardrobeLocks,
    propLocks,
    sceneLogicLine,
    physicsHardeningLine,
    continuityLine,
    avoidLine,
    cinematic,
  ]
    .filter((s) => s && s.trim().length > 0)
    .join(" ");
}

/**
 * Emit targeted physics-clarifier clauses when the spec describes surfaces
 * Nano Banana chronically gets wrong. The model's default tendency is to
 * *composite* (merge subject with space) rather than *place* (keep subject
 * in front of space). Explicit separation language fixes most failures.
 */
function detectPhysicsHazards(ctx: {
  subjectAction?: string;
  sceneLogic: string[];
  objectPlacements: Array<{ object: string; where: string; facing?: string }>;
  subjectIdx: number;
}): string {
  const hazards: string[] = [];
  const haystack = [
    ctx.subjectAction || "",
    ...ctx.sceneLogic,
    ...ctx.objectPlacements.flatMap((p) => [p.object, p.where, p.facing || ""]),
  ]
    .join(" ")
    .toLowerCase();

  const subject = ctx.subjectIdx ? `[Image${ctx.subjectIdx}]` : "the subject";

  // --- Mirror / reflection ---
  if (/\b(mirror|reflection|reflect|reflected)\b/.test(haystack)) {
    hazards.push(
      `MIRROR PHYSICS: ${subject} is a physical person standing IN FRONT OF the mirror's glass plane, not inside it. The glass is a flat vertical surface; the reflection appears only within the glass and is a mirror-flipped image of ${subject}. Do NOT depict ${subject} emerging from, stepping through, or merging into the glass. ${subject}'s body and the reflection are two separate visible elements — the real person is opaque and on the viewer's side of the glass.`
    );
  }

  // --- Glass barriers (zoo enclosure, aquarium, shop window) ---
  if (/\b(glass|window|pane|aquarium|enclosure|tank|display case|vitrine)\b/.test(haystack) && !/\b(mirror)\b/.test(haystack)) {
    hazards.push(
      `GLASS BARRIER PHYSICS: The glass is a single flat transparent plane between ${subject} and whatever is on the other side. ${subject} is on one specific side of the glass (as staged) and the other subject/object is on the opposite side. They must NOT occupy the same space. Depict subtle glass cues (faint reflections, smudge/dust, edge highlight) so the viewer can read that the two elements are separated.`
    );
  }

  // --- Vehicle interior ---
  if (/\b(inside the car|driver seat|dashboard|steering wheel|passenger seat|car interior)\b/.test(haystack)) {
    hazards.push(
      `VEHICLE INTERIOR PHYSICS: The dashboard and steering wheel are IN FRONT of the driver (visible through the windshield as a foreground), NOT behind them. The driver sits facing forward toward the windshield. The rearview mirror hangs from the top of the windshield above the driver's eyeline. Seatbelts cross the chest diagonally. Do NOT invert this geometry.`
    );
  }

  // --- Water / submerged ---
  if (/\b(water|underwater|submerged|pool|swimming|floating in)\b/.test(haystack)) {
    hazards.push(
      `WATER PHYSICS: Water surface is a horizontal plane. Above-water elements cast real light onto the water (caustics, ripples), below-water elements show refraction and slightly muted color. Do NOT merge above/below elements into a single space.`
    );
  }

  // --- Jumping / mid-air ---
  if (/\b(jump|jumping|leaping|mid-air|airborne|falling)\b/.test(haystack)) {
    hazards.push(
      `AIRBORNE PHYSICS: ${subject} is genuinely airborne with no ground contact — hair, clothing, and limbs show motion consistent with gravity and initial momentum. Do NOT depict a standing pose composited onto a jumping background; the body must read as mid-trajectory.`
    );
  }

  if (hazards.length === 0) return "";
  return `Physics clarifications: ${hazards.join(" ")}`;
}

function lensCharacter(mm: Lens): string {
  if (mm <= 24) return "wide, environmental — slight edge distortion, deep DoF";
  if (mm === 35) return "naturalistic reportage feel — Deakins default";
  if (mm === 50) return "eye-normal, no perspective distortion";
  if (mm <= 100) return "portrait compression, shallow DoF, flattering";
  return "telephoto isolation, heavy compression, very shallow DoF";
}

function continuityDescription(
  cont: { match: ContinuityMatch; note?: string },
  prev: ShotSpec,
  curr: ShotSpec
): string {
  const prevScale = prev.scale || "MS";
  const prevLens = prev.lens_mm || 50;
  const prevPos = (prev.subject_position || "center").replace(/_/g, "-");
  const prevEye = (prev.eye_direction || "natural").replace(/_/g, "-");
  const prevKey = (prev.key_direction || "frontal").replace(/_/g, "-");
  const baseline = [
    `- Previous shot (${prevScale} @ ${prevLens}mm) had the subject on the ${prevPos}, gaze ${prevEye}, key light ${prevKey}.`,
  ];
  switch (cont.match) {
    case "eyeline":
      baseline.push(
        `- This shot must maintain EYELINE MATCH: if the previous subject looked camera-right, the present subject or object they were looking at must appear on camera-LEFT side of THIS frame (or itself look camera-left if another person).`
      );
      break;
    case "axis":
      baseline.push(
        `- Hold the 180° axis: camera stays on the same side of the imaginary line between subjects as before. No crossing.`
      );
      break;
    case "graphic":
      baseline.push(
        `- Carry a graphic match — the same shape, color, or motion line should bridge previous → current.`
      );
      break;
    case "action":
      baseline.push(
        `- Match on action: this frame picks up mid-gesture from where the previous one ended.`
      );
      break;
    case "light":
      baseline.push(
        `- Light continuity: key direction (${prevKey}) and color temperature (~${prev.key_color_k || 5000}K) must be preserved unless the scene has physically changed space.`
      );
      break;
    case "break":
      baseline.push(
        `- INTENTIONAL CONTINUITY BREAK — the cut is meant to jolt. ${cont.note || "No further guidance."}`
      );
      break;
    case "first":
      break;
  }
  // 30° rule warning
  if (prev.scale === curr.scale && prev.lens_mm === curr.lens_mm) {
    baseline.push(
      `- 30° RULE: because previous and current scale/lens are identical, change the camera angle by at least 30° or vary the subject's position to avoid a jump-cut read.`
    );
  }
  if (cont.note) {
    baseline.push(`- Director note: ${cont.note}`);
  }
  return baseline.join("\n");
}

// ============================================================================
// Reference examples — for the agent system prompt
// ============================================================================

export const SHOT_SPEC_EXAMPLES = [
  {
    name: "Fincher / Messerschmidt — Mindhunter institutional corridor",
    when: "Establishing an institution, a power space, or a confrontation.",
    spec: {
      scale: "WS",
      lens_mm: 35,
      angle: "eye",
      movement: "locked",
      subject_position: "center",
      eye_direction: "into_lens",
      key_direction: "frontal",
      key_quality: "soft",
      key_color_k: 5000,
      fill_ratio: "1:2",
      purpose: "establish",
      mood: "clinical",
    },
  },
  {
    name: "Villeneuve / Deakins — Blade Runner 2049 interior two-shot",
    when: "Intimate scene between two people, or subject with a charged object.",
    spec: {
      scale: "MCU",
      lens_mm: 85,
      angle: "eye",
      movement: "micro_drift",
      subject_position: "left_third",
      eye_direction: "camera_right",
      key_direction: "from_right",
      key_quality: "hard",
      key_color_k: 2800,
      fill_ratio: "1:8",
      purpose: "intimate",
      mood: "quiet",
    },
  },
  {
    name: "Deakins — Sicario border silhouette",
    when: "Foreboding transition, subject against a charged sky or neon.",
    spec: {
      scale: "MWS",
      lens_mm: 35,
      angle: "eye",
      movement: "locked",
      subject_position: "small_in_landscape",
      eye_direction: "off_screen_up",
      key_direction: "backlit",
      key_quality: "hard",
      key_color_k: 4500,
      fill_ratio: "1:16",
      purpose: "transition",
      mood: "foreboding",
    },
  },
  {
    name: "Chazelle / Sandgren — La La Land magic hour",
    when: "A romantic beat, golden light, movement with motivation.",
    spec: {
      scale: "MS",
      lens_mm: 50,
      angle: "eye",
      movement: "tracking",
      subject_position: "right_third",
      eye_direction: "camera_left",
      key_direction: "three_quarter_right",
      key_quality: "diffused",
      key_color_k: 2200,
      fill_ratio: "1:4",
      purpose: "intimate",
      mood: "warm",
    },
  },
  {
    name: "Glazer / Fraser — Under the Skin / The Zone of Interest",
    when: "Detached observation, stillness, subject unaware.",
    spec: {
      scale: "WS",
      lens_mm: 35,
      angle: "high",
      movement: "locked",
      subject_position: "small_in_landscape",
      eye_direction: "off_screen_down",
      key_direction: "frontal",
      key_quality: "soft",
      key_color_k: 5600,
      fill_ratio: "1:2",
      purpose: "reveal",
      mood: "detached",
    },
  },
  {
    name: "Wong Kar-wai / Doyle — In the Mood for Love corridor",
    when: "Intimate but voyeuristic, shallow DoF, saturated light.",
    spec: {
      scale: "MCU",
      lens_mm: 85,
      angle: "eye",
      movement: "handheld",
      subject_position: "right_third",
      eye_direction: "camera_left",
      key_direction: "chiaroscuro",
      key_quality: "hard",
      key_color_k: 3000,
      fill_ratio: "1:16",
      purpose: "intimate",
      mood: "longing",
    },
  },
];

/**
 * Markdown block describing the grammar — for injection into the agent
 * system prompt. Kept compact so it survives prompt-cache TTL cleanly.
 */
export function shotGrammarReferenceBlock(): string {
  return [
    `### Shot grammar — the fields every shot must lock before generate_keyframe`,
    ``,
    `**SCENE STAGING (most important — this is where shots fail when underspecified):**`,
    `- \`camera_position\` — where the CAMERA sits in 3D, not just angle. "Exterior, opposite sidewalk 8m away" — not "eye level". "Interior passenger seat, 60cm from driver, looking at driver past the wheel toward the windshield" — not "over-the-shoulder".`,
    `- \`subject_action\` — what the body is doing, with verb + direction of attention. "Walks three paces toward camera, weight on left foot, gaze forward past camera." Never "looking" without saying at what. Never "standing" without saying where and in what posture.`,
    `- \`subject_contact\` — what the subject touches or holds, with hand and surface named.`,
    `- \`object_placements\` — every named object's distance, orientation, and state. "Peugeot parked parallel to the curb, 4m behind subject, facing camera-right, headlights on." Not "car in background".`,
    `- \`scene_logic\` — invariants the model is likely to break if left implicit. "The mirror reflects the man standing in front of it." "The glass between the subject and the lion is a single transparent pane." "The camera is outside the car, not inside."`,
    `- \`avoid\` — specific mis-interpretations to forbid. "Do NOT park the car in the middle of the road." "Do NOT show the dashboard behind the driver." "Do NOT replace the reflection with anything other than the man's face."`,
    ``,
    `**Camera:** scale (ECU / CU / MCU / MS / MWS / WS / EWS) · lens_mm (18 / 24 / 35 / 50 / 85 / 100 / 135) · angle (low / eye / high / top_down / dutch) · movement (locked / micro_drift / handheld / slow_dolly_in / push_in / tracking / pan / tilt / rack_focus / pov).`,
    ``,
    `**Composition:** subject_position (left_third / right_third / center / golden_* / full_bleed / small_in_landscape) · eye_direction (camera_left / camera_right / into_lens / off_screen_up / off_screen_down / inward / obscured) · depth (foreground / midground / background, all three should do work) · negative_space.`,
    ``,
    `**Light:** key_direction (from_left / from_right / three_quarter_* / frontal / backlit / top / bottom / rembrandt / chiaroscuro) · key_quality (hard / soft / diffused / specular) · key_color_k (Kelvin: 2000–8000) · fill_ratio (1:1 .. 1:16 or none) · practicals (visible in-frame sources).`,
    ``,
    `**Intent:** purpose (establish / introduce / intimate / reveal / confront / transition / punctuation / product_hero / end_card) · mood (one word).`,
    ``,
    `**Continuity** to the previous shot: match = eyeline / axis / graphic / action / light / break / first. Break means an intentional disruption — always explain why in the note.`,
    ``,
    `**Plate roles (strict):** subject_plate (required) · location_plate · prop_plates[] · wardrobe_plates[] · vfx_plates[]. EVERY plate listed in a shot's plate_refs MUST be assigned a role here — the keyframe tool will reject shots where plate_refs and the role fields disagree.`,
    ``,
    `### Reference bench — channel these when picking a spec`,
    SHOT_SPEC_EXAMPLES.map((ex) => `- **${ex.name}** — ${ex.when}`).join("\n"),
    ``,
    `### Continuity laws — not suggestions`,
    `- **180° rule**: once you pick a side of the axis between two subjects, stay on it across cuts.`,
    `- **Eyeline match**: if A looks camera-right in shot N, whatever they're looking at appears on camera-LEFT in shot N+1 (or itself looks camera-left if another person).`,
    `- **30° rule**: adjacent shots of the same subject must differ by at least 30° of angle OR change scale — otherwise it reads as a jump-cut.`,
    `- **Match on action**: cut mid-motion so the gesture completes in the next frame.`,
    `- **Graphic match**: a shape, line, or color can bridge two unrelated shots poetically.`,
    `- **Light continuity**: within a scene, key direction and color temperature stay constant unless the subject physically moves to a new space.`,
  ].join("\n");
}
