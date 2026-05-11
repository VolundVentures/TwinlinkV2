// Persistent avatar ID store.
//
// Runway avatar IDs survive across server restarts; the in-memory cache in
// /api/avatar/session/route.ts does not. Without persistence we re-create
// the same avatar on every dev restart, burning Runway credits and re-rolling
// the dice on Runway's processing pipeline (which sometimes returns FAILED
// for reasons unrelated to our input).
//
// This store keeps successful avatar IDs in
// `public/directors/avatar-ids.json` — a single JSON file, write-after-create,
// read-before-create. Keyed by persona id.
//
// File format:
//   {
//     "marcel-vrai": { "avatarId": "...", "referenceUri": "runway://...", "createdAt": 1730000000 },
//     "sven-holmgren": null,   // last attempt failed; next call will retry
//     ...
//   }

import fs from "node:fs/promises";
import path from "node:path";

const STORE_PATH = path.join(
  process.cwd(),
  "public",
  "directors",
  "avatar-ids.json"
);

export type AvatarRecord = {
  avatarId: string;
  referenceUri: string;
  createdAt: number;
};

type Store = Record<string, AvatarRecord | null>;

let memCache: Store | null = null;
let writeLock: Promise<void> = Promise.resolve();

async function readStore(): Promise<Store> {
  if (memCache) return memCache;
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    memCache = JSON.parse(raw) as Store;
  } catch {
    memCache = {};
  }
  return memCache;
}

async function writeStore(next: Store): Promise<void> {
  memCache = next;
  // Serialize writes — JSON file integrity is fragile under concurrent writes.
  writeLock = writeLock.then(async () => {
    try {
      await fs.writeFile(STORE_PATH, JSON.stringify(next, null, 2), "utf8");
    } catch (err) {
      console.warn("[avatar-ids-store] write failed:", err);
    }
  });
  await writeLock;
}

export async function getAvatarRecord(directorId: string): Promise<AvatarRecord | null> {
  const store = await readStore();
  return store[directorId] ?? null;
}

export async function setAvatarRecord(
  directorId: string,
  record: AvatarRecord
): Promise<void> {
  const store = await readStore();
  await writeStore({ ...store, [directorId]: record });
}

export async function clearAvatarRecord(directorId: string): Promise<void> {
  const store = await readStore();
  await writeStore({ ...store, [directorId]: null });
}
