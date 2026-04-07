/**
 * Music generation via Suno API (sunoapi.org).
 * Uses model V4_5ALL (latest). Generates instrumental background music.
 * Flow: POST /api/v1/generate → poll /api/v1/generate/record-info → get audioUrl
 *
 * API returns camelCase fields: audioUrl, sourceAudioUrl, streamAudioUrl
 */

import { trackCost } from "./cost-tracker";

const SUNO_API_URL = "https://api.sunoapi.org";
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_MS = 600_000; // 10 minutes — Suno V4.5 TEXT_SUCCESS→FIRST_SUCCESS takes 5-8 min

type SunoGenerateResponse = {
  code: number;
  msg: string;
  data?: {
    taskId: string;
  };
};

// Matches ACTUAL camelCase fields returned by sunoapi.org
type SunoTrack = {
  id: string;
  title: string;
  audioUrl: string;           // camelCase — the main download URL
  sourceAudioUrl: string | null;  // camelCase — CDN source URL
  streamAudioUrl: string | null;  // camelCase — streaming URL
  sourceStreamAudioUrl: string | null;
  duration: number | null;
  modelName: string;
  tags: string;
};

type SunoRecordResponse = {
  code: number;
  msg: string;
  data?: {
    status: string;
    response?: {
      sunoData?: SunoTrack[];
    };
  };
};

export type MusicOptions = {
  prompt: string;
  style?: string;
  title?: string;
  instrumental?: boolean;
  negativeTags?: string;
  generationId?: string;
  /** Target duration in seconds. Appended to prompt as guidance. Default: 30 */
  targetDuration?: number;
};

export async function generateMusic(options: MusicOptions, signal?: AbortSignal): Promise<{
  audioUrl: string;
  duration: number;
  title: string;
}> {
  const {
    prompt,
    style,
    title = "Background Music",
    instrumental = true,
    negativeTags,
    generationId,
    targetDuration = 30,
  } = options;

  const apiKey = process.env.SUNO_API_KEY;
  if (!apiKey) {
    throw new Error("SUNO_API_KEY not set. Add it to your .env file.");
  }

  // Force short ad-optimized music — Suno tends to generate long songs otherwise
  const durationHint = prompt.toLowerCase().includes("second") ? "" : ` Exactly ${targetDuration} seconds long.`;
  const adHint = " Short advertisement jingle. Starts immediately with energy from beat one — NO slow intro, NO buildup, NO fade-in. Punchy from the first second. Loops cleanly.";
  const fullPrompt = prompt + durationHint + adHint;

  console.log("[music] Generating with Suno V4.5:", fullPrompt.slice(0, 100), "style:", style);

  // Step 1: Submit
  const body: Record<string, unknown> = {
    customMode: true,
    instrumental,
    model: "V4_5ALL",
    callBackUrl: "https://example.com/suno-callback",
    prompt: fullPrompt,
    title,
  };
  if (style) body.style = style;
  if (negativeTags) body.negativeTags = negativeTags;

  const res = await fetch(`${SUNO_API_URL}/api/v1/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.text();
    console.error("[music] Suno submit error:", res.status, error);
    throw new Error(`Suno API error ${res.status}: ${error}`);
  }

  const data: SunoGenerateResponse = await res.json();
  if (data.code !== 200 || !data.data?.taskId) {
    throw new Error(`Suno error: ${data.msg || JSON.stringify(data)}`);
  }

  const taskId = data.data.taskId;
  console.log("[music] Task submitted:", taskId);

  // Step 2: Poll — Suno states flow: PENDING → TEXT_SUCCESS → FIRST_SUCCESS → SUCCESS
  const SUCCESS_STATES = ["SUCCESS", "COMPLETE", "COMPLETED", "DONE"];
  const PENDING_STATES = [
    "PENDING", "PROCESSING", "QUEUED", "RUNNING", "IN_QUEUE", "IN_PROGRESS", "SUBMITTED",
    "CREATE_SUCCESS",  // Creation in progress
  ];
  // TEXT_SUCCESS and FIRST_SUCCESS handled separately below for early audio extraction

  const start = Date.now();
  let textSuccessSince: number | null = null; // track when we entered TEXT_SUCCESS
  while (Date.now() - start < MAX_POLL_MS) {
    if (signal?.aborted) {
      throw new Error(`Suno music generation aborted. Task ID: ${taskId}`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    try {
      const pollRes = await fetch(
        `${SUNO_API_URL}/api/v1/generate/record-info?taskId=${taskId}`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );

      if (!pollRes.ok) {
        console.warn("[music] Poll HTTP error:", pollRes.status);
        continue;
      }

      const pollData: SunoRecordResponse = await pollRes.json();
      const status = pollData.data?.status;
      const normalizedStatus = status?.toUpperCase() || "";

      if (normalizedStatus === "TEXT_SUCCESS") {
        if (!textSuccessSince) textSuccessSince = Date.now();
        const elapsed = Math.round((Date.now() - textSuccessSince) / 1000);
        console.log(`[music] Audio rendering, text ready... (${elapsed}s in TEXT_SUCCESS)`);

        // After 60s in TEXT_SUCCESS, check if any track already has an audioUrl
        if (elapsed >= 60) {
          const tracks = pollData.data?.response?.sunoData;
          if (tracks?.length) {
            const track = tracks.find((t) => t.audioUrl || t.sourceAudioUrl || t.streamAudioUrl);
            if (track) {
              const audioUrl = track.audioUrl || track.sourceAudioUrl || track.streamAudioUrl;
              if (audioUrl) {
                const trackDuration = track.duration || targetDuration;
                if (generationId) {
                  trackCost(generationId, "suno-music", trackDuration,
                    `Music: "${track.title}" (${trackDuration}s)`);
                }
                console.log("[music] Early audio found during TEXT_SUCCESS:", track.title, trackDuration + "s", audioUrl.slice(0, 80));
                return { audioUrl, duration: trackDuration, title: track.title || title };
              }
            }
          }
        }
        continue;
      } else {
        textSuccessSince = null; // reset if we leave TEXT_SUCCESS
      }

      console.log("[music] Status:", status);

      if (SUCCESS_STATES.includes(normalizedStatus)) {
        const tracks = pollData.data?.response?.sunoData;
        if (!tracks?.length) {
          console.error("[music] Success status but no tracks. Full data:", JSON.stringify(pollData.data).slice(0, 500));
          throw new Error("Suno returned success but no tracks in response");
        }

        // API returns camelCase: audioUrl, sourceAudioUrl, streamAudioUrl
        // Find first track with a usable audio URL
        const track = tracks.find((t) => t.audioUrl || t.sourceAudioUrl || t.streamAudioUrl) || tracks[0];
        const audioUrl = track.audioUrl || track.sourceAudioUrl || track.streamAudioUrl;
        if (!audioUrl) {
          console.error("[music] Tracks found but no audio URL. Track keys:", Object.keys(track), "Track:", JSON.stringify(track).slice(0, 500));
          throw new Error("Track has no audioUrl, sourceAudioUrl, or streamAudioUrl");
        }

        const trackDuration = track.duration || targetDuration;

        if (generationId) {
          trackCost(generationId, "suno-music", trackDuration,
            `Music: "${track.title}" (${trackDuration}s)`);
        }

        console.log("[music] Done:", track.title, trackDuration + "s", audioUrl.slice(0, 80));
        return { audioUrl, duration: trackDuration, title: track.title || title };
      }

      // FIRST_SUCCESS: first track is ready — we can use it immediately instead of waiting
      // for the second track (which is just a variant)
      if (normalizedStatus === "FIRST_SUCCESS") {
        const tracks = pollData.data?.response?.sunoData;
        if (tracks?.length) {
          const track = tracks.find((t) => t.audioUrl || t.sourceAudioUrl || t.streamAudioUrl);
          if (track) {
            const audioUrl = track.audioUrl || track.sourceAudioUrl || track.streamAudioUrl;
            if (audioUrl) {
              const trackDuration = track.duration || targetDuration;
              if (generationId) {
                trackCost(generationId, "suno-music", trackDuration,
                  `Music: "${track.title}" (${trackDuration}s)`);
              }
              console.log("[music] Using first variant (FIRST_SUCCESS):", track.title, trackDuration + "s", audioUrl.slice(0, 80));
              return { audioUrl, duration: trackDuration, title: track.title || title };
            }
          }
        }
        // First track not yet usable — audio URLs not populated yet, keep polling
        console.log("[music] FIRST_SUCCESS but no audio URL on any track yet — waiting for audio to populate");
        continue;
      }

      // If status is not a known pending state, fail fast
      // TEXT_SUCCESS and FIRST_SUCCESS are handled above and `continue`, so they won't reach here
      if (!PENDING_STATES.includes(normalizedStatus) && normalizedStatus !== "") {
        console.error("[music] Unknown/failed status:", status, "Response:", JSON.stringify(pollData).slice(0, 500));
        throw new Error(`Suno generation failed with status: "${status}"`);
      }
    } catch (err) {
      // Re-throw permanent errors
      if (err instanceof Error && (
        err.message.includes("no tracks") ||
        err.message.includes("no audio") ||
        err.message.includes("failed with status")
      )) {
        throw err;
      }
      // Transient errors — log and retry
      console.warn("[music] Transient poll error (will retry):", err);
    }
  }

  throw new Error(`Suno timeout after ${MAX_POLL_MS / 1000}s. Task ID: ${taskId}`);
}
