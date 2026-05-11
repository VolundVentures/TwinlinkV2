// Spike 03 — Aleph 5s coverage from Seedance master
//
// Goal: prove Aleph (5s max, gen4_aleph) can produce convincing alternate-angle
// coverage from a Seedance master shot. This is the "novel view generation" claim
// that makes 1 expensive Seedance call yield 4+ usable cinematic angles for the editor.
//
// Three-step probe:
//   1) Generate a 5s Seedance master shot (text-to-video).
//   2) Pass that master to Aleph asking for a CLOSE-UP variant.
//   3) Pass the same master to Aleph asking for a LOW-ANGLE variant.
// Eyeball: do the variants feel like coverage of the SAME fictional moment?
//
// This is the highest-risk spike — flagged in the plan as the gate for the
// whole AUTEUR coverage architecture.
//
// Run:
//   node --env-file=.env scripts/runway-spikes/03-aleph-coverage-5s.mjs

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

// Generic master-shot brief — a single character moment so coverage matters narratively.
const MASTER_PROMPT = `
A 5-second cinematic master shot. Medium-wide eye-level shot of a woman in her late 20s
standing alone at a kitchen counter in soft morning light, looking down at a folded letter
in her hands. She turns the letter over slowly, doesn't open it. Quiet, contemplative,
unresolved. Single overhead pendant lamp + warm window side-light from camera-left.
Muted earth tones, slight film grain, locked-off camera, no movement.
`.trim();

console.log("Spike 03 — Aleph 5s coverage from Seedance master");
console.log("---");
console.log("Step 1: Generate 5s master shot via Seedance...");

const t0 = Date.now();

let masterTask;
try {
  masterTask = await client.textToVideo
    .create({
      model: "seedance2",
      promptText: MASTER_PROMPT,
      ratio: "1280:720",
      duration: 5,
    })
    .waitForTaskOutput();
} catch (err) {
  console.error("[Failed at step 1 — Seedance master]");
  console.error(err?.message || err);
  if (err?.taskDetails) console.error(JSON.stringify(err.taskDetails, null, 2));
  process.exit(1);
}

const masterUrl = masterTask.output?.[0];
if (!masterUrl) {
  console.error("[Failed] master task.output empty");
  process.exit(1);
}

const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const masterPath = path.join(OUT_DIR, `03-master-${ts}.mp4`);
const mRes = await fetch(masterUrl);
fs.writeFileSync(masterPath, Buffer.from(await mRes.arrayBuffer()));

console.log(`  Master saved: ${masterPath}`);
console.log(`  Master URL (passing to Aleph): ${masterUrl}`);
console.log(`  Step 1 elapsed: ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

const COVERAGE_PROMPTS = [
  {
    label: "close-up",
    prompt: `
Same scene, same moment, same character, same lighting.
Close-up shot of the woman's hands holding the folded letter, turning it slowly.
Camera positioned at chest level, focused on hands and letter, face out of frame or barely visible at top.
Same morning light direction (warm window light from camera-left), same earth-tone palette.
This is coverage of the SAME fictional moment, not a new scene.
`.trim(),
  },
  {
    label: "low-angle",
    prompt: `
Same scene, same moment, same character, same lighting.
Low-angle medium shot looking up at the woman from below the kitchen counter level,
counter edge in the lower foreground. Her face is the focal point, lit by the same warm
window light from camera-left + overhead pendant. She is still looking down at the letter.
This is coverage of the SAME fictional moment, not a new scene.
`.trim(),
  },
];

console.log("Steps 2 + 3: Generate two Aleph 5s coverage variants in parallel...");

const variantPromises = COVERAGE_PROMPTS.map(async (variant) => {
  const tStart = Date.now();
  let task;
  try {
    task = await client.videoToVideo
      .create({
        model: "gen4_aleph",
        videoUri: masterUrl,
        promptText: variant.prompt,
      })
      .waitForTaskOutput();
  } catch (err) {
    console.error(`[Failed at variant ${variant.label}]`);
    console.error(err?.message || err);
    if (err?.taskDetails) console.error(JSON.stringify(err.taskDetails, null, 2));
    return null;
  }
  const url = task.output?.[0];
  if (!url) {
    console.error(`[Failed] variant ${variant.label} task.output empty`);
    return null;
  }
  const variantPath = path.join(OUT_DIR, `03-coverage-${variant.label}-${ts}.mp4`);
  const res = await fetch(url);
  fs.writeFileSync(variantPath, Buffer.from(await res.arrayBuffer()));
  const elapsed = ((Date.now() - tStart) / 1000).toFixed(1);
  console.log(`  ${variant.label} saved (${elapsed}s): ${variantPath}`);
  return variantPath;
});

const variantPaths = await Promise.all(variantPromises);

const totalElapsed = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\n  Total elapsed: ${totalElapsed}s\n`);

const failed = variantPaths.filter((p) => !p).length;
if (failed > 0) {
  console.error(`[Spike 03 PARTIAL FAIL — ${failed}/${variantPaths.length} variants failed]`);
  process.exit(1);
}

console.log("[Spike 03 PASS — files saved]");
console.log(`  Master:    ${masterPath}`);
variantPaths.forEach((p) => console.log(`  Variant:   ${p}`));
console.log(`  Eyeball check (CRITICAL):`);
console.log(`    PASS if both variants feel like coverage of the SAME moment from different angles.`);
console.log(`         Same character face, same wardrobe, same lighting direction, same letter.`);
console.log(`    FAIL if variants are different scenes, different characters, or only re-graded the master.`);
console.log(`  ⚠ This is the architectural gate. If it fails, fall back to: 2 separate Seedance generations`);
console.log(`    of the same prompt with different framing words as "coverage" — less novel, still functional.`);
