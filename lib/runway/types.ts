// Shared types for the Runway client wrappers.

export type RunwayTaskResult<T = unknown> = {
  /** The Runway task ID (used for cost tracking + asset lineage). */
  taskId: string;
  /** Output array — typically signed URLs. SDK returns this as `task.output`. */
  output: T;
};

/** Seedance 2.5 output ratios (WIDTH:HEIGHT). 720p tier first, then 1080p. */
export type RunwayRatio =
  | "1280:720"
  | "720:1280"
  | "960:960"
  | "1112:834"
  | "834:1112"
  | "1470:630"
  | "1920:1080"
  | "1080:1920"
  | "1440:1440"
  | "1664:1248"
  | "1248:1664"
  | "2206:946";

/** Reference image entry passed to multi-ref-capable models. */
export type ReferenceImage = {
  /** HTTPS URL, runway:// URI, or data URI. */
  uri: string;
  /** Optional tag — referenced as @tag in prompt. 3-16 chars, starts with a letter, [A-Za-z0-9_]. */
  tag?: string;
};
