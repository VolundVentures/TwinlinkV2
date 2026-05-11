// Backend-RPC handler lifecycle for Runway Characters API sessions.
//
// The Characters API supports `backend_rpc` tools — round-trip tool calls that
// the avatar's LLM brain makes to OUR backend mid-conversation. Unlike
// `client_event` (fire-and-forget tools that go to the browser), backend_rpc
// tools BLOCK on a response. They're the architectural answer to the
// "frozen persona" problem: the director can ASK us for live project state
// instead of guessing from session-create-time context.
//
// Per the Runway docs (https://docs.dev.runwayml.com/characters/tools/server-tools/),
// the backend doesn't expose an HTTP webhook. Instead, we open a WebSocket
// connection FROM our backend INTO the LiveKit room hosting the session,
// using `@runwayml/avatars-node-rpc`. Per-session, one connection. When the
// session ends or our process restarts, we close the handler.
//
// This module owns the lifecycle: start, look up, stop. Handlers live in a
// module-scoped Map keyed by sessionId. Auto-cleanup on inactivity prevents
// orphaned handlers from leaking after dev-server restarts or unclean ends.

import type { RpcHandler, ToolHandler } from "@runwayml/avatars-node-rpc";

// LAZY IMPORT. The @runwayml/avatars-node-rpc package transitively loads
// @livekit/rtc-node, which has native OS-specific bindings. If those fail
// (wrong platform, missing build tools, sandboxed env), the import throws
// at module load and would crash the route. We resolve it on first use and
// gracefully disable RPC if it can't load — the rest of the session flow
// keeps working.
type CreateRpcHandlerFn = typeof import("@runwayml/avatars-node-rpc").createRpcHandler;
let _createRpcHandler: CreateRpcHandlerFn | null = null;
let _loadAttempted = false;
async function loadCreateRpcHandler(): Promise<CreateRpcHandlerFn | null> {
  if (_loadAttempted) return _createRpcHandler;
  _loadAttempted = true;
  try {
    const mod = await import("@runwayml/avatars-node-rpc");
    _createRpcHandler = mod.createRpcHandler;
    return _createRpcHandler;
  } catch (err) {
    console.warn(
      "[rpc-manager] @runwayml/avatars-node-rpc failed to load — backend_rpc disabled:",
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry — sessionId → handler.
// ─────────────────────────────────────────────────────────────────────────────

type ManagedHandler = {
  handler: RpcHandler;
  generationId: string;
  startedAt: number;
};

const handlers = new Map<string, ManagedHandler>();

// Auto-cleanup: any handler older than the session cap should already be dead
// on Runway's side. We close ours after 35 minutes (5 min past the 30 min
// session cap) just to be safe and avoid leaking sockets.
const HANDLER_TTL_MS = 35 * 60 * 1000;
let janitorTimer: ReturnType<typeof setInterval> | null = null;

function startJanitor() {
  if (janitorTimer) return;
  janitorTimer = setInterval(() => {
    const now = Date.now();
    for (const [sessionId, m] of handlers) {
      if (now - m.startedAt > HANDLER_TTL_MS) {
        console.log(`[rpc-manager] janitor closing stale handler ${sessionId}`);
        m.handler.close().catch(() => {});
        handlers.delete(sessionId);
      }
    }
  }, 60_000);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export type StartHandlerInput = {
  /** Runway realtime session id (the conversation id). */
  sessionId: string;
  /** Generation/project id — passed to every tool handler. */
  generationId: string;
  /** Tool name → async function. Keys MUST match the backend_rpc tool names
   *  declared in the session's tools array. */
  tools: Record<string, ToolHandler>;
};

export async function startSessionRpc(
  input: StartHandlerInput
): Promise<RpcHandler | null> {
  const apiKey = process.env.RUNWAYML_API_SECRET;
  if (!apiKey) {
    console.warn("[rpc-manager] RUNWAYML_API_SECRET missing — backend_rpc disabled");
    return null;
  }

  // If a handler already exists for this session, close it first — the
  // session may have been recreated.
  const existing = handlers.get(input.sessionId);
  if (existing) {
    await existing.handler.close().catch(() => {});
    handlers.delete(input.sessionId);
  }

  startJanitor();

  const createFn = await loadCreateRpcHandler();
  if (!createFn) {
    // Native deps couldn't load. RPC disabled; session itself still works.
    return null;
  }

  try {
    const handler = await createFn({
      apiKey,
      sessionId: input.sessionId,
      tools: input.tools,
      onConnected: () => {
        console.log(`[rpc-manager] connected ${input.sessionId} (gen ${input.generationId})`);
      },
      onDisconnected: () => {
        console.log(`[rpc-manager] disconnected ${input.sessionId}`);
        handlers.delete(input.sessionId);
      },
      onError: (err) => {
        console.warn(`[rpc-manager] error in ${input.sessionId}:`, err.message);
      },
      debug: false,
    });
    handlers.set(input.sessionId, {
      handler,
      generationId: input.generationId,
      startedAt: Date.now(),
    });
    return handler;
  } catch (err) {
    console.warn(
      `[rpc-manager] failed to start handler for ${input.sessionId}:`,
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}

export async function stopSessionRpc(sessionId: string): Promise<void> {
  const m = handlers.get(sessionId);
  if (!m) return;
  await m.handler.close().catch(() => {});
  handlers.delete(sessionId);
}

export function getActiveHandlerCount(): number {
  return handlers.size;
}
