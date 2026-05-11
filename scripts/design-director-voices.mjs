// Batch-design custom voices for all 20 director personas.
//
// For every persona JSON whose voice.type === "custom" and voice.voiceId is
// missing, this script:
//   1. Calls Runway POST /custom_voices with the persona's designPrompt and
//      model "eleven_ttv_v3".
//   2. Polls until status === "READY".
//   3. Patches the persona JSON file in-place to add voice.voiceId.
//
// Idempotent: skips personas that already have a voiceId.
//
// Usage:
//   node --env-file=.env scripts/design-director-voices.mjs
//
// Cost: ~$0.50 per voice × 20 = ~$10 (verify against actual invoice).

import RunwayML from "@runwayml/sdk";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PERSONAS_DIR = path.join(__dirname, "..", "lib", "directors", "personas");

if (!process.env.RUNWAYML_API_SECRET) {
  console.error("RUNWAYML_API_SECRET not set. Did you pass --env-file=.env?");
  process.exit(1);
}

const client = new RunwayML();

async function pollVoiceReady(voiceId, timeoutMs = 90_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = await client.customVoices.retrieve(voiceId);
    if (v.status === "READY") return;
    if (v.status === "FAILED") throw new Error(`Voice ${voiceId} failed`);
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Voice ${voiceId} not READY after ${timeoutMs}ms`);
}

async function designOne(personaPath) {
  const persona = JSON.parse(fs.readFileSync(personaPath, "utf-8"));

  if (!persona.voice || persona.voice.type !== "custom") {
    console.log(`  [skip] ${persona.id}: voice.type is not custom`);
    return;
  }
  if (persona.voice.voiceId) {
    console.log(`  [skip] ${persona.id}: voiceId already set (${persona.voice.voiceId})`);
    return;
  }
  const designPrompt = persona.voice.designPrompt;
  if (!designPrompt || designPrompt.length < 20) {
    console.log(`  [skip] ${persona.id}: designPrompt missing or too short`);
    return;
  }

  console.log(`  Designing voice for ${persona.id}...`);
  const voice = await client.customVoices.create({
    name: `${persona.id}-${Date.now()}`,
    from: { type: "text", prompt: designPrompt, model: "eleven_ttv_v3" },
  });
  await pollVoiceReady(voice.id);

  persona.voice.voiceId = voice.id;
  fs.writeFileSync(personaPath, JSON.stringify(persona, null, 2) + "\n");
  console.log(`  [ok]   ${persona.id} → voiceId ${voice.id}`);
}

const files = fs
  .readdirSync(PERSONAS_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => path.join(PERSONAS_DIR, f));

console.log(`Found ${files.length} persona files.\n`);
const t0 = Date.now();

// Concurrency of 2 — voice creation is async on Runway's side and a couple of
// parallel polls won't hurt, but more might rate-limit.
const POOL = 2;
let i = 0;
async function worker() {
  while (i < files.length) {
    const idx = i++;
    try {
      await designOne(files[idx]);
    } catch (err) {
      console.error(`  [fail] ${path.basename(files[idx])}: ${err?.message || err}`);
    }
  }
}
await Promise.all(Array.from({ length: POOL }, () => worker()));

console.log(`\nDone in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
