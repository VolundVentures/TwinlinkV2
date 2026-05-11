// Shared types for the Runway client wrappers.

export type RunwayTaskResult<T = unknown> = {
  /** The Runway task ID (used for cost tracking + asset lineage). */
  taskId: string;
  /** Output array — typically signed URLs. SDK returns this as `task.output`. */
  output: T;
};

/** Aspect ratio strings supported by Runway. WIDTH:HEIGHT, both divisible by 16. */
export type RunwayRatio =
  | "1280:720"
  | "1920:1080"
  | "720:1280"
  | "1080:1920"
  | "960:960"
  | "1408:896"
  | "896:1408"
  | "1408:1408"
  // Seedance-specific:
  | "1112:834"
  | "834:1112"
  | "1470:630"
  | "992:432"
  | "864:496"
  | "752:560"
  | "640:640"
  | "560:752"
  | "496:864";

/** Reference image entry passed to multi-ref-capable models. */
export type ReferenceImage = {
  /** HTTPS URL, runway:// URI, or data URI. */
  uri: string;
  /** Optional tag — referenced as @tag in prompt. Lowercase, 3-16 chars. */
  tag?: string;
};
