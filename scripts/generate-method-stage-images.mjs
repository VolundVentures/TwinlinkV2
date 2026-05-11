// Generate the 5 stage illustrations for the marketing landing page's Method
// section ("Five stages. Five approvals."). Editorial B&W film-magazine style,
// vertical 4:5 to match the StageRow card aspect.
//
// Usage:
//   node --env-file=.env scripts/generate-method-stage-images.mjs

import RunwayML from "@runwayml/sdk";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_DIR = path.join(__dirname, "..", "public", "method");
fs.mkdirSync(OUT_DIR, { recursive: true });

if (!process.env.RUNWAYML_API_SECRET) {
  console.error("RUNWAYML_API_SECRET not set. Did you pass --env-file=.env?");
  process.exit(1);
}

const COMMON = `Editorial black-and-white film-magazine still, magazine-spread quality, vertical 4:5 framing, 35mm film grain, soft directional natural light, cinematic depth of field, no text, no logos, no watermark.`;

const STAGES = [
  {
    id: "01-casting",
    label: "Casting",
    prompt: `${COMMON} Subject: a moody contemplative B&W portrait gallery wall — three director portraits hanging in a quiet exhibition space, warm tungsten gallery lights, one viewer's silhouette gazing at the central portrait. Editorial cinema-museum atmosphere. Reads as "casting your director."`,
  },
  {
    id: "02-treatment",
    label: "Treatment",
    prompt: `${COMMON} Subject: an open leather-bound director's treatment book on a wooden table, hand-written notes and storyboard sketches visible, a Polaroid pinned beside, a fountain pen, a glass of whiskey, low warm light from a desk lamp. Top-down half-overhead angle. Reads as "the director pitches you back."`,
  },
  {
    id: "03-plates",
    label: "Plates",
    prompt: `${COMMON} Subject: a contact-sheet wall — multi-angle character study sheets pinned in a grid (full-front, three-quarter, profile, close-up), location reference photographs, fabric swatches, prop polaroids, hand-drawn lighting diagrams, all monochrome. Editorial production-design wall in a film studio. Reads as "identity-locked references."`,
  },
  {
    id: "04-keyframes",
    label: "Keyframes",
    prompt: `${COMMON} Subject: a single composed cinematic still — a lone figure at the end of a long corridor, deep shadows, anamorphic 2.39:1 aspect-ratio framing visible as letterboxing inside the 4:5 frame, smoke or atmospheric haze drifting through a single shaft of natural window light. Reads as "one composed keyframe per shot."`,
  },
  {
    id: "05-the-cut",
    label: "The Cut",
    prompt: `${COMMON} Subject: a dimly lit edit suite — a Steenbeck-style flatbed film editing machine with a strip of 35mm film threaded through, a director's hand resting near the splicer, glow from a small monitor, deep shadows, vinyl record sleeves stacked in the background. Reads as "scored, graded, mastered."`,
  },
];

const client = new RunwayML();

async function generateOne(stage) {
  const outPath = path.join(OUT_DIR, `${stage.id}.png`);
  if (fs.existsSync(outPath)) {
    console.log(`  [skip] ${stage.id}.png already exists`);
    return;
  }
  console.log(`  Generating ${stage.id} (${stage.label})...`);
  const task = await client.textToImage
    .create({
      model: "gpt_image_2",
      promptText: stage.prompt,
      // 4:5 vertical, gpt_image_2-legal pair (1536x1920).
      ratio: "1536:1920",
    })
    .waitForTaskOutput();

  const url = task.output?.[0];
  if (!url) {
    console.error(`  [fail] ${stage.id}: no output URL`);
    return;
  }
  const res = await fetch(url);
  fs.writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));
  console.log(`  [ok]   ${stage.id}.png saved`);
}

console.log(`Generating 5 method-stage stills to ${OUT_DIR}\n`);
const t0 = Date.now();

// Sequential — 5 calls is fine, no need for concurrency.
for (const stage of STAGES) {
  try {
    await generateOne(stage);
  } catch (err) {
    console.error(`  [fail] ${stage.id}: ${err?.message || err}`);
  }
}

console.log(`\nDone in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
