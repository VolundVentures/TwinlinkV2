// Debug avatar creation for a specific director.
//
// Tests avatar creation in isolation — bypasses all app code. Logs every
// detail of what Runway returns, including failureReason.
//
// Usage:
//   node --env-file=.env scripts/debug-avatar-create.mjs <director-id>
//   node --env-file=.env scripts/debug-avatar-create.mjs yuki-sato
//   node --env-file=.env scripts/debug-avatar-create.mjs marcel-vrai

import RunwayML from "@runwayml/sdk";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!process.env.RUNWAYML_API_SECRET) {
  console.error("RUNWAYML_API_SECRET not set. Did you pass --env-file=.env?");
  process.exit(1);
}

const directorId = process.argv[2];
if (!directorId) {
  console.error("Usage: node --env-file=.env scripts/debug-avatar-create.mjs <director-id>");
  process.exit(1);
}

const personaPath = path.join(__dirname, "..", "lib", "directors", "personas", `${directorId}.json`);
if (!fs.existsSync(personaPath)) {
  console.error(`Persona not found: ${personaPath}`);
  process.exit(1);
}
const persona = JSON.parse(fs.readFileSync(personaPath, "utf8"));

console.log(`\n=== AVATAR CREATE DEBUG · ${persona.name} (${persona.id}) ===\n`);

// Resolve reference image path
const candidates = [
  `public/directors/avatars/${persona.id}.png`,
  `public/directors/${persona.id}.png`,
];
let referencePath = null;
for (const rel of candidates) {
  const abs = path.join(__dirname, "..", rel);
  if (fs.existsSync(abs)) {
    referencePath = abs;
    break;
  }
}
if (!referencePath) {
  console.error(`No reference image found. Tried:`, candidates);
  process.exit(1);
}
const stat = fs.statSync(referencePath);
console.log(`Reference image: ${referencePath}`);
console.log(`  size: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);

console.log(`Personality length: ${persona.personality.length} chars`);
console.log(`Voice config:`, persona.voice);

const client = new RunwayML();

console.log(`\n--- 1. Uploading reference image to Runway ---`);
let referenceUri;
try {
  const upload = await client.uploads.createEphemeral({
    file: fs.createReadStream(referencePath),
  });
  referenceUri = upload.uri;
  console.log(`✓ Uploaded. URI: ${referenceUri}`);
} catch (err) {
  console.error(`✗ Upload failed:`, err);
  console.error(`Full error:`, JSON.stringify(err, null, 2));
  process.exit(1);
}

// Build voice config (same logic as the API route)
let voice;
if (persona.voice.type === "preset") {
  voice = { type: "runway-live-preset", presetId: persona.voice.presetId };
} else if (persona.voice.voiceId) {
  voice = { type: "custom", id: persona.voice.voiceId };
} else {
  const fallback = persona.deferenceRate < 0.45 ? "vincent" : persona.deferenceRate > 0.6 ? "clara" : "victoria";
  voice = { type: "runway-live-preset", presetId: fallback };
  console.log(`  (custom voiceId not set — falling back to preset "${fallback}")`);
}

console.log(`\n--- 2. Creating avatar ---`);
console.log(`Voice that will be sent:`, voice);

let avatarId;
let createResp;
try {
  createResp = await client.avatars.create({
    name: persona.name,
    referenceImage: referenceUri,
    personality: persona.personality,
    voice,
  });
  avatarId = createResp.id;
  console.log(`✓ Created. avatarId: ${avatarId}`);
  console.log(`  Initial status: ${createResp.status}`);
  if (createResp.failureReason) {
    console.log(`  failureReason: ${createResp.failureReason}`);
  }
  console.log(`  Full response:`, JSON.stringify(createResp, null, 2));
} catch (err) {
  console.error(`✗ Create call failed:`, err);
  console.error(`Status:`, err.status);
  console.error(`Full error body:`, err.error || err.body || JSON.stringify(err, null, 2));
  process.exit(1);
}

if (createResp.status === "READY") {
  console.log(`\n✓ Avatar already READY at create time. Done.`);
  process.exit(0);
}

if (createResp.status === "FAILED") {
  console.error(`\n✗ Avatar FAILED at create.`);
  console.error(`failureReason: ${createResp.failureReason ?? "(none)"}`);
  process.exit(1);
}

console.log(`\n--- 3. Polling for READY/FAILED ---`);
const start = Date.now();
const TIMEOUT_MS = 180_000;
let lastStatus = null;
while (Date.now() - start < TIMEOUT_MS) {
  await new Promise((r) => setTimeout(r, 2_000));
  let polled;
  try {
    polled = await client.avatars.retrieve(avatarId);
  } catch (err) {
    console.error(`✗ retrieve() failed:`, err);
    process.exit(1);
  }

  if (polled.status !== lastStatus) {
    const elapsed = Math.floor((Date.now() - start) / 1000);
    console.log(`  [${elapsed}s] status: ${polled.status}`);
    lastStatus = polled.status;
  }

  if (polled.status === "READY") {
    const elapsed = Math.floor((Date.now() - start) / 1000);
    console.log(`\n✓ READY after ${elapsed}s. avatarId: ${avatarId}`);
    process.exit(0);
  }

  if (polled.status === "FAILED") {
    const elapsed = Math.floor((Date.now() - start) / 1000);
    console.error(`\n✗ FAILED after ${elapsed}s.`);
    console.error(`failureReason: ${polled.failureReason ?? "(none)"}`);
    console.error(`Full polled response:`, JSON.stringify(polled, null, 2));
    process.exit(1);
  }
}

console.error(`\n✗ Timed out after ${TIMEOUT_MS / 1000}s. avatarId: ${avatarId}`);
process.exit(1);
