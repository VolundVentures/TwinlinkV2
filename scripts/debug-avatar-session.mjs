// Debug session creation for the cached avatar IDs.
//
// The avatars succeed via debug-avatar-create.mjs, but the app's session call
// hangs. This script tests session creation specifically — using the same
// cached avatar IDs the app would use. Logs every poll state so we see
// exactly where it's getting stuck.
//
// Usage:
//   node --env-file=.env scripts/debug-avatar-session.mjs

import RunwayML from "@runwayml/sdk";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!process.env.RUNWAYML_API_SECRET) {
  console.error("RUNWAYML_API_SECRET not set");
  process.exit(1);
}

const STORE_PATH = path.join(__dirname, "..", "public", "directors", "avatar-ids.json");
const store = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));

const client = new RunwayML();

const RUNWAY_CHARACTERS_MODEL = "gwm1_avatars";

async function checkAvatar(directorId) {
  const rec = store[directorId];
  if (!rec) {
    console.log(`  no cached record for ${directorId}`);
    return null;
  }
  console.log(`\n=== ${directorId} (cached avatarId: ${rec.avatarId}) ===`);
  try {
    const polled = await client.avatars.retrieve(rec.avatarId);
    console.log(`  current status: ${polled.status}`);
    if (polled.failureReason) console.log(`  failureReason: ${polled.failureReason}`);
    return polled.status === "READY" ? rec.avatarId : null;
  } catch (err) {
    console.log(`  retrieve failed:`, err.message || err);
    console.log(`  (avatar id may have expired or been revoked — re-create needed)`);
    return null;
  }
}

async function tryCreateSession(directorId, avatarId) {
  console.log(`\n--- Creating realtime session for ${directorId} ---`);
  const personaPath = path.join(__dirname, "..", "lib", "directors", "personas", `${directorId}.json`);
  const persona = JSON.parse(fs.readFileSync(personaPath, "utf8"));

  let session;
  try {
    session = await client.realtimeSessions.create({
      model: RUNWAY_CHARACTERS_MODEL,
      avatar: { type: "custom", avatarId },
    });
    console.log(`  session.id: ${session.id}`);
  } catch (err) {
    console.error(`  ✗ realtimeSessions.create failed:`, err.message || err);
    console.error(`  status: ${err.status}`);
    if (err.error) console.error(`  body:`, JSON.stringify(err.error, null, 2));
    return null;
  }

  console.log(`  --- Polling for READY ---`);
  const start = Date.now();
  let lastStatus = null;
  while (Date.now() - start < 90_000) {
    await new Promise((r) => setTimeout(r, 1500));
    let polled;
    try {
      polled = await client.realtimeSessions.retrieve(session.id);
    } catch (err) {
      console.error(`  ✗ retrieve failed:`, err.message || err);
      return null;
    }
    if (polled?.status !== lastStatus) {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      console.log(`  [${elapsed}s] status: ${polled?.status}`);
      lastStatus = polled?.status;
    }
    if (polled?.status === "READY") {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      console.log(`  ✓ READY after ${elapsed}s`);
      console.log(`  has sessionKey:`, !!polled.sessionKey);
      return session.id;
    }
    if (polled?.status === "FAILED") {
      console.error(`  ✗ FAILED — ${polled.failure ?? "(no message)"} (${polled.failureCode ?? "no code"})`);
      console.error(`  Full polled:`, JSON.stringify(polled, null, 2));
      return null;
    }
    if (polled?.status === "CANCELLED") {
      console.error(`  ✗ CANCELLED`);
      return null;
    }
  }
  console.error(`  ✗ timed out after 90s`);
  return null;
}

(async () => {
  console.log("\n=== AVATAR/SESSION DEBUG ===\n");

  const yuki = await checkAvatar("yuki-sato");
  const marcel = await checkAvatar("marcel-vrai");

  if (!yuki && !marcel) {
    console.log("\nNo READY avatars in cache. Run debug-avatar-create.mjs first.");
    process.exit(1);
  }

  // Test session creation in parallel — same as the app does.
  console.log("\n\n=== TESTING SESSION CREATION (parallel, like the app) ===");
  const results = await Promise.allSettled([
    yuki ? tryCreateSession("yuki-sato", yuki) : Promise.resolve(null),
    marcel ? tryCreateSession("marcel-vrai", marcel) : Promise.resolve(null),
  ]);

  console.log("\n\n=== SUMMARY ===");
  for (let i = 0; i < results.length; i++) {
    const name = i === 0 ? "yuki-sato" : "marcel-vrai";
    const r = results[i];
    if (r.status === "fulfilled" && r.value) {
      console.log(`  ✓ ${name}: session.id ${r.value}`);
    } else if (r.status === "fulfilled") {
      console.log(`  ✗ ${name}: failed (no value)`);
    } else {
      console.log(`  ✗ ${name}: rejected — ${r.reason?.message || r.reason}`);
    }
  }
})();
