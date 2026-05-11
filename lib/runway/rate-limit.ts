// Concurrency limiter for Runway task creation.
//
// Runway, like Replicate, rate-limits task creation. The agent loop can fan
// out many parallel calls (e.g. generate 5 character bibles + 3 scene
// storyboards simultaneously) — without a gate this trips 429s. We mirror the
// replicate.ts pattern: a small promise pool that lets up to N tasks be
// inflight at once, queueing the rest.
//
// Default 5: matches Runway tier-3 limits (May 2026). Override via env if the
// account is on a higher/lower tier.
const MAX_INFLIGHT = Number(process.env.RUNWAY_MAX_INFLIGHT || 5);

let inflight = 0;
const queue: Array<() => void> = [];

export async function acquireSlot(): Promise<void> {
  if (inflight < MAX_INFLIGHT) {
    inflight++;
    return;
  }
  return new Promise<void>((resolve) => {
    queue.push(() => {
      inflight++;
      resolve();
    });
  });
}

export function releaseSlot(): void {
  inflight = Math.max(0, inflight - 1);
  const next = queue.shift();
  if (next) next();
}

/**
 * Run a function with a concurrency slot held for its lifetime. Releases the
 * slot in `finally` so failures don't deadlock the queue.
 */
export async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  await acquireSlot();
  try {
    return await fn();
  } finally {
    releaseSlot();
  }
}
