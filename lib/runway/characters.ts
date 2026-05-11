// Characters API (gwm1_avatars) — server-side primitives.
//
// The dual-live director architecture (per plan §1.3) calls these from
// app/api/avatar/session/route.ts to spin up two parallel sessions per
// connection, polls each to READY, consumes credentials once, and returns
// both credential bundles to the client for WebRTC.
//
// Never expose RUNWAYML_API_SECRET to the client. All calls here are
// server-side only.

import { getRunwayClient } from "./client";
import { withSlot } from "./rate-limit";
import { RUNWAY_MODELS } from "./models";

export type AvatarVoice =
  | { type: "preset"; presetId: "clara" | "victoria" | "vincent" }
  | { type: "custom"; voiceId: string };

export type CreateAvatarInput = {
  name: string;
  /** HTTPS URL, runway:// URI, or data URI. Recommended: 1088×704 with face centered. */
  referenceImage: string;
  voice: AvatarVoice;
  /** ≤10K chars. Drives the avatar's behavior, opinions, vocabulary. */
  personality: string;
};

export async function createAvatar(input: CreateAvatarInput): Promise<{ avatarId: string }> {
  return withSlot(async () => {
    const client = getRunwayClient();
    const params: Record<string, unknown> = {
      name: input.name,
      referenceImage: input.referenceImage,
      personality: input.personality,
      voice:
        input.voice.type === "preset"
          ? { type: "runway-live-preset", presetId: input.voice.presetId }
          : { type: "custom", id: input.voice.voiceId },
    };

    // 1. Create avatar — response includes status (PROCESSING | READY | FAILED).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const avatar = await (client as any).avatars.create(params);
    const avatarId: string = avatar.id;

    if (avatar.status === "READY") return { avatarId };
    if (avatar.status === "FAILED") {
      throw new Error(
        `Avatar ${avatarId} (${input.name}) FAILED at create: ${avatar.failureReason ?? "(no reason given)"}`
      );
    }

    // 2. Status is PROCESSING — poll retrieve() until READY. Avatar provisioning
    //    takes ~15-90s in practice. Cap at 3 min to fail loudly rather than hang.
    const start = Date.now();
    const TIMEOUT_MS = 180_000;
    while (Date.now() - start < TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, 2_000));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const polled = await (client as any).avatars.retrieve(avatarId);
      if (polled.status === "READY") return { avatarId };
      if (polled.status === "FAILED") {
        throw new Error(
          `Avatar ${avatarId} (${input.name}) FAILED while processing: ${polled.failureReason ?? "(no reason given)"}`
        );
      }
      // status === "PROCESSING" — keep waiting
    }

    throw new Error(
      `Avatar ${avatarId} (${input.name}) did not reach READY within ${TIMEOUT_MS / 1000}s`
    );
  });
}

export type CreateSessionInput = {
  avatarId: string;
  /** Per-session override of the persona's base personality. ≤10K chars. */
  personality?: string;
  /** Per-session override of the avatar's opening line. ≤2K chars. */
  startScript?: string;
  /**
   * Optional tools available to the avatar during this session.
   * - `client_event` tools fire as `useClientEvent` events on the React SDK
   *   side (fire-and-forget; the avatar doesn't wait for a response).
   * - `backend_rpc` tools (not used here yet) hit a registered webhook on
   *   our backend and the avatar awaits the response.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools?: any[];
  /** Maximum session duration in seconds. When the cap is reached the session
   *  ends. Default left to Runway's server-side default if omitted. */
  maxDurationSeconds?: number;
};

/**
 * What the client needs to connect to a realtime session via the
 * `@runwayml/avatars-react` SDK. The React SDK accepts `{ sessionId, sessionKey }`
 * via `<AvatarProvider>` / `<AvatarCall>` and handles the `/consume` round-trip
 * itself — we don't need to consume server-side.
 */
export type SessionCredentials = {
  sessionId: string;
  sessionKey: string;
};

/**
 * Create a realtime session and poll until it's READY. Returns the sessionId
 * and the sessionKey the React SDK uses to call /consume.
 *
 * Note: the SDK's `realtimeSessions.create()` returns ONLY `{ id }` — no
 * status. We must poll `retrieve()` at least once before checking status.
 * The SDK doesn't expose a `consume` method (the React-side SDK handles that
 * leg), so we don't call it here.
 */
export async function createReadySession(
  input: CreateSessionInput
): Promise<SessionCredentials> {
  return withSlot(async () => {
    const client = getRunwayClient();

    // 1. Create session — response is just `{ id }`.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = await (client as any).realtimeSessions.create({
      model: RUNWAY_MODELS.CHARACTERS,
      avatar: { type: "custom", avatarId: input.avatarId },
      ...(input.personality ? { personality: input.personality } : {}),
      ...(input.startScript ? { startScript: input.startScript } : {}),
      ...(input.tools && input.tools.length > 0 ? { tools: input.tools } : {}),
      ...(input.maxDurationSeconds
        ? { maxDuration: input.maxDurationSeconds }
        : {}),
    });
    const sessionId: string = session.id;

    // 2. Poll retrieve() until status === "READY". On READY the response
    //    includes `sessionKey` — that's what the React SDK uses for /consume.
    const start = Date.now();
    const TIMEOUT_MS = 90_000;
    let sessionKey: string | undefined;

    while (Date.now() - start < TIMEOUT_MS) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const polled = await (client as any).realtimeSessions.retrieve(sessionId);
      const status: string = polled?.status;

      if (status === "READY") {
        sessionKey = polled.sessionKey;
        break;
      }
      if (status === "FAILED") {
        throw new Error(
          `Realtime session ${sessionId} FAILED: ${polled.failure ?? "(no message)"} (${polled.failureCode ?? "no code"})`
        );
      }
      if (status === "CANCELLED") {
        throw new Error(`Realtime session ${sessionId} CANCELLED`);
      }
      // status is "NOT_READY" (or undefined the very first poll if Runway
      // is slow to assign one) — wait and retry.
      await new Promise((r) => setTimeout(r, 1500));
    }

    if (!sessionKey) {
      throw new Error(
        `Realtime session ${sessionId} did not reach READY within ${TIMEOUT_MS}ms`
      );
    }

    return { sessionId, sessionKey };
  });
}

export type CreateCustomVoiceInput =
  | { name: string; from: { type: "text"; prompt: string; model?: "eleven_ttv_v3" | "eleven_multilingual_ttv_v2" } }
  | { name: string; from: { type: "audio"; audio: string } };

/**
 * Create a custom voice. Async — caller must poll until status is READY
 * before assigning to an avatar. Returns the new voice ID immediately.
 *
 * Used at director-persona bootstrap time to design 20 voices via text prompts.
 */
export async function createCustomVoice(
  input: CreateCustomVoiceInput
): Promise<{ voiceId: string }> {
  return withSlot(async () => {
    const client = getRunwayClient();
    const params: Record<string, unknown> = {
      name: input.name,
      from:
        input.from.type === "text"
          ? {
              type: "text",
              prompt: input.from.prompt,
              model: input.from.model ?? "eleven_ttv_v3",
            }
          : { type: "audio", audio: input.from.audio },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const voice = await (client as any).customVoices.create(params);
    return { voiceId: voice.id };
  });
}

export async function pollVoiceReady(voiceId: string, timeoutMs = 60_000): Promise<void> {
  const client = getRunwayClient();
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = await (client as any).customVoices.retrieve(voiceId);
    if (v.status === "READY") return;
    if (v.status === "FAILED") throw new Error(`Custom voice ${voiceId} failed`);
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Custom voice ${voiceId} did not reach READY within ${timeoutMs}ms`);
}
