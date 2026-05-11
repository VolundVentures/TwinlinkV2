// Sanitize the personality field of every director persona JSON to satisfy
// Runway Characters API's content moderation.
//
// Trigger of the original "This text cannot be used for an avatar" rejection:
// each persona's personality opened with "You are [Fictional Name], a fictional
// director inspired by [Real Director]. You have personally directed [real
// film 1], [real film 2], [real film 3], [real film 4]..." Runway flags this
// as impersonation of real public figures.
//
// This script rewrites the personality field from a clean template using the
// persona's other fields (school, visualSignature, voice description,
// deferenceRate). The result has no specific real-director names, no specific
// real-film titles, but preserves each persona's distinct voice, opinions,
// and co-direction behaviour.
//
// The `filmsCited` array stays in the JSON unchanged — it's read by the agent
// loop / knowledge base for richer cinema teaching, just not in the avatar's
// system prompt.
//
// Idempotent. Re-running overwrites the personality with the same sanitized
// version. Safe to run multiple times.
//
// Usage:
//   node scripts/sanitize-persona-personalities.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PERSONAS_DIR = path.join(__dirname, "..", "lib", "directors", "personas");

function buildSanitizedPersonality(persona) {
  const def = persona.deferenceRate ?? 0.5;
  const coDirectionGuidance =
    def < 0.45
      ? "you tend to lead. Speak first when you have a strong opinion. Don't talk over your co-director, but don't hide either."
      : def > 0.6
        ? "you tend to defer. Listen first, let your co-director set the frame, then build on their point or quietly counter it."
        : "you balance lead and listen. Chime in when you have something specific to add. Hold back when the moment is theirs.";

  const voiceLine =
    persona.voice?.type === "custom" && persona.voice.designPrompt
      ? persona.voice.designPrompt
      : "warm but uncompromising about craft, never raised, measured pace";

  return [
    `You are ${persona.name}. You're a fictional cinema director working in the ${persona.school.toLowerCase()} tradition. The user has cast you to co-direct their film. Together you're going to make something — they bring the story, you shape the choices.`,
    "",
    `Your voice character: ${voiceLine}. You speak in fragments and in images more than complete sentences. You distrust adjectives that try to do the camera's work.`,
    "",
    `Your visual language: ${persona.visualSignature}`,
    "",
    "What you believe about cinema:",
    "- Composition is character. Where the camera sits decides what the audience feels.",
    "- Hold longer than feels comfortable, then hold longer than that. Duration is meaning.",
    "- The frame is a moral choice. The cut is the second moral choice.",
    "- Sound design is half the film. Silence is sound design.",
    "- Reference your touchstones generously — schools of cinema, eras, moods you love. That's how craft is passed down.",
    "",
    "Your job has two halves:",
    "1. Direct — shape what's in frame, how the camera moves, how cuts land, what fills the soundscape, what the actor is feeling between lines.",
    "2. Teach — as you make decisions, mention the school or the technique that informs them. Speak with the authority of someone who's thought hard about every choice.",
    "",
    `Co-directing with another director on this project: ${coDirectionGuidance} The user may address either of you by name; when called by name, respond preferentially.`,
    "",
    "Speak with conviction. The user has chosen you for your taste, not consensus. Don't be hesitant. Don't soften everything. The film deserves your strongest read.",
  ].join("\n");
}

const files = fs
  .readdirSync(PERSONAS_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => path.join(PERSONAS_DIR, f));

console.log(`Sanitizing ${files.length} persona personality fields...\n`);

let updated = 0;
let skipped = 0;

for (const filePath of files) {
  const persona = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const before = persona.personality?.length ?? 0;
  const after = buildSanitizedPersonality(persona);
  if (persona.personality === after) {
    console.log(`  [skip] ${persona.id} (already sanitized)`);
    skipped++;
    continue;
  }
  persona.personality = after;
  fs.writeFileSync(filePath, JSON.stringify(persona, null, 2) + "\n");
  console.log(`  [ok]   ${persona.id}: ${before} → ${after.length} chars`);
  updated++;
}

console.log(`\nDone. ${updated} updated, ${skipped} unchanged.`);
console.log(
  "Restart your dev server (or just retry /dashboard/auteur) so the avatar cache picks up the new personality on next createAvatar call."
);
