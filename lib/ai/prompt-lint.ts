/**
 * Prompt linter — enforces the Higgsfield mechanical video prompt style.
 *
 * Cannes-tier video prompts are ≤25 words: [camera rule] + [motion verb] + [what stays still].
 * The keyframe carries composition, lighting, framing. The video prompt only describes motion.
 *
 * When a shot prompt fails the lint, the tool layer returns `success: false`
 * with a coaching message so the agent self-corrects in the same turn —
 * we never silently rewrite (the agent has to learn the format).
 */

const FORBIDDEN_ADJECTIVES = [
  "cinematic",
  "beautiful",
  "stunning",
  "epic",
  "dramatic",
  "dynamic",
  "sweeping",
  "breathtaking",
  "mesmerizing",
  "ultra-realistic",
  "ultrarealistic",
  "8k",
  "4k",
  "masterpiece",
  "award-winning",
  "cinematic masterpiece",
  "hyperrealistic",
];

const CAMERA_RULE_KEYWORDS = [
  "static",
  "locked",
  "handheld",
  "dolly",
  "push",
  "pull",
  "pan",
  "tilt",
  "tracking",
  "zoom",
  "crane",
  "arc",
  "orbit",
  "pov",
  "aerial",
  "whip",
  "rack focus",
];

export type VideoPromptLintResult = {
  ok: boolean;
  warnings: string[];
  wordCount: number;
};

const WORD_LIMIT = 30; // hard cap — target is 25

export function lintVideoPrompt(prompt: string): VideoPromptLintResult {
  const words = prompt.trim().split(/\s+/).filter(Boolean);
  const warnings: string[] = [];
  const lower = prompt.toLowerCase();

  if (words.length > WORD_LIMIT) {
    warnings.push(
      `Video prompt is ${words.length} words — compress to ≤25. The keyframe carries composition; the prompt only describes motion. Example: "static camera. orlando turns head to mirror, gaze lingers."`
    );
  }

  const foundForbidden = FORBIDDEN_ADJECTIVES.filter((w) => {
    const pattern = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    return pattern.test(lower);
  });
  if (foundForbidden.length > 0) {
    warnings.push(
      `Forbidden adjectives: ${foundForbidden.join(", ")}. Describe motion and camera rule only. The keyframe already carries the cinematic quality — don't restate it in the prompt.`
    );
  }

  const hasCameraRule = CAMERA_RULE_KEYWORDS.some((k) => {
    const pattern = new RegExp(`\\b${k}\\b`, "i");
    return pattern.test(lower);
  });
  if (!hasCameraRule) {
    warnings.push(
      `No camera rule found. Start with one of: static camera, locked off, handheld, slow dolly in, push in, pull back, pan left/right, tracking, rack focus, pov.`
    );
  }

  return {
    ok: warnings.length === 0,
    warnings,
    wordCount: words.length,
  };
}
