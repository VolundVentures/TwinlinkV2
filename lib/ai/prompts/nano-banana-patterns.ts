/**
 * Nano Banana Pro prompt patterns — platform-wide building blocks.
 *
 * Distilled from Google's official prompting guide, the Higgsfield Nano Banana
 * Pro review, the DEV.to strategies guide, and the DP craft of the reference
 * bench (Fincher/Messerschmidt, Villeneuve/Deakins, Chazelle, Glazer, Lubezki,
 * Wong Kar-wai, Chloé Zhao).
 *
 * Golden rules (from the guides, verified against our failure cases):
 *   1. Narrative sentences — not tag soup. Full grammar, complete clauses.
 *      Brief the model like a human creative director.
 *   2. Role-labeled references. Every [Image N] gets a named role and a
 *      preservation clause. The model weighs earlier images more.
 *   3. Identity lock must be EXPLICIT. "Keep face, skin tone, ethnicity, age,
 *      hair color and texture, facial hair, proportions exactly as [Image N]"
 *      — never implicit.
 *   4. Spatial staging in world coordinates. "Parked parallel to the curb 4m
 *      behind the subject, facing camera-right, headlights on" — not "there's
 *      a car".
 *   5. Motivated light. Declare key direction, color temp, quality. Every
 *      visible light source named (practicals).
 *   6. Concrete materiality. "brushed steel, matte velvet, fabric weave
 *      visible, pores visible on skin" — not "realistic".
 *   7. Negatives are specific. Name the failure modes ("no collage, no
 *      multi-panel split, no text overlay, no beauty filter") — generic
 *      "not cartoonish" does nothing.
 *   8. Cinema, not advertising. The anti-prompt suffix closes every image
 *      prompt to counter Nano Banana's default glossy-ad bias.
 */

// ---------------------------------------------------------------------------
// Role-labeled reference locks
// ---------------------------------------------------------------------------

/**
 * Identity-lock clause for a character reference image.
 * Use on every shot that contains the named subject — identity drift is the
 * single most common failure mode and this clause is the only reliable fix.
 */
export function subjectLock(imageIdx: number): string {
  return `[Image${imageIdx}] is the identity anchor — in the output, keep the exact face shape, skin tone, ethnicity, age, eye color, hair color and texture, facial hair, body type, and proportions from [Image${imageIdx}]. Do NOT age the person, do NOT change gender, do NOT swap ethnicity, do NOT alter facial structure.`;
}

/**
 * Space-lock clause for a location reference. Prevents the model from
 * inventing architecture or relocating the scene to a stock interior.
 */
export function spaceLock(imageIdx: number): string {
  return `[Image${imageIdx}] is the exact location — preserve the walls, ceiling, floor, window and door placements, architectural proportions, and the material palette from [Image${imageIdx}]. Do NOT invent new rooms, extend geometry, or substitute a different space.`;
}

/**
 * Prop-lock clause. Keeps objects at their reference silhouette/color.
 */
export function propLock(imageIdx: number, name?: string): string {
  const label = name ? ` (${name})` : "";
  return `[Image${imageIdx}]${label} must appear with its exact shape, color, finish, materials, and proportions as in [Image${imageIdx}]. Do NOT substitute a similar object.`;
}

/** Wardrobe lock — preserves garment cut/color across shots. */
export function wardrobeLock(imageIdx: number): string {
  return `[Image${imageIdx}] defines the wardrobe worn by the subject — preserve the exact cut, fabric, color, and hardware (buttons, zippers, belts, accessories).`;
}

// ---------------------------------------------------------------------------
// Cinematic directive (the Netflix-DP closing clause)
// ---------------------------------------------------------------------------

/**
 * Final directive appended to every keyframe/plate prompt. This is where
 * "AI-looking" gets killed. The language is specific enough the model
 * downweights its stock-ad tendencies.
 */
export function cinematicDirective(aspect: string): string {
  return [
    `Photorealistic cinema film frame, aspect ratio ${aspect}.`,
    `Shot on a 35mm motion picture camera (ARRI Alexa 35 / Panavision DXL) with a true cinema prime lens; depth of field and bokeh behave like real glass; every reflection, cast shadow, and ground contact is physically correct.`,
    `Single cohesive composition inside a single rectangular frame — never a collage, never a multi-panel grid, never a split-screen, never picture-in-picture.`,
    `No text, no watermark, no captions, no logos, no borders, no matte bars. No AI sheen, no beauty filter, no HDR, no contrast push, no saturation boost.`,
  ].join(" ");
}

/** Lightweight version for non-keyframe contexts (prop stills, end cards). */
export function filmFrameDeclaration(aspect: string): string {
  return `Photorealistic film still, ${aspect} frame, single cohesive composition, no collage, no text, no watermark, no matte bars.`;
}

// ---------------------------------------------------------------------------
// Photographic grade + materiality anchors
// ---------------------------------------------------------------------------

export type FilmStock =
  | "portra_400"
  | "portra_800"
  | "vision3_250d"
  | "vision3_500t"
  | "ektachrome_100"
  | "print_2383"
  | "fuji_pro_400h";

export function gradeLine(stock: FilmStock = "vision3_250d"): string {
  const map: Record<FilmStock, string> = {
    portra_400:
      "graded on Kodak Portra 400 — organic grain, warm neutrals, soft highlight roll-off, shadows lifted slightly, pleasing skin tones",
    portra_800:
      "graded on Kodak Portra 800 — coarser grain, warmer bias, slight halation around speculars",
    vision3_250d:
      "graded on Kodak Vision3 250D — fine organic grain, neutral balance, natural highlight roll-off, shadows retain detail",
    vision3_500t:
      "graded on Kodak Vision3 500T — tungsten-balanced, soft grain, slight red-channel lift in shadow",
    ektachrome_100:
      "graded on Kodak Ektachrome 100 — crisp grain, slightly cool bias, clean speculars",
    print_2383:
      "graded through a Kodak 2383 print stock emulation — cinema contrast curve, natural vignette, warm mid-tones",
    fuji_pro_400h:
      "graded on Fuji Pro 400H — cool highlights, soft pastel mid-tones, gentle shadow roll",
  };
  return map[stock];
}

/**
 * Skin materiality clause — stops the "plastic doll" failure on portraits.
 */
export const SKIN_MATERIALITY =
  "skin shows visible pores, fine peach fuzz, natural asymmetries, micro-redness at the nostrils and ears, a real specular roll on the nose bridge and cupid's bow; no smoothed skin, no beauty retouch, no wax-figure sheen";

/**
 * Fabric/material materiality — stops the stock-product look on props/wardrobe.
 */
export const FABRIC_MATERIALITY =
  "fabric weave visible at close range, stitching sharp and regular, hardware (zippers, buttons, eyelets) truthful; the garment looks worn-in, not brand-new off-the-shelf";

// ---------------------------------------------------------------------------
// Scene-narrative opener (Nano Banana Pro prefers narrative to tag-soup)
// ---------------------------------------------------------------------------

/**
 * Compose a scene opener in the guide's recommended order:
 * Subject → Setting → Lighting → Mood → Key visual details.
 */
export function sceneOpener(opts: {
  subject: string; // "a mid-40s man in a dark tailored suit"
  setting: string; // "a narrow Brutalist corridor lit by overhead fluorescents"
  lighting: string; // "cold 5600K top-down light, 1:8 contrast"
  mood: string; // "clinical, oppressive"
}): string {
  return `${opts.subject}, ${opts.setting}. ${opts.lighting}. The overall mood is ${opts.mood}.`;
}

// ---------------------------------------------------------------------------
// Neutral backdrop (for plates — character_sheet, prop, wardrobe)
// ---------------------------------------------------------------------------

export const NEUTRAL_GREY_BACKDROP =
  "clean neutral mid-grey seamless backdrop (#7F7F7F), no environmental details, no props other than the subject, uniform flat ambient light with a single soft top-front key";

export const PURE_BLACK_BACKDROP =
  "pure black (#000000) seamless void, no environmental details, no ground plane, ready for compositing";

// ---------------------------------------------------------------------------
// Six-pose character turnaround — the highest-leverage plate
// ---------------------------------------------------------------------------

/**
 * Builds the explicit six-panel turnaround instruction for a character sheet.
 * Nano Banana Pro handles multi-panel compositions when told exactly where
 * each panel sits and what angle it shows. Back view is the single most
 * missed angle — it must be called out by name.
 */
export function sixPoseTurnaround(subject: string): string {
  return [
    `EDITORIAL CHARACTER REFERENCE SHEET — a single composited landscape page that reads like a film-production character bible. The output is ONE 16:9 image, rendered like a designer's reference layout printed on a clean off-white sheet. All sections live on the same canvas with thin black hairline dividers between them — NOT separate exports.`,
    ``,
    `The page contains the FOLLOWING SECTIONS in this approximate layout:`,
    ``,
    `(1) HEADER STRIP across the top — small black serif title "CHARACTER REFERENCE SHEET" left-aligned, with the subject's name set in a smaller mono caps line below it. No other text in the header.`,
    ``,
    `(2) MAIN IDENTITY + SCALE SHEET, occupying the LEFT ~60% of the page below the header. FOUR full-body panels in a single horizontal row, each labeled with a tiny mono caps tag below the panel: "FRONT" / "3/4 VIEW" / "SIDE" / "BACK". Vertical height markings ("7'0", "6'6", "6'0", … down to "1'0") run along the left edge of this section. EVERY panel shows THE SAME PERSON — identical face, hair, wardrobe (same garment, same fit, same accessories, same footwear), body proportions, height, neutral expression. Full body, head to feet, head in the upper portion of each panel.`,
    `   - FRONT: subject facing the camera, toes forward, face fully visible.`,
    `   - 3/4 VIEW: subject rotated 45° to their own left.`,
    `   - SIDE: 90° pure profile, only one eye visible, nose/lips/chin in profile.`,
    `   - BACK: subject FULLY turned away — back of head, back of garment, back of legs. NO face, NO mirror. THIS PANEL IS REQUIRED.`,
    `   ${NEUTRAL_GREY_BACKDROP}. Lighting is uniform, soft, flat across all four — reference-sheet light, no key direction.`,
    ``,
    `(3) EXPRESSION PROGRESSION, top-right area. EIGHT small head-and-shoulders portraits in a horizontal strip, each labeled in tiny mono caps below: "NEUTRAL" / "CURIOUS" / "WORRIED" / "SURPRISED" / "AFRAID" / "SAD" / "DETERMINED" / "RELIEVED". Same person, same wardrobe collar/neckline visible, same lighting, same framing — only the facial expression changes between panels.`,
    ``,
    `(4) MICRO-EXPRESSIONS, below the progression. FIVE tight close-ups of the face only, labeled "SUBTLE EYE TENSION" / "SLIGHT SMIRK" / "LIP TENSION" / "MICRO FEAR" / "CONTROLLED BREATH". Tighter framing than the progression strip — eyes / mouth area readable.`,
    ``,
    `(5) HEAD DETAIL, below the micro-expressions. FIVE small portrait crops at different angles, labeled "3/4 HEADSHOT" / "SIDE HEADSHOT" / "TOP ANGLE" / "LOW ANGLE" / "DIAGONAL ANGLE". Same neutral expression as panel (1).`,
    ``,
    `(6) NEUTRAL BASELINE — one larger headshot near the right side, labeled "NEUTRAL BASELINE". The reference look the editor will mentally compare every shot against.`,
    ``,
    `(7) POSTURE VARIATION — three full-body shots labeled "RELAXED" / "TENSE" / "CONFIDENT". Same wardrobe, same lighting, body language differs.`,
    ``,
    `(8) WARDROBE / ACCESSORIES DETAILS, bottom-left strip. FOUR small detail-shot crops of garment / shoe / accessory / texture details, labeled with single short captions ("hair texture", "fabric weave", "footwear detail", "tattoo / accessory detail" — pick whatever the subject calls for).`,
    ``,
    `(9) HAND GESTURES, bottom-center strip. FIVE small hand-only crops on neutral backdrop, labeled "RELAXED HAND" / "TENSE FINGERS" / "POINTING" / "GRIPPING" / "SUBTLE GESTURE". Same hands across all five — the subject's hands.`,
    ``,
    `Subject: ${subject}.`,
    ``,
    `RENDERING RULES (strict):`,
    `- The whole page is ONE composited landscape image — NOT a montage of separate exports. Section dividers are thin black hairlines.`,
    `- The SAME PERSON across every section. Identical face, hair, wardrobe. Not "similar people".`,
    `- The BACK panel in section (2) is REQUIRED — if you replace it with another front view the sheet is invalid.`,
    `- Text on the page is restricted to the section labels listed above (set in tiny mono caps). NO additional captions, body copy, watermarks, page numbers, or annotations.`,
    `- Background is a clean off-white paper-like surface for the whole page; individual panels sit on neutral grey or muted backdrop within their frames.`,
    `- Lighting is consistent and flat across panels — reference-sheet light, not dramatic.`,
    `- No environment, no props beyond what the subject naturally wears, no other people, no decorative borders.`,
  ].join(" ");
}
