/**
 * The Higgsfield anti-prompt suffix.
 *
 * Appended to every image generation/edit prompt automatically (tool layer).
 * Never applied to video prompts — those are mechanical motion descriptions.
 *
 * Purpose: counteract Nano Banana's default "glossy AI-looking advertisement"
 * bias and push output toward a real film frame.
 */
export const ANTI_PROMPT_SUFFIX =
  "preserve original color grade, preserve original grain, preserve natural skin texture, " +
  "no HDR, no contrast push, no saturation boost, no beauty filter, no AI sheen, " +
  "photorealistic, this is a film frame not an advertisement";

export function withAntiPrompt(prompt: string): string {
  const normalized = prompt.trim();
  if (normalized.toLowerCase().includes("this is a film frame not an advertisement")) {
    return normalized; // already appended
  }
  return `${normalized}\n\n${ANTI_PROMPT_SUFFIX}`;
}
