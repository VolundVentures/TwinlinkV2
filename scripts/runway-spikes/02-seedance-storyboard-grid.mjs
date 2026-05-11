// Spike 02 — Seedance storyboard-grid-as-timeline
//
// Goal: prove Seedance can read a multi-panel storyboard image as a TIMELINE
// (not as a single composition), generating a continuous video that follows
// the panel sequence. This is the central trick of the AUTEUR production engine —
// if it works, one Seedance call produces a multi-beat scene from one storyboard image.
//
// Two-step probe:
//   1) Generate a 3x3 storyboard image with gpt_image_2 (or fallback gen4_image).
//   2) Pass that image to Seedance text-to-video as a reference, with a prompt
//      that explicitly instructs "follow the storyboard sequence of the 9 reference frames".
//
// Run:
//   node --env-file=.env scripts/runway-spikes/02-seedance-storyboard-grid.mjs

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

// Generic 9-beat storyboard so the architecture isn't biased toward any demo film.
// A man walks through a city street at dusk; mood shifts from neutral → unease.
const STORYBOARD_PROMPT = `
A 3x3 grid storyboard sheet, hand-drawn black and white sketch style with light pencil shading,
white background with thin grid lines separating each panel, panel numbers 1-9 in top-left corners.
Each panel shows the SAME man (mid-30s, dark coat, neutral expression at first, tightening across the sequence)
walking through an empty European city street at dusk. The panels MUST progress as a timeline:

Panel 1: Wide establishing shot — empty cobblestone street, distant streetlamps just turning on, man entering frame from the left, small in frame.
Panel 2: Medium tracking shot — man walking forward, hands in coat pockets, eyes scanning ahead.
Panel 3: Close-up profile — man's face, brow slightly furrowed, mouth tight. Streetlight glints in his eye.
Panel 4: Over-the-shoulder — looking past man at the empty street stretching ahead, single distant figure barely visible.
Panel 5: Wider shot — man pauses mid-step, head turning slightly to look back.
Panel 6: Reverse angle — empty street behind him, lamp post slightly out of focus.
Panel 7: Low angle close-up on the man's hand pulling out of his coat pocket.
Panel 8: Tight close-up on his eyes, alarmed.
Panel 9: Wide shot — man breaks into a run away from camera, coat flaring, street stretching into darkness.

Each panel labeled with its shot type underneath in small handwritten text. Light handwritten arrows
showing motion direction in panels 1, 2, 5, 9. Mood: cinematic noir, suspended unease.
`.trim();

console.log("Spike 02 — Seedance storyboard-as-timeline");
console.log("---");
console.log("Step 1: Generate 9-panel storyboard via gpt_image_2...");

const t0 = Date.now();

let storyboardTask;
try {
  storyboardTask = await client.textToImage
    .create({
      model: "gpt_image_2",
      promptText: STORYBOARD_PROMPT,
      ratio: "1408:1408", // square works well for a 3x3 grid
    })
    .waitForTaskOutput();
} catch (err) {
  console.error("[Failed at step 1 — storyboard image]");
  console.error(err?.message || err);
  if (err?.taskDetails) console.error(JSON.stringify(err.taskDetails, null, 2));
  process.exit(1);
}

const storyboardUrl = storyboardTask.output?.[0];
if (!storyboardUrl) {
  console.error("[Failed] storyboard task.output empty");
  process.exit(1);
}

const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const storyboardPath = path.join(OUT_DIR, `02-storyboard-${ts}.png`);
const sbRes = await fetch(storyboardUrl);
fs.writeFileSync(storyboardPath, Buffer.from(await sbRes.arrayBuffer()));

console.log(`  Storyboard saved: ${storyboardPath}`);
console.log(`  Storyboard URL (passing to Seedance): ${storyboardUrl}`);
console.log(`  Elapsed so far: ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

console.log("Step 2: Generate 15s video via Seedance, using storyboard as a reference...");

// Seedance text-to-video with image references. Pass the storyboard as an image reference
// and explicitly instruct Seedance to treat the panels as a timeline.
const SEEDANCE_PROMPT = `
Generate a 15-second cinematic sequence following the storyboard sequence of the 9 reference frames in panel order.
Treat the panels as a timeline, not a single composition: panel 1 is the opening beat, panel 9 is the closing beat,
the camera moves and shot framing must evolve through the sequence as each panel prescribes.

Subject: A man in his mid-30s wearing a dark coat, walking through an empty European cobblestone street at dusk.
Mood: noir, suspended unease. Soft golden streetlamp light fighting blue twilight ambient. Hand-held subtle camera motion on tracking shots, locked stillness on the close-ups.

Maintain consistent character appearance (same face, same coat, same lighting) across all beats.
`.trim();

let videoTask;
try {
  videoTask = await client.textToVideo
    .create({
      model: "seedance2",
      promptText: SEEDANCE_PROMPT,
      ratio: "1280:720",
      duration: 15,
      references: [{ type: "image", uri: storyboardUrl }],
    })
    .waitForTaskOutput();
} catch (err) {
  console.error("[Failed at step 2 — Seedance video]");
  console.error(err?.message || err);
  if (err?.taskDetails) console.error(JSON.stringify(err.taskDetails, null, 2));
  console.error(
    "\nIf the SDK rejected `references: [{ type: 'image', uri }]` shape, try `promptImage: storyboardUrl` instead (Seedance i2v Mode 2)."
  );
  process.exit(1);
}

const videoUrl = videoTask.output?.[0];
if (!videoUrl) {
  console.error("[Failed] video task.output empty");
  process.exit(1);
}

const videoPath = path.join(OUT_DIR, `02-storyboard-video-${ts}.mp4`);
const vRes = await fetch(videoUrl);
fs.writeFileSync(videoPath, Buffer.from(await vRes.arrayBuffer()));

const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`  Video saved: ${videoPath}`);
console.log(`  Total elapsed: ${elapsed}s\n`);

console.log("[Spike 02 PASS — files saved]");
console.log(`  Storyboard: ${storyboardPath}`);
console.log(`  Video:      ${videoPath}`);
console.log(`  Eyeball check:`);
console.log(`    PASS if the 15s video covers all 9 beats in order — wide opening, medium tracking,`);
console.log(`         close-up profile, OTS, pause, reverse, hand close-up, eyes, run-away.`);
console.log(`    FAIL if it ignores the panels, only animates panel 1, or treats the grid as one scene.`);
