const REPLICATE_API_URL = "https://api.replicate.com/v1";

export type ReplicatePrediction<T = unknown> = {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output: T | null;
  error: string | null;
  urls: { get: string; cancel: string };
  metrics?: { predict_time?: number };
};

// ============================================================================
// Concurrency limiter
//
// Replicate rate-limits creation of predictions (default ~60/min, 5 burst for
// accounts with < $10 credit). Firing 13 plate generations at once guarantees
// 429s. We gate every CREATE call through a small promise pool so the
// agent can still request many plates in parallel — they just trickle out.
// ============================================================================

const MAX_INFLIGHT_CREATES = Number(process.env.REPLICATE_MAX_INFLIGHT || 3);
let inflightCreates = 0;
const createQueue: Array<() => void> = [];

async function acquireCreateSlot(): Promise<void> {
  if (inflightCreates < MAX_INFLIGHT_CREATES) {
    inflightCreates++;
    return;
  }
  return new Promise<void>((resolve) => {
    createQueue.push(() => {
      inflightCreates++;
      resolve();
    });
  });
}

function releaseCreateSlot(): void {
  inflightCreates = Math.max(0, inflightCreates - 1);
  const next = createQueue.shift();
  if (next) next();
}

// ============================================================================
// Network-level retry
// ============================================================================

/**
 * Retry transient network errors (ECONNRESET, ETIMEDOUT, EAI_AGAIN) AND 429s.
 * On 429 we parse `retry_after` from the body and wait that long.
 */
async function fetchWithRetry(
  input: string,
  init: RequestInit,
  opts: { retries?: number; baseDelayMs?: number } = {}
): Promise<Response> {
  const retries = opts.retries ?? 6;
  const baseDelay = opts.baseDelayMs ?? 500;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(input, init);

      // Handle 429 — read retry_after and retry
      if (res.status === 429) {
        let waitMs = 5000;
        try {
          const body = await res.clone().json();
          const ra =
            (body as { retry_after?: number })?.retry_after ??
            Number(res.headers.get("retry-after"));
          if (Number.isFinite(ra) && ra > 0) waitMs = Math.ceil(ra * 1000) + 500;
        } catch {
          /* ignore */
        }
        if (attempt === retries) return res;
        console.warn(
          `[replicate] 429 throttled — waiting ${waitMs}ms (attempt ${attempt + 1}/${retries})`
        );
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      // Retry 5xx transient
      if (res.status >= 500 && res.status < 600 && attempt < retries) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 250;
        console.warn(
          `[replicate] ${res.status} server error — retry ${attempt + 1}/${retries} in ${Math.round(delay)}ms`
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      return res;
    } catch (err) {
      lastErr = err;
      const cause = (err as { cause?: { code?: string } })?.cause;
      const code = cause?.code || (err as { code?: string })?.code;
      const transient =
        code === "ECONNRESET" ||
        code === "ETIMEDOUT" ||
        code === "ECONNREFUSED" ||
        code === "EAI_AGAIN" ||
        code === "UND_ERR_SOCKET" ||
        code === "UND_ERR_CONNECT_TIMEOUT" ||
        (err as Error)?.message?.includes("fetch failed");

      if (!transient || attempt === retries) throw err;

      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 200;
      console.warn(
        `[replicate] transient fetch error (${code || "?"}) — retry ${attempt + 1}/${retries} in ${Math.round(delay)}ms`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastErr;
}

// ============================================================================
// Prediction lifecycle
// ============================================================================

export async function createPrediction<T = unknown>(
  model: string,
  input: Record<string, unknown>,
  opts?: { webhookUrl?: string }
): Promise<ReplicatePrediction<T>> {
  await acquireCreateSlot();
  try {
    const body: Record<string, unknown> = { input };
    if (opts?.webhookUrl) {
      body.webhook = opts.webhookUrl;
      body.webhook_events_filter = ["completed"];
    }

    const response = await fetchWithRetry(
      `${REPLICATE_API_URL}/models/${model}/predictions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
          "Content-Type": "application/json",
          Prefer: opts?.webhookUrl ? "respond-async" : "wait",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Replicate API error: ${response.status} — ${error}`);
    }

    return response.json();
  } finally {
    releaseCreateSlot();
  }
}

export async function getPrediction<T = unknown>(id: string): Promise<ReplicatePrediction<T>> {
  const response = await fetchWithRetry(`${REPLICATE_API_URL}/predictions/${id}`, {
    headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` },
  });
  if (!response.ok) throw new Error(`Replicate API error: ${response.status}`);
  return response.json();
}

export async function cancelPrediction(id: string): Promise<void> {
  try {
    await fetchWithRetry(`${REPLICATE_API_URL}/predictions/${id}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` },
    });
  } catch (err) {
    // Cancel is best-effort — the prediction may already have completed.
    console.warn(
      `[replicate] cancel failed for ${id}: ${err instanceof Error ? err.message : err}`
    );
  }
}

export async function waitForPrediction<T = unknown>(
  id: string,
  maxWaitMs = 600_000,
  pollIntervalMs = 4000,
  signal?: AbortSignal
): Promise<ReplicatePrediction<T>> {
  const start = Date.now();
  let consecutivePollErrors = 0;
  let lastPollWarnAt = 0;
  let pollErrorsSinceWarn = 0;
  while (Date.now() - start < maxWaitMs) {
    // Client disconnected / user clicked Stop — cancel the prediction on
    // Replicate's side so we stop paying for compute, then bail.
    if (signal?.aborted) {
      cancelPrediction(id); // fire-and-forget — don't await
      throw new Error("Prediction canceled by user");
    }
    try {
      const prediction = await getPrediction<T>(id);
      consecutivePollErrors = 0;
      pollErrorsSinceWarn = 0;
      if (prediction.status === "succeeded") return prediction;
      if (prediction.status === "failed")
        throw new Error(`Prediction failed: ${prediction.error}`);
      if (prediction.status === "canceled") throw new Error("Prediction was canceled");
    } catch (err) {
      consecutivePollErrors++;
      pollErrorsSinceWarn++;
      if (consecutivePollErrors >= 5) throw err;
      // Throttle the warn log to once every 60s per prediction. Without the
      // throttle, transient Replicate 5xx storms produce thousands of
      // identical "poll failure 1/5" lines that hide the real errors.
      const now = Date.now();
      if (now - lastPollWarnAt >= 60_000) {
        if (pollErrorsSinceWarn > 1) {
          console.warn(
            `[replicate] poll failures for ${id}: ${pollErrorsSinceWarn} in the last minute (will throw after 5 consecutive)`
          );
        } else {
          console.warn(
            `[replicate] poll failure ${consecutivePollErrors}/5 for ${id} — continuing`
          );
        }
        lastPollWarnAt = now;
        pollErrorsSinceWarn = 0;
      }
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
  throw new Error("Prediction timed out");
}

/**
 * High-level: run a model and await its final output in one call.
 *
 * Timeout handling: if waitForPrediction times out but the prediction is
 * still running on Replicate's side, we RE-ENTER waitForPrediction for the
 * SAME prediction ID — we do NOT create a new prediction. Creating a new
 * one double-bills and orphans the original (which usually completes
 * seconds after we gave up). Only truly transient network errors spawn a
 * fresh prediction, and only if the original is terminally dead.
 */
export async function runModel<T = unknown>(
  model: string,
  input: Record<string, unknown>,
  opts?: { webhookUrl?: string; maxWaitMs?: number; retries?: number; signal?: AbortSignal }
): Promise<{ predictionId: string; output: T | null }> {
  if (opts?.signal?.aborted) throw new Error("Prediction canceled by user");

  const prediction = await createPrediction<T>(model, input, opts);
  if (prediction.status === "succeeded") {
    return { predictionId: prediction.id, output: prediction.output };
  }
  if (opts?.webhookUrl) {
    return { predictionId: prediction.id, output: null };
  }

  const maxWaitMs = opts?.maxWaitMs ?? 600_000;
  const extensionMs = Math.min(maxWaitMs, 120_000); // extend by up to 2 more minutes on timeout
  const maxExtensions = opts?.retries ?? 2;

  try {
    const done = await waitForPrediction<T>(prediction.id, maxWaitMs, 4000, opts?.signal);
    return { predictionId: done.id, output: done.output };
  } catch (err) {
    const msg = (err as Error)?.message || String(err);
    // Only extend on timeout — keep canceled/failed/aborted terminal.
    if (!msg.includes("timed out")) throw err;

    for (let ext = 1; ext <= maxExtensions; ext++) {
      if (opts?.signal?.aborted) throw new Error("Prediction canceled by user");
      // Before extending, peek at the prediction: if it already succeeded or
      // failed in the gap, take that result instead of polling again.
      try {
        const peek = await getPrediction<T>(prediction.id);
        if (peek.status === "succeeded") {
          return { predictionId: peek.id, output: peek.output };
        }
        if (peek.status === "failed" || peek.status === "canceled") {
          throw new Error(`Prediction ${peek.status}: ${peek.error || peek.status}`);
        }
      } catch (peekErr) {
        // If the peek itself fails transiently, fall through to the extend
        // and let waitForPrediction's own polling deal with it.
        const pmsg = (peekErr as Error)?.message || String(peekErr);
        if (!pmsg.includes("Replicate API error") && !pmsg.includes("fetch failed")) {
          throw peekErr;
        }
      }
      console.warn(
        `[replicate] extending wait on ${prediction.id} — still running after ${Math.round(
          (maxWaitMs + (ext - 1) * extensionMs) / 1000
        )}s (extension ${ext}/${maxExtensions})`
      );
      try {
        const done = await waitForPrediction<T>(
          prediction.id,
          extensionMs,
          4000,
          opts?.signal
        );
        return { predictionId: done.id, output: done.output };
      } catch (extErr) {
        const emsg = (extErr as Error)?.message || String(extErr);
        if (!emsg.includes("timed out")) throw extErr;
        // Keep extending
      }
    }
    // Fully exhausted extensions — best-effort cancel and surface the
    // timeout so the caller can fail gracefully.
    cancelPrediction(prediction.id);
    throw new Error(
      `Prediction ${prediction.id} still running after ${Math.round(
        (maxWaitMs + maxExtensions * extensionMs) / 1000
      )}s. Canceled.`
    );
  }
}

export const MODELS = {
  KLING_OMNI: "kwaivgi/kling-v3-omni-video",
  KLING_O1: "kwaivgi/kling-o1",
  SEEDANCE: "bytedance/seedance-2.0",
  NANO_BANANA_PRO: "google/nano-banana-pro",
  NANO_BANANA: "google/nano-banana",
} as const;

/**
 * Default image model. Set REPLICATE_IMAGE_MODEL=google/nano-banana to downgrade.
 */
export const DEFAULT_IMAGE_MODEL: string =
  process.env.REPLICATE_IMAGE_MODEL || MODELS.NANO_BANANA_PRO;

/**
 * Default output resolution for image generation. Nano Banana Pro supports
 * 1K / 2K / 4K. Default is 1K because it's ~3× faster and the downstream
 * pipeline (Kling/Seedance) downsamples to 720p-1080p anyway, so 2K detail
 * is lost before the user sees the shot. Bump via env for hero stills.
 */
export const DEFAULT_IMAGE_RESOLUTION: string =
  process.env.REPLICATE_IMAGE_RESOLUTION || "1K";
