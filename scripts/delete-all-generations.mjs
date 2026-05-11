// One-time: delete all generations + related session/asset rows.
// Storage files are orphaned (not deleted here) — cleanup separately if needed.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

for (const p of [".env.local", ".env"]) {
  try {
    const src = readFileSync(p, "utf8");
    for (const line of src.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      if (process.env[m[1]]) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      process.env[m[1]] = v;
    }
  } catch {}
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

const { count: before } = await db
  .from("generations")
  .select("*", { count: "exact", head: true });

console.log(`Found ${before} generations. Deleting...`);

// generation_assets and agent_sessions cascade from generations
const { error } = await db.from("generations").delete().not("id", "is", null);

if (error) {
  console.error("Delete failed:", error);
  process.exit(1);
}

const { count: after } = await db
  .from("generations")
  .select("*", { count: "exact", head: true });

console.log(`Done. Remaining: ${after}.`);
