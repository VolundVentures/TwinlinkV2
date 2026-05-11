import {
  streamWithTools,
  type AnthropicMessage,
  type ContentBlock,
  type ToolUseBlock,
} from "@/lib/ai/claude";
import type {
  AgentContext,
  ToolResult,
  SSEEmitter as SSEEmitterShape,
} from "@/lib/ai/tools/types";
import { TOOL_CREDIT_COSTS, TOOL_TIMEOUTS } from "@/lib/ai/tools/types";
import { SSEEmitter } from "@/lib/ai/sse-emitter";
import { getCredits } from "@/lib/credits";
import { db } from "@/lib/db";
import { buildAgentSystemPrompt } from "@/lib/ai/agent-system-prompt";
import { buildProjectState, renderProjectStateSection } from "@/lib/ai/project-state";
import { getToolDefinitions, getToolHandler } from "@/lib/ai/tools/registry";

const MAX_TURNS = 30;
const MAX_TOOL_CALLS = 60;

/**
 * Tools that produce user-facing assets. After any of these run, the agent
 * MUST follow up with request_approval — otherwise the UI has no buttons and
 * the workflow stalls. If the agent forgets, we inject a reminder message.
 */
const ASSET_PRODUCING_TOOLS = new Set([
  "generate_plate",
  "edit_plate",
  "generate_keyframe",
  "generate_image",
  "generate_video",
  "edit_video",
  "generate_coverage",
  "apply_signature_pass",
  "apply_director_note",
  "compose_video",
]);

/** Infer which stage a given tool's output belongs to. */
function stageForTool(name: string): "plates" | "keyframes" | "shots" | "final_cut" | null {
  if (name === "generate_plate" || name === "edit_plate") return "plates";
  if (name === "generate_keyframe" || name === "generate_image") return "keyframes";
  if (
    name === "generate_video" ||
    name === "edit_video" ||
    name === "generate_coverage" ||
    name === "apply_signature_pass" ||
    name === "apply_director_note"
  )
    return "shots";
  if (name === "compose_video") return "final_cut";
  return null;
}

/**
 * Walk the conversation history in reverse looking for the most recent
 * assistant turn that produced assets. If that turn did NOT include a
 * request_approval call, return the stage that still needs approval.
 * Otherwise null.
 */
function lastAssetStageNeedingApproval(
  messages: AnthropicMessage[]
): "plates" | "keyframes" | "shots" | "final_cut" | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant" || typeof m.content === "string") continue;
    const tools = (m.content as ContentBlock[]).filter(
      (b): b is ToolUseBlock => b.type === "tool_use"
    );
    if (tools.length === 0) continue;
    const hadAssetTool = tools.some((t) => ASSET_PRODUCING_TOOLS.has(t.name));
    const hadApproval = tools.some((t) => t.name === "request_approval");
    if (!hadAssetTool) return null; // most recent asset-producing turn already handled
    if (hadApproval) return null;
    // Pick the stage from the first asset-producing tool in this turn
    for (const t of tools) {
      const stage = stageForTool(t.name);
      if (stage) return stage;
    }
    return null;
  }
  return null;
}

/**
 * Flatten the internal Anthropic message array into a compact text form for
 * persistence. Tool-use blocks become a one-line summary; tool_result blocks
 * get trimmed. On resume, the agent gets this as conversationHistory — the
 * current project state is re-read from DB anyway.
 */
function serializeMessages(
  messages: AnthropicMessage[]
): Array<{ role: "user" | "assistant"; content: string }> {
  const out: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const m of messages) {
    if (typeof m.content === "string") {
      out.push({ role: m.role, content: m.content });
      continue;
    }
    const parts: string[] = [];
    for (const b of m.content) {
      if (b.type === "text") parts.push(b.text);
      else if (b.type === "tool_use") {
        const input = JSON.stringify(b.input).slice(0, 400);
        parts.push(`[called ${b.name}(${input})]`);
      } else if (b.type === "tool_result") {
        const text = typeof b.content === "string" ? b.content : JSON.stringify(b.content);
        parts.push(`[result: ${text.slice(0, 400)}]`);
      }
      // thinking blocks are dropped — they have signatures tied to a specific
      // API call and can't be replayed anyway
    }
    const joined = parts.join("\n").trim();
    if (joined) out.push({ role: m.role, content: joined });
  }
  return out;
}

/**
 * Core autonomous agent loop.
 *
 * Streams Claude responses to the frontend via SSE while executing tools
 * in a multi-turn conversation until the agent decides it is done or
 * safety limits are reached.
 */
export type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function runAgentLoop(
  context: AgentContext,
  userPrompt: string,
  emitter: SSEEmitter,
  sessionId: string,
  conversationHistory?: ConversationMessage[]
): Promise<void> {
  // Build messages: previous conversation history + current user prompt
  const messages: AnthropicMessage[] = [];

  // Inject previous conversation so the agent remembers what was discussed
  if (conversationHistory && conversationHistory.length > 0) {
    for (const msg of conversationHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }
    console.log(`[agent-loop] Loaded ${conversationHistory.length} previous messages for context`);
  }

  // Add the current user message
  messages.push({ role: "user", content: userPrompt });

  const toolDefs = getToolDefinitions();

  // Build the persistent project-state manifest from DB so the director
  // starts every run with full awareness of what's already been generated
  // (plates, keyframes, shots, final film). Resilient to context compaction
  // and session resumption.
  const projectState = await buildProjectState(context.generationId);
  const projectStateSection = renderProjectStateSection(projectState);
  if (projectStateSection) {
    console.log(
      `[agent-loop] Injecting project state — ${projectState.plates.length} plates, ${projectState.keyframes.length} keyframes, ${projectState.shots.length} shots`
    );
  }

  const staticSystemPrompt = buildAgentSystemPrompt(
    context.brand,
    context.language,
    context.allBrands,
    { durationSeconds: context.durationSeconds, aspectRatio: context.aspectRatio },
    { lead: context.leadDirector ?? null, co: context.coDirector ?? null }
  );

  // Split system into a cacheable static prefix + a non-cached dynamic suffix
  // (project state changes every turn as assets land; caching it would
  // invalidate the prefix). The static prefix is ~10k tokens — caching saves
  // ~60% of input-token cost across a multi-turn run.
  const systemBlocks: Array<{
    type: "text";
    text: string;
    cache_control?: { type: "ephemeral" };
  }> = [
    {
      type: "text",
      text: staticSystemPrompt,
      cache_control: { type: "ephemeral" },
    },
  ];
  if (projectStateSection) {
    systemBlocks.push({ type: "text", text: `\n${projectStateSection}\n` });
  }

  let totalToolCalls = 0;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    // Client disconnected / user clicked Stop — bail out immediately so we
    // stop paying for Claude turns and stop launching new Replicate jobs.
    if (context.signal?.aborted) {
      console.log(`[agent-loop] aborted before turn ${turn + 1} — exiting loop`);
      break;
    }
    console.log(
      `[agent-loop] Turn ${turn + 1}/${MAX_TURNS}, tool calls so far: ${totalToolCalls}`
    );

    // ----- Stream one Claude response -----
    let assistantContentBlocks: ContentBlock[];
    let stopReason: string;

    try {
      const result = await collectStreamResponse(
        systemBlocks,
        messages,
        toolDefs,
        emitter
      );
      assistantContentBlocks = result.contentBlocks;
      stopReason = result.stopReason;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[agent-loop] Claude API error:", errMsg);
      emitter.send("error", { message: `AI error: ${errMsg}` });
      break;
    }

    // Add the assistant message to the conversation
    messages.push({
      role: "assistant",
      content: assistantContentBlocks,
    });

    // ----- Collect tool_use blocks -----
    const toolUseBlocks = assistantContentBlocks.filter(
      (b): b is ToolUseBlock => b.type === "tool_use"
    );

    // If no tool calls and stop_reason is "end_turn", the agent thinks it's done.
    // BUT: if the previous turn ran asset-producing tools without request_approval,
    // the UI has no buttons. Nudge the agent to call request_approval instead of
    // just stopping — this is the gate discipline the user depends on.
    if (toolUseBlocks.length === 0 && stopReason === "end_turn") {
      const pendingStage = lastAssetStageNeedingApproval(messages);
      if (pendingStage) {
        console.warn(
          `[agent-loop] Agent ended turn without request_approval after producing ${pendingStage} assets — injecting nudge`
        );
        messages.push({
          role: "user",
          content: `REMINDER: you just produced ${pendingStage} assets but did not call request_approval(stage="${pendingStage}"). The user has no approval button right now. Call request_approval(stage="${pendingStage}", items=[...]) NOW, listing every current ${pendingStage} item. Do not ask me if you should — just do it.`,
        });
        continue; // loop once more to let the agent recover
      }
      console.log("[agent-loop] Agent finished (end_turn, no tool calls)");
      break;
    }

    // If there are no tool calls but stop_reason isn't end_turn
    // (e.g. max_tokens), also break to avoid infinite loop
    if (toolUseBlocks.length === 0) {
      console.warn(`[agent-loop] No tool calls, stop_reason: ${stopReason}`);
      if (stopReason !== "end_turn") {
        emitter.send("error", {
          message: `The director stopped unexpectedly (${stopReason}). The treatment may be incomplete. You can reply in the chat to continue, or re-pitch.`,
        });
      }
      break;
    }

    // ----- Execute tool calls -----
    if (totalToolCalls + toolUseBlocks.length > MAX_TOOL_CALLS) {
      emitter.send("agent_message", {
        content:
          "I've reached the maximum number of tool calls for this session. Here's a summary of what was accomplished so far.",
      });
      break;
    }

    // Budget check: estimate cost of upcoming tool calls
    if (context.budget && context.budget > 0) {
      const currentCredits = await getCredits(context.orgId);
      const estimatedCost = toolUseBlocks.reduce((sum, block) => {
        return sum + (TOOL_CREDIT_COSTS[block.name] || 5);
      }, 0);

      if (currentCredits < estimatedCost) {
        emitter.send("agent_message", {
          content: `Not enough credits for the next steps. You have ${currentCredits} credits but need ~${estimatedCost}. Please upgrade your plan to continue.`,
        });
        emitter.send("budget_exceeded", { remaining: currentCredits, needed: estimatedCost });
        break;
      }

      // Send budget update to frontend
      emitter.send("credits_update", {
        remaining: currentCredits,
        estimatedCost,
        budgetCap: context.budget,
      });
    }

    const toolResultBlocks = await executeToolCalls(
      toolUseBlocks,
      context,
      emitter
    );

    totalToolCalls += toolUseBlocks.length;

    // Add tool results as a user message (Anthropic format)
    messages.push({
      role: "user",
      content: toolResultBlocks,
    });

    // Checkpoint break: if the agent called request_approval, stop the loop.
    // The checkpoint_ready event was already emitted by the tool; the frontend
    // renders the approval UI. The user's next message resumes the loop via
    // the accumulated conversationHistory.
    const hitCheckpoint = toolUseBlocks.some((b) => b.name === "request_approval");
    if (hitCheckpoint) {
      console.log("[agent-loop] Checkpoint hit via request_approval — ending turn, awaiting user follow-up");
      break;
    }

    // Persist step progress + full message history to DB (best-effort).
    // Messages live here so a future session can load and resume the chat.
    try {
      await db
        .from("agent_sessions")
        .update({
          current_step: turn + 1,
          status: "active",
          messages: serializeMessages(messages),
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);
    } catch {
      // Non-critical — don't break the loop
    }
  }

  // Final flush so the last turn's messages are persisted even when the loop
  // exits via checkpoint/end_turn/budget/limit.
  try {
    await db
      .from("agent_sessions")
      .update({
        messages: serializeMessages(messages),
        status: "idle",
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);
  } catch {
    // ignore
  }

  // If we exhausted all turns without the agent finishing
  if (totalToolCalls >= MAX_TOOL_CALLS) {
    emitter.send("agent_message", {
      content:
        "Reached the maximum number of tool executions. Stopping here — please review the results above.",
    });
  }
}

// ============================================
// Stream collection
// ============================================

type StreamResult = {
  contentBlocks: ContentBlock[];
  stopReason: string;
};

/**
 * Calls streamWithTools and collects the full response, emitting
 * real-time SSE events to the frontend along the way.
 */
async function collectStreamResponse(
  systemBlocks: Array<{
    type: "text";
    text: string;
    cache_control?: { type: "ephemeral" };
  }>,
  messages: AnthropicMessage[],
  tools: ReturnType<typeof getToolDefinitions>,
  emitter: SSEEmitter
): Promise<StreamResult> {
  const contentBlocks: ContentBlock[] = [];
  let stopReason = "end_turn";

  // Track text block being assembled
  let currentText = "";

  const stream = streamWithTools({
    // Sonnet 4.6 runs the director agent loop. We tried Haiku 4.5 for speed
    // but Haiku jumps ahead in the asset chain — observed firing 3×
    // generate_video calls in parallel BEFORE any keyframe existed,
    // then back-filling keyframes a turn later. Sonnet respects the
    // hard dependency order (plates → keyframes → shots → compose) and
    // keeps to one stage per turn. Treatment generation stays on Haiku
    // (it's a single structured-JSON pass with no ordering risk).
    // Override with AGENT_MODEL=claude-haiku-4-5 to retry Haiku with
    // a stronger system prompt later.
    model: process.env.AGENT_MODEL || "claude-sonnet-4-6",
    system: systemBlocks,
    messages,
    tools,
  });

  for await (const event of stream) {
    switch (event.type) {
      case "thinking_done": {
        // Include thinking block with signature in content for API conversation history
        // (required by Anthropic — thinking blocks + signature must be preserved)
        contentBlocks.push({ type: "thinking", thinking: event.thinkingText, signature: event.signature });
        console.log(`[agent-loop] Thinking: ${event.thinkingText.length} chars`);
        break;
      }

      case "text_delta": {
        // Accumulate but DO NOT stream deltas to the client — the UX is cleaner
        // when only the completed message arrives as a single event, which the
        // chat pane then renders as a preview with "full version in workspace".
        currentText += event.text;
        break;
      }

      case "text_done": {
        if (event.fullText) {
          contentBlocks.push({ type: "text", text: event.fullText });
          emitter.send("agent_message", { content: event.fullText });
        }
        currentText = "";
        break;
      }

      case "tool_use_start": {
        emitter.send("tool_start", {
          toolCallId: event.id,
          toolName: event.name,
        });
        break;
      }

      case "tool_use_done": {
        const block: ToolUseBlock = {
          type: "tool_use",
          id: event.id,
          name: event.name,
          input: event.input,
        };
        contentBlocks.push(block);
        break;
      }

      case "message_done": {
        stopReason = event.stopReason;
        break;
      }
    }
  }

  // Handle edge case: text was streaming but text_done never fired
  if (currentText && !contentBlocks.some((b) => b.type === "text")) {
    contentBlocks.push({ type: "text", text: currentText });
    emitter.send("agent_message", { content: currentText });
  }

  return { contentBlocks, stopReason };
}

// ============================================
// Tool execution
// ============================================

/**
 * Execute all tool calls from a single assistant turn.
 * Runs them in parallel when there are multiple.
 */
async function executeToolCalls(
  toolUseBlocks: ToolUseBlock[],
  context: AgentContext,
  emitter: SSEEmitter
): Promise<ContentBlock[]> {
  const results = await Promise.all(
    toolUseBlocks.map((block) => executeToolCall(block, context, emitter))
  );

  return results;
}

/**
 * Execute a single tool call with credit checking, timeout, and error handling.
 * Returns a tool_result content block for the conversation.
 */
async function executeToolCall(
  block: ToolUseBlock,
  context: AgentContext,
  emitter: SSEEmitter
): Promise<ContentBlock> {
  const { id, name, input } = block;

  console.log(`[agent-loop] Executing tool: ${name} (id: ${id})`);

  // ----- Credit check -----
  const creditCost = TOOL_CREDIT_COSTS[name] ?? 0;
  if (creditCost > 0) {
    try {
      const balance = await getCredits(context.orgId);
      if (balance < creditCost) {
        const errorMsg = `Insufficient credits. Tool "${name}" costs ${creditCost} credits but you have ${balance}. Please purchase more credits to continue.`;
        emitter.send("tool_result", {
          toolCallId: id,
          toolName: name,
          success: false,
          content: errorMsg,
        });
        return {
          type: "tool_result",
          tool_use_id: id,
          content: errorMsg,
          is_error: true,
        };
      }
    } catch (err) {
      console.error(`[agent-loop] Credit check failed for ${name}:`, err);
      // Non-fatal — proceed with tool execution
    }
  }

  // ----- Get handler -----
  const handler = getToolHandler(name);
  if (!handler) {
    const errorMsg = `Unknown tool: "${name}". This tool is not available.`;
    emitter.send("tool_result", {
      toolCallId: id,
      toolName: name,
      success: false,
      content: errorMsg,
    });
    return {
      type: "tool_result",
      tool_use_id: id,
      content: errorMsg,
      is_error: true,
    };
  }

  // ----- Execute with timeout -----
  const timeoutMs = TOOL_TIMEOUTS[name] ?? 60_000;

  let result: ToolResult;
  try {
    result = await withTimeout(
      (signal) => handler(input, { ...context, signal }, emitter as unknown as SSEEmitterShape),
      timeoutMs,
      `Tool "${name}" timed out after ${Math.round(timeoutMs / 1000)}s`,
      context.signal
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[agent-loop] Tool "${name}" failed:`, errMsg);

    emitter.send("tool_result", {
      toolCallId: id,
      toolName: name,
      success: false,
      content: errMsg,
    });

    return {
      type: "tool_result",
      tool_use_id: id,
      content: `Tool execution failed: ${errMsg}`,
      is_error: true,
    };
  }

  // ----- Deduct credits on success -----
  if (result.success && creditCost > 0) {
    try {
      const balance = await getCredits(context.orgId);
      const newBalance = balance - creditCost;
      await db
        .from("credit_balances")
        .update({ balance: newBalance })
        .eq("org_id", context.orgId);

      await db.from("credit_transactions").insert({
        org_id: context.orgId,
        amount: -creditCost,
        type: "deduction",
        description: `Tool: ${name} (generation: ${context.generationId})`,
        balance_after: newBalance,
      });

      emitter.send("credits_deducted", {
        tool: name,
        cost: creditCost,
        balance: newBalance,
      });
    } catch (err) {
      console.error(`[agent-loop] Credit deduction failed for ${name}:`, err);
      // Non-fatal — the tool already succeeded
    }
  }

  // ----- Emit result + assets -----
  emitter.send("tool_result", {
    toolCallId: id,
    toolName: name,
    success: result.success,
    content: result.content,
  });

  // Emit asset_ready events for any produced assets
  if (result.assets && result.assets.length > 0) {
    for (const asset of result.assets) {
      emitter.send("asset_ready", {
        assetId: asset.assetId,
        type: asset.type,
        url: asset.url,
        metadata: asset.metadata,
      });
    }
  }

  return {
    type: "tool_result",
    tool_use_id: id,
    content: result.content,
    is_error: !result.success,
  };
}

// ============================================
// Utilities
// ============================================

function withTimeout<T>(
  promiseOrFactory: Promise<T> | ((signal: AbortSignal) => Promise<T>),
  ms: number,
  message: string,
  parentSignal?: AbortSignal
): Promise<T> {
  const controller = new AbortController();
  // If the parent (loop-level) signal aborts, cascade into the child so
  // in-flight tool calls stop immediately when the user clicks Stop.
  if (parentSignal) {
    if (parentSignal.aborted) controller.abort(parentSignal.reason);
    else parentSignal.addEventListener("abort", () => controller.abort(parentSignal.reason), { once: true });
  }
  const promise =
    typeof promiseOrFactory === "function"
      ? promiseOrFactory(controller.signal)
      : promiseOrFactory;

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error(message));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}
