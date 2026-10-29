/**
 * Scene-direction linter for Seedance 2.5 prompts.
 *
 * A scene is 25 seconds with native audio, so the prompt is no longer a
 * 25-word motion tag — it is a short shooting script: camera rule, 2–4
 * timed beats, any dialogue in quotes, sound cues. Hard cap 220 words so
 * the agent still writes direction rather than prose.
 *
 * When a prompt fails lint, the tool returns `success: false` with a
 * coaching message so the agent self-corrects in the same turn.
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
  "steadicam",
];

export type VideoPromptLintResult = {
  ok: boolean;
  warnings: string[];
  wordCount: number;
};

const WORD_LIMIT = 220;

export function lintVideoPrompt(prompt: string): VideoPromptLintResult {
  const words = prompt.trim().split(/\s+/).filter(Boolean);
  const warnings: string[] = [];
  const lower = prompt.toLowerCase();

  if (words.length > WORD_LIMIT) {
    warnings.push(
      `Scene direction is ${words.length} words — cap is ${WORD_LIMIT}. Write beats, not prose: "[camera rule]. 0-8s: … 8-18s: … 18-25s: …". Dialogue in quotes, sound cues in brackets.`
    );
  }

  const foundForbidden = FORBIDDEN_ADJECTIVES.filter((w) => {
    const pattern = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    return pattern.test(lower);
  });
  if (foundForbidden.length > 0) {
    warnings.push(
      `Forbidden adjectives: ${foundForbidden.join(", ")}. Describe camera, action, dialogue and sound — the keyframe already carries the look.`
    );
  }

  const hasCameraRule = CAMERA_RULE_KEYWORDS.some((k) => {
    const pattern = new RegExp(`\\b${k}\\b`, "i");
    return pattern.test(lower);
  });
  if (!hasCameraRule) {
    warnings.push(
      `No camera rule found. Open with one of: static camera, locked off, handheld, slow dolly in, push in, pull back, pan left/right, tracking, steadicam, rack focus, pov.`
    );
  }

  return {
    ok: warnings.length === 0,
    warnings,
    wordCount: words.length,
  };
}
