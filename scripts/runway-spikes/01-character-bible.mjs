// Spike 01 — gpt_image_2 character bible quality test
//
// Goal: produce a single composed character reference sheet (front/3-quarter/side/back +
// expression progression + micro-expressions + head detail + wardrobe + color palette)
// in one gpt_image_2 call. The bar is the user's Yeon / Mika / Viktor / Lumen examples —
// production-grade pre-production output.
//
// Run:
//   node --env-file=.env scripts/runway-spikes/01-character-bible.mjs

import RunwayML from "@runwayml/sdk";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_DIR = path.join(__dirname, "output");
fs.mkdirSync(OUT_DIR, { recursive: true });

if (!process.env.RUNWAYML_API_SECRET) {
  console.error("RUNWAYML_API_SECRET not set. Did you pass --env-file=.env?");
  process.exit(1);
}

const client = new RunwayML();

// Character brief — kept generic so the architecture isn't biased toward any demo film.
// The prompt template is what real users will run through; only the character brief varies.
const CHARACTER_BRIEF = {
  name: "Sun-yeon Park",
  alias: "Yeon",
  role: "Jeju Island local / coastal resident",
  age: 24,
  personality: "warm, observant, grounded, quietly confident, resilient, gentle",
  coreTheme: "sea-wind grace and grounded island strength",
  speechAccent: "soft Jeju Korean accent / light Jeju dialect influence",
};

// Composed-document prompt that asks gpt_image_2 to render an entire reference sheet
// as a single image. The structure mirrors the user's example sheets exactly.
const PROMPT = `
A professional CHARACTER REFERENCE SHEET document layout, editorial film-production quality, single composed page.

Subject: ${CHARACTER_BRIEF.name} ("${CHARACTER_BRIEF.alias}"), ${CHARACTER_BRIEF.age}, ${CHARACTER_BRIEF.role}.
Personality: ${CHARACTER_BRIEF.personality}.
Core theme: ${CHARACTER_BRIEF.coreTheme}.

LAYOUT (a single page divided into clearly labeled sections, white background, light grid lines, sans-serif typography):

Header bar (top): "CHARACTER REFERENCE SHEET" in bold, then small metadata grid with labels Name / Alias / Role / Age / Personality / Core Theme / Speech Accent.

Main identity + scale sheet (left two thirds): four full-body views of the SAME woman labeled FRONT, 3/4 VIEW, SIDE, BACK. Heights marked with a vertical scale on the left in centimeters from 0cm to 170cm. Each view shows identical wardrobe (warm beige linen shirt over a cream tank, mid-blue straight-leg jeans rolled at the cuff, plain white sneakers). Identical face: late teens / early twenties Korean woman, shoulder-length wavy dark brown hair, warm undertone skin, expressive natural eyes, calm half-smile.

Color palette strip (top right): seven small color swatches representing the key palette (warm beige, cream, sea-storm blue, slate, dark navy, soft denim blue, coastal gray, terracotta). Hex codes optional.

Expression progression panel (right side, two rows of four): eight headshots of the same face labeled NEUTRAL, CURIOUS, WORRIED, SURPRISED, AFRAID, SAD, DETERMINED, RELIEVED. Each expression must be readably distinct.

Micro-expressions row (right side, below expression progression): five tighter close-ups labeled SUBTLE EYE TENSION, SLIGHT SMIRK, LIP TENSION, MICRO FEAR, CONTROLLED BREATH.

Head detail sheet (right side): five labeled headshots — 3/4 HEADSHOT, SIDE HEADSHOT, TOP ANGLE, LOW ANGLE, DIAGONAL ANGLE. Same character, same lighting, photographic quality.

Silhouette guide (bottom left): two black silhouette versions of the character, labeled NEUTRAL STANCE and PROFILE SILHOUETTE.

Posture variation (bottom center): three full-body shots labeled RELAXED, TENSE, CONFIDENT.

Close-up pose (bottom right): one warm tighter shot of the character thoughtful, hand near chin, half-smile.

Wardrobe / accessories detail (bottom strip): four close-up insets — hair texture / hairstyle detail, outerwear detail (linen overshirt), footwear detail (clean sneakers), accessory / fabric detail (delicate necklace).

Hand gestures row (bottom strip): five hand close-up insets labeled RELAXED HAND, TENSE FINGERS, POINTING, GRIPPING, SUBTLE GESTURE NEAR FACE.

STYLE: photographic realism for the headshots and full-body views, clean editorial reference-sheet typography, soft natural daylight, no dramatic shadows, consistent face and wardrobe across every panel. The image must read as a single composed production document, not a collage.
`.trim();

console.log("Spike 01 — gpt_image_2 character bible");
console.log("---");
console.log(`Subject: ${CHARACTER_BRIEF.name}`);
console.log(`Prompt length: ${PROMPT.length} chars`);
console.log(`Calling Runway text_to_image with model gpt_image_2...`);

const t0 = Date.now();

let task;
try {
  task = await client.textToImage
    .create({
      model: "gpt_image_2",
      promptText: PROMPT,
      // gpt_image_2 supports WIDTHxHEIGHT divisible by 16, ratio 1:3 to 3:1.
      // 1408x896 is roughly 1.57:1 (close to a magazine-spread reference sheet).
      ratio: "1408:896",
    })
    .waitForTaskOutput();
} catch (err) {
  console.error("\n[Failed]");
  console.error(err?.message || err);
  if (err?.taskDetails) console.error(JSON.stringify(err.taskDetails, null, 2));
  console.error(
    "\nIf this errored on `model: gpt_image_2`, try fallback by changing the script to `model: 'gen4_image'` and ratio `1280:720`."
  );
  process.exit(1);
}

const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
const url = task.output?.[0];
if (!url) {
  console.error("[Failed] task.output empty:", JSON.stringify(task, null, 2));
  process.exit(1);
}

console.log(`API ok in ${elapsed}s. Downloading...`);

const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outPath = path.join(OUT_DIR, `01-character-bible-${ts}.png`);

const res = await fetch(url);
if (!res.ok) {
  console.error(`Download failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}
const buf = Buffer.from(await res.arrayBuffer());
fs.writeFileSync(outPath, buf);

console.log("\n[Spike 01 PASS — file saved]");
console.log(`  → ${outPath}`);
console.log(`  → Open the file and eyeball it.`);
console.log(`  → PASS if it reads like the user's Yeon/Mika/Viktor/Lumen examples.`);
console.log(`  → FAIL if it's a single portrait, panels are unlabeled, or face drifts between angles.`);
