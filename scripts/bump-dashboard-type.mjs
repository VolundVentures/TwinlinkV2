// One-shot type-scale bumper for the dashboard/director surfaces.
//
// The dashboard uses an editorial micro-type system inherited from the marketing
// page. At 9-11px with tight tracking it reads as "smashed" — letters look
// cramped and small on dense surfaces (director-shell, workspace plates list,
// on-call widget). This bumps the dominant patterns up one notch and loosens
// tracking just enough to breathe, without touching layout or semantics.
//
// Pass order matters: process from LARGEST source size down to SMALLEST so each
// pass doesn't accidentally re-bump output of the previous pass.
//
// Run: node scripts/bump-dashboard-type.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");

const FILES = [
  // Dashboard chrome
  "components/dashboard/header.tsx",
  "components/dashboard/sidebar.tsx",
  "components/dashboard/mobile-nav.tsx",
  // Director surface (the screenshot)
  "components/director/director-shell.tsx",
  "components/director/chat-pane.tsx",
  "components/director/workspace-pane.tsx",
  "components/director/cast.tsx",
  "components/director/brief-form.tsx",
  "components/director/asset-modal.tsx",
  "components/director/recent-films.tsx",
  "components/director/mention-input.tsx",
  "components/director/markdown.tsx",
  "components/director/attach-button.tsx",
  "components/director/workflow-canvas.tsx",
  // Auteur (lobby + studio)
];

// Pass 1 — bump 11px caps to 12px (slightly looser tracking on tightest case).
// Done first so we don't double-bump 10→11→12.
const PASS_1 = [
  ["text-[11px] uppercase tracking-[0.14em]", "text-[12px] uppercase tracking-[0.16em]"],
  ["text-[11px] uppercase tracking-[0.16em]", "text-[12px] uppercase tracking-[0.16em]"],
  ["text-[11px] uppercase tracking-[0.18em]", "text-[12px] uppercase tracking-[0.18em]"],
  ["text-[11px] uppercase tracking-[0.2em]",  "text-[12px] uppercase tracking-[0.2em]"],
  ["text-[11px] uppercase tracking-[0.22em]", "text-[12px] uppercase tracking-[0.22em]"],
  ["text-[11px] uppercase tracking-[0.24em]", "text-[12px] uppercase tracking-[0.24em]"],
  ["text-[11px] uppercase tracking-[0.28em]", "text-[12px] uppercase tracking-[0.28em]"],
  ["text-[11px] uppercase tracking-wider",    "text-[12px] uppercase tracking-[0.18em]"],
  ["text-[11px] uppercase tracking-widest",   "text-[12px] uppercase tracking-[0.22em]"],
];

// Pass 2 — bump 10px caps to 11px. Tighten the loosest tracking back where
// 11px doesn't need it as badly.
const PASS_2 = [
  ["text-[10px] uppercase tracking-[0.1em]",  "text-[11px] uppercase tracking-[0.16em]"],
  ["text-[10px] uppercase tracking-[0.14em]", "text-[11px] uppercase tracking-[0.18em]"],
  ["text-[10px] uppercase tracking-[0.16em]", "text-[11px] uppercase tracking-[0.18em]"],
  ["text-[10px] uppercase tracking-[0.18em]", "text-[11px] uppercase tracking-[0.18em]"],
  ["text-[10px] uppercase tracking-[0.2em]",  "text-[11px] uppercase tracking-[0.2em]"],
  ["text-[10px] uppercase tracking-[0.22em]", "text-[11px] uppercase tracking-[0.22em]"],
  ["text-[10px] uppercase tracking-[0.24em]", "text-[11px] uppercase tracking-[0.24em]"],
  ["text-[10px] uppercase tracking-[0.28em]", "text-[11px] uppercase tracking-[0.28em]"],
  ["text-[10px] uppercase tracking-wider",    "text-[11px] uppercase tracking-[0.18em]"],
  ["text-[10px] uppercase tracking-widest",   "text-[11px] uppercase tracking-[0.22em]"],
];

// Pass 3 — kill 9px caps entirely (way too small).
const PASS_3 = [
  ["text-[9px] uppercase tracking-[0.14em]", "text-[11px] uppercase tracking-[0.18em]"],
  ["text-[9px] uppercase tracking-[0.16em]", "text-[11px] uppercase tracking-[0.18em]"],
  ["text-[9px] uppercase tracking-[0.18em]", "text-[11px] uppercase tracking-[0.18em]"],
  ["text-[9px] uppercase tracking-[0.2em]",  "text-[11px] uppercase tracking-[0.2em]"],
  ["text-[9px] uppercase tracking-[0.22em]", "text-[11px] uppercase tracking-[0.22em]"],
  ["text-[9px] uppercase tracking-[0.24em]", "text-[11px] uppercase tracking-[0.24em]"],
  ["text-[9px] uppercase tracking-wider",    "text-[11px] uppercase tracking-[0.18em]"],
];

// Pass 4 — bare-ish text-[10px] (numeric/tabular labels, etc.) → 11px.
// Order matters: must run AFTER PASS_2 so we don't re-bump uppercase patterns
// already updated. PASS_4 catches patterns without an `uppercase` modifier.
// Limit to specific common contexts to avoid touching non-label uses (e.g.
// canvas line-clamp body text where 10px is intentionally compact).
const PASS_4 = [
  ["font-mono text-[10px] tabular-nums",      "font-mono text-[11px] tabular-nums"],
  ["font-mono text-[10px] text-neutral-",     "font-mono text-[11px] text-neutral-"],
  ["font-mono text-[10px] leading-snug",      "font-mono text-[11px] leading-snug"],
  ["truncate font-mono text-[10px]",          "truncate font-mono text-[11px]"],
];

// Pass 5 — bare 9px → 11px catch-all.
const PASS_5 = [
  ["text-[9px]", "text-[11px]"],
];

// Pass 6 — 8px caps (rare, found on the Wings sub-tile + a corner badge).
const PASS_6 = [
  ["text-[8px] uppercase tracking-[0.14em]", "text-[10px] uppercase tracking-[0.18em]"],
  ["text-[8px] uppercase tracking-[0.18em]", "text-[10px] uppercase tracking-[0.18em]"],
  ["text-[8px]", "text-[10px]"],
];

const PASSES = [PASS_1, PASS_2, PASS_3, PASS_4, PASS_5, PASS_6];

let totalChanges = 0;
const perFile = new Map();

for (const rel of FILES) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    console.warn(`  [skip] ${rel} — not found`);
    continue;
  }
  const original = fs.readFileSync(full, "utf8");
  let content = original;
  let fileChanges = 0;
  for (const pass of PASSES) {
    for (const [from, to] of pass) {
      if (from === to) continue;
      // Count by splitting BEFORE replacing — works whether lengths differ or not.
      const occurrences = content.split(from).length - 1;
      if (occurrences > 0) {
        content = content.split(from).join(to);
        fileChanges += occurrences;
      }
    }
  }
  if (content !== original) {
    fs.writeFileSync(full, content);
    perFile.set(rel, fileChanges);
    totalChanges += fileChanges;
  }
}

console.log(`\nBumped ${totalChanges} occurrences across ${perFile.size} files:`);
for (const [f, n] of [...perFile.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)} × ${f}`);
}
